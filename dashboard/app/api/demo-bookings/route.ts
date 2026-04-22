import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { SERVICE_CATALOGUE, BARBER_NAME_POOL, rInt, pick, pickN } from "@/lib/barbers";
import { DemoBookingsRequestSchema, parseJson } from "@/lib/validation";

// Durations (minutes) for each catalogue service — server-only concern
const SERVICE_DURATIONS: Record<string, number> = {
  Haircut: 30,
  "Beard Trim": 20,
  "Full Shave": 25,
  "Haircut + Beard Combo": 45,
  "Kids Cut": 20,
  "Hair Styling": 40,
  "Eyebrow Grooming": 10,
};
const SERVICES = SERVICE_CATALOGUE.map((s) => ({ ...s, duration: SERVICE_DURATIONS[s.name] ?? 30 }));

// ── Demo client name pool ─────────────────────────────────────────────────────
const CLIENTS_F = [
  "Alexandros",
  "Dimitrios",
  "Nikolaos",
  "Georgios",
  "Konstantinos",
  "Ioannis",
  "Vasileios",
  "Christos",
  "Athanasios",
  "Michail",
  "Theodoros",
  "Spyridon",
  "Evangelos",
  "Andreas",
  "Petros",
  "Stelios",
  "Nikos",
  "Kostas",
  "Takis",
  "Manolis",
  "Makis",
  "Sakis",
  "Giannis",
  "Thanasis",
  "Giorgos",
  "Leonidas",
  "Thanos",
  "Babis",
  "Lefteris",
];
const CLIENTS_L = [
  "Papadopoulos",
  "Papadimitriou",
  "Nikolaou",
  "Georgiou",
  "Konstantinidis",
  "Ioannou",
  "Alexiou",
  "Vasiliou",
  "Christodoulou",
  "Petrou",
  "Stavropoulos",
  "Papageorgiou",
  "Anastasiou",
  "Karamanlis",
  "Dimos",
  "Lambrakis",
  "Zografos",
  "Mpournazos",
];
const LANGS = ["Greek", "Greek", "Greek", "Greek", "English", "Greek", "Albanian", "Bulgarian"];

// Words that should never be treated as a personal name
const NOT_A_NAME = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "at",
  "in",
  "on",
  "by",
  "for",
  "to",
  "de",
  "la",
  "el",
  "los",
  "das",
  "die",
  "der",
  "και",
]);

/**
 * Try to extract barber first names from the agent's system prompt.
 * Looks for English and Greek patterns like:
 *   "barbers: Kostas, Nikos, Makis"
 *   "barbers are Kostas and Nikos"
 *   "κουρείς: Κώστας, Νίκος"
 * Returns empty array if nothing found — caller falls back to BARBER_NAME_POOL.
 */
function extractBarbersFromPrompt(prompt: string): string[] {
  const patterns = [
    /barbers?\s*[:\-–]\s*([^\n.]{3,80})/i,
    /barbers?\s+are\s+([^\n.]{3,80})/i,
    /team\s*[:\-–]\s*([^\n.]{3,80})/i,
    /staff\s*[:\-–]\s*([^\n.]{3,80})/i,
    /κομμωτ[έε]ς?\s*[:\-–]\s*([^\n.]{3,80})/i,
    /προσωπικό\s*[:\-–]\s*([^\n.]{3,80})/i,
  ];
  for (const re of patterns) {
    const m = prompt.match(re);
    if (!m) continue;
    const names = m[1]
      .split(/[,;&]|\band\b|\bκαι\b/i)
      .map((s) => s.trim().split(/\s+/)[0]) // first word only
      .map((s) => s.replace(/[^A-Za-zΑ-Ωα-ωά-ώ]/g, "")) // strip punctuation
      .filter((s) => s.length >= 2 && /^[A-ZΑ-Ω]/u.test(s) && !NOT_A_NAME.has(s.toLowerCase()));
    if (names.length >= 1) return names;
  }
  return [];
}

/** Fallback barbers when ElevenLabs returns nothing useful. */
function fallbackBarbers(shopName: string): string[] {
  const seed =
    shopName
      .trim()
      .split(/\s+/)
      .find((w) => w.length >= 3 && /^[A-Z]/.test(w) && !NOT_A_NAME.has(w.toLowerCase())) ?? null;
  const pool = seed ? BARBER_NAME_POOL.filter((n) => n !== seed) : BARBER_NAME_POOL;
  return seed ? [seed, ...pickN(pool, 2)] : pickN(BARBER_NAME_POOL, 3);
}

