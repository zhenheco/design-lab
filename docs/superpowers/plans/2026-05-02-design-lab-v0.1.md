# design-lab v0.1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `design-lab` Claude Code skill 的 v0.1 MVP — 4 個 slash command 有最小可用功能 + 1 個 stub、memory 目錄結構（Obsidian vault 內）、schema migration framework 起手式、NEVER lint regex engine。Spec: `docs/superpowers/specs/2026-05-02-design-lab-design.md`

**Architecture:**
- **Skill 程式碼** 開發於 `/Volumes/500G/Claude Code Projects/Design skill/skill/`，最終 symlink 部署到 `~/.claude/skills/design-lab/`。SKILL.md (frontmatter + slash command 路由) + bash scripts (user 互動 / wrapper) + node helpers (邏輯)。
- **Memory** 在 `~/Documents/CC Cli/design-library/`（Obsidian vault 內），純 markdown source of truth。v0.1 不上 SQLite（v0.2 才加索引快取，v0.1 < 50 case 純 grep + LLM 即可）。
- **無 build step**：純 ESM JS（不上 TypeScript）、bash scripts。
- **Schema migration framework 起手式**：`lib/schema.js` 含 `CURRENT_SCHEMA_VERSION = 1`，`migrations/` 目錄存在但空，啟動腳本跑 schema check（v1 無 diff 直接過）。

**Tech Stack:**
- Bash (script wrapper, user 互動)
- Node.js v20+ ESM (lib/ 邏輯, no TypeScript, no build)
- npm packages: `gray-matter` (markdown frontmatter parse)、`chalk@5` (CLI 顏色)
- 測試：`node --test` (Node 內建 test runner，不用 jest)

**Out of v0.1 scope (v0.2+):**
- SQLite 索引快取
- Playwright URL 解構（v0.1 只支援手動圖檔上傳，靠 vision LLM）
- Hook keyword pre-filter + candidates 候選池
- LLM detector for NEVER (v0.1 只 regex)
- Distill 自動化（v0.1 stub only）

---

## Task 1: 專案初始化 + git + 目錄結構 + deploy 腳本

**Files:**
- Create: `/Volumes/500G/Claude Code Projects/Design skill/.gitignore`
- Create: `/Volumes/500G/Claude Code Projects/Design skill/skill/SKILL.md` (placeholder)
- Create: `/Volumes/500G/Claude Code Projects/Design skill/package.json`
- Create: `/Volumes/500G/Claude Code Projects/Design skill/deploy.sh`
- Create: `/Volumes/500G/Claude Code Projects/Design skill/skill/scripts/.keep`
- Create: `/Volumes/500G/Claude Code Projects/Design skill/skill/lib/.keep`
- Create: `/Volumes/500G/Claude Code Projects/Design skill/skill/templates/.keep`
- Create: `/Volumes/500G/Claude Code Projects/Design skill/skill/migrations/README.md`
- Create: `/Volumes/500G/Claude Code Projects/Design skill/skill/tests/.keep`

- [ ] **Step 1.1: cd to project root + git init**

```bash
cd "/Volumes/500G/Claude Code Projects/Design skill"
git init
git config user.email "ace@zhenhe-co.com"
git config user.name "zhenheco"
```

- [ ] **Step 1.2: 建立目錄結構**

```bash
mkdir -p skill/{scripts,lib,templates,migrations,tests}
touch skill/scripts/.keep skill/lib/.keep skill/templates/.keep skill/tests/.keep
```

- [ ] **Step 1.3: 寫 .gitignore**

```bash
cat > .gitignore <<'EOF'
node_modules/
.DS_Store
*.log
.env
EOF
```

- [ ] **Step 1.4: 寫 package.json（最小化）**

```bash
cat > package.json <<'EOF'
{
  "name": "design-lab",
  "version": "0.1.0",
  "description": "Personal brand design system Claude Code skill",
  "type": "module",
  "scripts": {
    "test": "node --test \"skill/tests/*.test.js\"",
    "deploy": "bash deploy.sh"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "chalk": "^5.3.0"
  },
  "engines": {
    "node": ">=20"
  }
}
EOF
npm install
```

- [ ] **Step 1.5: 寫 deploy.sh（symlink to ~/.claude/skills/design-lab）**

```bash
cat > deploy.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$REPO_DIR/skill"
SKILL_DST="$HOME/.claude/skills/design-lab"

if [ ! -d "$SKILL_SRC" ]; then
    echo "ERROR: $SKILL_SRC not found"
    exit 1
fi

# 移除舊 symlink/dir
if [ -L "$SKILL_DST" ]; then
    rm "$SKILL_DST"
elif [ -d "$SKILL_DST" ]; then
    echo "ERROR: $SKILL_DST exists as real dir; refuse to overwrite. Move or rm manually first."
    exit 1
fi

ln -s "$SKILL_SRC" "$SKILL_DST"
echo "Deployed: $SKILL_DST -> $SKILL_SRC"
ls -la "$SKILL_DST"
EOF
chmod +x deploy.sh
```

- [ ] **Step 1.6: 寫 placeholder SKILL.md（Task 5 會擴充）**

```bash
cat > skill/SKILL.md <<'EOF'
---
name: design-lab
description: 個人化品牌設計系統 — 學習偏好、累積個案、自動演化。WIP placeholder.
version: 0.1.0
---

# design-lab (WIP)

This is a placeholder. Full implementation in Task 5.
EOF
```

- [ ] **Step 1.7: 寫 migrations/README.md**

```bash
cat > skill/migrations/README.md <<'EOF'
# Schema Migrations

每個 migration 腳本命名 `vN-to-v(N+1).sh`，必須:

1. Idempotent：重跑不破壞已 migrate 的資料
2. 接受 `<vault-path>` 參數，遞迴處理該目錄下所有有 `schema_version` 欄位的 markdown
3. 原地修改 frontmatter + 更新 `schema_version` 欄位到新值
4. 失敗回 non-zero exit code

skill 啟動時自動掃 `lib/schema.js` 的 `CURRENT_SCHEMA_VERSION` 跟 vault 最舊版本比對，差異就提示用戶執行 migration（先 git commit pre-snapshot）。

詳見 spec §11：docs/superpowers/specs/2026-05-02-design-lab-design.md
EOF
```

- [ ] **Step 1.8: Commit**

```bash
git add .
git commit -m "feat: initialize design-lab v0.1 project structure"
```

---

## Task 2: Schema framework — schema.js + check-schema.sh

**Files:**
- Create: `skill/lib/schema.js`
- Create: `skill/scripts/check-schema.sh`
- Create: `skill/tests/schema.test.js`

- [ ] **Step 2.1: 寫 failing test（測 schema check 在 vault 沒檔案時 pass）**

