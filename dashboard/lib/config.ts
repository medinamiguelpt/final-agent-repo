/**
 * Client-safe constants derived from NEXT_PUBLIC_ environment variables.
 * Import from here instead of reading process.env directly in components.
 */
export const DEFAULT_AGENT_ID   = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID   ?? "";
export const DEFAULT_AGENT_NAME = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_NAME ?? "AI Barber";