// ── POST: generate demo bookings for a business ───────────────────────────────
export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const parsed = await parseJson(req, DemoBookingsRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { business_id: businessId, shop_name: shopName = "", regenerate = false, barber_names = [] } = parsed.data;
  const providedBarbers: string[] = barber_names;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin() as any;
  const {
    data: { user },
    error: authErr,
  } = await db.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Confirm the user is a member of this business
  const { data: membership } = await db
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── If regenerating: wipe existing calls + appointments for this business ──
  if (regenerate) {
    await Promise.all([
      db.from("calls").delete().eq("business_id", businessId),
      db.from("appointments").delete().eq("business_id", businessId),
    ]);
  }

  // ── Resolve barber names (provided > ElevenLabs prompt > fallback) ──────────
  let barbers: string[] = providedBarbers;

  if (barbers.length === 0) {
    const { data: agentRows } = await db
      .from("agents")
      .select("elevenlabs_agent_id")
      .eq("business_id", businessId)
      .limit(1);

    const agentId = agentRows?.[0]?.elevenlabs_agent_id as string | undefined;
    const EL_KEY = process.env.ELEVENLABS_API_KEY;

    if (agentId && EL_KEY) {
      try {
        const agentRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
          headers: { "xi-api-key": EL_KEY },
          cache: "no-store",
        });
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          const prompt: string = agentData?.conversation_config?.agent?.prompt?.prompt ?? "";
          barbers = extractBarbersFromPrompt(prompt);
        }
      } catch {
        // non-fatal — fall through to fallback below
      }
    }
  }

  if (barbers.length === 0) barbers = fallbackBarbers(shopName);

  // ── Build a shuffled source list guaranteeing ≥5 of each type ───────────────
  // Fixed minimums: 8 agent, 7 walk-in, 5 human-call, 5 website, 5 manual = 30
  // Then pad to 45 with weighted random extras
  const BASE_SOURCES: string[] = [
    ...Array(8).fill("agent"),
    ...Array(7).fill("walk-in"),
    ...Array(5).fill("human-call"),
    ...Array(5).fill("website"),
    ...Array(5).fill("manual"),
  ];
  const SOURCE_WEIGHTS: { src: string; max: number }[] = [
    { src: "agent", max: 0.4 },
    { src: "walk-in", max: 0.65 },
    { src: "human-call", max: 0.8 },
    { src: "website", max: 0.92 },
    { src: "manual", max: 1.0 },
  ];
  const extraCount = rInt(10, 15);
  for (let e = 0; e < extraCount; e++) {
    const r = Math.random();
    BASE_SOURCES.push(SOURCE_WEIGHTS.find((w) => r < w.max)!.src);
  }
  // Shuffle Fisher-Yates
  for (let i = BASE_SOURCES.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [BASE_SOURCES[i], BASE_SOURCES[j]] = [BASE_SOURCES[j], BASE_SOURCES[i]];
  }
  let sourceIdx = 0;
  function nextSource(): string {
    return BASE_SOURCES[sourceIdx++ % BASE_SOURCES.length];
  }

  // ── Status distributions per source ────────────────────────────────────────
  function pickStatus(source: string): { callStatus: string; apptStatus: string; callOk: string | null } {
    const r = Math.random();
    if (source === "agent") {
      // AI calls: mix of successes, no-answers, cancellations, failures
      if (r < 0.45) return { callStatus: "done", apptStatus: "completed", callOk: "true" };
      else if (r < 0.6) return { callStatus: "done", apptStatus: "confirmed", callOk: "true" };
      else if (r < 0.7) return { callStatus: "done", apptStatus: "cancelled", callOk: "true" };
      else if (r < 0.8) return { callStatus: "missed", apptStatus: "no_show", callOk: "false" };
      else if (r < 0.9) return { callStatus: "cancelled", apptStatus: "cancelled", callOk: "false" };
      else return { callStatus: "failed", apptStatus: "failed", callOk: "false" };
    }
    if (source === "walk-in") {
      // Walk-ins almost always show up
      if (r < 0.7) return { callStatus: "done", apptStatus: "completed", callOk: null };
      else if (r < 0.85) return { callStatus: "done", apptStatus: "confirmed", callOk: null };
      else if (r < 0.93) return { callStatus: "done", apptStatus: "cancelled", callOk: null };
      else return { callStatus: "done", apptStatus: "no_show", callOk: null };
    }
    if (source === "website") {
      // Online bookings: mostly confirmed/completed, some cancellations
      if (r < 0.5) return { callStatus: "done", apptStatus: "confirmed", callOk: null };
      else if (r < 0.75) return { callStatus: "done", apptStatus: "completed", callOk: null };
      else if (r < 0.88) return { callStatus: "done", apptStatus: "cancelled", callOk: null };
      else return { callStatus: "done", apptStatus: "no_show", callOk: null };
    }
    // human-call / manual: good show rate
    if (r < 0.55) return { callStatus: "done", apptStatus: "completed", callOk: null };
    else if (r < 0.75) return { callStatus: "done", apptStatus: "confirmed", callOk: null };
    else if (r < 0.88) return { callStatus: "done", apptStatus: "cancelled", callOk: null };
    else return { callStatus: "done", apptStatus: "no_show", callOk: null };
  }

  // ── Generate bookings ─────────────────────────────────────────────────────
  const now = new Date();
  const count = BASE_SOURCES.length;
  const callRows: object[] = [];
  const apptRows: object[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    // Spread across 90 days, weighted toward recent (last 30 days more likely)
    const daysAgo = Math.random() < 0.55 ? rInt(0, 30) : rInt(30, 90);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split("T")[0];
    // Barbershop hours: 09:00–18:30 in 30-min slots
    const hour = rInt(9, 18);
    const minutes = hour === 18 ? "00" : Math.random() < 0.5 ? "00" : "30";
    const timeStr = `${String(hour).padStart(2, "0")}:${minutes}:00`;
    const lang = pick(LANGS);

    const source = nextSource();
    const { callStatus, apptStatus, callOk } = pickStatus(source);

    const client = `${pick(CLIENTS_F)} ${pick(CLIENTS_L)}`;
    const phone = `+30 69${rInt(10, 99)} ${rInt(100, 999)} ${rInt(100, 999)}`;

    // ── Pick 1–3 services; assign a barber per service ──────────────────────
    const isFailed = apptStatus === "failed";
    // Walk-ins more likely to get combo services; website tends to single service
    const svcRnd = Math.random();
    const svcCount = isFailed
      ? 1
      : source === "website"
        ? svcRnd < 0.8
          ? 1
          : 2
        : source === "walk-in"
          ? svcRnd < 0.4
            ? 1
            : svcRnd < 0.75
              ? 2
              : 3
          : svcRnd < 0.5
            ? 1
            : svcRnd < 0.8
              ? 2
              : 3;
    const chosen = pickN(SERVICES, svcCount);

    const assignedBarbers = pickN(barbers, Math.min(barbers.length, svcCount));
    while (assignedBarbers.length < svcCount) assignedBarbers.push(pick(barbers));

    const services = chosen.map((svc, idx) => ({
      service: svc.name,
      barber: assignedBarbers[idx],
      price: svc.price,
      duration_minutes: svc.duration,
    }));

    const totalPrice = services.reduce((s, l) => s + l.price, 0);
    const totalDuration = services.reduce((s, l) => s + l.duration_minutes, 0);
    const primaryService = services[0];
    const serviceLabel = services.map((s) => s.service).join(" + ");

    if (source === "agent") {
      callRows.push({
        business_id: businessId,
        conversation_id: `demo-${businessId.slice(0, 8)}-${i}-${Date.now()}${rInt(0, 9999)}`,
        status: callStatus,
        source: "agent",
        client_name: client,
        phone_number: phone,
        service_type: serviceLabel,
        barber_name: primaryService.barber,
        appointment_date: dateStr,
        appointment_time: timeStr,
        price: isFailed ? 0 : totalPrice,
        duration_minutes: totalDuration,
        appointment_status: apptStatus,
        call_successful: callOk,
        call_duration_secs: isFailed ? rInt(8, 55) : rInt(90, 520),
        message_count: isFailed ? rInt(1, 5) : rInt(6, 24),
        call_language: lang === "Greek" ? "el" : "en",
        main_language: lang,
        raw_data: {},
      });
    }

    apptRows.push({
      business_id: businessId,
      source,
      client_name: client,
      phone_number: phone,
      service_type: serviceLabel,
      barber_name: primaryService.barber,
      appointment_date: dateStr,
      appointment_time: timeStr,
      price: isFailed ? 0 : totalPrice,
      duration_minutes: totalDuration,
      status: apptStatus,
      services: services,
    });
  }

  const [callsResult, apptsResult] = await Promise.all([
    callRows.length ? db.from("calls").insert(callRows) : Promise.resolve({ error: null }),
    apptRows.length ? db.from("appointments").insert(apptRows) : Promise.resolve({ error: null }),
  ]);

  const errors: string[] = [];
  if (callsResult?.error) errors.push(`calls: ${callsResult.error.message}`);
  if (apptsResult?.error) errors.push(`appointments: ${apptsResult.error.message}`);

  if (errors.length) {
    return NextResponse.json({
      warning: errors.join("; "),
      inserted: { calls: callRows.length, appointments: apptRows.length },
    });
  }

  return NextResponse.json({ inserted: { calls: callRows.length, appointments: apptRows.length } });
}
