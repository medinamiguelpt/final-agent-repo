/**
 * POST /api/elevenlabs/webhook
 *
 * Receives ElevenLabs post-call events and persists them to Supabase.
 * All registered agents fire to this single endpoint (workspace-level webhook).
 *
 * Supported event types:
 *   post_call_transcription — full transcript + analysis.data_collection_results → saved to DB
 *   post_call_audio         — acknowledged, not stored
 *   call_initiation_failure — logged as failed call in DB
 *
 * Security: HMAC-SHA256 via ElevenLabs-Signature header.
 * Set ELEVENLABS_WEBHOOK_SECRET in Vercel after configuring in ElevenLabs dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, dcr, DataCollectionValue } from "@/lib/elevenlabs/client";
import { supabaseAdmin } from "@/lib/supabase/client";

// ── Payload types ─────────────────────────────────────────────────────────────

interface TranscriptMessage {
  role: string;
  message: string | null;
  time_in_call_secs: number;
}

interface PostCallPayload {
  type: "post_call_transcription" | "post_call_audio" | "call_initiation_failure";
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: string;
    transcript?: TranscriptMessage[];
    metadata?: {
      start_time_unix_secs?: number;
      call_duration_secs?: number;
      main_language?: string;
    };
    analysis?: {
      transcript_summary?: string;
      call_successful?: string;
      termination_reason?: string;
      data_collection_results?: Record<string, DataCollectionValue>;
    };
    full_audio?: string;
    failure_reason?: string;
  };
}

// ── Resolve business_id from agent_id (dynamic DB lookup) ────────────────────

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";

// Simple in-memory cache to avoid a DB round-trip on every webhook call
const agentCache: Record<string, string> = {};

async function businessIdForAgent(agentId: string): Promise<string> {
  if (agentCache[agentId]) return agentCache[agentId];
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("agents").select("business_id").eq("elevenlabs_agent_id", agentId).single();
    const bid = (data as { business_id: string } | null)?.business_id ?? FALLBACK_BUSINESS_ID;
    agentCache[agentId] = bid;
    return bid;
  } catch {
    return FALLBACK_BUSINESS_ID;
  }
}

// ── Date/time helpers ─────────────────────────────────────────────────────────

function toIsoDate(raw: string): string | null {
  if (!raw) return null;
  // DD/MM/YYYY → YYYY-MM-DD
  const dm = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (dm) {
    const year = dm[3] ?? new Date().getFullYear().toString();
    return `${year}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function toIsoTime(raw: string): string | null {
  if (!raw) return null;
  // HH:MM or HH:MM:SS
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5) + ":00";
  return null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // Verify HMAC signature
  const signature = req.headers.get("elevenlabs-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PostCallPayload;
  try {
    payload = JSON.parse(rawBody) as PostCallPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data } = payload;
  console.log(`[webhook] ${type} conv=${data.conversation_id} agent=${data.agent_id}`);

  // Must return 200 quickly — do DB work async-safe
  if (type === "call_initiation_failure") {
    await persistCall({
      business_id: await businessIdForAgent(data.agent_id),
      conversation_id: data.conversation_id,
      status: "failed",
      message_count: 0,
      call_duration_secs: 0,
      appointment_status: "not_booked",
      raw_data: data as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true });
  }

  if (type === "post_call_audio") {
    return NextResponse.json({ ok: true });
  }

  if (type === "post_call_transcription") {
    const results = data.analysis?.data_collection_results;
    const priceRaw = dcr(results, "price_quoted");
    const durRaw = dcr(results, "duration_minutes");
    const cbRaw = results?.["callback_requested"]?.value;

    const apptDate = toIsoDate(dcr(results, "appointment_date", "date"));
    const apptTime = toIsoTime(dcr(results, "appointment_time", "time"));
    const apptStatus = dcr(results, "appointment_status", "status") || "not_booked";

    const callRow = {
      business_id: await businessIdForAgent(data.agent_id),
      conversation_id: data.conversation_id,
      status: data.status ?? "done",
      client_name: dcr(results, "client_name", "customer_name", "name") || null,
      phone_number: dcr(results, "phone_number", "phone") || null,
      service_type: dcr(results, "service_type", "service") || null,
      barber_name: dcr(results, "barber_name", "barber") || null,
      appointment_date: apptDate,
      appointment_time: apptTime,
      appointment_status: apptStatus,
      price: priceRaw ? parseFloat(priceRaw) : null,
      duration_minutes: durRaw ? parseInt(durRaw, 10) : null,
      special_requests: dcr(results, "special_requests", "notes") || null,
      call_language: dcr(results, "call_language", "language") || data.metadata?.main_language || null,
      callback_requested: cbRaw === true || cbRaw === "true",
      summary: data.analysis?.transcript_summary || null,
      call_duration_secs: data.metadata?.call_duration_secs ?? 0,
      message_count: (data.transcript ?? []).length,
      main_language: data.metadata?.main_language || null,
      call_successful: data.analysis?.call_successful || null,
      termination_reason: data.analysis?.termination_reason || null,
      source: "ai_call",
      raw_data: data as unknown as Record<string, unknown>,
    };

    const callId = await persistCall(callRow);

    // Also create/upsert an appointment row if the call resulted in a booking
    if (apptDate && apptStatus === "confirmed" && callId) {
      await persistAppointment({
        business_id: callRow.business_id,
        call_id: callId,
        source: "ai_call",
        client_name: callRow.client_name,
        phone_number: callRow.phone_number,
        service_type: callRow.service_type,
        barber_name: callRow.barber_name,
        appointment_date: apptDate,
        appointment_time: apptTime,
        duration_minutes: callRow.duration_minutes,
        price: callRow.price,
        status: "confirmed",
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

// ── Persistence helpers ───────────────────────────────────────────────────────

async function persistCall(row: Record<string, unknown>): Promise<string | null> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("calls")
      .upsert(row as never, { onConflict: "conversation_id" })
      .select("id")
      .single();
    if (error) {
      console.error("[webhook] persistCall error:", error.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    console.error("[webhook] persistCall threw:", e);
    return null;
  }
}

async function persistAppointment(row: Record<string, unknown>): Promise<void> {
  try {
    const db = supabaseAdmin();
    const { error } = await db.from("appointments").upsert(row as never, { onConflict: "call_id" });
    if (error) console.error("[webhook] persistAppointment error:", error.message);
  } catch (e) {
    console.error("[webhook] persistAppointment threw:", e);
  }
}
