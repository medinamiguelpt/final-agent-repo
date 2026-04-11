/**
 * GET /api/appointments?business_id=<uuid>
 *
 * Returns walk-in / manual appointments (call_id IS NULL) for a business,
 * formatted as AiBooking-compatible objects so they can be merged into the ledger.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

type ServiceItem = { service: string; barber?: string; price?: number; duration_minutes?: number };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get("business_id");

  if (!business_id) {
    return NextResponse.json({ error: "business_id is required" }, { status: 400 });
  }

  // Verify the caller is a member of this business via Bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  // Resolve user from token
  const { data: { user }, error: userErr } = await db.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check membership
  const { data: member } = await db
    .from("business_members")
    .select("user_id")
    .eq("business_id", business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch non-agent appointments (no call_id, and not agent-sourced — agent rows
  // are already returned by /api/elevenlabs/bookings and would duplicate here)
  const { data: rows, error: rowsErr } = await db
    .from("appointments")
    .select("*")
    .eq("business_id", business_id)
    .is("call_id", null)
    .neq("source", "agent")
    .order("created_at", { ascending: false });

  if (rowsErr) {
    console.error("[appointments] Supabase error:", rowsErr.message);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }

  type ApptRow = {
    id: string;
    business_id: string;
    source: string | null;
    client_name: string | null;
    service_type: string | null;
    barber_name: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    price: number | null;
    status: string;
    services: unknown | null;
    created_at: string;
  };

  // Map DB source strings to frontend SourceKey values
  function mapSource(raw: string | null): "ai-call" | "walk-in" | "human-call" | "website" | "manual" {
    switch (raw) {
      case "walk-in":    return "walk-in";
      case "human-call": return "human-call";
      case "website":    return "website";
      case "manual":     return "manual";
      default:           return "manual";
    }
  }

  const bookings = (rows as ApptRow[]).map(row => {
    const svcArr = Array.isArray(row.services) ? (row.services as ServiceItem[]) : null;

    // Format date as DD/MM from YYYY-MM-DD
    let date = "";
    if (row.appointment_date) {
      const parts = row.appointment_date.split("-"); // ["YYYY","MM","DD"]
      if (parts.length === 3) date = `${parts[2]}/${parts[1]}`;
    }

    // Format time as HH:MM
    const time = row.appointment_time ? row.appointment_time.slice(0, 5) : "";

    const service = svcArr?.[0]?.service ?? row.service_type ?? "—";
    const barber  = svcArr?.[0]?.barber  ?? row.barber_name  ?? "TBD";
    const price   = row.price ?? (svcArr ? svcArr.reduce((s, l) => s + (l.price ?? 0), 0) : 0);

    // Derive unix timestamp from appointment_date + appointment_time for sorting
    let start_time_unix_secs = 0;
    if (row.appointment_date && row.appointment_time) {
      const dt = new Date(`${row.appointment_date}T${time}:00`);
      if (!isNaN(dt.getTime())) start_time_unix_secs = Math.floor(dt.getTime() / 1000);
    }

    return {
      id:                    row.id,
      conversation_id:       `manual-${row.id}`,
      source:                mapSource(row.source),
      status:                row.status ?? "confirmed",
      client_name:           row.client_name ?? "Unknown",
      service,
      barber,
      services:              svcArr ?? undefined,
      date,
      time,
      price,
      duration_secs:         0,
      start_time_unix_secs,
      message_count:         0,
      summary:               "",
      call_status:           "done",
      business_id:           row.business_id,
      call_language:         "",
    };
  });

  return NextResponse.json({ bookings });
}

// ── POST /api/appointments — create a walk-in / manual appointment ───────────
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: { user }, error: userErr } = await db.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    business_id, client_name, phone_number, service_type, barber_name,
    appointment_date, appointment_time, duration_minutes, price, notes, source,
    services,
  } = body;

  if (!business_id) {
    return NextResponse.json({ error: "business_id is required" }, { status: 400 });
  }

  const { data: member } = await db
    .from("business_members")
    .select("user_id")
    .eq("business_id", business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await (db as never)
    .from("appointments")
    .insert({
      business_id,
      source:           source ?? "walk-in",
      client_name:      client_name ?? null,
      phone_number:     phone_number ?? null,
      service_type:     service_type ?? null,
      barber_name:      barber_name ?? null,
      appointment_date: appointment_date ?? null,
      appointment_time: appointment_time ?? null,
      duration_minutes: duration_minutes ?? null,
      price:            price ?? null,
      notes:            notes ?? null,
      status:           "confirmed",
      services:         services ?? null,
    })
    .select("id")
    .single();

  if (apptErr) {
    console.error("[POST /api/appointments]", apptErr.message);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }

  return NextResponse.json({ appointment: appt }, { status: 201 });
}
