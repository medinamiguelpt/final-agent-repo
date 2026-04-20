# Greek Barber Festival — Monorepo

Event demo: AI voice receptionist + event dashboard.

## Structure

```
agent/          # Kostas — AI voice receptionist (ElevenLabs ConvAI)
dashboard/      # Next.js 16 booking dashboard (Supabase + ElevenLabs webhook)
```

## ⚠️ ElevenLabs docs rule

Before ANY change to `agent/agent.json` or the agent prompt: **check the official ElevenLabs docs first** via Context7 MCP (or WebFetch fallback). See [agent/CLAUDE.md](agent/CLAUDE.md) for the full URL list. ElevenAgents is new and docs change often — never rely on cached knowledge.

## Agent

See [agent/CLAUDE.md](agent/CLAUDE.md) for full details.

Quick commands:
```bash
cd agent
export ELEVENLABS_API_KEY="..."
bash scripts/deploy.sh agent.json    # Deploy agent config
```

## Dashboard

Next.js 16 booking management UI. Receives ElevenLabs post-call webhooks, extracts booking data via data_collection_results, and persists to Supabase.

**Supabase project:** `tghadldaxbooawjfsuzs` (eu-west-2, `greek-barber-dashboard`)

**Tables:** businesses, agents, calls, appointments, profiles, business_members (all with RLS)

**Webhook flow:** ElevenLabs `post_call_transcription` → `/api/elevenlabs/webhook` → upsert calls + appointments

**Key API routes:**
- `POST /api/elevenlabs/webhook` — receives post-call data from ElevenLabs
- `POST /api/elevenlabs/configure` — pushes data-collection schema to agent(s)
- `GET  /api/elevenlabs/signed-url` — WebSocket URL for live calls
- `GET  /api/businesses` — list user's businesses
- `POST /api/appointments` — create walk-in/manual bookings

Quick commands:
```bash
cd dashboard && npm install && npm run dev   # http://localhost:3000

# Push data-collection schema to ElevenLabs agent
curl -X POST http://localhost:3000/api/elevenlabs/configure \
  -H "x-admin-key: $ELEVENLABS_API_KEY"
```

**Env config:** Copy `dashboard/.env.example` to `dashboard/.env.local` and fill in Supabase keys + ElevenLabs secrets.
