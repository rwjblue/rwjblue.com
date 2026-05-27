#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/pota/sanitize-images.sh --slug <note-slug> [options] <image>...

Options:
  --slug <slug>        Note slug used for public/images/pota/<slug>/.
  --output-dir <dir>   Override the output directory.
  --max-edge <px>      Longest output edge in pixels. Default: 1600.
  --quality <1-100>    JPEG quality. Default: 82.

Outputs sanitized JPEGs with lowercase hyphenated filenames, auto orientation,
web-sized dimensions, and metadata stripped.
EOF
}

slug=""
output_dir=""
max_edge="1600"
quality="82"
inputs=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug)
      slug="${2:-}"
      shift 2
      ;;
    --output-dir)
      output_dir="${2:-}"
      shift 2
      ;;
    --max-edge)
      max_edge="${2:-}"
      shift 2
      ;;
    --quality)
      quality="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      inputs+=("$@")
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      inputs+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$slug" && -z "$output_dir" ]]; then
  echo "Missing required --slug or --output-dir." >&2
  usage >&2
  exit 1
fi

if [[ ${#inputs[@]} -eq 0 ]]; then
  echo "Pass at least one image to sanitize." >&2
  usage >&2
  exit 1
fi

if ! [[ "$max_edge" =~ ^[0-9]+$ && "$max_edge" -gt 0 ]]; then
  echo "--max-edge must be a positive integer." >&2
  exit 1
fi

if ! [[ "$quality" =~ ^[0-9]+$ && "$quality" -ge 1 && "$quality" -le 100 ]]; then
  echo "--quality must be an integer from 1 to 100." >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick is required. Install it before sanitizing images." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

if [[ -z "$output_dir" ]]; then
  output_dir="$repo_root/public/images/pota/$slug"
elif [[ "$output_dir" != /* ]]; then
  output_dir="$repo_root/$output_dir"
fi

mkdir -p "$output_dir"

slugify_stem() {
  local stem="$1"
  stem="$(printf '%s' "$stem" | tr '[:upper:]' '[:lower:]')"
  stem="$(printf '%s' "$stem" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  if [[ -z "$stem" ]]; then
    stem="image"
  fi
  printf '%s' "$stem"
}

for input in "${inputs[@]}"; do
  if [[ ! -f "$input" ]]; then
    echo "Skipping missing input: $input" >&2
    continue
  fi

  filename="$(basename "$input")"
  stem="${filename%.*}"
  safe_stem="$(slugify_stem "$stem")"
  output="$output_dir/$safe_stem.jpg"
  tmp="$(mktemp "$output_dir/.sanitize-$safe_stem.XXXXXX.jpg")"

  magick "$input" \
    -auto-orient \
    -resize "${max_edge}x${max_edge}>" \
    -strip \
    -interlace Plane \
    -quality "$quality" \
    "$tmp"

  mv "$tmp" "$output"
  printf '%s\n' "${output#$repo_root/}"
done
