import { createHmac, timingSafeEqual } from "crypto";
import { BARBER_SCHEMA } from "./schema";

export const EL_BASE = "https://api.elevenlabs.io/v1";

function apiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not set");
  return k;
}

function jsonHeaders() {
  return { "xi-api-key": apiKey(), "Content-Type": "application/json" };
}

// ── Agent configuration ───────────────────────────────────────────────────────

/**
 * Push the barber data-collection schema to one agent.
 * Call this once per agent (or after adding new schema fields).
 * Returns the raw ElevenLabs API response.
 */
export async function configureAgentSchema(agentId: string): Promise<unknown> {
  const res = await fetch(`${EL_BASE}/convai/agents/${agentId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({
      platform_settings: {
        data_collection: BARBER_SCHEMA,
      },
    }),
  });

  const body = await res.json().catch(() => ({ _raw: "non-JSON response" }));
  if (!res.ok) {
    throw Object.assign(
      new Error(`ElevenLabs PATCH agent/${agentId} failed (HTTP ${res.status})`),
      { status: res.status, body }
    );
  }
  return body;
}

/** Fetch the current agent configuration (useful for verifying schema was applied). */
export async function getAgentConfig(agentId: string): Promise<unknown> {
  const res = await fetch(`${EL_BASE}/convai/agents/${agentId}`, {
    headers: { "xi-api-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET agent/${agentId} failed (HTTP ${res.status})`);
  return res.json();
}

// ── Conversation helpers ──────────────────────────────────────────────────────

export interface ConvSummary {
  conversation_id: string;
  status: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  /** ElevenLabs auto-generated title e.g. "Haircut and Beard Booking" */
  call_summary_title?: string | null;
  /** ISO 639-1 language code detected by ElevenLabs e.g. "el", "en", "es" */
  main_language?: string | null;
  /** Whether the call completed successfully */
  call_successful?: string | null;
  /** Reason the call ended */
  termination_reason?: string | null;
}

/** List conversations for one agent (up to pageSize, most-recent first). */
export async function listConversations(
  agentId: string,
  pageSize = 50,
): Promise<ConvSummary[]> {
  const url = `${EL_BASE}/convai/conversations?agent_id=${agentId}&page_size=${pageSize}`;
  const res = await fetch(url, {
    headers: { "xi-api-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`List conversations for ${agentId} failed (HTTP ${res.status})`);
  const data = await res.json();
  return (data.conversations ?? []) as ConvSummary[];
}

export interface DataCollectionValue {
  data_collection_id?: string;
  value?: string | number | boolean | null;
  rationale?: string;
}

export interface ConvDetail {
  conversation_id: string;
  status: string;
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    main_language?: string;
  };
  analysis?: {
    transcript_summary?: string;
    call_successful?: string;
    /** Dict keyed by identifier */
    data_collection_results?: Record<string, DataCollectionValue>;
  };
  transcript?: Array<{
    role: string;
    message: string | null;
    time_in_call_secs: number;
  }>;
}

/** Fetch full detail (transcript + analysis) for one conversation. */
export async function getConversation(conversationId: string): Promise<ConvDetail | null> {
  try {
    const res = await fetch(`${EL_BASE}/convai/conversations/${conversationId}`, {
      headers: { "xi-api-key": apiKey() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ConvDetail;
  } catch {
    return null;
  }
}

// ── Data-collection helpers ───────────────────────────────────────────────────

/**
 * Pull a string value from data_collection_results by trying multiple identifier aliases.
 * Returns "" if none of the keys has a non-empty, non-null value.
 */
export function dcr(
  results: Record<string, DataCollectionValue> | undefined | null,
  ...keys: string[]
): string {
  if (!results) return "";
  for (const k of keys) {
    const entry = results[k];
    if (!entry) continue;
    const raw = entry.value;
    if (raw === null || raw === undefined) continue;
    const s = String(raw).trim();
    if (s && !["null", "undefined", "n/a", "none", ""].includes(s.toLowerCase())) return s;
  }
  return "";
}

// ── Webhook signature verification ───────────────────────────────────────────

/**
 * Verify an ElevenLabs webhook signature.
 *
 * Header format: "t=<unix_timestamp>,v0=<hmac_hex>"
 * Signed payload: "<timestamp>.<raw_body_string>"
 *
 * Store the webhook secret as ELEVENLABS_WEBHOOK_SECRET in your env.
 * Returns true if the signature matches (or if no secret is configured — for dev).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow in development, warn in production
    if (process.env.NODE_ENV === "production") {
      console.warn("[webhook] ELEVENLABS_WEBHOOK_SECRET not set — skipping verification");
    }
    return true;
  }
  if (!signatureHeader) return false;

  try {
    const parts: Record<string, string> = {};
    for (const chunk of signatureHeader.split(",")) {
      const idx = chunk.indexOf("=");
      if (idx !== -1) parts[chunk.slice(0, idx)] = chunk.slice(idx + 1);
    }
    const { t: timestamp, v0: receivedHmac } = parts;
    if (!timestamp || !receivedHmac) return false;

    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    // timingSafeEqual requires equal-length buffers
    const a = Buffer.from(receivedHmac.padEnd(64, "0"), "hex");
    const b = Buffer.from(expected.padEnd(64, "0"), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
