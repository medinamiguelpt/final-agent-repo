# Greek Barber Dashboard

AI-powered booking dashboard for barbershops. Connects ElevenLabs Conversational AI with a Supabase backend — every call is transcribed, parsed, and saved as an appointment automatically.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| AI Calls | ElevenLabs Conversational AI |
| Deployment | Vercel |

---

## Quick start

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- An [ElevenLabs](https://elevenlabs.io) account with a Conversational AI agent created

### 2. Clone and install

```bash
git clone <your-repo-url>
cd greek-barber-dashboard
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New Query**, paste the contents of `supabase/schema.sql`, and run it.
3. Go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Authentication → Providers** and enable **Email** (it is on by default).

### 4. Set up ElevenLabs

1. In the ElevenLabs dashboard, go to **Conversational AI** and create a new agent (or use an existing one).
2. Copy the **Agent ID** (starts with `agent_`).
3. Go to **Profile → API Keys** and create an API key.
4. Set these env vars (see step 6):
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID` (and `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` — same value)
   - `ELEVENLABS_AGENT_NAME` (and `NEXT_PUBLIC_ELEVENLABS_AGENT_NAME`) — the display name, e.g. `"AI Barber"`

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all the values. The file is annotated — follow the comments.

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the login page.

### 7. Push the data-collection schema to your agent

After signing up and logging in, run this once to configure the ElevenLabs agent so it extracts booking data (client name, date, service, barber, etc.) from every call:

```bash
curl -X POST http://localhost:3000/api/elevenlabs/configure \
  -H "x-admin-key: YOUR_ELEVENLABS_API_KEY"
```

The response includes a `webhookUrl`. Copy it — you'll need it in the next step.

### 8. Register the webhook in ElevenLabs

1. In ElevenLabs → **Conversational AI → Webhooks**, add a new POST webhook:
   - URL: `https://your-deployed-url.vercel.app/api/elevenlabs/webhook`
   - Events: **post_call_transcription**
2. Copy the **webhook secret** and add it as `ELEVENLABS_WEBHOOK_SECRET` in your Vercel environment variables.

---

## Deploy to Vercel

1. Push your repo to GitHub.
2. Import the project in [vercel.com/new](https://vercel.com/new).
3. Add all environment variables from `.env.example` in the Vercel project settings (**Settings → Environment Variables**).
4. Deploy. After the first deploy, re-run step 7 and 8 with your production URL.

---

## Adding a second ElevenLabs agent (multi-shop)

Edit `lib/elevenlabs/agents.ts` and uncomment the `second_shop` template:

```ts
second_shop: {
  id: "agent_XXXXXXXXXXXXXXXXXXXX",  // your second agent ID
  name: "Branch 2 — Nikos",
  active: true,
  shop: "Branch 2",
},
```

Then re-run `/api/elevenlabs/configure` to push the schema to all active agents.

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | ✅ | ElevenLabs agent ID (server-side) |
| `ELEVENLABS_AGENT_NAME` | ✅ | Agent display name (server-side) |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | ✅ | Same agent ID, exposed to browser |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_NAME` | ✅ | Same agent name, exposed to browser |
| `ELEVENLABS_WEBHOOK_SECRET` | ✅ | Webhook HMAC secret from ElevenLabs |
| `CONFIGURE_ADMIN_KEY` | Optional | Alternative admin key for `/api/elevenlabs/configure` |
