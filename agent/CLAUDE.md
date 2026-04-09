# Kostas — Greek Barber Festival

AI voice receptionist for a Greek barbershop, built on ElevenLabs ConvAI.

## Stack

- **Platform:** ElevenLabs Conversational AI
- **LLM:** Gemini 2.5 Flash
- **TTS:** ElevenLabs v3 Conversational
- **ASR:** Scribe Realtime (high quality)
- **Agent ID:** `agent_8701kn7p69jaf0frvsvwd6g2sq4e`

## Project structure

```
agent.json              # Full agent config (prompt, voices, TTS, ASR, widget, guardrails)
scripts/
  deploy.sh             # Push agent.json to ElevenLabs API
  push-tests.py         # Create + attach 84 tests (does NOT run them)
```

## ⚠️ Mandatory: Check ElevenLabs docs before ANY agent changes

Before editing `agent.json`, the agent prompt, or any ConvAI configuration:

1. **Use Context7 MCP** to look up the relevant ElevenLabs docs for the fields you're changing. Use the `elevenlabs.io/docs` source (library ID: `/elevenlabs/elevenlabs-docs`). If Context7 MCP is not available, fall back to WebFetch.
2. **Verify field names, accepted values, and behavior** against the latest docs. ElevenAgents docs change frequently — never assume cached knowledge is correct.
3. **Key doc pages** (use WebFetch as fallback if Context7 is unavailable):
   - Overview: https://elevenlabs.io/docs/eleven-agents/overview
   - Prompting guide: https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide
   - Voice & language: https://elevenlabs.io/docs/eleven-agents/customization/voice
   - Conversation flow: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow
   - Agent testing: https://elevenlabs.io/docs/eleven-agents/customization/agent-testing
   - Tools: https://elevenlabs.io/docs/eleven-agents/customization/tools
   - Personalization: https://elevenlabs.io/docs/eleven-agents/customization/personalization
   - Widget: https://elevenlabs.io/docs/eleven-agents/customization/widget
   - LLM config: https://elevenlabs.io/docs/eleven-agents/customization/llm
   - Privacy: https://elevenlabs.io/docs/eleven-agents/customization/privacy
   - API reference: https://elevenlabs.io/docs/api-reference/agents/create

## Commands

```bash
# Deploy agent changes to ElevenLabs
export ELEVENLABS_API_KEY="..."
bash scripts/deploy.sh agent.json

# Push tests (create + attach, no run)
python3 scripts/push-tests.py

# Run tests via the ElevenLabs dashboard
# https://elevenlabs.io/app/conversational-ai/agents/agent_8701kn7p69jaf0frvsvwd6g2sq4e/testing
```

## Agent overview

**Persona:** Kostas, a warm and direct front-desk manager who has run the desk for years. Handles bookings only — does not cut hair.

**Shop:** Greek Barber Festival, Kifissou 42, Egaleo, Athens. Tue–Sat 10:00–20:00.

**Team:** Nikos, Giorgos, Eleni, Petros (all handle all services).

**Languages:** Greek (default), English, Spanish, Portuguese, French, German, Arabic. Language locks from the client's first word. Always formal register.

**Services:**
| Service | Price | Duration |
|---|---|---|
| Haircut | €15 | 30 min |
| Beard Trim | €10 | 20 min |
| Full Shave | €12 | 25 min |
| Haircut + Beard Combo | €22 | 45 min |
| Kids Cut (under 12) | €10 | 20 min |
| Hair Styling / Grooming | €20 | 40 min |
| Eyebrow Grooming | €5 | 10 min |

**Booking flow:** Greet → ask service → ask time → confirm slot → ask first name → final confirmation (name + service + barber + time) → contextual upsell → goodbye → end_call.

**Key rules:**
- 1–2 short sentences max per response
- Never volunteer info (no prices, durations, barber names until final confirmation)
- Forbidden words: "Certainly", "Of course", "Absolutely", "Great choice", "Sure", "No problem"
- Schedule is improvised (demo) — shop hours enforced, past times rejected, closed days handled
- Upsell must complement the booked service (not repeat it)

## Test categories (84 tests)

1. Language Detection (7) — tool tests for all 7 languages
2. Language Register & Locking (7) — formal register + language lock
3. Greeting Logic (3) — morning/afternoon/evening
4. Booking Flow (8) — full flow from service request to goodbye
5. Schedule & Availability (8) — closed days, past times, multi-day, ranges, late combo, ambiguous time
6. Services & Pricing (8) — prices, durations, kids cut, hair styling, combo duration, service listing
7. Shop Info (5) — hours, directions, name clarification, best barber
8. Persona & Tone (7) — brevity, no filler, AI identity, warmth
9. Forbidden Words (3) — English and Greek
10. End Call Tool (5) — fires at right time, never mid-conversation
11. Contextual Upsell (4) — haircut→beard/shave, beard→haircut/shave, combo→eyebrow/styling, shave→beard/haircut
12. Edge Cases & Security (7) — injection, off-topic, abuse, multi-service, parent+child, rude visitor
13. Full Simulations (7) — English, Greek, Spanish, info-only, multi-day, kids cut, hair styling
14. Content Guardrails (5) — sexual, violence, profanity, politics, medical advice
