import { NextResponse } from "next/server";
import type { Call } from "@/lib/supabase/types";
import { ACTIVE_AGENTS } from "@/lib/elevenlabs/agents";
import { supabaseAdmin } from "@/lib/supabase/client";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { listConversations, getConversation, dcr, ConvSummary, ConvDetail } from "@/lib/elevenlabs/client";

// ── Service detection ─────────────────────────────────────────────────────────
// Checked in priority order — first match wins

const SERVICE_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  {
    name: "Haircut + Beard Combo",
    patterns: [
      /combo/i,
      /haircut\s*(\+|and|&)\s*beard/i,
      /κούρεμα\s*(και|&|\+)\s*(γέν|μούσι|μπαρμπ)/i,
      /corte\s*y\s*barba/i,
      /full\s*(grooming\s*)?package/i,
      /πακέτο/i,
    ],
  },
  {
    name: "Full Shave",
    patterns: [
      /full\s*shave/i,
      /ξύρισμα/i,
      /afeitado/i,
      /rasage/i,
      /straight\s*razor/i,
      /traditional\s*shave/i,
      /hot\s*towel\s*shave/i,
      /head\s*shave/i,
      /shave\s*(my\s*)?head/i,
    ],
  },
  {
    name: "Beard Trim",
    patterns: [
      /beard\s*(trim|shap|groom|cut|style)/i,
      /trim\s*(my\s*)?beard/i,
      /arreglo\s*de\s*barba/i,
      /barba/i,
      /μούσι/i,
      /γενειάδα/i,
      /γένι(α)?/i,
      /\bbeard\b/i,
    ],
  },
  { name: "Eyebrow Grooming", patterns: [/eyebrow/i, /brow\s*(shap|trim|groom)/i, /cejas/i, /φρύδι(α|ων)?/i] },
  {
    name: "Kids Cut",
    patterns: [/kids?\s*cut/i, /child('?s)?\s*(hair)?cut/i, /παιδικό/i, /corte\s*(de\s*)?niño/i, /under\s*12/i],
  },
  {
    name: "Hair Styling",
    patterns: [/hair\s*styl/i, /styling/i, /στάιλ/i, /στάιλινγκ/i, /peinado/i, /coiffure/i, /frisur/i, /grooming/i],
  },
  {
    name: "Haircut",
    patterns: [
      /hair\s*cut/i,
      /haircut/i,
      /corte\s*(de\s*(pelo|cabello))?/i,
      /κούρεμα/i,
      /κόψ(ιμο|ω|ε)\s*(τα\s*)?μαλλιά/i,
      /\bcut\b/i,
      /coupe/i,
      /haarschnitt/i,
      /taglio/i,
    ],
  },
];

/** Returns the first matching service (for single-service fallback). */
function detectService(text: string): string {
  for (const { name, patterns } of SERVICE_PATTERNS) for (const re of patterns) if (re.test(text)) return name;
  return "";
}

/** Returns ALL matching services found in text, joined with " + ". */
function detectServices(text: string): string {
  const found: string[] = [];
  for (const { name, patterns } of SERVICE_PATTERNS) if (patterns.some((re) => re.test(text))) found.push(name);
  return found.join(" + ");
}

// ── Price extraction ──────────────────────────────────────────────────────────

// Standard prices — must match the agent prompt exactly
const SERVICE_DEFAULT_PRICES: Record<string, number> = {
  Haircut: 15,
  "Beard Trim": 10,
  "Full Shave": 12,
  "Haircut + Beard Combo": 22,
  "Kids Cut": 10,
  "Hair Styling": 20,
  "Eyebrow Grooming": 5,
};

/**
 * Try to find an explicit price mention in text.
 * Matches: €15, 15€, 15 euros, 15 eur, 15 ευρώ, £15, $15
 * Returns 0 if nothing found.
 */
function extractPrice(text: string): number {
  // "€15", "€ 15", "15€", "£15", "$15"
  const sym = text.match(/[€£\$]\s*(\d{1,3}(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{1,2})?)\s*[€£\$]/);
  if (sym) {
    const raw = (sym[1] ?? sym[2]).replace(",", ".");
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0 && n < 500) return n;
  }
  // "15 euros", "15 eur", "15 ευρώ", "15 euro"
  const word = text.match(/\b(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:euros?|eur\b|ευρώ|ευρω)\b/i);
  if (word) {
    const n = parseFloat(word[1].replace(",", "."));
    if (!isNaN(n) && n > 0 && n < 500) return n;
  }
  return 0;
}

