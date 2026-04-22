# Greek Barber Festival — Monorepo

AI voice receptionist (**Kostas**) + booking dashboard for the demo barbershop **Greek Barber Festival**.

## Structure

```
agent/        # Kostas — ElevenLabs ConvAI agent config
  agent.json  # Full agent config (prompt, voices, TTS, ASR, guardrails)
  scripts/deploy.sh  # Push agent.json to ElevenLabs API
dashboard/    # Next.js 16 app
  app/
    dashboard/     # /dashboard and /dashboard/login (the booking UI)
    auth/callback  # Supabase OAuth callback
    api/elevenlabs/*  # webhook, bookings, config, signed URL, conversation detail
    api/{appointments,businesses,demo-bookings,admin/approve}  # dashboard data
    page.tsx       # / → redirects to /dashboard
  lib/elevenlabs/  # ACTIVE_AGENTS registry, REST client, data_collection schema
  lib/supabase/    # server + browser clients, RLS-aware
```

---

## ⚠️ Mandatory: Check ElevenLabs docs before ANY agent change

Before editing `agent/agent.json`, the agent prompt, or `dashboard/lib/elevenlabs/*`:

1. **Context7 MCP first** — library `/websites/elevenlabs_io`.
2. **WebFetch fallback** if Context7 is unavailable.
3. **Verify** field names, accepted values, and behavior against the latest docs. ElevenAgents evolves fast — never rely on cached knowledge.

Key doc pages (all under `https://elevenlabs.io/docs/eleven-agents/`):
- `overview` · `quickstart` · `best-practices/prompting-guide`
- `customization/voice` · `customization/conversation-flow` · `customization/llm`
- `customization/tools` · `customization/tools/system-tools/language-detection`
- `customization/personalization` · `customization/privacy` · `customization/agent-testing`
- API reference: `https://elevenlabs.io/docs/api-reference/agents/create`

---

## Agent (`agent/`)

**Stack**
- **Platform:** ElevenLabs Conversational AI
- **LLM:** GPT-4o mini (chosen for tool-calling reliability — ElevenLabs explicitly recommends it over Gemini Flash for tool-using agents)
- **Analysis LLM:** gemini-2.5-flash (platform-gated, not changeable via API on Creator plan)
- **TTS:** ElevenLabs v3 Conversational
- **ASR:** Scribe Realtime (high quality)
- **Agent ID:** `agent_8701kn7p69jaf0frvsvwd6g2sq4e`

**Persona**
Kostas, a warm and direct front-desk manager who has run the desk for years. Handles bookings only — does not cut hair.

**Shop**
Greek Barber Festival, Kifissou 42, Egaleo, Athens. **Tue–Sat 10:00–20:00** (Sun/Mon closed).

**Team:** Nikos, Giorgos, Eleni, Petros (all handle all services).

**Languages:** Greek (default), English, Spanish, Portuguese, French, German, Arabic. Language locks from the client's first substantive word. Always formal register.

**Services (source of truth)**

| Service | Price | Duration |
|---|---|---|
| Haircut | €15 | 30 min |
| Beard Trim | €10 | 20 min |
| Full Shave | €12 | 25 min |
| Haircut + Beard Combo | €22 | 45 min |
| Kids Cut (under 12) | €10 | 20 min |
| Hair Styling | €20 | 40 min |
| Eyebrow Grooming | €5 | 10 min |

**Booking flow:** Greet → ask service → (if multi-person) together or separate? → ask time → ALWAYS ask barber preference → ask first + last name → final confirmation → neutral "anything else?" → farewell + end_call (atomic).

**Key rules in prompt (non-exhaustive)**
- 1–3 short sentences (flexible; go longer only when content genuinely needs it)
- Never volunteer info (no prices / durations / barber names until final confirmation)
- Forbidden openers in all 7 languages ("Certainly", "Σίγουρα", "Claro", "Bien sûr", etc.)
- Multi-person bookings: ask together/separate; if together, assign different barbers
- Never mix languages; close with the language's farewell template + end_call in the same turn
- Ask for each piece of info ONCE per call (never re-ask name/time/barber after booking changes)
- Sun/Mon closed only; any weekday name = next upcoming occurrence

**Testing:** manual live calls via widget. No automated suite.

**Deploy**
```bash
cd agent
export ELEVENLABS_API_KEY="..."
bash scripts/deploy.sh agent.json
```
Manual test widget: https://elevenlabs.io/app/talk-to?agent_id=agent_8701kn7p69jaf0frvsvwd6g2sq4e

---

## Dashboard (`dashboard/`)