```bash
cat > skill/tests/schema.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/check-schema.sh', import.meta.url));

test('check-schema: empty vault passes', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    const out = execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.match(out, /OK: schema v\d+ \(no files yet\)/);
});

test('check-schema: vault with schema_version=1 passes', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    mkdirSync(join(vault, 'cases'));
    writeFileSync(join(vault, 'cases', '0001.md'), '---\nschema_version: 1\n---\nbody');
    const out = execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.match(out, /OK: schema v1/);
});

test('check-schema: vault with schema_version=0 (older) fails with migration prompt', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    mkdirSync(join(vault, 'cases'));
    writeFileSync(join(vault, 'cases', '0001.md'), '---\nschema_version: 0\n---\nbody');
    let exitCode = 0;
    let stderr = '';
    try {
        execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        exitCode = e.status;
        stderr = e.stderr.toString();
    }
    assert.equal(exitCode, 2);
    assert.match(stderr, /MIGRATION_NEEDED.*v0.*v1/);
});
EOF
```

- [ ] **Step 2.2: Run test → expect FAIL（檔案不存在）**

Run: `cd "/Volumes/500G/Claude Code Projects/Design skill" && node --test skill/tests/schema.test.js`
Expected: 全部 FAIL（`check-schema.sh` 不存在）

- [ ] **Step 2.3: 寫 lib/schema.js**

```bash
cat > skill/lib/schema.js <<'EOF'
// Schema version tracking. Bump when frontmatter / rule structure changes.
// 對應 migration script: skill/migrations/v<N>-to-v<N+1>.sh

export const CURRENT_SCHEMA_VERSION = 1;
EOF
```

- [ ] **Step 2.4: 寫 scripts/check-schema.sh**

```bash
cat > skill/scripts/check-schema.sh <<'EOF'
#!/usr/bin/env bash
# Usage: check-schema.sh <vault-path>
# Exit codes: 0 = OK, 2 = migration needed, 1 = error
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
[ -d "$VAULT" ] || { echo "ERROR: vault not found: $VAULT" >&2; exit 1; }

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CURRENT=$(node -e "import('$SKILL_DIR/lib/schema.js').then(m => console.log(m.CURRENT_SCHEMA_VERSION))")

# 找所有 markdown 的最小 schema_version
OLDEST=$(grep -rh "^schema_version:" "$VAULT" 2>/dev/null \
    | awk '{print $2}' \
    | sort -n \
    | head -1 || true)

if [ -z "$OLDEST" ]; then
    echo "OK: schema v$CURRENT (no files yet)"
    exit 0
fi

if [ "$OLDEST" -eq "$CURRENT" ]; then
    echo "OK: schema v$CURRENT"
    exit 0
elif [ "$OLDEST" -lt "$CURRENT" ]; then
    echo "MIGRATION_NEEDED: vault has v$OLDEST, skill expects v$CURRENT" >&2
    echo "Run: bash $SKILL_DIR/scripts/migrate.sh \"$VAULT\"" >&2
    exit 2
else
    echo "ERROR: vault schema v$OLDEST > skill v$CURRENT (downgrade not supported)" >&2
    exit 1
fi
EOF
chmod +x skill/scripts/check-schema.sh
```

- [ ] **Step 2.5: Run test → expect PASS**

Run: `node --test skill/tests/schema.test.js`
Expected: 3 tests pass

- [ ] **Step 2.6: Commit**

```bash
git add skill/lib/schema.js skill/scripts/check-schema.sh skill/tests/schema.test.js
git commit -m "feat(schema): add schema version check + framework starter"
```

---

## Task 3: Memory init 腳本 — init-library.sh

**Files:**
- Create: `skill/scripts/init-library.sh`
- Create: `skill/templates/personal-style-guide.md`
- Create: `skill/templates/scenario-override.md`
- Create: `skill/tests/init-library.test.js`

- [ ] **Step 3.1: 寫 failing test**

```bash
cat > skill/tests/init-library.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/init-library.sh', import.meta.url));

test('init-library: creates expected directory tree', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });

    assert.ok(existsSync(join(vault, 'personal-style-guide.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'landing.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'saas-ui.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'brand.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'content.md')));
    assert.ok(existsSync(join(vault, 'cases')));
    assert.ok(existsSync(join(vault, 'anti-library')));
    assert.ok(existsSync(join(vault, 'candidates')));
});

test('init-library: personal-style-guide has schema_version=1', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    const content = readFileSync(join(vault, 'personal-style-guide.md'), 'utf8');
    assert.match(content, /schema_version: 1/);
    assert.match(content, /## DO/);
    assert.match(content, /## NEVER/);
    assert.match(content, /## SOMETIMES/);
});

test('init-library: idempotent (re-run does not overwrite)', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    // 用戶手改 personal-style-guide
    const guidePath = join(vault, 'personal-style-guide.md');
    const original = readFileSync(guidePath, 'utf8');
    const modified = original + '\n## My custom rule\n';
    writeFileSync(guidePath, modified);

    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    const after = readFileSync(guidePath, 'utf8');
    assert.equal(after, modified, 'init should not overwrite user changes');
});
EOF
```

- [ ] **Step 3.2: Run test → expect FAIL**

Run: `node --test skill/tests/init-library.test.js`
Expected: 全部 FAIL

- [ ] **Step 3.3: 寫 templates/personal-style-guide.md**

```bash
cat > skill/templates/personal-style-guide.md <<'EOF'
---
schema_version: 1
version: 1
updated: 2026-05-02
distilled_from_cases: 0
distilled_anti_cases: 0
---

# Avy 設計法則 v1

# 這是初始空白模板。隨著你 /design-collect 累積個案，
# 跑 /design-distill（v0.3 後）會自動 distill 成具體規則。
# v0.1 階段請手動編輯本檔。

## DO（你偏好的）

（待累積，例：配色 60-30-10、字型 Inter 700+...）

## NEVER（你絕對不要的）

（待累積，例如要寫機械可判的 NEVER 規則：）
- id: example-no-pure-black
  rule: "不要純黑 #000000"
  detector:
    type: regex
    pattern: '#000(?![0-9a-fA-F])|#000000|rgb\(0,\s*0,\s*0\)'
    target: css

## SOMETIMES（context-dependent）

（待累積，例：暗色模式視場景而定）
EOF
```

- [ ] **Step 3.4: 寫 templates/scenario-override.md**

```bash
cat > skill/templates/scenario-override.md <<'EOF'
---
schema_version: 1
parent: personal-style-guide.md
scenario: SCENARIO_NAME
---

# SCENARIO_NAME 場景特化

# 這是初始空白模板。記錄此場景的 override 偏好。

## 覆蓋通用法則

（待累積）

## 場景專屬偏好

（待累積）
EOF
```

- [ ] **Step 3.5: 寫 scripts/init-library.sh**

