#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 -m http.server 5173 --directory apps/dashboard

