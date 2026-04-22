/**
 * POST /api/admin/approve
 *
 * Approves or revokes a user account.
 * Caller must be an approved user with role "admin" or "owner".
 *
 * Body: { user_id: string, approved: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { AdminApproveSchema, parseJson } from "@/lib/validation";

export async function POST(req: NextRequest) {
  // Auth check — caller must be signed in and approved
  const caller = await createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: callerProfileRaw } = await caller.from("profiles").select("approved, role").eq("id", user.id).single();
  const callerProfile = callerProfileRaw as Pick<Profile, "approved" | "role"> | null;

  if (!callerProfile?.approved) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["admin", "owner"].includes(callerProfile.role ?? "")) {
    return NextResponse.json({ error: "Admin or owner role required" }, { status: 403 });
  }

  const parsed = await parseJson(req, AdminApproveSchema);
  if (!parsed.ok) return parsed.response;
  const { user_id, approved } = parsed.data;

  const db = supabaseAdmin();
  const { error } = await db
    .from("profiles")
    .update({ approved } as never)
    .eq("id", user_id);

  if (error) {
    console.error("[admin/approve]", error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_id, approved });
}

/**
 * GET /api/admin/approve — list pending users
 */
export async function GET(req: NextRequest) {
  const caller = await createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: callerProfileRaw2 } = await caller.from("profiles").select("approved, role").eq("id", user.id).single();
  const callerProfile2 = callerProfileRaw2 as Pick<Profile, "approved" | "role"> | null;

  if (!callerProfile2?.approved || !["admin", "owner"].includes(callerProfile2.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "pending"; // "pending" | "all"

  let query = db
    .from("profiles")
    .select("id, full_name, email, role, approved, created_at")
    .order("created_at", { ascending: false });
  if (filter === "pending") query = query.eq("approved", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data });
}