```bash
cat > skill/scripts/init-library.sh <<'EOF'
#!/usr/bin/env bash
# Usage: init-library.sh <vault-path>
# Idempotent: 已存在的檔案不覆蓋
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$VAULT"/{cases,anti-library,candidates,scenario-overrides}

# personal-style-guide
if [ ! -f "$VAULT/personal-style-guide.md" ]; then
    cp "$SKILL_DIR/templates/personal-style-guide.md" "$VAULT/personal-style-guide.md"
    echo "Created: $VAULT/personal-style-guide.md"
fi

# scenario overrides
for scenario in landing saas-ui brand content; do
    target="$VAULT/scenario-overrides/$scenario.md"
    if [ ! -f "$target" ]; then
        sed "s/SCENARIO_NAME/$scenario/g" "$SKILL_DIR/templates/scenario-override.md" > "$target"
        echo "Created: $target"
    fi
done

echo "OK: design-library initialized at $VAULT"
EOF
chmod +x skill/scripts/init-library.sh
```

- [ ] **Step 3.6: Run test → expect PASS**

Run: `node --test skill/tests/init-library.test.js`
Expected: 3 tests pass

- [ ] **Step 3.7: Commit**

```bash
git add skill/scripts/init-library.sh skill/templates/ skill/tests/init-library.test.js
git commit -m "feat(memory): add init-library script + templates"
```

---

## Task 4: NEVER lint regex engine — lib/lint.js

**Files:**
- Create: `skill/lib/lint.js`
- Create: `skill/scripts/lint.sh`
- Create: `skill/tests/lint.test.js`

- [ ] **Step 4.1: 寫 failing test**

```bash
cat > skill/tests/lint.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintCss, parseRulesFromGuide } from '../lib/lint.js';

const SAMPLE_RULES = [
    {
        id: 'no-gradient',
        rule: '不要漸層',
        detector: { type: 'regex', pattern: 'linear-gradient|radial-gradient|conic-gradient', target: 'css' },
        autoFix: { replace: /linear-gradient\([^)]+\)/g, with: '#1F2937' }
    },
    {
        id: 'no-pure-black',
        rule: '不要純黑',
        detector: { type: 'regex', pattern: '#000(?![0-9a-fA-F])|#000000|rgb\\(0,\\s*0,\\s*0\\)', target: 'css' }
    }
];

test('lintCss: detects gradient violation', () => {
    const css = '.hero { background: linear-gradient(45deg, #fff, #000); }';
    const result = lintCss(css, SAMPLE_RULES);
    assert.equal(result.violations.length, 2); // gradient + pure black
    assert.ok(result.violations.some(v => v.ruleId === 'no-gradient'));
    assert.ok(result.violations.some(v => v.ruleId === 'no-pure-black'));
});

test('lintCss: clean css has no violations', () => {
    const css = '.hero { background: #1F2937; color: #FFFFFF; }';
    const result = lintCss(css, SAMPLE_RULES);
    assert.equal(result.violations.length, 0);
});

test('lintCss: auto-fix replaces gradient with solid color', () => {
    const css = '.hero { background: linear-gradient(45deg, #fff, #aaa); }';
    const result = lintCss(css, SAMPLE_RULES, { autoFix: true });
    assert.match(result.fixedCss, /background:\s*#1F2937/);
    assert.equal(result.fixes.length, 1);
});

test('lintCss: skips rules in lint_skip list', () => {
    const css = '.hero { background: linear-gradient(45deg, #fff, #aaa); }';
    const result = lintCss(css, SAMPLE_RULES, { lintSkip: ['no-gradient'] });
    assert.equal(result.violations.filter(v => v.ruleId === 'no-gradient').length, 0);
});

test('parseRulesFromGuide: extracts NEVER rules from style-guide markdown', () => {
    const md = `---
version: 1
---
## NEVER
- id: no-gradient
  rule: "不要漸層"
  detector:
    type: regex
    pattern: 'linear-gradient'
    target: css
- id: no-pure-black
  rule: "不要純黑"
  detector:
    type: regex
    pattern: '#000000'
    target: css
`;
    const rules = parseRulesFromGuide(md);
    assert.equal(rules.length, 2);
    assert.equal(rules[0].id, 'no-gradient');
    assert.equal(rules[1].id, 'no-pure-black');
});
EOF
```

- [ ] **Step 4.2: Run test → expect FAIL**

Run: `node --test skill/tests/lint.test.js`
Expected: 全部 FAIL（lib/lint.js 不存在）

- [ ] **Step 4.3: 寫 lib/lint.js**

```bash
cat > skill/lib/lint.js <<'EOF'
import matter from 'gray-matter';

/**
 * 對 css 字串跑 NEVER lint 規則。
 * @param {string} css - CSS source
 * @param {Array} rules - NEVER rules with regex detectors
 * @param {object} opts - { autoFix: bool, lintSkip: string[] }
 * @returns {{ violations: Array, fixedCss: string, fixes: Array }}
 */
export function lintCss(css, rules, opts = {}) {
    const { autoFix = false, lintSkip = [] } = opts;
    const violations = [];
    const fixes = [];
    let fixedCss = css;

    for (const rule of rules) {
        if (lintSkip.includes(rule.id)) continue;
        if (rule.detector.type !== 'regex') continue;
        if (rule.detector.target !== 'css') continue;

        const re = new RegExp(rule.detector.pattern, 'g');
        const matches = [...fixedCss.matchAll(re)];

        if (matches.length === 0) continue;

        for (const m of matches) {
            violations.push({
                ruleId: rule.id,
                rule: rule.rule,
                match: m[0],
                index: m.index
            });
        }

        if (autoFix && rule.autoFix) {
            const before = fixedCss;
            fixedCss = fixedCss.replace(rule.autoFix.replace, rule.autoFix.with);
            if (before !== fixedCss) {
                fixes.push({
                    ruleId: rule.id,
                    note: `replaced ${rule.autoFix.replace} with ${rule.autoFix.with}`
                });
            }
        }
    }

    return { violations, fixedCss, fixes };
}

/**
 * 從 personal-style-guide.md 抽出 NEVER 規則陣列。
 * NEVER section 用簡化 YAML-ish 格式（不是嚴格 YAML）：
 *   - id: <id>
 *     rule: "..."
 *     detector:
 *       type: regex
 *       pattern: '...'
 *       target: css
 */
export function parseRulesFromGuide(markdown) {
    const { content } = matter(markdown);
    const rules = [];

    // 找 ## NEVER section
    const neverMatch = content.match(/##\s+NEVER[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/);
    if (!neverMatch) return rules;

    const neverBlock = neverMatch[1];
    // split by "- id:"
    const ruleBlocks = neverBlock.split(/\n(?=- id:)/);
    for (const block of ruleBlocks) {
        if (!block.trim().startsWith('- id:')) continue;
        const idMatch = block.match(/- id:\s*([^\n]+)/);
        const ruleMatch = block.match(/rule:\s*"([^"]+)"/);
        const patternMatch = block.match(/pattern:\s*'([^']+)'/);
        const targetMatch = block.match(/target:\s*(\w+)/);
        if (idMatch && patternMatch) {
            rules.push({
                id: idMatch[1].trim(),
                rule: ruleMatch ? ruleMatch[1] : '',
                detector: {
                    type: 'regex',
                    pattern: patternMatch[1],
                    target: targetMatch ? targetMatch[1] : 'css'
                }
            });
        }
    }
    return rules;
}
EOF
```