// ── Time extraction (AM/PM aware) ─────────────────────────────────────────────

function extractTime(text: string): string {
  // "6:30 PM", "5:00 p.m.", "14:30", "10.30"
  const withAmPm = text.match(/\b(\d{1,2})[:\.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (withAmPm) {
    let h = parseInt(withAmPm[1]);
    const min = withAmPm[2];
    const meridiem = withAmPm[3].replace(/\./g, "").toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  // "6 PM", "5 pm"
  const ampmOnly = text.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (ampmOnly) {
    let h = parseInt(ampmOnly[1]);
    const meridiem = ampmOnly[2].replace(/\./g, "").toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:00`;
  }
  // 24h "14:30" (no meridiem)
  const hhmm = text.match(/\b(\d{1,2})[:\.](\d{2})\b/);
  if (hhmm) return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
  // Greek "στις δέκα"
  const greekNums: Record<string, number> = {
    δύο: 2,
    τρεις: 3,
    τέσσερις: 4,
    πέντε: 5,
    έξι: 6,
    εφτά: 7,
    επτά: 7,
    οχτώ: 8,
    οκτώ: 8,
    εννιά: 9,
    εννέα: 9,
    δέκα: 10,
    έντεκα: 11,
    δώδεκα: 12,
    μία: 1,
    μια: 1,
  };
  const greekM = text.match(/στις\s+([α-ωΑ-Ωά-ώ]+|\d{1,2})/i);
  if (greekM) {
    const w = greekM[1].toLowerCase();
    const h = greekNums[w] ?? parseInt(w);
    if (!isNaN(h)) return `${String(h).padStart(2, "0")}:00`;
  }
  return "";
}

// ── Date extraction ───────────────────────────────────────────────────────────

const TODAY_DT = new Date();
const DAY_OFFSETS: { re: RegExp; offset: (d: number) => number }[] = [
  { re: /\b(today|σήμερα|hoy|heute|aujourd'hui)\b/i, offset: () => 0 },
  { re: /\b(tomorrow|αύριο|mañana|morgen|demain)\b/i, offset: () => 1 },
  { re: /\b(monday|δευτέρα|lunes|montag|lundi)\b/i, offset: (d) => (8 - d) % 7 || 7 },
  { re: /\b(tuesday|τρίτη|martes|dienstag|mardi)\b/i, offset: (d) => (9 - d) % 7 || 7 },
  { re: /\b(wednesday|τετάρτη|miércoles|mittwoch|mercredi)\b/i, offset: (d) => (10 - d) % 7 || 7 },
  { re: /\b(thursday|πέμπτη|jueves|donnerstag|jeudi)\b/i, offset: (d) => (11 - d) % 7 || 7 },
  { re: /\b(friday|παρασκευή|viernes|freitag|vendredi)\b/i, offset: (d) => (12 - d) % 7 || 7 },
  { re: /\b(saturday|σάββατο|sábado|samstag|samedi)\b/i, offset: (d) => (13 - d) % 7 || 7 },
  { re: /\b(sunday|κυριακή|domingo|sonntag|dimanche)\b/i, offset: (d) => (14 - d) % 7 || 7 },
];

function extractDate(text: string): string {
  // Explicit DD/MM or YYYY-MM-DD
  const dm = text.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (dm) return `${dm[1].padStart(2, "0")}/${dm[2].padStart(2, "0")}`;
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const dow = TODAY_DT.getDay();
  for (const { re, offset } of DAY_OFFSETS) {
    if (re.test(text)) {
      const t = new Date(TODAY_DT);
      t.setDate(TODAY_DT.getDate() + offset(dow));
      return t.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
    }
  }
  return "";
}

function normalizeDate(raw: string): string {
  if (!raw) return "";
  if (/^\d{1,2}\/\d{1,2}/.test(raw)) return raw.slice(0, 5);
  return raw;
}

// ── Name extraction ───────────────────────────────────────────────────────────

const KNOWN_BARBERS = new Set(["nikos", "giorgos", "eleni", "petros"]);
const NON_NAMES = new Set([
  "okay",
  "ok",
  "yes",
  "no",
  "hi",
  "hello",
  "hey",
  "thank",
  "thanks",
  "sure",
  "great",
  "good",
  "sorry",
  "please",
  "can",
  "would",
  "could",
  "like",
  "need",
  "want",
  "have",
  "just",
  "know",
  "well",
  "right",
  "also",
  "may",
  "let",
  "see",
  "got",
  "get",
  "one",
  "mmm",
  "um",
  "uh",
  "ah",
  "oh",
  "hmm",
  "ναι",
  "όχι",
  "γεια",
  "ευχαριστώ",
  "παρακαλώ",
  "καλά",
  "εντάξει",
  "είμαι",
  "θέλω",
  "μπορώ",
  "έχω",
  "είναι",
  "english",
  "greek",
  "claro",
  "buenas",
  "buenos",
  "hola",
  "gracias",
  "sí",
  "non",
  "oui",
  "bitte",
  "danke",
  // Common words mistakenly grabbed from ElevenLabs summary phrases
  "initiated",
  "switching",
  "attempted",
  "disconnected",
  "connected",
  "transferred",
  "forwarded",
  "redirected",
  "terminated",
  "ended",
  "started",
  "continued",
  "resumed",
  "abandoned",
  "dropped",
  // Time / day words
  "today",
  "yesterday",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "morning",
  "afternoon",
  "evening",
  "tonight",
  // Filler / hesitation sounds (Greek + multilingual)
  "εεε",
  "εε",
  "ε",
  "ααα",
  "λοιπόν",
  "eee",
  "aaa",
  "mmm",
  "erm",
  "err",
  "ehm",
  "asking",
  "asked",
  "inquired",
  "inquiring",
  "calling",
  "called",
  "regarding",
  "requesting",
  "requested",
  "speaking",
  "spoke",
  "scheduling",
  "scheduled",
  "booking",
  "booked",
  "appointment",
  "service",
  "services",
  "barber",
  "shop",
  "call",
  "caller",
  "user",
  "client",
  "customer",
  "person",
  "individual",
  "someone",
  "they",
  "them",
  "their",
  "the",
  "this",
  "that",
  "an",
  "a",
  "in",
  "on",
  "at",
  "for",
  "with",
  "about",
  "after",
  "during",
  "before",
]);

// Capitalise a potentially-multi-word name: "john smith" → "John Smith".
function capitalise(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ")
    .trim();
}

// Name-word pattern: one capitalised word (Latin or Greek), 2-20 chars.
// The capturing group optionally extends to a second (and rarely third)
// word so we return full names like "Maria Papadopoulou" / "John Michael Smith".
const NAME_WORD = "[A-ZÀ-Ö\\u00C0-\\u024F\\u0370-\\u03FF][a-zA-ZÀ-Öà-ö\\u00C0-\\u024F\\u0370-\\u03FF]{1,20}";
const FULL_NAME = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}`;

// Patterns specifically tuned to ElevenLabs' own summary style
const SUMMARY_NAME_PATTERNS: RegExp[] = [
  // "The user, identified as Jorge Papadopoulos" / "identified as Miguel"
  new RegExp(`\\bidentified\\s+as\\s+(${FULL_NAME})`, "i"),
  // "The user, Miguel Rodriguez," / "The caller, Ana Silva,"
  new RegExp(`\\b(?:user|caller|client|customer)[,\\s]+(${FULL_NAME})[,.]`, "i"),
  // "scheduled for Miguel Papadopoulos" / "booked for Ana Silva"
  new RegExp(`\\b(?:scheduled|booked|appointment)\\s+for\\s+(${FULL_NAME})\\b`, "i"),
  // "Thank you, Miguel" / "Alright, Jorge Papadopoulos" — agent echoing name
  new RegExp(`\\b(?:thank\\s+you|alright|perfect|great|confirmed)[,!]\\s+(${FULL_NAME})\\b`, "i"),
  // Generic: "named X" / "name is X"
  new RegExp(`\\bnamed?\\s+(${FULL_NAME})\\b`, "i"),
];

const NAME_REQUEST_RE =
  /what(?:'s| is) your (?:first )?name|may I (?:have|get|ask) your name|your name please|c[uú]al es su nombre|c[oó]mo se llama|su nombre|quel est votre nom|wie hei[sß]en Sie|qual [eé] o seu nome|ποιο είναι το όνομά σας|πώς σας λένε|το όνομό σας/i;

function extractName(transcript: { role: string; message: string }[], summary: string): string {
  // 1. ElevenLabs summary patterns (most reliable)
  for (const re of SUMMARY_NAME_PATTERNS) {
    const m = summary.match(re);
    if (m) {
      const n = m[1];
      if (n.length >= 2 && !NON_NAMES.has(n.toLowerCase()) && !KNOWN_BARBERS.has(n.toLowerCase())) return capitalise(n);
    }
  }

  // 2. Agent asks for name → next user reply. Capture up to 2 words (first + last).
  for (let i = 0; i < transcript.length - 1; i++) {
    if (transcript[i].role !== "agent") continue;
    if (!NAME_REQUEST_RE.test(transcript[i].message.replace(/<[^>]+>/g, " "))) continue;
    for (let j = i + 1; j < Math.min(i + 3, transcript.length); j++) {
      if (transcript[j].role !== "user") continue;
      const words = transcript[j].message
        .trim()
        .replace(/[.,!?;]+$/, "")
        .split(/\s+/);
      if (words.length >= 1 && words.length <= 4) {
        const first = words[0];
        if (first.length >= 2 && !NON_NAMES.has(first.toLowerCase()) && !KNOWN_BARBERS.has(first.toLowerCase())) {
          // If a plausible second word exists (2+ chars, alphabetic), include it as a last name
          const second = words[1];
          const isWord = (w?: string) => !!w && /^[A-Za-zÀ-Öà-ö\u00C0-\u024F\u0370-\u03FF]{2,}$/.test(w);
          if (isWord(second) && !NON_NAMES.has(second.toLowerCase())) {
            return `${capitalise(first)} ${capitalise(second)}`;
          }
          return capitalise(first);
        }
      }
      break;
    }
  }

  // 3. Agent echoes name back: "Great, Miguel, you are booked..."
  for (const msg of transcript.filter((m) => m.role === "agent")) {
    const clean = msg.message.replace(/<[^>]+>/g, " ").trim();
    const m = clean.match(
      /\b(?:great|perfect|alright|okay)[,!]\s+([A-ZÀ-Ö\u00C0-\u024F][a-zA-ZÀ-Öà-ö\u00C0-\u024F]{1,20})[,\s]/i,
    );
    if (m && !NON_NAMES.has(m[1].toLowerCase()) && !KNOWN_BARBERS.has(m[1].toLowerCase())) return capitalise(m[1]);
  }

  // 4. Self-introduction
  for (const msg of transcript.filter((m) => m.role === "user")) {
    const m = msg.message.match(
      /(?:i['']?m|my name is|call me|είμαι|ονομάζομαι|με λένε|λέγομαι|me llamo|je m['']appelle|ich bin|mi chiamo|sou o|sou a)\s+([A-ZÀ-Ö\u00C0-\u024F]?[a-zA-ZÀ-Öà-ö\u00C0-\u024F]{2,20})/i,
    );
    if (m && !NON_NAMES.has(m[1].toLowerCase()) && !KNOWN_BARBERS.has(m[1].toLowerCase())) return capitalise(m[1]);
  }

  return "";
}

// ── Barber extraction ─────────────────────────────────────────────────────────

const BARBER_LIST = ["nikos", "giorgos", "eleni", "petros"];

function extractBarber(transcript: { role: string; message: string }[], summary: string): string {
  // Summary: "with Nikos" / "con Nikos" / "με τον Νίκο"
  const sumM =
    summary.match(/\bwith\s+(Nikos|Giorgos|Eleni|Petros)\b/i) ||
    summary.match(/\bcon\s+(Nikos|Giorgos|Eleni|Petros)\b/i) ||
    summary.match(/\bμε\s+(τον|την)?\s*(Νίκο|Γιώργο|Ελένη|Πέτρο)\b/i);
  if (sumM) {
    const raw = sumM[sumM.length - 1];
    const map: Record<string, string> = { νίκο: "Nikos", γιώργο: "Giorgos", ελένη: "Eleni", πέτρο: "Petros" };
    return map[raw.toLowerCase()] ?? capitalise(raw);
  }
  // Transcript scan
  const all = transcript
    .map((m) => m.message)
    .join(" ")
    .toLowerCase();
  for (const b of BARBER_LIST) if (new RegExp(`\\b${b}\\b`).test(all)) return capitalise(b);
  return "";
}

// ── Appointment status ────────────────────────────────────────────────────────

function inferStatus(
  convStatus: string,
  callSuccessful: string | null | undefined,
  terminationReason: string | null | undefined,
  summary: string,
  dcrStatus: string,
): string {
  // Only "in-progress" is an actively-happening call. "processing" means the call
  // has ended and ElevenLabs is generating the analysis — treat as "done/pending".
  if (convStatus === "in-progress") return "in-progress";
  if (dcrStatus === "confirmed") return "confirmed";
  if (dcrStatus === "pending") return "pending";
  if (dcrStatus === "not_booked") return "cancelled";

  // Derive from ElevenLabs-provided fields
  const sum = summary.toLowerCase();
  if (/\bcancel/i.test(sum)) return "cancelled";
  if (
    /\bconcluded\s+with\s+the\s+booking\s+confirmed|booking\s+confirmed|appointment\s+(was\s+)?confirmed|successfully\s+(booked|scheduled)/i.test(
      summary,
    )
  )
    return "confirmed";
  if (/\bpending|will\s+call\s+back|callback|no\s+(?:appointment|booking)\s+(?:was\s+)?made/i.test(sum))
    return "pending";

  // Fall back to termination and call success
  if (terminationReason?.includes("end_call")) return "confirmed";
  if (callSuccessful === "failure") return "cancelled";

  return "confirmed"; // default for completed calls
}

// ── Build one booking entry ───────────────────────────────────────────────────

function buildBooking(conv: ConvSummary, detail: ConvDetail | null) {
  const callDate = new Date(conv.start_time_unix_secs * 1000);
  const fallbackDate = callDate.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
  const fallbackTime = callDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // ── No-answer / silent calls (phone connected but nobody spoke) ──────────────
  const isNoAnswer = conv.message_count === 0;
  if (isNoAnswer) {
    return {
      conversation_id: conv.conversation_id,
      source: "ai-call" as const,
      status: "failed",
      client_name: "—",
      service: "—",
      barber: "—",
      date: fallbackDate,
      time: fallbackTime,
      price: 0,
      duration_secs: conv.call_duration_secs,
      start_time_unix_secs: conv.start_time_unix_secs,
      message_count: 0,
      summary: "No answer — silent call",
      first_user_message: "",
      call_status: conv.status,
      call_language: conv.main_language ?? "",
    };
  }

  // ── Dropped / abandoned calls (agent greeted but caller hung up immediately) ──
  const isDropped = conv.message_count <= 1 && conv.call_duration_secs < 20;
  if (isDropped) {
    return {
      conversation_id: conv.conversation_id,
      source: "ai-call" as const,
      status: "failed",
      client_name: "—",
      service: "—",
      barber: "—",
      date: fallbackDate,
      time: fallbackTime,
      price: 0,
      duration_secs: conv.call_duration_secs,
      start_time_unix_secs: conv.start_time_unix_secs,
      message_count: conv.message_count,
      summary: "Dropped call — caller hung up immediately",
      first_user_message: "",
      call_status: conv.status,
      call_language: conv.main_language ?? "",
    };
  }

  const results = detail?.analysis?.data_collection_results;
  const summary = detail?.analysis?.transcript_summary ?? "";
  const transcript = (detail?.transcript ?? []).filter(
    (m): m is { role: string; message: string; time_in_call_secs: number } => !!m.message,
  );

  const userText = transcript
    .filter((m) => m.role === "user")
    .map((m) => m.message)
    .join(" ");
  const fullText = transcript.map((m) => m.message).join(" ");

  // ── Client name ──────────────────────────────────────────────────────────────
  const clientName =
    dcr(results, "client_name", "customer_name", "name", "caller_name") || extractName(transcript, summary);

  // ── Service ──────────────────────────────────────────────────────────────────
  // call_summary_title is short and precise → safe for multi-service detection
  // transcript_summary and transcript text are verbose → single match only
  const summaryTitle = conv.call_summary_title ?? "";
  const service =
    dcr(results, "service_type", "service", "requested_service", "haircut_type") ||
    detectServices(summaryTitle) ||
    detectService(summary) ||
    detectService(userText) ||
    detectService(fullText);

  // ── Barber ───────────────────────────────────────────────────────────────────
  const barber =
    dcr(results, "barber_name", "barber", "preferred_barber", "stylist") || extractBarber(transcript, summary);

  // ── Date ─────────────────────────────────────────────────────────────────────
  const rawDate =
    dcr(results, "appointment_date", "date", "booking_date") ||
    extractDate(summary) ||
    extractDate(userText) ||
    extractDate(fullText);

  // ── Time ─────────────────────────────────────────────────────────────────────
  const rawTime =
    dcr(results, "appointment_time", "time", "booking_time") ||
    extractTime(summary) ||
    extractTime(userText) ||
    extractTime(fullText);

  // ── Price ────────────────────────────────────────────────────────────────────
  // Priority: data_collection → explicit mention in text → sum of service default prices
  const priceRaw = dcr(results, "price_quoted", "price");
  const serviceDefaultPrice = service
    ? service.split(" + ").reduce((sum, s) => sum + (SERVICE_DEFAULT_PRICES[s.trim()] ?? 0), 0)
    : 0;
  const price =
    (priceRaw ? parseFloat(priceRaw) : 0) || extractPrice(summary) || extractPrice(fullText) || serviceDefaultPrice;

  // ── Status ───────────────────────────────────────────────────────────────────
  const dcrStatus = dcr(results, "appointment_status", "status");
  const status = inferStatus(conv.status, conv.call_successful, conv.termination_reason, summary, dcrStatus);

  // ── Language ─────────────────────────────────────────────────────────────────
  const callLanguage = dcr(results, "call_language", "language") || conv.main_language || "";

  // ── Fallbacks ────────────────────────────────────────────────────────────────
  const firstUserMsg = transcript.find((m) => m.role === "user")?.message?.trim() ?? "";

  return {
    conversation_id: conv.conversation_id,
    source: "ai-call",
    status,
    client_name: clientName || "Client",
    service: service || "—",
    barber: barber || "TBD",
    date: normalizeDate(rawDate) || fallbackDate,
    time: rawTime || fallbackTime,
    price: isNaN(price) ? 0 : price,
    duration_secs: conv.call_duration_secs,
    start_time_unix_secs: conv.start_time_unix_secs,
    message_count: conv.message_count,
    summary,
    first_user_message: firstUserMsg,
    call_status: conv.status,
    call_language: callLanguage,
  };
}

// ── Shared row mapper ─────────────────────────────────────────────────────────
function mapCallToBooking(r: Call) {
  return {
    conversation_id: r.conversation_id,
    source: "ai-call" as const,
    status:
      r.appointment_status === "confirmed"
        ? "confirmed"
        : r.appointment_status === "pending"
          ? "pending"
          : r.status === "failed"
            ? "failed"
            : r.appointment_status === "not_booked"
              ? "cancelled"
              : "confirmed",
    client_name: r.client_name || "—",
    service: r.service_type || "—",
    barber: r.barber_name || "TBD",
    date: r.appointment_date
      ? r.appointment_date.split("-").reverse().slice(0, 2).join("/")
      : new Date(r.created_at).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" }),
    time: r.appointment_time
      ? r.appointment_time.slice(0, 5)
      : new Date(r.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    price: r.price ?? 0,
    duration_secs: r.call_duration_secs ?? 0,
    start_time_unix_secs: Math.floor(new Date(r.created_at).getTime() / 1000),
    message_count: r.message_count ?? 0,
    summary: r.summary || "",
    first_user_message: "",
    call_status: r.status,
    call_language: r.call_language || r.main_language || "",
    business_id: r.business_id,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessIdParam = searchParams.get("business_id");

  // ── 1. Try Supabase first (permanent, fast, all sources) ─────────────────
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabaseAdmin() as any;

      // Resolve which business IDs to query
      let businessIds: string[] = [];
      if (businessIdParam) {
        businessIds = [businessIdParam];
      } else {
        // "All shops" — identify user via Bearer token first, then cookies as fallback
        let user: { id: string } | null = null;

        const bearerToken = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
        if (bearerToken) {
          const { data } = await db.auth.getUser(bearerToken);
          user = data.user;
        }

        if (!user) {
          const sbServer = await createSupabaseServerClient();
          const { data } = await sbServer.auth.getUser();
          user = data.user;
        }

        if (user) {
          const { data: memberships } = await db.from("business_members").select("business_id").eq("user_id", user.id);
          businessIds = (memberships ?? []).map((m: { business_id: string }) => m.business_id);
        }
        // If no businesses found, return empty — don't pollute with demo data
        if (businessIds.length === 0) {
          return NextResponse.json({ bookings: [], source: "supabase" });
        }
      }

      const query = db.from("calls").select("*").order("created_at", { ascending: false }).limit(200);

      const { data: rows, error } =
        businessIds.length === 1
          ? await query.eq("business_id", businessIds[0])
          : await query.in("business_id", businessIds);

      // Supabase returned a clean result — use it, but also merge any
      // ElevenLabs conversations not yet stored via webhook (covers calls
      // that happened before the webhook was set up).
      if (!error) {
        const supabaseBookings = (rows ?? []).map(mapCallToBooking);
        const supabaseConvIds = new Set(supabaseBookings.map((b: { conversation_id: string }) => b.conversation_id));

        // Try enriching with live ElevenLabs data
        let elBookings: ReturnType<typeof buildBooking>[] = [];
        if (process.env.ELEVENLABS_API_KEY) {
          try {
            const agentConvs = await Promise.all(
              ACTIVE_AGENTS.map(async (agent) => {
                try {
                  const convs = await listConversations(agent.id, 50);
                  return convs.map((c) => ({ ...c, _agentId: agent.id }));
                } catch {
                  return [];
                }
              }),
            );
            const seen = new Set<string>();
            const allConvs = agentConvs
              .flat()
              .sort((a, b) => b.start_time_unix_secs - a.start_time_unix_secs)
              .filter((c) => {
                if (seen.has(c.conversation_id)) return false;
                if (supabaseConvIds.has(c.conversation_id)) {
                  seen.add(c.conversation_id);
                  return false;
                }
                seen.add(c.conversation_id);
                return true;
              });
            const toEnrich = allConvs.slice(0, 15);
            const details = await Promise.all(toEnrich.map((c) => getConversation(c.conversation_id)));
            elBookings = toEnrich.map((conv, i) => buildBooking(conv, details[i]));
          } catch {
            /* ElevenLabs unavailable — just use Supabase data */
          }
        }

        const merged = [...supabaseBookings, ...elBookings].sort(
          (a, b) => b.start_time_unix_secs - a.start_time_unix_secs,
        );

        return NextResponse.json({ bookings: merged, source: supabaseBookings.length > 0 ? "supabase" : "elevenlabs" });
      }
    } catch (e) {
      console.warn("[bookings] Supabase read failed, falling back to ElevenLabs:", e);
    }
  }

  // ── 2. Fallback: pull live from ElevenLabs API ────────────────────────────
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ bookings: [] });
  }

  try {
    const agentConvs = await Promise.all(
      ACTIVE_AGENTS.map(async (agent) => {
        try {
          const convs = await listConversations(agent.id, 50);
          return convs.map((c) => ({ ...c, _agentId: agent.id }));
        } catch {
          return [];
        }
      }),
    );

    const seen = new Set<string>();
    const allConvs = agentConvs
      .flat()
      .sort((a, b) => b.start_time_unix_secs - a.start_time_unix_secs)
      .filter((c) => {
        if (seen.has(c.conversation_id)) return false;
        seen.add(c.conversation_id);
        return true;
      });

    const toEnrich = allConvs.slice(0, 15);
    const details = await Promise.all(toEnrich.map((c) => getConversation(c.conversation_id)));
    const bookings = toEnrich.map((conv, i) => buildBooking(conv, details[i]));

    return NextResponse.json({ bookings, source: "elevenlabs" });
  } catch {
    return NextResponse.json({ bookings: [] });
  }
}
