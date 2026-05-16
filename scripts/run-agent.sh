#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [ -x .venv/bin/python ]; then
  PYTHONPATH=. exec .venv/bin/python -m apps.agent.terrygam_agent.server
fi

PYTHONPATH=. exec python3 -m apps.agent.terrygam_agent.server
