#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

TERRYGAM_ROBOT_MODE="${TERRYGAM_ROBOT_MODE:-mock}" \
  PYTHONPATH=. python3 -m apps.agent.terrygam_agent.robot --smoke >/tmp/tarry-robot-smoke.json

python3 - <<'PY'
import json

with open("/tmp/tarry-robot-smoke.json", encoding="utf-8") as f:
    results = json.load(f)

assert len(results) == 4
assert all(result["ok"] for result in results), results
assert [result["action"] for result in results] == ["status", "look_at", "react", "stop"]
print("robot smoke test passed")
PY
