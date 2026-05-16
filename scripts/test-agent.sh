#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

output="$(PYTHONPATH=. python3 -m apps.agent.terrygam_agent.cli --sample --mode local)"

python3 - "$output" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
assert payload["session_id"] == "agent-smoke-session"
assert payload["mode"] == "local"
assert any(event["type"] == "decision" for event in payload["events"])
assert any(event["type"] == "risk" for event in payload["events"])
assert any(intent["name"] == "save_memory" for intent in payload["tool_intents"])
print("agent smoke test passed")
PY
