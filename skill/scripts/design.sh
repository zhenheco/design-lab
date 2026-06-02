#!/usr/bin/env bash
# Usage: design.sh <task-description> [client] [scenario]
# v0.4: 優先載入 sidecar merged context，失敗時降級到 no-merge memory。
set -euo pipefail

TASK="${1:?usage: $0 <task-description> [client] [scenario]}"
CLIENT="${2:-_personal}"
SCENARIO="${3:-}"
VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIDECAR_BASE_URL="${DESIGN_LAB_SIDECAR_URL:-http://127.0.0.1:${DESIGN_LAB_SIDECAR_PORT:-5174}}"

[ -d "$VAULT" ] || { echo "vault not found: $VAULT" >&2; exit 1; }

# Step 1: schema check
bash "$SKILL_DIR/scripts/check-schema.sh" "$VAULT" || exit $?

# v0.3: 自動 ensure sidecar，給 bridge skill 抓 context；fail soft
bash "$SKILL_DIR/scripts/ensure-sidecar.sh" || \
    echo "[design] sidecar 啟動失敗，bridge 將 fallback to no-memory" >&2

CONTEXT_FILE="$(mktemp "${TMPDIR:-/tmp}/design-context.XXXXXX")"
trap 'rm -f "$CONTEXT_FILE"' EXIT

CONTEXT_URL="$(
    SIDECAR_BASE_URL="$SIDECAR_BASE_URL" CLIENT="$CLIENT" SCENARIO="$SCENARIO" node --input-type=module -e "
const url = new URL('/api/context', process.env.SIDECAR_BASE_URL);
url.searchParams.set('client', process.env.CLIENT);
if (process.env.SCENARIO) {
    url.searchParams.set('scenario', process.env.SCENARIO);
}
console.log(url.toString());
"
)"

