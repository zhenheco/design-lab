#!/usr/bin/env bash
set -euo pipefail

VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
STATE_PATH="${DESIGN_LAB_STATE_PATH:-$HOME/.claude/state/design-lab}"
STATUS_FILE="$STATE_PATH/distill-status.json"
FEEDBACK_LOG="$VAULT/feedback-log.jsonl"
TASTE_OVERRIDES="$VAULT/taste-overrides.md"

DETAILS=()

if [ -f "$FEEDBACK_LOG" ]; then
  FEEDBACK_COUNT="$(awk 'NF { count++ } END { print count + 0 }' "$FEEDBACK_LOG")"
else
  FEEDBACK_COUNT=0
fi

PROCESSED_RECORDS=""
if [ -f "$TASTE_OVERRIDES" ]; then
  PROCESSED_RECORDS="$(grep -E '^processed_records:' "$TASTE_OVERRIDES" 2>/dev/null | head -n 1 | sed -E 's/^processed_records:[[:space:]]*([0-9]+).*$/\1/' || true)"
fi

if [ -z "$PROCESSED_RECORDS" ]; then
  DETAILS+=("processed_records=missing feedback-log=$FEEDBACK_COUNT")
elif [ "$FEEDBACK_COUNT" -ne "$PROCESSED_RECORDS" ] 2>/dev/null; then
  DETAILS+=("feedback-log=$FEEDBACK_COUNT processed_records=$PROCESSED_RECORDS")
fi

if [ -f "$STATUS_FILE" ]; then
  STATUS_OK="$(grep -E '"ok"[[:space:]]*:' "$STATUS_FILE" 2>/dev/null | head -n 1 | sed -E 's/.*"ok"[[:space:]]*:[[:space:]]*(true|false).*/\1/' || true)"
  if [ "$STATUS_OK" = "false" ]; then
    DETAILS+=("status.ok=false")
  fi

  LAST_RUN="$(grep -E '"last_run_iso"[[:space:]]*:' "$STATUS_FILE" 2>/dev/null | head -n 1 | sed -E 's/.*"last_run_iso"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || true)"
  if [ -n "$LAST_RUN" ] && command -v python3 >/dev/null 2>&1; then
    HOURS_AGO="$(LAST_RUN="$LAST_RUN" python3 - <<'PY' 2>/dev/null || echo 999
from datetime import datetime, timezone
import os

raw = os.environ["LAST_RUN"].replace("Z", "+00:00")
try:
    last = datetime.fromisoformat(raw)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    print(int((datetime.now(timezone.utc) - last).total_seconds() // 3600))
except Exception:
    print(999)
PY
)"
    if [ "$HOURS_AGO" -gt 26 ] || [ "$HOURS_AGO" -eq 26 ]; then
      DETAILS+=("last_run>26h (${HOURS_AGO}h)")
    fi
  elif [ -z "$LAST_RUN" ]; then
    DETAILS+=("last_run=missing")
  fi
else
  DETAILS+=("status=missing")
fi

if [ "${#DETAILS[@]}" -gt 0 ]; then
  DETAIL_TEXT="${DETAILS[0]}"
  for detail in "${DETAILS[@]:1}"; do
    DETAIL_TEXT="$DETAIL_TEXT; $detail"
  done
  echo "⚠️ design-lab distill drift: $DETAIL_TEXT"
fi
