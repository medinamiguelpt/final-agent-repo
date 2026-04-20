# Greek Barber Festival — Monorepo

Event demo: AI voice receptionist + booking dashboard.

## Structure

```
agent/       # Kostas — ElevenLabs ConvAI agent  (see agent/CLAUDE.md)
dashboard/   # Next.js 16 booking UI            (see dashboard/CLAUDE.md)
```

Both directories have their own `CLAUDE.md` with domain-specific rules and commands. Read the one for the area you're working in.

## ⚠️ ElevenLabs docs rule

Before **ANY** change to `agent/agent.json`, the agent prompt, or `dashboard/lib/elevenlabs/*`: check the official ElevenLabs docs first via **Context7 MCP** (library `/websites/elevenlabs_io`) or WebFetch fallback. See [agent/CLAUDE.md](agent/CLAUDE.md#mandatory-check-elevenlabs-docs-before-any-agent-changes) for the full URL list. ElevenAgents is evolving fast — never rely on cached knowledge.

## Deploy flow

- **Agent** → `cd agent && bash scripts/deploy.sh agent.json` (pushes to ElevenLabs)
- **Dashboard** → `git push` then `npx vercel --prod` (Vercel Git integration is manual-trigger; don't assume auto-deploy)

## Env

Copy `dashboard/.env.example` → `dashboard/.env.local` and fill in Supabase + ElevenLabs keys. Never commit `.env.local`.
