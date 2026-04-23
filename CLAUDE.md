# Greek Barber Festival — Monorepo

AI voice receptionist (**Kostas**) + booking dashboard for the demo barbershop **Greek Barber Festival**.

## 🔒 Committed stack — DO NOT substitute

This product is built on one explicit technology stack. New surfaces, features, and tools MUST use the same stack unless there is a documented architectural reason to deviate. This is a deliberate commitment after evaluating alternatives (no-code tools, other frameworks, other runtimes); we lock it to prevent drift.

| Layer | Choice | Version |
|---|---|---|
| **Build / dev runtime** | Bun | 1.3.9 (pinned via `packageManager`) |
| **Production runtime** | Node.js LTS | 22.x (pinned via `engines`, Vercel `nodeVersion`) |
| **Framework** | Next.js (App Router + Turbopack) | 16.2.2 |
| **UI library** | React + React DOM | 19.2.4 |
| **Language** | TypeScript, `strict: true` (enable `noUncheckedIndexedAccess` after splitting `dashboard/page.tsx`) | ^5 |
| **AI coding assistant** | Claude Code | — (source of all LLM-assisted changes) |
| **Runtime schema validation** | Zod | ^4.3.6 (at every `/api/*` boundary) |
| **DB + Auth + Realtime** | Supabase | eu-west-2 |
| **Voice platform** | ElevenLabs ConvAI | agent `agent_8701kn7p69jaf0frvsvwd6g2sq4e` |
| **Hosting** | Vercel | auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`) on push to `main` after CI passes |

Not used (deliberate): Tailwind, shadcn/ui, framer-motion, next-intl (custom translations), Redux/Zustand, React Query/SWR, Storybook. If a feature genuinely needs one of these, discuss before adding.

Not allowed without architectural review:
- **No-code / low-code platforms** (Bubble, Retool, Webflow, etc.) for the customer-facing product
- **Alternative frameworks** (Remix, Astro, SvelteKit) for new pages
- **Alternative runtimes** (Deno, or running Bun in production)
- **Alternative bundlers** (Webpack, Vite) — Next 16 + Turbopack only
- **Alternative package managers** (npm, yarn, pnpm) — Bun only

Complementary tools (SaaS — not custom) are fine for:
- Marketing site / CMS → Framer (if/when needed)
- Email → Resend
- CRM → Attio / HubSpot
- Analytics → Plausible / PostHog
- Support → Plain / Crisp / Intercom
- Automation / drip campaigns → n8n
- Billing → Stripe

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

Adult services (12+):

| Service | Price | Duration |
|---|---|---|
| Haircut | €15 | 30 min |
| Beard Trim | €10 | 20 min |
| Full Shave | €12 | 25 min |
| Haircut + Beard Combo | €22 | 45 min |
| Hair Styling | €20 | 40 min |
| Eyebrow Grooming | €5 | 10 min |

Kids (under 12) — only one service offered:

| Service | Price | Duration |
|---|---|---|
| Kids Cut | €10 | 20 min |

Kids rule: children under 12 can ONLY book the Kids Cut. Beard/shave/combo/styling/eyebrow are adult-only. Kostas asks the age if unclear before assigning a service.

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
- Deploy: Vercel — auto-deploys on push to `main` after CI passes, via `.github/workflows/deploy.yml`. Manual `npx vercel --prod` still works for out-of-band deploys.

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

**Pricing tiers (source of truth — mirrors `dashboard/lib/pricing.ts`)**

Agent-only product — no dashboard. Bookings sync to the customer's calendar (cal.com on launch, Google Calendar fast-follow) and a weekly performance email replaces the live dashboard surface. Four tiers, named by usage volume so a barbershop owner can self-match to their call load. Set to maintain ≥80% gross margin **per tier** at the modelled ~€0.08/min blended voice cost (ElevenLabs ConvAI annual Business $0.08/min − silent-period discount + GPT-4o-mini pass-through @ ~€0.001/min w/ prompt caching, plus buffer). When changing prices, re-validate margins and update both this table and `lib/pricing.ts` in the same commit.

**No-code MVP stack** — the pricing below is calibrated for a stack assembled entirely from ready-made tools (ElevenLabs ConvAI with native WhatsApp + managed phone number, customer's own cal.com, shared Airtable workspace via ElevenLabs MCP, Stripe Billing + Tax, Resend for email). Custom code lives only in this dashboard repo (internal admin + future customer portal). Fixed OpEx per customer is **~€20/mo**: phone DID ~€4, Airtable shared ~€5, Stripe fees ~€5, Stripe Tax ~€1, email + monitoring ~€1, legal/accounting/domain amortized ~€4. Customer owns their cal.com + WhatsApp Business Account (Meta bills them directly) → those vendor costs are on them. If we migrate off the no-code stack to custom Supabase/Vercel infra in v2, OpEx floats to ~€30 and margins compress accordingly — re-run this table if so.

**Hard-cap model — no overage, no top-ups.** A customer gets exactly the minutes they bought. When the bucket is spent, the agent stops taking new calls and incoming calls route to voicemail until the next billing cycle or an upgrade. Bill is flat and predictable — no surprise charges, no telco-style overage guilt. The trade-off: a shop that misjudges usage loses booking capacity mid-month, so **mid-month usage alerts** and **one-click upgrade from the weekly email** are load-bearing UX (see planned work below).

| Tier | Monthly | Yearly (−20%) | Minutes | € / included min |
|---|---:|---:|---:|---:|
| Light | €99/mo | €950/yr (€79/mo equiv.) | 100 min/mo | €0.990 |
| Standard ★ | €179/mo | €1,718/yr (€143/mo equiv.) | 250 min/mo | €0.716 |
| Busy | €299/mo | €2,870/yr (€239/mo equiv.) | 500 min/mo | €0.598 |
| Heavy | €499/mo | €4,790/yr (€399/mo equiv.) | 1,000 min/mo | €0.499 |

★ Most popular · All plans include bookings sync to the customer's calendar, weekly performance email, listen to any call on demand (ElevenLabs-hosted conversation pages), and all 7 supported languages. Minutes are a single pool the customer can use however they want — one shop, two shops, ten shops — we don't track or limit where they're spent. Don't frame this as a "feature" ("unlimited locations", "multi-shop support") on marketing surfaces; locations aren't a billable dimension, so mentioning them just invents a limit-shaped object in the customer's head. Just sell minutes.

Typical shop profiles (for self-selection at sales time):
- **Light** — quieter shop, ~3 calls/day
- **Standard** — busy shop, ~8 calls/day
- **Busy** — high-volume or small multi-shop, ~15 calls/day
- **Heavy** — multi-shop or very high volume, ~30+ calls/day

Per-included-minute cost drops at every step (upgrading is always cheaper per minute than staying on a lower tier): Light €0.990 → Standard €0.716 (−28%) → Busy €0.598 (−16%) → Heavy €0.499 (−17%).

Self-select by expected monthly minutes: **<100 → Light · 100–250 → Standard · 250–500 → Busy · 500–1,000 → Heavy**. A shop regularly near the top of their bucket should upgrade — they'll run out of capacity otherwise.

**Cap behaviour / usage alerts (load-bearing UX for the hard cap):**
- **75% used** — informational email ("you've used 75 of your 100 minutes this month")
- **90% used** — amber alert with upgrade CTA ("~10 min left this cycle — upgrade to Standard for ×2.5 the capacity at €0.716/min")
- **100% used** — red alert + agent stops answering; calls route to carrier voicemail until next cycle or upgrade (one-click upgrade in the email, prorated to the remainder of the cycle)

Unit economics at full bucket utilisation (voice cost €0.08/min + €20/mo fixed OpEx per customer):

| Tier | Voice cost | Gross | Gross % | OpEx | Net | Net % |
|---|---:|---:|---:|---:|---:|---:|
| Light | €8 | €91 | 91.9% | €20 | €71 | 71.7% |
| Standard | €20 | €159 | 88.8% | €20 | €139 | 77.7% |
| Busy | €40 | €259 | 86.6% | €20 | €239 | 79.9% |
| Heavy | €80 | €419 | 84.0% | €20 | €399 | 80.0% |

Every tier clears ≥80% gross and ≥70% net. OpEx dilutes hardest on Light (20% of revenue) and least on Heavy (4% of revenue) — which is why upselling Light → Standard roughly doubles net contribution (+€68/customer/mo for +€80 in revenue). Pricing is held (not cut) despite the improved margin vs. earlier custom-build estimates, to (a) absorb ElevenLabs LLM pass-through when it lands, (b) preserve runway, and (c) avoid price-cutting before market validation.

**Yearly billing** — flat 20% discount vs paying monthly (`YEARLY_DISCOUNT` in `lib/pricing.ts`).

**Holiday / seasonal sales** — declared as data in `HOLIDAY_PROMOS`. The active promo is auto-detected by date and stacks on top of the yearly discount.

| Promo | Window | Discount | Applies to | Code |
|---|---|---:|---|---|
| Spring Refresh | Apr 1 – May 1 | 15% | both | `SPRING15` |
| Easter Special | Apr 5 – Apr 20 | 20% | yearly | `PASCHA20` |
| Summer Sale | Jul 15 – Aug 16 | 15% | monthly | `SUMMER15` |
| Black Friday | Nov 24 – Dec 2 | 30% | yearly | `BF30` |
| Christmas | Dec 1 – Jan 7 | 25% | yearly | `XMAS25` |
| New Year | Jan 1 – Jan 16 | 20% | monthly | `NY20` |

Add new sales by appending to `HOLIDAY_PROMOS` — no UI changes required.

**Multi-currency** — `dashboard/lib/currencies.ts` defines hand-rounded local prices per tier per currency (not runtime FX). Covers EUR, USD, GBP, CHF, CAD, AUD, SEK, NOK, DKK, PLN, AED, JPY. Each currency has its own `tierMonthly`, `overageByTier`, and locale-aware formatting via `Intl.NumberFormat`.

**VAT / sales tax** — `dashboard/lib/vat.ts` declares rates for all 27 EU member states + UK, NO, CH, IS, US, CA, AU, NZ, AE, JP, SG. Vendor country is Greece (`VENDOR_COUNTRY = "GR"`). `computeVat()` handles:

- **EU B2B with valid VAT ID** → reverse charge (0%, customer self-accounts under Article 196)
- **EU B2C or EU B2B without VAT ID** → charge customer-country VAT (OSS)
- **UK / NO / CH / non-EU** → charge local rate (assumes vendor registered)
- **US** → 0% at platform level (state sales tax handled at checkout)

The dashboard Subscription panel shows a region picker (currency + country + B2B toggle with VAT ID field) and renders a full net / VAT / gross breakdown on every tier card.

**Commands**
```bash
cd dashboard
npm install
npm run dev            # http://localhost:3000

