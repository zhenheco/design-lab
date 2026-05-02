#!/usr/bin/env bash
# Usage: collect.sh <image-path>
# v0.1: 只支援檔案上傳。Claude 自己看圖抽 tokens（透過 SKILL.md 指示），這個 script 負責互動引導 + 寫檔。
set -euo pipefail

IMAGE="${1:?usage: $0 <image-path>}"
[ -f "$IMAGE" ] || { echo "image not found: $IMAGE" >&2; exit 1; }

VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
[ -d "$VAULT" ] || { echo "vault not found: $VAULT (run init-library.sh first)" >&2; exit 1; }

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 互動: 詢問 minimal mode 欄位
read -p "Sentiment? (positive/negative) [positive]: " SENTIMENT
SENTIMENT="${SENTIMENT:-positive}"

read -p "Scenario? (landing/saas-ui/brand/content): " SCENARIO
[ -n "$SCENARIO" ] || { echo "scenario required" >&2; exit 1; }

read -p "Quote (1 句話為什麼喜歡/不喜歡): " QUOTE
[ -n "$QUOTE" ] || { echo "quote required" >&2; exit 1; }

# Slug: 用 image basename 預設、用戶可改
DEFAULT_SLUG=$(basename "$IMAGE" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed 's/--*/-/g; s/^-//; s/-$//')
read -p "Slug [$DEFAULT_SLUG]: " SLUG
SLUG="${SLUG:-$DEFAULT_SLUG}"

read -p "Client? [_personal]: " CLIENT
CLIENT="${CLIENT:-_personal}"

# v0.1 tokens 抽取靠 Claude vision（在 SKILL.md 指示 Claude 看完圖把 tokens 結構化丟進 stdin）
# 這個 script 從 stdin 讀 tokens JSON（如果有），否則用空值
echo "請貼 tokens JSON（Claude 看完圖後產出，省略則留空）："
echo "(輸入完按 Ctrl+D 結束)"
TOKENS_JSON=$(cat || echo '{}')
TOKENS_JSON="${TOKENS_JSON:-{\}}"

# 呼叫 case-writer
DESIGN_LAB_VAULT_PATH="$VAULT" node --import tsx --input-type=module -e "
import { writeCase } from '$SKILL_DIR/lib/case-writer.ts';
const tokens = JSON.parse(process.argv[1] || '{}');
const result = writeCase({
    client: '$CLIENT',
    slug: '$SLUG',
    sentiment: '$SENTIMENT',
    scenario: '$SCENARIO',
    quote: \`$QUOTE\`,
    sourceImagePath: '$IMAGE',
    tokens
});
console.log('Created:', result.casePath);
console.log('Assets:', result.assetsDir);
" "$TOKENS_JSON"
