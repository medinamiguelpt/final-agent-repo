# Greek Barber Festival — Monorepo

Event demo: AI voice receptionist + event dashboard.

## Structure

```
agent/          # Kostas — AI voice receptionist (ElevenLabs ConvAI)
dashboard/      # Event dashboard (TBD)
```

## Agent

See [agent/CLAUDE.md](agent/CLAUDE.md) for full details.

Quick commands:
```bash
cd agent
export ELEVENLABS_API_KEY="..."
bash scripts/deploy.sh agent.json    # Deploy agent config
python3 scripts/push-tests.py        # Push + attach tests (deletes old ones first)
```