Next.js 16 booking management UI. Receives ElevenLabs post-call webhooks, extracts booking data via `data_collection_results`, and persists to Supabase.

**Stack**
- Next.js 16 (App Router + Turbopack) · React 19
- Supabase (Postgres + Auth + RLS), project `tghadldaxbooawjfsuzs` (eu-west-2)
- Supabase Realtime (event-driven on `calls` + `appointments`)
- ElevenLabs ConvAI (WebSocket for live calls via JS SDK; REST for history + transcripts)
- Deploy: Vercel (manual `vercel --prod` — Git integration not wired)

**Key files**
```
app/dashboard/page.tsx             # Entire dashboard UI (~9500 lines)
app/api/elevenlabs/
  route.ts                         # GET: agent + conversation list (15s idle / 2s live)
  bookings/route.ts                # Hybrid Supabase + ElevenLabs booking feed
  conversation/[id]/route.ts       # Per-conversation transcript detail
  webhook/route.ts                 # Receives post_call_transcription from EL
  configure/route.ts               # Pushes data_collection schema to EL agents
  signed-url/route.ts              # Issues WebSocket URL for live calls
app/api/appointments/route.ts      # Walk-in / manual bookings
app/api/businesses/route.ts        # User's business memberships
lib/elevenlabs/
  agents.ts                        # ACTIVE_AGENTS registry (env-driven)
  client.ts                        # ElevenLabs REST helpers
  schema.ts                        # data_collection schema pushed to agents
```

**Post-call data flow**
1. Call happens → ElevenLabs processes (10–30 s)
2. ElevenLabs POSTs to `/api/elevenlabs/webhook`
3. Webhook writes `calls` + `appointments` rows in Supabase
4. Supabase Realtime notifies connected dashboards → `fetchDashboardData()` fires
5. Fallback: live-status poll detects call-end transition and refreshes without waiting for the webhook

**Live-call status semantics**
- `in-progress` = call actively happening → LIVE badge on
- `processing` = call has ENDED; EL generating analysis → treat as done; LIVE badge OFF
- `done` = analysis complete

Never conflate `processing` with `in-progress`.

**Behaviour rules**
- No forced upsell — agent asks neutral "anything else?"; dashboard shouldn't push either
- Dropped calls (≤1 msg, <20 s) render as amber "DROPPED", not hidden
- Ledger default sort = latest → earliest by start time
- Header dropdowns use a single `openMenu` state so only one is open at a time
- Language badges in feed + ledger cover el, en, es, pt, fr, de, ar

**Pricing tiers (source of truth)**

| Tier | Price | Minutes |
|---|---:|---:|
| Starter | €79/mo | 200 min/month |
| Professional | €149/mo | 500 min/month |
| Enterprise | €299/mo | 1,200 min/month |

**Commands**
```bash
cd dashboard
npm install
npm run dev            # http://localhost:3000

# Push data-collection schema to ElevenLabs agent(s)
curl -X POST http://localhost:3000/api/elevenlabs/configure \
  -H "x-admin-key: $ELEVENLABS_API_KEY"

# Production deploy (git push does NOT auto-deploy — run manually)
npx vercel --prod
```

**Env (`dashboard/.env.local`)**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=agent_8701kn7p69jaf0frvsvwd6g2sq4e
ELEVENLABS_AGENT_NAME=Kostas
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_8701kn7p69jaf0frvsvwd6g2sq4e
NEXT_PUBLIC_ELEVENLABS_AGENT_NAME=Kostas
ELEVENLABS_WEBHOOK_SECRET=...
```
Sync from Vercel: `cd dashboard && npx vercel env pull .env.local`

---

## Data flow — keep agent and dashboard in sync

When services, pricing, hours, or persona change:
- **Services** → update `agent/agent.json` prompt block AND the dashboard service display
- **Pricing** → update the dashboard `SUBSCRIPTION_TIERS` constant
- **Shop/persona/hours** → update `agent/agent.json` prompt only

Never let the two surfaces diverge.

---

## Infrastructure URLs

- **Production:** https://dashboard-sooty-seven-64.vercel.app/
- **Vercel project:** https://vercel.com/rgekfd3e-gmailcoms-projects/dashboard
- **Supabase project:** https://supabase.com/dashboard/project/tghadldaxbooawjfsuzs
- **GitHub repo:** https://github.com/medinamiguelpt/final-agent-repo
- **ElevenLabs agent:** https://elevenlabs.io/app/conversational-ai/agents/agent_8701kn7p69jaf0frvsvwd6g2sq4e
