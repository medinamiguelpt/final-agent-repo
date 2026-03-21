#!/bin/bash
# ============================================================
# UPDATE KOSTAS AGENT — Greek Barber Festival
# ============================================================
# 
# WHAT THIS CHANGES:
#
# 1. GREETING: "Γεια σας" (works any time) instead of "Καλησπέρα" (evening only)
#    - Same fix applied to all 6 language greetings
#    - Added greeting logic in prompt so Kostas adapts based on system time
#
# 2. SYSTEM PROMPT improvements:
#    - "One or two short sentences" instead of rigid "one sentence always"
#    - Added explicit instruction to check {{system__time}} before offering slots
#    - Added greeting-time-of-day logic block
#    - thinking_budget: 0 → 1024 (so Gemini can reason about time/slots)
#    - temperature: 0.0 → 0.1 (slightly less robotic, still consistent)
#
# 3. ASR KEYWORDS: Added 18 Greek/English terms Scribe often mishears
#    (barber names, services, location names)
#
# 4. SILENCE TIMEOUT: 60s → 20s (better for noisy festival booth)
#
# 5. MAX DURATION: 240s → 360s (6 min — more room for demo walkthroughs)
#
# 6. EXPRESSIVE MODE: "Enthusiastic" → "Confident" (fits Kostas persona better)
#
# 7. WIDGET STYLING: Dark theme with gold accent (#c8a87c) — barbershop aesthetic
#    - Added shareable page description text
#    - Enabled during-call feedback
#
# 8. LANGUAGE PRESETS: Neutral greetings (Hola/Olá/Bonjour/Hallo/أهلاً)
#
# ============================================================
# USAGE:
#   chmod +x update-agent.sh
#   export ELEVENLABS_API_KEY="sk_your_new_key_here"
#   ./update-agent.sh                      # uses update-agent.json (default)
#   ./update-agent.sh agent-export.json    # push any JSON file directly
# ============================================================

AGENT_ID="agent_5001kjkkjvs6e7fs5t5fkjh1hhwc"

# JSON file to push — defaults to update-agent.json, or pass as first argument
JSON_FILE="${1:-update-agent.json}"

if [ -z "$ELEVENLABS_API_KEY" ]; then
  echo "ERROR: Set your API key first:"
  echo "  export ELEVENLABS_API_KEY=\"sk_your_key_here\""
  exit 1
fi

if [ ! -f "$JSON_FILE" ]; then
  echo "ERROR: JSON file not found: $JSON_FILE"
  exit 1
fi

echo "Using payload: $JSON_FILE"
echo "Updating Kostas agent ($AGENT_ID)..."

HTTP_CODE=$(curl -s -o /tmp/agent-response.json -w "%{http_code}" \
  -X PATCH \
  "https://api.elevenlabs.io/v1/convai/agents/$AGENT_ID" \
  -H "xi-api-key:$ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$JSON_FILE")

if [ "$HTTP_CODE" = "200" ]; then
  echo "SUCCESS — Agent updated."
  echo ""
  echo "Test it: https://elevenlabs.io/app/talk-to?agent_id=$AGENT_ID"
  echo ""
  echo "Verify the changes:"
  echo "  curl https://api.elevenlabs.io/v1/convai/agents/$AGENT_ID -H \"xi-api-key:\$ELEVENLABS_API_KEY\" | jq '.conversation_config.agent.prompt.prompt' | head -5"
else
  echo "FAILED — HTTP $HTTP_CODE"
  echo "Response:"
  cat /tmp/agent-response.json | jq '.' 2>/dev/null || cat /tmp/agent-response.json
fi