- [ ] **Step 4.4: Run test → expect PASS**

Run: `node --test skill/tests/lint.test.js`
Expected: 5 tests pass

- [ ] **Step 4.5: 寫 scripts/lint.sh wrapper**

```bash
cat > skill/scripts/lint.sh <<'EOF'
#!/usr/bin/env bash
# Usage: lint.sh <css-file-or-html-file> <style-guide.md>
# Output: JSON to stdout: { violations: [...], fixedCss: "...", fixes: [...] }
set -euo pipefail

INPUT="${1:?usage: $0 <input-file> <style-guide.md>}"
GUIDE="${2:?usage: $0 <input-file> <style-guide.md>}"
[ -f "$INPUT" ] || { echo "input not found: $INPUT" >&2; exit 1; }
[ -f "$GUIDE" ] || { echo "guide not found: $GUIDE" >&2; exit 1; }

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node --input-type=module -e "
import { readFileSync } from 'fs';
import { lintCss, parseRulesFromGuide } from '$SKILL_DIR/lib/lint.js';
const css = readFileSync('$INPUT', 'utf8');
const guide = readFileSync('$GUIDE', 'utf8');
const rules = parseRulesFromGuide(guide);
const result = lintCss(css, rules, { autoFix: false });
console.log(JSON.stringify(result, null, 2));
"
EOF
chmod +x skill/scripts/lint.sh
```

- [ ] **Step 4.6: Commit**

```bash
git add skill/lib/lint.js skill/scripts/lint.sh skill/tests/lint.test.js
git commit -m "feat(lint): add NEVER regex lint engine + style-guide parser"
```

---

## Task 5: SKILL.md 主入口 + 5 個 slash command 路由

**Files:**
- Modify: `skill/SKILL.md`（從 placeholder 擴成完整版）

- [ ] **Step 5.1: 完整覆蓋 skill/SKILL.md**

```bash
cat > skill/SKILL.md <<'EOF'
---
name: design-lab
description: 個人化品牌設計系統 skill — 跨場景（landing / SaaS UI / brand / content）累積你喜歡/不喜歡的設計、自動演化「Avy 設計法則」、設計時自動 retrieve 相關個案 + lint NEVER 規則。v0.1 MVP：4 commands 有最小可用功能 + 1 stub。Memory 在 ~/Documents/CC Cli/design-library/。
version: 0.1.0
---

# design-lab v0.1 MVP

個人化品牌設計系統。Memory 庫位置：`~/Documents/CC Cli/design-library/`（Obsidian vault 內）。

## 啟動 hook

每個 slash command 第一個動作都跑 schema check：

```bash
bash $SKILL_DIR/scripts/check-schema.sh "$HOME/Documents/CC Cli/design-library"
```

退出碼 2 = 提示用戶跑 migration；退出碼 1 = 致命錯誤；退出碼 0 = 繼續。

如 vault 不存在，先跑 `bash $SKILL_DIR/scripts/init-library.sh "$HOME/Documents/CC Cli/design-library"` 初始化。

## Slash Commands

### `/design <task description>` — 主入口

**做什麼**：根據任務描述，從個案庫抽相似 case，綜合 personal-style-guide 規則層，產出 design。

執行流程（v0.1 簡化版）:
1. 跑 `scripts/design.sh "<task description>"`，腳本會:
   - LLM judge 場景（landing / saas-ui / brand / content）
   - 載入 `personal-style-guide.md` + `scenario-overrides/<scenario>.md`
   - 把 vault `cases/*.md` 全部 frontmatter 摘要餵 Claude，挑 top 5 相似案
   - **如果 case_count < 50**：呼叫內部 fallback `read-starter-pool.sh`（從 `~/.claude/skills/ui-ux-pro-max/SKILL.md` 抽 starter，標明為 starter pool）
   - 產出 design markdown（依場景 template）
   - 跑 `scripts/lint.sh` 對 design 中的 css/html 跑 NEVER regex check
   - 顯示 design + rationale + reference 個案 wiki link

### `/design-collect [image-path]` — 收藏個案（v0.1 只支援檔案上傳）

**做什麼**：把一張圖收進 cases/ 或 anti-library/。

執行流程：
1. 跑 `scripts/collect.sh <image-path>`
2. 腳本把圖讀入後 → vision LLM 看圖抽 design tokens（palette、typography、spacing 等）
3. 互動 minimal mode 問用戶:
   - sentiment: positive | negative
   - 1 句 quote「為什麼喜歡 / 不喜歡」
   - scenario: landing | saas-ui | brand | content（自動偵測，按 Enter 接受）
4. 寫 `cases/<slug>.md`（positive）或 `anti-library/<slug>.md`（negative），含 frontmatter（schema_version=1）+ embed 截圖
5. URL 自動截圖路徑 v0.2 才上（請用戶手動截圖丟進來）

### `/design-feedback [optional: target]` — 對 design 給回饋

**做什麼**：寫 feedback log（JSONL）+ 必要時 commit case 進 library。

執行流程：
1. 跑 `scripts/feedback.sh "<feedback text>"`
2. LLM 解析 feedback：sentiment / dimension / quote / target
3. 寫 `~/Documents/CC Cli/design-library/feedback-log.jsonl`（v0.2 才搬到 SQLite）
4. positive + 用戶明說「存進去」→ 觸發 collect 流程把當下 design 寫進 cases/
5. negative + 用戶明說「不要」→ 寫 anti-library/
6. v0.1 不做 hook 自動偵測語氣（v0.2 才上）

### `/design-stats` — 看 library 狀態

**做什麼**：顯示基礎報表（case count、scenario 分布、最近收藏）。

執行流程：跑 `scripts/stats.sh`。

### `/design-distill` — STUB（v0.1 不實作）

**做什麼**：v0.1 只顯示提示文字。

執行流程：跑 `scripts/distill.sh`，會印:
```
[design-lab v0.1] /design-distill 在 v0.3 自動化。
目前請手動編輯 ~/Documents/CC Cli/design-library/personal-style-guide.md
（DO / NEVER / SOMETIMES 三段直接編輯）。
```

## 環境變數

- `DESIGN_LAB_VAULT_PATH`：default `$HOME/Documents/CC Cli/design-library`
- `DESIGN_LAB_STATE_PATH`：default `$HOME/.claude/state/design-lab/`（last-artifact.txt 等 transient state）

## v0.1 已知限制

- 不支援 URL 自動截圖（v0.2）
- 不支援 hook 自動偵測語氣 → candidates pending review（v0.2）
- 不支援 LLM detector for NEVER（只 regex）（v0.2）
- 不支援自動 distill（v0.3）
- 不支援 SQLite 索引（純 markdown grep + LLM 挑）（v0.2）
EOF
```

- [ ] **Step 5.2: Commit**

```bash
git add skill/SKILL.md
git commit -m "feat(skill): write full SKILL.md with 5 slash command routes"
```

---

## Task 6: `/design-collect` — 檔案上傳 mode

**Files:**
- Create: `skill/scripts/collect.sh`
- Create: `skill/lib/case-writer.js`
- Create: `skill/tests/case-writer.test.js`

- [ ] **Step 6.1: 寫 failing test for case-writer**

```bash
cat > skill/tests/case-writer.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeCase } from '../lib/case-writer.js';
import matter from 'gray-matter';

test('writeCase: writes positive case with frontmatter + assets dir', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cw-'));
    const slug = 'test-stripe';
    const result = writeCase(vault, {
        slug,
        sentiment: 'positive',
        scenario: 'landing',
        quote: '配色乾淨',
        sourceImagePath: '/tmp/fixture.png',
        tokens: {
            palette: { primary: '#635BFF', bg: '#FFFFFF' },
            typography: { heading: 'Inter 600' }
        }
    });

    assert.equal(result.casePath, join(vault, 'cases', `${slug}.md`));
    assert.ok(existsSync(result.casePath));

    const md = readFileSync(result.casePath, 'utf8');
    const fm = matter(md);
    assert.equal(fm.data.schema_version, 1);
    assert.equal(fm.data.slug, slug);
    assert.equal(fm.data.sentiment, 'positive');
    assert.equal(fm.data.scenario, 'landing');
    assert.deepEqual(fm.data.quotes_from_user, ['配色乾淨']);
    assert.equal(fm.data.tokens.palette.primary, '#635BFF');
});

test('writeCase: negative sentiment goes to anti-library', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cw-'));
    const result = writeCase(vault, {
        slug: 'too-flat',
        sentiment: 'negative',
        scenario: 'brand',
        quote: '太扁太無聊',
        sourceImagePath: '/tmp/fixture.png',
        tokens: { palette: {} }
    });
    assert.equal(result.casePath, join(vault, 'anti-library', 'too-flat.md'));
    assert.ok(existsSync(result.casePath));
});

test('writeCase: rejects duplicate slug', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cw-'));
    writeCase(vault, { slug: 'same', sentiment: 'positive', scenario: 'landing', quote: 'a', sourceImagePath: '/tmp/x.png', tokens: {} });
    assert.throws(
        () => writeCase(vault, { slug: 'same', sentiment: 'positive', scenario: 'landing', quote: 'b', sourceImagePath: '/tmp/x.png', tokens: {} }),
        /already exists/
    );
});
EOF
```

- [ ] **Step 6.2: Run test → expect FAIL**

Run: `node --test skill/tests/case-writer.test.js`
Expected: FAIL（lib/case-writer.js 不存在）

- [ ] **Step 6.3: 寫 lib/case-writer.js**

```bash
cat > skill/lib/case-writer.js <<'EOF'
import matter from 'gray-matter';
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

/**
 * 寫 case markdown + 資產目錄。
 * @param {string} vault - vault path（design-library 根）
 * @param {object} c - case data
 * @returns {{ casePath: string, assetsDir: string }}
 */
