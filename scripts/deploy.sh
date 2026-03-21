#!/bin/bash
# Deploy agent config to ElevenLabs
# Usage: bash scripts/deploy.sh [json-file]

AGENT_ID="agent_5001kjkkjvs6e7fs5t5fkjh1hhwc"
JSON_FILE="${1:-agent.json}"

if [ -z "$ELEVENLABS_API_KEY" ]; then
  echo "ERROR: export ELEVENLABS_API_KEY first"
  exit 1
fi

if [ ! -f "$JSON_FILE" ]; then
  echo "ERROR: $JSON_FILE not found"
  exit 1
fi

echo "Deploying $JSON_FILE → agent $AGENT_ID ..."

HTTP_CODE=$(curl -s -o /tmp/agent-response.json -w "%{http_code}" \
  -X PATCH \
  "https://api.elevenlabs.io/v1/convai/agents/$AGENT_ID" \
  -H "xi-api-key:$ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$JSON_FILE")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Deployed"
  echo "  Test: https://elevenlabs.io/app/talk-to?agent_id=$AGENT_ID"
else
  echo "✗ Failed (HTTP $HTTP_CODE)"
  cat /tmp/agent-response.json 2>/dev/null | python3 -m json.tool 2>/dev/null | head -20
  exit 1
fi
