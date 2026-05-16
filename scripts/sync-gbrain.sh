#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/gbrain-env.sh

if ! command -v gbrain >/dev/null 2>&1; then
  echo "gbrain is not installed or not on PATH"
  exit 1
fi

ensure_project_gbrain

node scripts/materialize-replay-brain.mjs

BRAIN_PATH="$(pwd)/brain"
SOURCE_ID="terrygam-office"

if ! gbrain sources list --json | grep -q "\"id\": \"${SOURCE_ID}\""; then
  gbrain sources add "${SOURCE_ID}" --path "${BRAIN_PATH}" --name "TerryGam Office" --federated
fi

# `gbrain sync` expects the source path itself to be a git repo. Our generated
# brain folder intentionally lives inside the hackathon repo, so write pages
# directly into the named source instead of creating a nested git repo.
while IFS= read -r file; do
  rel="${file#brain/}"
  slug="${rel%.md}"
  GBRAIN_SOURCE="${SOURCE_ID}" gbrain put "${slug}" < "${file}"
done < <(find brain -name '*.md' -type f ! -name 'README.md' ! -name 'RESOLVER.md' ! -name 'schema.md' | sort)

EMBEDDING_MODEL="$(project_gbrain_embedding_model)"
if [[ "${EMBEDDING_MODEL}" == zeroentropyai:* ]]; then
  REQUIRED_KEY="ZEROENTROPY_API_KEY"
elif [[ "${EMBEDDING_MODEL}" == openai:* ]]; then
  REQUIRED_KEY="OPENAI_API_KEY"
else
  REQUIRED_KEY=""
fi

if [ -z "${REQUIRED_KEY}" ] || [ -n "${!REQUIRED_KEY:-}" ]; then
  gbrain embed --stale
else
  echo "${REQUIRED_KEY} is not set in this shell for ${EMBEDDING_MODEL}; skipping embeddings and using keyword search for smoke test."
fi

echo
echo "Smoke search:"
gbrain search "pricing" --source "${SOURCE_ID}"