export function writeCase(vault, c) {
    const { slug, sentiment, scenario, quote, sourceImagePath, tokens } = c;
    if (!slug || !sentiment || !scenario) throw new Error('missing required fields');

    const subdir = sentiment === 'positive' ? 'cases' : 'anti-library';
    const targetDir = join(vault, subdir);
    mkdirSync(targetDir, { recursive: true });

    const casePath = join(targetDir, `${slug}.md`);
    if (existsSync(casePath)) {
        throw new Error(`case already exists: ${casePath}`);
    }

    const assetsDir = join(targetDir, slug);
    mkdirSync(assetsDir, { recursive: true });

    // copy snapshot
    const snapshotName = 'snapshot' + extname(sourceImagePath);
    const snapshotTarget = join(assetsDir, snapshotName);
    if (existsSync(sourceImagePath)) {
        copyFileSync(sourceImagePath, snapshotTarget);
    }

    const frontmatter = {
        schema_version: 1,
        slug,
        captured_at: new Date().toISOString(),
        source: { type: 'upload', via: '/design-collect' },
        scenario,
        sentiment,
        quotes_from_user: [quote],
        tokens: tokens || {},
        tags: { style: [], mood: [], elements: [], industry: [] },
        related: [],
        lint_skip: []
    };

    const body = `\n## 為什麼${sentiment === 'positive' ? '喜歡' : '不喜歡'}\n\n${quote}\n\n## 截圖\n\n![[${slug}/${snapshotName}]]\n\n## 解構觀察\n\n（事後在 Obsidian 補）\n`;

    writeFileSync(casePath, matter.stringify(body, frontmatter));
    return { casePath, assetsDir };
}
EOF
```

- [ ] **Step 6.4: Run test → expect PASS**

Run: `node --test skill/tests/case-writer.test.js`
Expected: 3 tests pass

- [ ] **Step 6.5: 寫 scripts/collect.sh（互動 wrapper）**

```bash
cat > skill/scripts/collect.sh <<'EOF'
#!/usr/bin/env bash
# Usage: collect.sh <image-path>
# v0.1: 只支援檔案上傳。Claude 自己看圖抽 tokens（透過 SKILL.md 指示），這個 script 負責互動引導 + 寫檔。
set -euo pipefail

IMAGE="${1:?usage: $0 <image-path>}"
[ -f "$IMAGE" ] || { echo "image not found: $IMAGE" >&2; exit 1; }

VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
[ -d "$VAULT" ] || { echo "vault not found: $VAULT (run init-library.sh first)" >&2; exit 1; }

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 互動: 詢問 minimal mode 4 個欄位
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

# v0.1 tokens 抽取靠 Claude vision（在 SKILL.md 指示 Claude 看完圖把 tokens 結構化丟進 stdin）
# 這個 script 從 stdin 讀 tokens JSON（如果有），否則用空值
echo "請貼 tokens JSON（Claude 看完圖後產出，省略則留空）："
echo "(輸入完按 Ctrl+D 結束)"
TOKENS_JSON=$(cat || echo '{}')
TOKENS_JSON="${TOKENS_JSON:-{\}}"

