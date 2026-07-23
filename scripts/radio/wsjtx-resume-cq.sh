#!/usr/bin/env bash

set -euo pipefail

log_file="${HOME}/Library/Application Support/WSJT-X/wsjtx_log.adi"
poll_seconds="0.5"
resume_delay_seconds="1"
dry_run=false
check_only=false

usage() {
  printf '%s\n' \
    "Usage: $(basename "$0") [options]" \
    "" \
    "Watch the WSJT-X ADIF log and re-enable transmission after each new QSO." \
    "The helper starts at the current end of the log, so existing QSOs are ignored." \
    "" \
    "Options:" \
    "  --check             Verify that WSJT-X and its Enable Tx control are visible." \
    "  --dry-run           Report new QSOs without pressing Enable Tx." \
    "  --delay SECONDS     Wait before resuming CQ (default: 1)." \
    "  --poll SECONDS      Log polling interval (default: 0.5)." \
    "  --log PATH          Watch a different ADIF log." \
    "  -h, --help          Show this help." \
    "" \
    "Press Control-C to stop."
}

while (( $# > 0 )); do
  case "$1" in
    --check)
      check_only=true
      shift
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --delay)
      [[ $# -ge 2 ]] || { printf 'Missing value for --delay\n' >&2; exit 2; }
      resume_delay_seconds="$2"
      shift 2
      ;;
    --poll)
      [[ $# -ge 2 ]] || { printf 'Missing value for --poll\n' >&2; exit 2; }
      poll_seconds="$2"
      shift 2
      ;;
    --log)
      [[ $# -ge 2 ]] || { printf 'Missing value for --log\n' >&2; exit 2; }
      log_file="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'This helper requires macOS.\n' >&2
  exit 1
fi

if [[ ! -f "$log_file" ]]; then
  printf 'WSJT-X ADIF log not found: %s\n' "$log_file" >&2
  exit 1
fi

count_qsos() {
  awk '
    BEGIN { count = 0 }
    {
      remaining = tolower($0)
      while ((position = index(remaining, "<eor>")) > 0) {
        count++
        remaining = substr(remaining, position + 5)
      }
    }
    END { print count }
  ' "$log_file"
}

enable_tx_state() {
  local should_press="$1"

  PRESS_ENABLE_TX="$should_press" osascript <<'APPLESCRIPT'
tell application "System Events"
  if not (exists process "wsjtx") then error "WSJT-X is not running"

  tell process "wsjtx"
    set mainWindow to missing value
    repeat with aWindow in every window
      try
        if name of aWindow starts with "WSJT-X   v" then
          set mainWindow to aWindow
          exit repeat
        end if
      end try
    end repeat

    if mainWindow is missing value then error "The main WSJT-X window was not found"

    set allElements to entire contents of mainWindow
    repeat with anElement in allElements
      try
        if role of anElement is "AXCheckBox" and name of anElement is "Enable Tx" then
          if value of anElement is 0 then
            if system attribute "PRESS_ENABLE_TX" is "yes" then
              perform action "AXPress" of anElement
              return "enabled"
            end if
            return "disabled"
          end if
          return "already-enabled"
        end if
      end try
    end repeat
  end tell
end tell

error "The Enable Tx checkbox was not found in the main WSJT-X window"
APPLESCRIPT
}

state="$(enable_tx_state no)" || {
  printf '%s\n' \
    "Could not access WSJT-X." \
    "Allow your terminal to control System Events in System Settings → Privacy & Security → Automation." >&2
  exit 1
}

if [[ "$check_only" == true ]]; then
  printf 'WSJT-X is reachable; Enable Tx is %s. No control was pressed.\n' "$state"
  exit 0
fi

initial_qso_count="$(count_qsos)"
last_qso_count="$initial_qso_count"

printf '%s\n' \
  "WSJT-X resume-CQ helper is running." \
  "Watching: $log_file" \
  "Ignoring the $initial_qso_count QSO(s) already in the log." \
  "After each new QSO: wait ${resume_delay_seconds}s, then enable Tx if needed." \
  "Press Control-C to stop."

if [[ "$dry_run" == true ]]; then
  printf 'DRY RUN: Enable Tx will not be pressed.\n'
fi

trap 'printf "\nStopped; WSJT-X was left unchanged.\n"; exit 0' INT TERM

while true; do
  sleep "$poll_seconds"

  if [[ ! -f "$log_file" ]]; then
    printf 'Waiting for log to reappear: %s\n' "$log_file" >&2
    while [[ ! -f "$log_file" ]]; do
      sleep "$poll_seconds"
    done
    last_qso_count="$(count_qsos)"
    printf 'Log found again; now tracking from %s QSO(s).\n' "$last_qso_count"
    continue
  fi

  current_qso_count="$(count_qsos)"

  if (( current_qso_count < last_qso_count )); then
    last_qso_count="$current_qso_count"
    printf 'Log was cleared; now tracking from %s QSO(s).\n' "$last_qso_count"
    continue
  fi

  if (( current_qso_count == last_qso_count )); then
    continue
  fi

  new_qso_count=$((current_qso_count - last_qso_count))
  last_qso_count="$current_qso_count"
  printf 'Detected %s new QSO(s); log now contains %s.\n' "$new_qso_count" "$current_qso_count"

  sleep "$resume_delay_seconds"

  if [[ "$dry_run" == true ]]; then
    printf 'DRY RUN: Would enable Tx if it were off.\n'
    continue
  fi

  if state="$(enable_tx_state yes)"; then
    case "$state" in
      enabled)
        printf 'Enable Tx pressed; CQ will resume on the next transmit period.\n'
        ;;
      already-enabled)
        printf 'Enable Tx was already on; left it unchanged.\n'
        ;;
      *)
        printf 'Unexpected WSJT-X state: %s\n' "$state" >&2
        ;;
    esac
  else
    printf '%s\n' \
      "Could not re-enable Tx; the helper will keep watching." \
      "Check that the main WSJT-X window is open and that Terminal has Accessibility/Automation permission." >&2
  fi
done