render_context() {
    CONTEXT_FILE="$CONTEXT_FILE" TASK="$TASK" CLIENT="$CLIENT" SCENARIO="$SCENARIO" \
        VAULT="$VAULT" SKILL_DIR="$SKILL_DIR" node --input-type=module -e '
import { readFileSync } from "node:fs";

const context = JSON.parse(readFileSync(process.env.CONTEXT_FILE, "utf8"));
const task = process.env.TASK;
const client = process.env.CLIENT;
const scenario = process.env.SCENARIO;
const vault = process.env.VAULT;
const skillDir = process.env.SKILL_DIR;

function printSection(title, body, emptyText = "（無）") {
    console.log(`=== ${title} ===`);
    const text = typeof body === "string" ? body.trim() : "";
    console.log(text || emptyText);
    console.log("");
}

function compact(value) {
    if (value === undefined || value === null) {
        return "（無）";
    }
    if (typeof value === "string") {
        return value || "（無）";
    }
    if (Array.isArray(value) && value.length === 0) {
        return "[]";
    }
    if (typeof value === "object" && Object.keys(value).length === 0) {
        return "{}";
    }
    return JSON.stringify(value);
}

function quoteLines(quotes) {
    if (!Array.isArray(quotes) || quotes.length === 0) {
        console.log("  quotes_from_user: （無）");
        return;
    }
    console.log("  quotes_from_user:");
    for (const quote of quotes) {
        console.log(`    - ${quote}`);
    }
}

function aspectLines(aspects, sentiment) {
    if (!Array.isArray(aspects)) {
        return;
    }
    for (const aspect of aspects) {
        if (!aspect || typeof aspect !== "object" || aspect.sentiment !== sentiment) {
            continue;
        }
        const dimension = aspect.dimension || "unknown";
        const note = aspect.note || "";
        console.log(`    - ${sentiment}: ${dimension}${note ? ` - ${note}` : ""}`);
    }
}

console.log("=== TASK ===");
console.log(task);
console.log(`client=${client} scenario=${scenario || "（未指定）"}`);
console.log("");

printSection("全域 self-brand 法則", context.styleGuide);
printSection(`${client} 品牌法則`, context.brandStyleGuide, "無 per-brand guide");
if (context.scenarioOverride && String(context.scenarioOverride).trim()) {
    printSection("scenario override", context.scenarioOverride);
}

console.log("=== NEVER 規則（硬約束）===");
if (Array.isArray(context.neverRules) && context.neverRules.length > 0) {
    for (const rule of context.neverRules) {
        const pattern = rule?.detector?.pattern ?? "";
        console.log(`- ${rule.id}: ${rule.rule || ""}`);
        console.log(`  detector.pattern: ${pattern}`);
    }
} else {
    console.log("（無）");
}
console.log("");

console.log("=== 喜歡的參考 cases ===");
const cases = Array.isArray(context.cases) ? context.cases : [];
if (cases.length === 0) {
    console.log("（無）");
}
for (const entry of cases) {
    console.log(`- ${entry.slug} (${entry.scenario || "no-scenario"})`);
    console.log(`  palette(tokens): ${compact(entry.tokens?.palette)}`);
    console.log(`  fonts: ${compact(entry.tokens?.fonts)}`);
    quoteLines(entry.quotes_from_user);
    aspectLines(entry.aspects, "like");
}
console.log("");

console.log("=== 要避免（anti-cases）===");
const antiCases = Array.isArray(context.antiCases) ? context.antiCases : [];
if (antiCases.length === 0) {
    console.log("（無）");
}
for (const entry of antiCases) {
    console.log(`- ${entry.slug} (${entry.scenario || "no-scenario"})`);
    quoteLines(entry.quotes_from_user);
    aspectLines(entry.aspects, "dislike");
}
console.log("");

console.log("=== meta ===");
console.log(`retrievedFrom: ${JSON.stringify(context.retrievedFrom || [])}`);
console.log(`case_count: ${cases.length}`);
console.log("");

console.log("=== INSTRUCTIONS to Claude ===");
console.log(`1. 為 ${client} 的 ${scenario || "通用場景"} 設計前端。`);
console.log("2. 硬守每條 NEVER；遵全域 DO + 該 brand 法則；scenario override 優先於通用。");
console.log("3. 參考「喜歡的 cases」的 palette/fonts/liked aspects 去 emulate。");
console.log("4. 避免 anti-cases + disliked aspects。");
console.log("5. 產出 CSS/HTML 後，echo css 部分到 .design-output.css，先跑：");
console.log(`   bash ${skillDir}/scripts/lint.sh .design-output.css \"${vault}/personal-style-guide.md\"`);
console.log("6. 若 lint.sh 支援多 guide，再加 brand guide：");
console.log(`   bash ${skillDir}/scripts/lint.sh .design-output.css \"${vault}/personal-style-guide.md\" \"${vault}/clients/${client}/style-guide.md\"`);
console.log("7. 違反 NEVER 自動修正、提示用戶。");
console.log("8. 寫 artifact slug：");
console.log(`   node --input-type=module -e \"import {writeLastArtifact} from \\\"${skillDir}/lib/last-artifact.js\\\"; writeLastArtifact(\\\"design-${scenario || "general"}-$(date +%Y%m%d-%H%M)\\\");\"`);
'
}

render_fallback() {
    echo "sidecar 不可用，降級 no-merge 記憶" >&2

    # Step 2: 輸出載入資料給 Claude（stdout 是 Claude 看的）
echo "=== TASK ==="
echo "$TASK"
echo "client=$CLIENT scenario=${SCENARIO:-（未指定）}"
echo ""
echo "=== personal-style-guide.md ==="
if [ -f "$VAULT/personal-style-guide.md" ]; then
    cat "$VAULT/personal-style-guide.md"
else
    echo "(no personal-style-guide.md — 用 ui-ux-pro-max starter)"
fi
echo ""
echo "=== cases/ frontmatter summary ==="
V_PATH="$VAULT" S_PATH="$SKILL_DIR" node --import tsx --input-type=module -e "
    import { join } from 'node:path';
    const { loadCaseSummaries } = await import(join(process.env.S_PATH, 'lib/case-loader.ts'));
    const all = loadCaseSummaries(process.env.V_PATH);
    console.log(JSON.stringify(all.map(c => ({
        client: c.client,
        slug: c.slug,
        scenario: c.scenario,
        quotes: c.quotes_from_user,
        tags: c.tags,
        palette: c.tokens.palette
    })), null, 2));
" || echo "[design] case summary 載入失敗，略過" >&2

CASE_COUNT=$(find "$VAULT/clients" -path "*/cases/*.md" 2>/dev/null | wc -l | tr -d ' ')
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
}

if curl -sf "$CONTEXT_URL" > "$CONTEXT_FILE" && render_context; then
    exit 0
fi

render_fallback
