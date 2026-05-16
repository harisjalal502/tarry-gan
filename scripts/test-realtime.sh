#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHONPATH=. python3 - <<'PY'
from apps.agent.terrygam_agent.realtime import (
    build_realtime_session_payload,
    dispatch_realtime_tool,
)

payload = build_realtime_session_payload(session_id="realtime-smoke")
session = payload["session"]
assert session["type"] == "realtime", session
assert session["model"].startswith("gpt-realtime"), session
assert session["output_modalities"] == ["text"], session
assert session["audio"]["input"]["transcription"]["model"], session
tool_names = {tool["name"] for tool in session["tools"]}
assert {"look_at", "react", "save_memory", "search_memory"}.issubset(tool_names), tool_names

robot_result = dispatch_realtime_tool("react", {"emotion": "insight"})
assert robot_result["type"] == "robot_action", robot_result
assert robot_result["result"]["ok"], robot_result

print("realtime smoke test passed")
PY
