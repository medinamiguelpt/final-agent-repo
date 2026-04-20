# Dashboard — Greek Barber Festival

Next.js 16 booking management UI. Receives ElevenLabs post-call webhooks, extracts booking data via `data_collection_results`, and persists to Supabase.

For end-user setup + stack overview see [README.md](./README.md).

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + Turbopack
- **DB:** Supabase (Postgres + Auth + RLS), project `tghadldaxbooawjfsuzs` (eu-west-2)
- **Realtime:** Supabase Realtime (event-driven on `calls` + `appointments` tables)
- **AI:** ElevenLabs ConvAI (WebSocket for live calls via JS SDK; REST for history + transcripts)
- **Deploy:** Vercel (manual `vercel --prod` — Git integration not wired)

## Key files

```
app/dashboard/page.tsx           # Entire dashboard UI (~9500 lines — everything)
app/api/elevenlabs/
  route.ts                       # GET: agent + conversation list (polled every 15s idle / 2s live)
  bookings/route.ts              # Hybrid Supabase + ElevenLabs booking feed
  conversation/[id]/route.ts     # Per-conversation transcript detail
  webhook/route.ts               # Receives post_call_transcription from EL
  configure/route.ts             # Pushes data_collection schema to EL agents
  signed-url/route.ts            # Issues WebSocket URL for live calls
app/api/appointments/route.ts    # Walk-in / manual bookings
app/api/businesses/route.ts      # User's business memberships
lib/elevenlabs/
  agents.ts                      # ACTIVE_AGENTS registry (env-driven)
  client.ts                      # ElevenLabs REST helpers
  schema.ts                      # data_collection schema pushed to agents
```

## Data flow

1. Call happens → ElevenLabs processes (10-30s) → webhook to `/api/elevenlabs/webhook`
2. Webhook writes to Supabase `calls` + `appointments`
3. Supabase Realtime notifies dashboard → `fetchDashboardData()` fires
4. Fallback: live-status poll every 15s (2s while a call is in-progress) detects call-end transitions and triggers a full refresh without waiting for the webhook

## Live-call status

- `in-progress` = call actively happening → LIVE badge on
- `processing` = call has **ended**, ElevenLabs generating analysis → treat as done; LIVE badge OFF
- `done` = analysis complete

Never conflate `processing` with `in-progress` — users get confused when LIVE persists after they hang up.

## Dashboard behaviour rules

- **No forced upsell** — the agent asks "anything else?" only, neutral; dashboard shouldn't push either.
- **Dropped calls** (≤1 message, <20s) render as amber "DROPPED" status, not hidden.
- **Ledger default sort** = latest → earliest by start time.
- **Header dropdowns** use a single `openMenu` state (`"biz" | "lang" | "credits" | null`) so only one can be open at a time.
- **Language badges** in feed + ledger cover el, en, es, pt, fr, de, ar.

## Commands

```bash
npm install
npm run dev            # http://localhost:3000

# Push data-collection schema to ElevenLabs agent(s)
curl -X POST http://localhost:3000/api/elevenlabs/configure \
  -H "x-admin-key: $ELEVENLABS_API_KEY"

# Production deploy (Git push alone does NOT auto-deploy — run manually)
npx vercel --prod
```

## Env (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=agent_8701kn7p69jaf0frvsvwd6g2sq4e
ELEVENLABS_AGENT_NAME=Kostas — Greek Barber Festival
ELEVENLABS_WEBHOOK_SECRET=...
```
