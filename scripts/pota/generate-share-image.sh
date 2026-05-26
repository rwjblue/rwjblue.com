#!/usr/bin/env bash
# Generate the RI POTA challenge share image by screenshotting the dedicated
# share-image page via agent-browser. Starts a temporary dev server, waits for
# it to be ready, then screenshots and saves the result.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT="$REPO_ROOT/public/images/pota/ri-pota-challenge-share.png"
PORT=4399
URL="http://localhost:$PORT/projects/2026-activate-all-ri-pota/share-image/"

cd "$REPO_ROOT"

cleanup() {
  agent-browser close --session ri-pota-share 2>/dev/null || true
  if [[ -n "${DEV_PID:-}" ]]; then
    kill "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Starting dev server on port $PORT..."
npm run dev -- --port "$PORT" > /tmp/astro-dev-share.log 2>&1 &
DEV_PID=$!

echo "Waiting for dev server..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/" > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "Dev server exited unexpectedly. Log:" >&2
    cat /tmp/astro-dev-share.log >&2
    exit 1
  fi
  sleep 1
done

echo "Capturing share image..."
agent-browser --session ri-pota-share set viewport 1200 630
agent-browser --session ri-pota-share open "$URL"
agent-browser --session ri-pota-share wait --load networkidle
# Wait for OSM tiles to render
agent-browser --session ri-pota-share wait 3000
agent-browser --session ri-pota-share screenshot "$OUTPUT"

echo "Saved: $OUTPUT"
