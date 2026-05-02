#!/usr/bin/env bash
# Usage: design.sh <task-description>
# v0.1: 預載 style-guide + cases summary 給 Claude，Claude 自己挑 + 產出，最後跑 lint。
set -euo pipefail

TASK="${1:?usage: $0 <task-description>}"
VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ -d "$VAULT" ] || { echo "vault not found: $VAULT" >&2; exit 1; }

# Step 1: schema check
bash "$SKILL_DIR/scripts/check-schema.sh" "$VAULT" || exit $?

# Step 2: 輸出載入資料給 Claude（stdout 是 Claude 看的）
echo "=== TASK ==="
echo "$TASK"
echo ""
echo "=== personal-style-guide.md ==="
cat "$VAULT/personal-style-guide.md"
echo ""
echo "=== cases/ frontmatter summary ==="
node --input-type=module -e "
import { loadCaseSummaries } from '$SKILL_DIR/lib/case-loader.js';
const all = loadCaseSummaries('$VAULT');
console.log(JSON.stringify(all.map(c => ({
    slug: c.slug,
    scenario: c.scenario,
    quotes: c.quotes_from_user,
    tags: c.tags,
    palette: c.tokens.palette
})), null, 2));
"

CASE_COUNT=$(find "$VAULT/cases" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "=== meta ==="
echo "case_count: $CASE_COUNT"
if [ "$CASE_COUNT" -lt 50 ]; then
    echo "fallback_starter_pool: TRUE (case_count < 50, 引用 ui-ux-pro-max starter)"
else
    echo "fallback_starter_pool: FALSE"
fi

echo ""
echo "=== INSTRUCTIONS to Claude ==="
echo "1. 從上面 cases summary 挑 top 5 跟 task 相似的個案"
echo "2. 載入 scenario-overrides/<scenario>.md（如果存在）"
echo "3. 綜合 personal-style-guide DO + NEVER + top 5 個案 → 產出 design"
echo "4. design 完成後 echo css 部分到 .design-output.css 跑 lint:"
echo "   bash $SKILL_DIR/scripts/lint.sh .design-output.css \"$VAULT/personal-style-guide.md\""
echo "5. 違反 NEVER 自動修正、提示用戶"
echo "6. 寫 artifact slug:"
echo "   node --input-type=module -e \"import {writeLastArtifact} from '$SKILL_DIR/lib/last-artifact.js'; writeLastArtifact('design-<scenario>-\$(date +%Y%m%d-%H%M)');\""
