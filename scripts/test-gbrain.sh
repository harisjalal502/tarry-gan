#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/gbrain-env.sh
ensure_project_gbrain

SOURCE_ID="tarry-office"
SLUG="meetings/demo-pricing-debate"

echo "1. Sync generated brain page into GBrain"
npm run gbrain:sync

echo
echo "2. Verify source exists"
gbrain sources list --json | grep "\"id\": \"${SOURCE_ID}\"" >/dev/null
echo "ok: source ${SOURCE_ID}"

echo
echo "3. Verify page can be read"
gbrain get "${SLUG}" --source "${SOURCE_ID}" | grep "Speaker-Separated Transcript" >/dev/null
echo "ok: page ${SLUG}"

echo
echo "4. Verify keyword retrieval"
gbrain search "enterprise trust" --source "${SOURCE_ID}" | grep "${SLUG}" >/dev/null
echo "ok: keyword search finds ${SLUG}"

if [ -n "${ZEROENTROPY_API_KEY:-}" ]; then
  echo
  echo "5. Verify semantic retrieval with ZeroEntropy embeddings"
  gbrain embed --stale
  query_output="$(mktemp)"
  if command -v script >/dev/null 2>&1; then
    script -q /dev/null env GBRAIN_SOURCE="${SOURCE_ID}" gbrain query "What pricing decision did the team make?" --limit 5 >"${query_output}" 2>&1 &
  else
    GBRAIN_SOURCE="${SOURCE_ID}" gbrain query "What pricing decision did the team make?" --limit 5 >"${query_output}" 2>&1 &
  fi
  query_pid="$!"
  found_result="false"

  # gbrain 0.35.1 can keep the CLI process open after successful vector
  # retrieval. For the smoke test, the contract we care about is whether the
  # semantic result appears; then we clean up the still-open process.
  for _ in $(seq 1 20); do
    if grep "${SLUG}" "${query_output}" >/dev/null; then
      found_result="true"
      break
    fi
    if ! kill -0 "${query_pid}" 2>/dev/null; then
      break
    fi
    sleep 1
  done

  if [ "${found_result}" != "true" ]; then
    cat "${query_output}"
    kill "${query_pid}" 2>/dev/null || true
    wait "${query_pid}" 2>/dev/null || true
    rm -f "${query_output}"
    echo "semantic query did not find ${SLUG}"
    exit 1
  fi

  kill "${query_pid}" 2>/dev/null || true
  wait "${query_pid}" 2>/dev/null || true
  rm -f "${query_output}"
  echo "ok: semantic query finds ${SLUG}"
else
  echo
  echo "5. Semantic retrieval skipped: ZEROENTROPY_API_KEY is not set"
fi

echo
echo "GBrain smoke test passed."
