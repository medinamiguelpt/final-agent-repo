import { NextRequest, NextResponse } from "next/server";
import { PRIMARY_AGENT, getAgentById } from "@/lib/elevenlabs/agents";
import { EL_BASE } from "@/lib/elevenlabs/client";

/**
 * GET /api/elevenlabs/signed-url?agentId=<optional>
 *
 * Returns a short-lived signed WebSocket URL for starting a ConvAI session.
 * Uses the primary active agent by default; pass ?agentId=<registry_key_or_el_id>
 * to use a specific agent (useful for multi-shop deployments).
 */
export async function GET(req: NextRequest) {
  const EL_KEY = process.env.ELEVENLABS_API_KEY;
  if (!EL_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }

  // Resolve agent
  const agentParam = req.nextUrl.searchParams.get("agentId");
  const agent = agentParam
    ? (getAgentById(agentParam) ?? { id: agentParam, name: agentParam, active: true })
    : PRIMARY_AGENT;

  if (!agent) {
    return NextResponse.json({ error: "No active agents configured" }, { status: 500 });
  }

  const res = await fetch(`${EL_BASE}/convai/conversation/get_signed_url?agent_id=${agent.id}`, {
    headers: { "xi-api-key": EL_KEY },
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const { signed_url } = (await res.json()) as { signed_url: string };
  return NextResponse.json({ signed_url, agentId: agent.id, agentName: agent.name });
}