# 呼叫 case-writer
node --input-type=module -e "
import { writeCase } from '$SKILL_DIR/lib/case-writer.js';
const tokens = JSON.parse(process.argv[1] || '{}');
const result = writeCase('$VAULT', {
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
EOF
chmod +x skill/scripts/collect.sh
```

- [ ] **Step 6.6: Commit**

```bash
git add skill/scripts/collect.sh skill/lib/case-writer.js skill/tests/case-writer.test.js
git commit -m "feat(collect): add /design-collect file upload mode + case writer"
```

---

## Task 7: `/design` 主入口最小版

**Files:**
- Create: `skill/scripts/design.sh`
- Create: `skill/lib/case-loader.js`
- Create: `skill/lib/last-artifact.js`
- Create: `skill/tests/case-loader.test.js`

- [ ] **Step 7.1: 寫 failing test for case-loader**

```bash
cat > skill/tests/case-loader.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCaseSummaries } from '../lib/case-loader.js';

function setupVault() {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cl-'));
    mkdirSync(join(vault, 'cases'));
    writeFileSync(join(vault, 'cases', '0001-stripe.md'),
        '---\nschema_version: 1\nslug: 0001-stripe\nscenario: landing\nsentiment: positive\nquotes_from_user: ["乾淨"]\n---\nbody');
    writeFileSync(join(vault, 'cases', '0002-linear.md'),
        '---\nschema_version: 1\nslug: 0002-linear\nscenario: saas-ui\nsentiment: positive\nquotes_from_user: ["精緻"]\n---\nbody');
    return vault;
}

test('loadCaseSummaries: returns all positive cases', () => {
    const vault = setupVault();
    const summaries = loadCaseSummaries(vault);
    assert.equal(summaries.length, 2);
    assert.equal(summaries[0].slug, '0001-stripe');
    assert.equal(summaries[1].slug, '0002-linear');
});

test('loadCaseSummaries: filter by scenario', () => {
    const vault = setupVault();
    const summaries = loadCaseSummaries(vault, { scenario: 'landing' });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].slug, '0001-stripe');
});

test('loadCaseSummaries: returns empty array if cases dir missing', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cl-'));
    const summaries = loadCaseSummaries(vault);
    assert.equal(summaries.length, 0);
});
EOF
```

- [ ] **Step 7.2: Run test → expect FAIL**

Run: `node --test skill/tests/case-loader.test.js`
Expected: FAIL

- [ ] **Step 7.3: 寫 lib/case-loader.js**

```bash
cat > skill/lib/case-loader.js <<'EOF'
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

/**
 * 讀 vault cases/ 下所有 markdown，回傳 frontmatter 摘要陣列。
 * @param {string} vault
 * @param {object} opts - { scenario?: string }
 * @returns {Array<{ slug, scenario, sentiment, quotes_from_user, tags, tokens, mdPath }>}
 */
export function loadCaseSummaries(vault, opts = {}) {
    const casesDir = join(vault, 'cases');
    if (!existsSync(casesDir)) return [];

    const files = readdirSync(casesDir).filter(f => f.endsWith('.md'));
    const out = [];
    for (const f of files) {
        const mdPath = join(casesDir, f);
        const raw = readFileSync(mdPath, 'utf8');
        const fm = matter(raw).data;
        if (opts.scenario && fm.scenario !== opts.scenario) continue;
        out.push({
            slug: fm.slug,
            scenario: fm.scenario,
            sentiment: fm.sentiment,
            quotes_from_user: fm.quotes_from_user || [],
            tags: fm.tags || {},
            tokens: fm.tokens || {},
            mdPath
        });
    }
    return out;
}
EOF
```

- [ ] **Step 7.4: 寫 lib/last-artifact.js（給未來 hook 用，v0.2 才接 hook，但 v0.1 先寫 helper）**

```bash
cat > skill/lib/last-artifact.js <<'EOF'
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { dirname } from 'path';

const STATE_FILE = process.env.DESIGN_LAB_STATE_PATH
    ? `${process.env.DESIGN_LAB_STATE_PATH}/last-artifact.txt`
    : `${process.env.HOME}/.claude/state/design-lab/last-artifact.txt`;

export function writeLastArtifact(slug) {
    const dir = dirname(STATE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // atomic: write to .tmp then rename
    const tmp = STATE_FILE + '.tmp';
    writeFileSync(tmp, slug);
    renameSync(tmp, STATE_FILE);
}

export function readLastArtifact() {
    if (!existsSync(STATE_FILE)) return null;
    return readFileSync(STATE_FILE, 'utf8').trim();
}
EOF
```

- [ ] **Step 7.5: Run test → expect PASS（case-loader）**

Run: `node --test skill/tests/case-loader.test.js`
Expected: 3 tests pass

- [ ] **Step 7.6: 寫 scripts/design.sh — v0.1 簡化版**

v0.1 設計流程不是傳統 script — 主要靠 Claude 在 session 中跑（讀 style-guide、看 case frontmatter、自己挑 top 5、產出 design）。script 只做：(a) 預載資料、(b) lint 後處理、(c) 寫 last-artifact。

```bash
cat > skill/scripts/design.sh <<'EOF'
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
EOF
chmod +x skill/scripts/design.sh
```

- [ ] **Step 7.7: Commit**

```bash
git add skill/scripts/design.sh skill/lib/case-loader.js skill/lib/last-artifact.js skill/tests/case-loader.test.js
git commit -m "feat(design): add /design main entry minimal version + case loader"
```

---

## Task 8: `/design-feedback`

**Files:**
- Create: `skill/scripts/feedback.sh`
- Create: `skill/lib/feedback-log.js`
- Create: `skill/tests/feedback-log.test.js`

- [ ] **Step 8.1: 寫 failing test**

```bash
cat > skill/tests/feedback-log.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendFeedback, readFeedback } from '../lib/feedback-log.js';

test('appendFeedback: writes JSONL line with required fields', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-'));
    appendFeedback(vault, {
        signal: 'like',
        user_quote: '配色不錯',
        case_slug: '0001-stripe',
        dimension: 'color'
    });
    const logPath = join(vault, 'feedback-log.jsonl');
    assert.ok(existsSync(logPath));
    const content = readFileSync(logPath, 'utf8');
    assert.match(content, /"signal":"like"/);
    assert.match(content, /"user_quote":"配色不錯"/);
});

test('appendFeedback: appends multiple lines', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-'));
    appendFeedback(vault, { signal: 'like', user_quote: 'a' });
    appendFeedback(vault, { signal: 'dislike', user_quote: 'b' });
    const all = readFeedback(vault);
    assert.equal(all.length, 2);
    assert.equal(all[0].signal, 'like');
    assert.equal(all[1].signal, 'dislike');
});

