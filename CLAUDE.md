# Kostas — Greek Barber Festival

AI voice receptionist for a Greek barbershop, built on ElevenLabs ConvAI.

## Stack

- **Platform:** ElevenLabs Conversational AI
- **LLM:** Gemini 2.5 Flash
- **TTS:** ElevenLabs v3 Conversational
- **ASR:** Scribe Realtime (high quality)
- **Agent ID:** `agent_5001kjkkjvs6e7fs5t5fkjh1hhwc`

## Project structure

```
agent.json              # Full agent config (prompt, voices, TTS, ASR, widget, guardrails)
scripts/
  deploy.sh             # Push agent.json to ElevenLabs API
  push-tests.py         # Create + attach 70 tests (does NOT run them)
```

## Commands

```bash
# Deploy agent changes to ElevenLabs
export ELEVENLABS_API_KEY="..."
bash scripts/deploy.sh agent.json

# Push tests (create + attach, no run)
python3 scripts/push-tests.py

# Run tests via the ElevenLabs dashboard
# https://elevenlabs.io/app/conversational-ai/agents/agent_5001kjkkjvs6e7fs5t5fkjh1hhwc/testing
```

## Agent overview

**Persona:** Kostas, a warm and direct front-desk manager who has run the desk for years. Handles bookings only — does not cut hair.

**Shop:** Greek Barber Festival, Kifissou 42, Egaleo, Athens. Tue–Sat 10:00–20:00.

**Team:** Nikos, Giorgos, Eleni, Petros (all handle all services).

**Languages:** Greek (default), English, Spanish, Portuguese, French, German, Arabic. Language locks from the client's first word. Always formal register.

**Booking flow:** Greet → ask time → confirm → ask first name → final confirmation (name + service + barber + time) → contextual upsell → goodbye → end_call.

**Key rules:**
- 1–2 short sentences max per response
- Never volunteer info (no prices, durations, barber names until final confirmation)
- Forbidden words: "Certainly", "Of course", "Absolutely", "Great choice", "Sure", "No problem"
- Schedule is improvised (demo) — shop hours enforced, past times rejected, closed days handled
- Upsell must complement the booked service (not repeat it)

## Test categories (70 tests)

1. Language Detection (7) — tool tests for all 7 languages
2. Language Register & Locking (7) — formal register + language lock
3. Greeting Logic (3) — morning/afternoon/evening
4. Booking Flow (8) — full flow from service request to goodbye
5. Schedule & Availability (6) — closed days, past times, multi-day, ranges
6. Services & Pricing (5) — prices, durations, service listing
7. Shop Info (5) — hours, directions, name clarification, best barber
8. Persona & Tone (7) — brevity, no filler, AI identity, warmth
9. Forbidden Words (3) — English and Greek
10. End Call Tool (5) — fires at right time, never mid-conversation
11. Contextual Upsell (4) — haircut→beard, beard→haircut, grooming→eyebrow, etc.
12. Edge Cases & Security (5) — injection, off-topic, abuse, multi-service
13. Full Simulations (5) — English, Greek, Spanish, info-only, multi-day