# Push data-collection schema to ElevenLabs agent(s)
curl -X POST http://localhost:3000/api/elevenlabs/configure \
  -H "x-admin-key: $ELEVENLABS_API_KEY"

# Production deploys happen automatically on push to main (after CI passes)
# via .github/workflows/deploy.yml. Requires VERCEL_TOKEN in repo secrets.
# Out-of-band / manual deploy still available:
npx vercel deploy --prod
npx vercel alias set <new-deploy-url> dashboard-sooty-seven-64.vercel.app
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

---

## Planned quality work (in priority order)

1. **Split `dashboard/app/dashboard/page.tsx` (9,650 lines) into per-tab modules** — biggest source of LLM hallucination risk; blocks several other flags.
2. **Enable `noUncheckedIndexedAccess` in `tsconfig.json`** — 92 call sites to fix, mostly inside `page.tsx`. Do this as part of step 1.
3. **Add Playwright E2E tests** for the 5 golden flows: login → dashboard, live call → ledger appears, walk-in form submit, cancel booking, language switch.
4. **Supabase RLS fixes** — enable RLS on `public.agents`; tighten `businesses: owner insert` policy (currently `WITH CHECK (true)`).
5. **Supabase Auth** — enable Leaked Password Protection.
6. **Go private on GitHub** — repo currently public, agent prompt + IDs exposed.