test('readFeedback: returns empty array if no log', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-'));
    const all = readFeedback(vault);
    assert.equal(all.length, 0);
});
EOF
```

- [ ] **Step 8.2: Run test → expect FAIL**

Run: `node --test skill/tests/feedback-log.test.js`
Expected: FAIL

- [ ] **Step 8.3: 寫 lib/feedback-log.js**

```bash
cat > skill/lib/feedback-log.js <<'EOF'
import { appendFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_NAME = 'feedback-log.jsonl';

/**
 * 寫 1 行 JSONL 到 vault/feedback-log.jsonl
 * @param {string} vault
 * @param {object} entry - { signal, user_quote, case_slug?, dimension?, derived_rule? }
 */
export function appendFeedback(vault, entry) {
    const logPath = join(vault, LOG_NAME);
    const record = {
        occurred_at: new Date().toISOString(),
        ...entry
    };
    appendFileSync(logPath, JSON.stringify(record) + '\n');
}

export function readFeedback(vault) {
    const logPath = join(vault, LOG_NAME);
    if (!existsSync(logPath)) return [];
    const text = readFileSync(logPath, 'utf8');
    return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
}
EOF
```

- [ ] **Step 8.4: Run test → expect PASS**

Run: `node --test skill/tests/feedback-log.test.js`
Expected: 3 tests pass

- [ ] **Step 8.5: 寫 scripts/feedback.sh**

```bash
cat > skill/scripts/feedback.sh <<'EOF'
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
EOF
chmod +x skill/scripts/feedback.sh
```

- [ ] **Step 8.6: Commit**

```bash
git add skill/scripts/feedback.sh skill/lib/feedback-log.js skill/tests/feedback-log.test.js
git commit -m "feat(feedback): add /design-feedback with JSONL log"
```

---

## Task 9: `/design-stats` 基礎報表

**Files:**
- Create: `skill/scripts/stats.sh`
- Create: `skill/lib/stats.js`
- Create: `skill/tests/stats.test.js`

- [ ] **Step 9.1: 寫 failing test**

```bash
cat > skill/tests/stats.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeStats } from '../lib/stats.js';

test('computeStats: count by scenario', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-st-'));
    mkdirSync(join(vault, 'cases'));
    mkdirSync(join(vault, 'anti-library'));

    writeFileSync(join(vault, 'cases', 'a.md'),
        '---\nslug: a\nscenario: landing\nsentiment: positive\n---\n');
    writeFileSync(join(vault, 'cases', 'b.md'),
        '---\nslug: b\nscenario: landing\nsentiment: positive\n---\n');
    writeFileSync(join(vault, 'cases', 'c.md'),
        '---\nslug: c\nscenario: saas-ui\nsentiment: positive\n---\n');
    writeFileSync(join(vault, 'anti-library', 'd.md'),
        '---\nslug: d\nscenario: brand\nsentiment: negative\n---\n');

    const stats = computeStats(vault);
    assert.equal(stats.totals.positive, 3);
    assert.equal(stats.totals.negative, 1);
    assert.equal(stats.byScenario.landing, 2);
    assert.equal(stats.byScenario['saas-ui'], 1);
    assert.equal(stats.byScenario.brand, 1);
});
EOF
```

- [ ] **Step 9.2: Run test → expect FAIL**

Run: `node --test skill/tests/stats.test.js`
Expected: FAIL

- [ ] **Step 9.3: 寫 lib/stats.js**

```bash
cat > skill/lib/stats.js <<'EOF'
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

export function computeStats(vault) {
    const totals = { positive: 0, negative: 0 };
    const byScenario = {};

    for (const sub of ['cases', 'anti-library']) {
        const dir = join(vault, sub);
        if (!existsSync(dir)) continue;
        const files = readdirSync(dir).filter(f => f.endsWith('.md'));
        for (const f of files) {
            const fm = matter(readFileSync(join(dir, f), 'utf8')).data;
            if (fm.sentiment === 'positive') totals.positive++;
            else if (fm.sentiment === 'negative') totals.negative++;
            const sc = fm.scenario || 'unknown';
            byScenario[sc] = (byScenario[sc] || 0) + 1;
        }
    }
    return { totals, byScenario };
}
EOF
```

- [ ] **Step 9.4: Run test → expect PASS**

Run: `node --test skill/tests/stats.test.js`
Expected: 1 test pass

- [ ] **Step 9.5: 寫 scripts/stats.sh**

```bash
cat > skill/scripts/stats.sh <<'EOF'
#!/usr/bin/env bash
# Usage: stats.sh
set -euo pipefail
VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -d "$VAULT" ] || { echo "vault not found: $VAULT" >&2; exit 1; }

node --input-type=module -e "
import { computeStats } from '$SKILL_DIR/lib/stats.js';
const s = computeStats('$VAULT');
console.log('=== Avy Design Library Stats (v0.1 basic) ===');
console.log('Total cases:', s.totals.positive, 'positive /', s.totals.negative, 'negative');
console.log('');
console.log('By scenario:');
for (const [sc, n] of Object.entries(s.byScenario)) {
    console.log('  ' + sc + ': ' + n);
}
"
EOF
chmod +x skill/scripts/stats.sh
```

- [ ] **Step 9.6: Commit**

```bash
git add skill/scripts/stats.sh skill/lib/stats.js skill/tests/stats.test.js
git commit -m "feat(stats): add /design-stats basic report"
```

---

## Task 10: `/design-distill` stub

**Files:**
- Create: `skill/scripts/distill.sh`

- [ ] **Step 10.1: 寫 stub script**

```bash
cat > skill/scripts/distill.sh <<'EOF'
#!/usr/bin/env bash
# Usage: distill.sh
# v0.1 STUB: 自動 distill 在 v0.3 才上。
set -euo pipefail

VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"

cat <<MSG

[design-lab v0.1] /design-distill 在 v0.3 自動化。

目前請手動編輯：
  $VAULT/personal-style-guide.md

直接編輯 DO / NEVER / SOMETIMES 三段。NEVER 規則記得遵守 spec §3.2 的格式才能被 lint 引擎讀到：

- id: <unique-id>
  rule: "說明"
  detector:
    type: regex
    pattern: '<regex>'
    target: css

跑 /design-stats 看你 library 累積進度。
MSG
EOF
chmod +x skill/scripts/distill.sh
```

- [ ] **Step 10.2: Commit**

```bash
git add skill/scripts/distill.sh
git commit -m "feat(distill): add /design-distill stub for v0.1"
```

---

## Task 11: E2E smoke test + deploy + dogfood path-through

**Files:**
- Create: `skill/tests/e2e-smoke.test.js`

- [ ] **Step 11.1: 寫 E2E smoke test**

```bash
cat > skill/tests/e2e-smoke.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';
const SKILL_DIR = fileURLToPath(new URL('..', import.meta.url));

function runScript(script, args = '', env = {}) {
    return execSync(`bash "${SKILL_DIR}/scripts/${script}" ${args}`, {
        encoding: 'utf8',
        env: { ...process.env, ...env }
    });
}

test('E2E: init → schema check → stats on empty vault', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    runScript('init-library.sh', `"${vault}"`);
    assert.ok(existsSync(join(vault, 'personal-style-guide.md')));

    const checkOut = runScript('check-schema.sh', `"${vault}"`);
    assert.match(checkOut, /OK: schema v1/);

    const statsOut = runScript('stats.sh', '', { DESIGN_LAB_VAULT_PATH: vault });
    assert.match(statsOut, /Total cases: 0/);
});

