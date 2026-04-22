/**
 * ElevenLabs Agent Registry
 *
 * To connect a new agent:
 *   1. Add an entry below with { id, name, active: true }
 *   2. POST /api/elevenlabs/configure  (applies the data-collection schema automatically)
 *   3. Set ELEVENLABS_WEBHOOK_SECRET in your environment (from the ElevenLabs webhook page)
 *
 * To disconnect an agent: set active: false
 * The webhook, bookings, and signed-url routes all read from ACTIVE_AGENTS — no other changes needed.
 */

export interface AgentConfig {
  /** ElevenLabs agent_id */
  id: string;
  /** Human-readable label shown in UI / logs */
  name: string;
  /** Set to false to stop pulling data without deleting the entry */
  active: boolean;
  /** Optional — for multi-shop deployments */
  shop?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD / REMOVE AGENTS HERE
//
// Option A — env-driven (recommended for single-agent deployments):
//   Set ELEVENLABS_AGENT_ID (and optionally ELEVENLABS_AGENT_NAME) in your
//   Vercel / .env.local. The primary agent is read automatically.
//
// Option B — hard-coded (multi-agent / multi-shop):
//   Uncomment and fill in the entries below. Set active: false to disable
//   an agent without removing it from the registry.
// ─────────────────────────────────────────────────────────────────────────────
const envAgentId = process.env.ELEVENLABS_AGENT_ID;
const envAgentName = process.env.ELEVENLABS_AGENT_NAME ?? "AI Barber";

export const AGENTS: Record<string, AgentConfig> = {};

// ── Env-driven primary agent (auto-populated from ELEVENLABS_AGENT_ID) ───────
if (envAgentId) {
  AGENTS.primary = { id: envAgentId, name: envAgentName, active: true };
}

// ── Additional hard-coded agents (uncomment to add) ──────────────────────────
// AGENTS.second_shop = {
//   id: "agent_XXXXXXXXXXXXXXXXXXXX",
//   name: "Branch 2 — Nikos",
//   active: true,
//   shop: "Branch 2",
// };
// ─────────────────────────────────────────────────────────────────────────────

export const ACTIVE_AGENTS: AgentConfig[] = Object.values(AGENTS).filter((a) => a.active);

/** First active agent — used as the default for signed-URL calls.
 * Undefined at boot time if no active agent is configured; callers should
 * guard with a 500 response rather than assume this is populated.
 */
export const PRIMARY_AGENT: AgentConfig | undefined = ACTIVE_AGENTS[0];

/** Look up a registered agent by its ElevenLabs ID */
export function getAgentById(id: string): AgentConfig | undefined {
  return Object.values(AGENTS).find((a) => a.id === id);
}
