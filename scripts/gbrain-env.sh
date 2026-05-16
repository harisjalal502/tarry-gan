#!/usr/bin/env bash

# Keep hackathon retrieval isolated from the user's global ~/.gbrain brain.
# GBrain appends `.gbrain` under GBRAIN_HOME, so this parent directory yields
# `.gbrain-home/.gbrain/...` for project-local state.
export GBRAIN_HOME="${GBRAIN_HOME:-$(pwd)/.gbrain-home}"

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

project_gbrain_config_path() {
  printf '%s\n' "${GBRAIN_HOME}/.gbrain/config.json"
}

project_gbrain_embedding_model() {
  node -e 'const fs = require("fs"); const p = process.argv[1]; let c = {}; try { c = JSON.parse(fs.readFileSync(p, "utf8")); } catch {} console.log(c.embedding_model || "openai:text-embedding-3-large");' "$(project_gbrain_config_path)"
}

ensure_project_gbrain() {
  mkdir -p "${GBRAIN_HOME}"
  if [ ! -f "$(project_gbrain_config_path)" ]; then
    gbrain init \
      --pglite \
      --embedding-model zeroentropyai:zembed-1 \
      --embedding-dimensions 2560 \
      --json
  fi

  # The project corpus is tiny, and gbrain 0.35.1 can keep the CLI process
  # open after writing semantic query-cache rows in TTY smoke tests.
  gbrain config set search.cache_enabled false >/dev/null 2>&1 || true
}