test('E2E: write fake case via case-writer → stats reflects it', async () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    runScript('init-library.sh', `"${vault}"`);

    // Inject a fake case using case-writer
    const fakeImg = join(vault, 'fake.png');
    writeFileSync(fakeImg, 'fake-png-bytes');

    const { writeCase } = await import(join(SKILL_DIR, 'lib/case-writer.js'));
    writeCase(vault, {
        slug: 'test-stripe',
        sentiment: 'positive',
        scenario: 'landing',
        quote: '測試',
        sourceImagePath: fakeImg,
        tokens: { palette: { primary: '#635BFF' } }
    });

    const statsOut = runScript('stats.sh', '', { DESIGN_LAB_VAULT_PATH: vault });
    assert.match(statsOut, /Total cases: 1 positive/);
    assert.match(statsOut, /landing: 1/);
});

test('E2E: distill stub prints help text', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    runScript('init-library.sh', `"${vault}"`);
    const out = runScript('distill.sh', '', { DESIGN_LAB_VAULT_PATH: vault });
    assert.match(out, /v0\.3 自動化/);
    assert.match(out, /personal-style-guide\.md/);
});
EOF
```

- [ ] **Step 11.2: Run E2E test → expect PASS**

Run: `node --test skill/tests/e2e-smoke.test.js`
Expected: 3 tests pass

- [ ] **Step 11.3: 跑全部 test 一次**

Run: `npm test`
Expected: 15+ tests 全 pass（schema 3 + init 3 + lint 5 + case-writer 3 + case-loader 3 + feedback 3 + stats 1 + e2e 3）

- [ ] **Step 11.4: Deploy 到 ~/.claude/skills/design-lab/**

```bash
bash deploy.sh
```

Expected output:
```
Deployed: /Users/avyhsu/.claude/skills/design-lab -> /Volumes/500G/Claude Code Projects/Design skill/skill
```

驗證：
```bash
ls -la ~/.claude/skills/design-lab/
# 應該看到 SKILL.md, scripts/, lib/, templates/, migrations/
```

- [ ] **Step 11.5: 手動跑 dogfood 路徑（不算 test，是用戶驗證）**

依序：
```bash
# 1. 初始化 vault
bash ~/.claude/skills/design-lab/scripts/init-library.sh "$HOME/Documents/CC Cli/design-library"

# 2. Schema check
bash ~/.claude/skills/design-lab/scripts/check-schema.sh "$HOME/Documents/CC Cli/design-library"

# 3. Stats（應該 0 case）
bash ~/.claude/skills/design-lab/scripts/stats.sh

# 4. Distill stub
bash ~/.claude/skills/design-lab/scripts/distill.sh
```

預期：4 個 command 都正常輸出、無 error。

接著在 Claude Code session 內試 `/design-collect <some-image>`、`/design "做一個 landing page 測試"`、`/design-feedback "這個讚"`、`/design-stats` — 預期主流程通。

- [ ] **Step 11.6: Commit + tag v0.1.0**

```bash
git add skill/tests/e2e-smoke.test.js
git commit -m "test(e2e): add smoke tests for full skill path"
git tag v0.1.0
```

---

## Plan Self-Review

**Spec coverage**：
- ✅ Spec §1 問題與目標 → Goal section + 各 task 對應 5 個 slash command
- ✅ Spec §2.2 目錄結構 → Task 1 + Task 3 (memory) + Task 5 (SKILL.md)
- ✅ Spec §3.1 個案 markdown frontmatter → Task 6 (case-writer.js)
- ✅ Spec §3.2 規則層 schema → Task 3 (templates) + Task 4 (lint parser)
- ✅ Spec §4.1 /design 主入口流程 → Task 7
- ✅ Spec §4.2 /design-collect → Task 6
- ✅ Spec §4.3 /design-feedback → Task 8
- ✅ Spec §4.4 /design-distill stub → Task 10
- ✅ Spec §4.5 /design-stats → Task 9
- ✅ Spec §5.1 NEVER lint regex 引擎 → Task 4
- ✅ Spec §5.2 starter pool fallback → 在 SKILL.md (Task 5) + design.sh (Task 7) 標明 case_count<50 引用
- ✅ Spec §11 schema migration framework 起手式 → Task 2
- ⚠️ Spec §3.3 場景 inheritance → v0.1 只放 scenario-overrides 模板（Task 3），合併算法 v0.4 才實作（design.sh 直接讀，不跑 inheritance）
- ⚠️ Spec §3.4 SQLite 索引快取 → v0.1 不實作（plan 開頭已明標）
- ⚠️ Spec §5.4 候選池語氣偵測 → v0.2，plan 開頭已明標
- ⚠️ Spec §6 錯誤處理表 → 各 task 的 script 有基本 error check，但「URL 開不了 / DOM scrape 失敗 / Obsidian 寫入衝突」等 v0.2+ 才有的場景 v0.1 不適用

**Placeholder scan**：
- 已避免「TBD / TODO / implement later」
- 每個 step 有具體 code/command/expected output
- 參照 spec 的章節（§3.2 等）皆有具體出處

**Type consistency 檢查**：
- `writeCase()` (Task 6) 簽名跟 case-writer.test.js 對得上
- `lintCss()` (Task 4) 簽名跟 lint.test.js 對得上
- `loadCaseSummaries()` (Task 7) 跟 case-loader.test.js 對得上
- `appendFeedback()` (Task 8) 跟 feedback-log.test.js 對得上
- `computeStats()` (Task 9) 跟 stats.test.js 對得上
- 所有 frontmatter `schema_version: 1` 一致（Task 3 templates + Task 6 case-writer）
- 環境變數名稱一致：`DESIGN_LAB_VAULT_PATH` / `DESIGN_LAB_STATE_PATH`（在 SKILL.md / design.sh / collect.sh / feedback.sh / stats.sh / distill.sh / case-loader.test.js E2E 全部統一）

無 inconsistency。

---

## 範圍邊界提醒

**v0.1 完成 ≠ skill 立即可用**：v0.1 deploy 後第一次跑 `/design-collect` 還需要：
1. Claude 在 session 內看你給的 image，自己抽 design tokens 結構（這是 vision LLM 在 Claude session 跑、不是 script 程式碼）
2. 用戶手動回答 minimal mode 的 sentiment / scenario / quote
3. 第一次至少累積 5 個 case + 手動編 personal-style-guide.md 的 NEVER 規則，`/design` 才有東西可參考

**v0.2 才上**（已在 plan 開頭標 out-of-scope）：
- Playwright URL 自動截圖
- Hook keyword pre-filter + candidates pending review
- LLM detector for NEVER

**v0.3** 才上：自動 distill。
**v0.4** 才上：完整 inheritance 算法、stats 完整報表。

