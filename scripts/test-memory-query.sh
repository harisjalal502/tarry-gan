#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHONPATH=. python3 - <<'PY'
from apps.agent.terrygam_agent.memory import query_memory

result = query_memory(
    "enterprise trust pricing",
    limit=5,
)
payload = result.to_json()
assert payload["matches"], payload
assert payload["answer"], payload
assert payload["mode"] in {"gbrain", "local_fallback"}, payload
print(f"memory query smoke passed ({payload['mode']}, {len(payload['matches'])} matches)")
PY
