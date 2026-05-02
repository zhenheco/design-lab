#!/usr/bin/env bash
# Usage: feedback.sh "<feedback text>"
# v0.1: Claude 自己解析 feedback（在 SKILL.md 指示下），這個 script 寫 log + 觸發 collect。
set -euo pipefail

FB="${1:?usage: $0 <feedback-text>}"
VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ -d "$VAULT" ] || { echo "vault not found: $VAULT" >&2; exit 1; }

# 預期 stdin 是 JSON：{ signal, user_quote, case_slug?, dimension? }
echo "請輸入解析後的 feedback JSON（Claude 從文字解析）："
echo "(範例: {\"signal\":\"like\",\"user_quote\":\"配色不錯\",\"dimension\":\"color\"})"
PARSED=$(cat)

node --input-type=module -e "
import { appendFeedback } from '$SKILL_DIR/lib/feedback-log.js';
const entry = JSON.parse(\`$PARSED\`);
appendFeedback('$VAULT', entry);
console.log('Logged feedback:', entry.signal, '/', entry.user_quote);
"
