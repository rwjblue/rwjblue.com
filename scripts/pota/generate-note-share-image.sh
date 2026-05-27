#!/usr/bin/env bash
# Generate a note share image by screenshotting the dedicated share-image page.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <note-slug>" >&2
  exit 1
fi

NOTE_SLUG="$1"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT="$REPO_ROOT/public/images/pota/$NOTE_SLUG/share.png"
PORT=4398
URL="http://localhost:$PORT/notes/$NOTE_SLUG/share-image/"

cd "$REPO_ROOT"
mkdir -p "$(dirname "$OUTPUT")"

cleanup() {
  agent-browser close --session "note-share-$NOTE_SLUG" 2>/dev/null || true
  if [[ -n "${DEV_PID:-}" ]]; then
    kill "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Starting dev server on port $PORT..."
npm run dev -- --port "$PORT" > /tmp/astro-note-share.log 2>&1 &
DEV_PID=$!

echo "Waiting for dev server..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/" > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "Dev server exited unexpectedly. Log:" >&2
    cat /tmp/astro-note-share.log >&2
    exit 1
  fi
  sleep 1
done

echo "Capturing share image for $NOTE_SLUG..."
agent-browser --session "note-share-$NOTE_SLUG" set viewport 1200 630
agent-browser --session "note-share-$NOTE_SLUG" open "$URL"
agent-browser --session "note-share-$NOTE_SLUG" wait --load networkidle
agent-browser --session "note-share-$NOTE_SLUG" wait 3000
agent-browser --session "note-share-$NOTE_SLUG" screenshot "$OUTPUT"

echo "Saved: $OUTPUT"
