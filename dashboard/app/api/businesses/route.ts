import { supabaseAdmin } from "@/lib/supabase/client";

// ── GET: return all businesses for the authenticated user ─────────────────────
export async function GET(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
  console.log("[GET /api/businesses] token present:", !!token, token?.substring(0, 20));
  if (!token) return Response.json({ businesses: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin() as any;
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  console.log("[GET /api/businesses] user:", user?.id ?? "null", authErr?.message ?? "");
  if (!user) return Response.json({ businesses: [] });

  const { data: members } = await db
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id);

  const ids = (members ?? []).map((m: { business_id: string }) => m.business_id);
  console.log("[GET /api/businesses] member ids:", ids);
  if (ids.length === 0) return Response.json({ businesses: [] });

  const { data: bizData, error: bizErr } = await db
    .from("businesses")
    .select("id, name, plan")
    .in("id", ids);

  console.log("[GET /api/businesses] returning", bizData?.length ?? 0, "businesses, err:", bizErr?.message ?? "none");
  return Response.json({ businesses: bizData ?? [] });
}

export async function POST(req: Request) {
  // ── Auth — verify via Bearer token sent by the browser client ───────────────
  const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (!token) return Response.json({ error: "Unauthorised" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin() as any;
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorised" }, { status: 401 });

  // ── Validate body ───────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const name     = (body.name     ?? "").trim();
  const timezone = (body.timezone ?? "").trim();
  if (!name)     return Response.json({ error: "Name is required" },     { status: 400 });
  if (!timezone) return Response.json({ error: "Timezone is required" }, { status: 400 });
  if (!body.phone?.trim() && !body.email?.trim()) {
    return Response.json({ error: "Phone or email is required" }, { status: 400 });
  }

  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) + "-" + Date.now().toString(36);

  // ── Insert business ─────────────────────────────────────────────────────────
  const { data: biz, error: bizErr } = await db
    .from("businesses")
    .insert({
      name,
      slug,
      phone:             body.phone             ?? null,
      email:             body.email             ?? null,
      address:           body.address           ?? null,
      city:              body.city              ?? null,
      country:           body.country           ?? null,
      website:           body.website           ?? null,
      description:       body.description       ?? null,
      hours:             body.hours ? JSON.stringify(body.hours) : null,
      timezone,
      owner_id:          user.id,
      approved:          true,
      plan:              body.plan              ?? "free",
    })
    .select("id, name, plan")
    .single();

  if (bizErr) return Response.json({ error: bizErr.message }, { status: 500 });

  // ── Add owner as member ─────────────────────────────────────────────────────
  await db.from("business_members").insert({
    business_id: biz.id,
    user_id:     user.id,
    role:        "owner",
  });

  // ── Link shared ElevenLabs agent (optional) ─────────────────────────────────
  const agentId   = (body.agent_id   ?? "").trim();
  const agentName = (body.agent_name ?? "").trim();
  if (agentId) {
    await db.from("agents").insert({
      business_id:         biz.id,
      elevenlabs_agent_id: agentId,
      name:                agentName || agentId,
      active:              true,
      calendar_config:     {},
    });
  }

  // ── Link additional ElevenLabs agent for migrate mode ──────────────────────
  const extraAgentId = (body.extra_agent_id ?? "").trim();
  if (extraAgentId) {
    await db.from("agents").insert({
      business_id:         biz.id,
      elevenlabs_agent_id: extraAgentId,
      name:                `Imported (${extraAgentId.slice(0, 14)}…)`,
      active:              true,
      calendar_config:     {},
    });
  }

  return Response.json({ business: biz }, { status: 201 });
}
