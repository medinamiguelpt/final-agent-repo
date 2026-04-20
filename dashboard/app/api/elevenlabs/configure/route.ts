/**
 * POST /api/elevenlabs/configure
 *
 * Pushes the barber data-collection schema to one or all active agents.
 * Run this once per agent, and again whenever you update the schema in
 * lib/elevenlabs/schema.ts.
 *
 * Body (all optional):
 *   { "agentId": "agent_xxx" }   → configure a single agent
 *   {}                           → configure ALL active agents in the registry
 *
 * Authentication: requires the header  x-admin-key: <ELEVENLABS_API_KEY>
 * (reuses the same key — no extra secret needed).
 *
 * Returns:
 *   { results: [{ agentId, name, ok, body|error }], webhookUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_AGENTS, AGENTS } from "@/lib/elevenlabs/agents";
import { configureAgentSchema, getAgentConfig } from "@/lib/elevenlabs/client";
import { BARBER_SCHEMA } from "@/lib/elevenlabs/schema";

export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  // Accepts ELEVENLABS_API_KEY *or* CONFIGURE_ADMIN_KEY (set separately in Vercel).
  // If neither is set as a header, still allow if the request comes from the same
  // Vercel deployment (x-vercel-deployment-url header present).
  const adminKey = req.headers.get("x-admin-key");
  const validKeys = [process.env.ELEVENLABS_API_KEY, process.env.CONFIGURE_ADMIN_KEY].filter(Boolean);
  const isVercelInternal = !!req.headers.get("x-vercel-deployment-url");
  if (!isVercelInternal && !validKeys.includes(adminKey ?? "")) {
    return NextResponse.json({ error: "Unauthorized — set x-admin-key header" }, { status: 401 });
  }

  // ── Decide which agents to configure ─────────────────────────────────────
  let body: { agentId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const targets = body.agentId
    ? (() => {
        // Could be a registry key ("greek_barber") or a raw ElevenLabs ID
        const byKey = AGENTS[body.agentId!];
        const byId = Object.values(AGENTS).find((a) => a.id === body.agentId);
        const found = byKey ?? byId;
        return found ? [found] : [{ id: body.agentId!, name: body.agentId!, active: true }];
      })()
    : ACTIVE_AGENTS;

  if (targets.length === 0) {
    return NextResponse.json({ error: "No active agents in registry" }, { status: 400 });
  }

  // ── Apply schema to each agent ────────────────────────────────────────────
  const results = await Promise.all(
    targets.map(async (agent) => {
      try {
        const result = await configureAgentSchema(agent.id);
        return { agentId: agent.id, name: agent.name, ok: true, body: result };
      } catch (err) {
        const e = err as Error & { body?: unknown; status?: number };
        return {
          agentId: agent.id,
          name: agent.name,
          ok: false,
          error: e.message,
          detail: e.body,
          httpStatus: e.status,
        };
      }
    }),
  );

  // ── Derive webhook URL from the request host ──────────────────────────────
  const origin = req.headers.get("x-forwarded-host")
    ? `https://${req.headers.get("x-forwarded-host")}`
    : req.nextUrl.origin;
  const webhookUrl = `${origin}/api/elevenlabs/webhook`;

  const allOk = results.every((r) => r.ok);
  return NextResponse.json(
    {
      results,
      schemaApplied: Object.keys(BARBER_SCHEMA),
      webhookUrl,
      nextSteps: allOk
        ? [
            `1. Go to elevenlabs.io → Your agent → Webhooks`,
            `2. Add POST webhook: ${webhookUrl}`,
            `3. Copy the webhook secret → add as ELEVENLABS_WEBHOOK_SECRET in Vercel`,
            `4. Done — data_collection_results will auto-populate after every call`,
          ]
        : ["Fix the errors above and retry"],
    },
    { status: allOk ? 200 : 207 },
  );
}

/** GET — returns current agent config (for verifying schema is applied). */
export async function GET(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  const validKeys = [process.env.ELEVENLABS_API_KEY, process.env.CONFIGURE_ADMIN_KEY].filter(Boolean);
  const isVercelInternal = !!req.headers.get("x-vercel-deployment-url");
  if (!isVercelInternal && !validKeys.includes(adminKey ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId");
  const targets = agentId ? [{ id: agentId, name: agentId }] : ACTIVE_AGENTS;

  const configs = await Promise.all(
    targets.map(async (agent) => {
      try {
        const cfg = await getAgentConfig(agent.id);
        return { agentId: agent.id, name: agent.name, ok: true, config: cfg };
      } catch (err) {
        return { agentId: agent.id, name: agent.name, ok: false, error: String(err) };
      }
    }),
  );

  return NextResponse.json({ agents: configs, schemaFields: Object.keys(BARBER_SCHEMA) });
}
