# design-lab v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 design-lab v0.1 升級為 v0.2 — 多客戶 schema + Astro local dashboard，取代 4 個 slash command（保留 `/design`、新增 `/design-dashboard`）。

**Architecture:** Markdown vault 仍是 source of truth（保 Obsidian 共存），加 SQLite 索引快取（chokidar 監聽 markdown 變動 + content hash invalidation）。Vault 結構從 flat `cases/` 改為 `clients/<slug>/cases/`，case frontmatter 加 `client` 欄位。Dashboard 是 Astro 5 SSR + Node adapter 單一 app（API routes 在 `src/pages/api/`），shadcn-ui 限互動 island。Vision LLM adapter chain：gemini-rotate.sh（spawn 子進程，6 帳號輪替）為主，Anthropic API（`ANTHROPIC_API_KEY` 有就啟用）為 fallback。

**Tech Stack:** Node 20 ESM、TypeScript strict、Astro 5 SSR + @astrojs/node、Tailwind 4、shadcn-ui (React island)、better-sqlite3、chokidar、gray-matter、Vitest（dashboard）+ node --test（lib，沿用 v0.1）+ Playwright E2E。

**Spec reference:** `docs/superpowers/specs/2026-05-02-design-lab-v0.2-design.md`（v0.1 spec：`docs/superpowers/specs/2026-05-02-design-lab-design.md`）

---

## Phase Order & Dependencies

```
A (Foundation)        → paths + schema_v2 + migration（lib 純加新檔，不破壞 v0.1）
  ↓
B (Library refactor)  → case/client loader-writer 改 .ts，多客戶結構
  ↓
C (Index + watcher)   → SQLite + chokidar（依賴 B 的 path classification）
  ↓
D (Vision adapter)    → 擴 gemini-rotate.sh + adapter chain
  ↓
E (Dashboard scaffold) → Astro + Tailwind + shadcn 整合 + 5 page 空殼
  ↓
F (Dashboard pages)   → 8 個 task 把每 page + API route 實作完
  ↓
G (Glue)              → server entry + PID/idle watcher + slash command + 整合 e2e
```

**Each phase is independently committable** — phase 邊界保持綠色 build / 全測試 pass。

**Branching strategy**: 全在 `main`（v0.1 已 ship）。Phase A-D 不破壞 v0.1 CLI 功能；Phase E-G dashboard 與 CLI 並行存在。

---

## File Structure（v0.2 完成後）

```
skill/
├── SKILL.md                       # MODIFY (G3): v0.2 路由表
├── package.json                   # MODIFY: 加 better-sqlite3、chokidar、tsx、@types
├── tsconfig.json                  # CREATE (A1): TS strict for lib/*.ts
├── scripts/
│   ├── check-schema.sh            # MODIFY (A2): v2 偵測
│   ├── design.sh                  # MODIFY (B5): 引用新 .ts loader
│   ├── init-library.sh            # MODIFY (A4): v0.2 多客戶結構
│   ├── lint.sh                    # KEEP
│   ├── collect.sh                 # MODIFY (G3): 改 thin wrapper or 移除（dashboard 取代）
│   ├── feedback.sh                # MODIFY (G3): 同上
│   ├── stats.sh                   # MODIFY (G3): 同上
│   ├── distill.sh                 # MODIFY (G3): 同上
│   ├── dashboard-start.sh         # CREATE (G2)
│   ├── dashboard-stop.sh          # CREATE (G2)
│   └── migrate-v1-to-v2.sh        # CREATE (A3)
├── lib/
│   ├── paths.ts                   # CREATE (A1)
│   ├── case-loader.ts             # CREATE (B1) replaces case-loader.js
│   ├── case-writer.ts             # CREATE (B2) replaces case-writer.js
│   ├── client-loader.ts           # CREATE (B3)
│   ├── client-writer.ts           # CREATE (B4)
│   ├── feedback-log.js            # MODIFY (B6): 加 client field
│   ├── lint.js                    # KEEP
│   ├── schema.js                  # MODIFY (A2): bump CURRENT to 2
│   ├── stats.js                   # MODIFY (B5): by-client breakdown
│   ├── last-artifact.js           # KEEP
│   ├── case-loader.js             # DELETE (B1) after migration
│   ├── case-writer.js             # DELETE (B2) after migration
│   ├── index/
│   │   ├── db.ts                  # CREATE (C1)
│   │   ├── reindex.ts             # CREATE (C2)
│   │   └── watcher.ts             # CREATE (C3)
│   └── vision/
│       ├── adapter.ts             # CREATE (D2)
│       ├── gemini-rotate.ts       # CREATE (D3)
│       ├── anthropic.ts           # CREATE (D4)
│       └── chain.ts               # CREATE (D5)
├── dashboard/
│   ├── astro.config.mjs           # CREATE (E1)
│   ├── package.json               # CREATE (E1)
│   ├── tsconfig.json              # CREATE (E1)
│   ├── tailwind.config.ts         # CREATE (E2)
│   ├── components.json            # CREATE (E3): shadcn config
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro                # CREATE (E5, F1)
│   │   │   ├── clients/
│   │   │   │   ├── index.astro            # CREATE (F2)
│   │   │   │   └── [slug].astro           # CREATE (F3)
│   │   │   ├── collect.astro              # CREATE (F4-F5)
│   │   │   ├── feedback.astro             # CREATE (F7)
│   │   │   ├── style-guide.astro          # CREATE (F6)
│   │   │   └── api/
│   │   │       ├── clients.ts             # CREATE (F1, F2)
│   │   │       ├── cases.ts               # CREATE (F3, F5)
│   │   │       ├── feedback.ts            # CREATE (F7)
│   │   │       ├── style-guide.ts         # CREATE (F6)
│   │   │       ├── vision.ts              # CREATE (F4)
│   │   │       └── reindex.ts             # CREATE (F8)
│   │   ├── components/
│   │   │   ├── ClientSwitcher.tsx         # CREATE (F1)
│   │   │   ├── CaseGrid.astro             # CREATE (F3)
│   │   │   ├── ClientCrudForm.tsx         # CREATE (F2)
│   │   │   ├── DropZone.tsx               # CREATE (F4)
│   │   │   ├── CollectForm.tsx            # CREATE (F5)
│   │   │   ├── StyleGuideEditor.tsx       # CREATE (F6)
│   │   │   └── ThumbVote.tsx              # CREATE (F7)
│   │   ├── styles/
│   │   │   └── theme.css                  # CREATE (E4)
│   │   ├── lib/
│   │   │   ├── api-helpers.ts             # CREATE (F1)
│   │   │   └── theme-palette.ts           # CREATE (E4)
│   │   └── server.ts                      # CREATE (G1) Node entry + idle watcher
│   └── tests/
│       ├── e2e/
│       │   ├── client-crud.spec.ts        # CREATE (F2)
│       │   ├── case-grid.spec.ts          # CREATE (F3)
│       │   ├── collect.spec.ts            # CREATE (F5)
│       │   ├── style-guide.spec.ts        # CREATE (F6)
│       │   ├── feedback.spec.ts           # CREATE (F7)
│       │   └── full-flow.spec.ts          # CREATE (G4)
│       ├── unit/
│       │   ├── api-helpers.test.ts        # CREATE (F1)
│       │   └── theme-palette.test.ts      # CREATE (E4)
│       ├── playwright.config.ts           # CREATE (F2)
│       └── vitest.config.ts               # CREATE (F1)
├── templates/
│   ├── personal-style-guide.md            # KEEP
│   ├── scenario-override.md               # KEEP
│   └── client-meta.yaml                   # CREATE (A4)
├── migrations/
│   ├── README.md                          # MODIFY (A3): 補 v1-to-v2 段落
│   └── v1-to-v2.md                        # CREATE (A3)
└── tests/
    ├── schema.test.js                     # MODIFY (A2): 加 v2 偵測
    ├── init-library.test.js               # MODIFY (A4): 驗 v0.2 結構
    ├── case-loader.test.ts                # CREATE (B1)
    ├── case-writer.test.ts                # CREATE (B2)
    ├── client-loader.test.ts              # CREATE (B3)
    ├── client-writer.test.ts              # CREATE (B4)
    ├── stats.test.ts                      # CREATE (B5)
    ├── feedback-log.test.ts               # CREATE (B6)
    ├── migration.test.ts                  # CREATE (A3)
    ├── paths.test.ts                      # CREATE (A1)
    ├── vision/
    │   ├── adapter.test.ts                # CREATE (D2)
    │   ├── gemini-rotate.test.ts          # CREATE (D3)
    │   ├── anthropic.test.ts              # CREATE (D4)
    │   └── chain.test.ts                  # CREATE (D5)
    └── index/
        ├── db.test.ts                     # CREATE (C1)
        ├── reindex.test.ts                # CREATE (C2)
        └── watcher.test.ts                # CREATE (C3)
```

---

## Conventions

- **Test runner:** `node --test "skill/tests/**/*.test.{js,ts}"` for skill lib（v0.1 沿用 + tsx loader for .ts）。Dashboard 用 Vitest（`dashboard/tests/unit/`）+ Playwright（`dashboard/tests/e2e/`）。
- **TS execution:** lib 用 `tsx` runtime（不編譯），node --test 跑 `.ts` 檔須加 `--import tsx`。
- **Imports：** ESM only。`.ts` 檔互引用時帶 `.ts` 副檔名（避免 Node ESM 解析問題）。
- **Commit prefix：** `feat(<phase>):` / `test(<phase>):` / `fix(<phase>):` / `refactor(<phase>):`。例：`feat(A): add lib/paths.ts`。
- **TDD：** 每個 task 必先寫 failing test → run fail → 寫實作 → run pass → commit。違反就重做。
- **Phase boundary commit：** 每 phase 末跑全測試，0 fail 才開下一 phase。

---

## Plan format note

- **Phase A** 完整 TDD 5-step 形式（test → fail → impl → pass → commit），作為其他 phase 的範本
- **Phase B-G** 簡化為「task = file list + key behavior + key code skeleton + acceptance」。實作者（Sonnet PM + Codex）按 Phase A 範本套用 TDD，每個 task 仍須先寫 failing test
- 每 phase 末必跑 `npm test`、Codex ↔ Gemini cross-review，0 🔴 才進下一 phase

---

# Phase A — Foundation

**Goal:** 建立 v0.2 path resolver、schema_version=2 機制、migration 腳本、init 多客戶結構。所有改動**不破壞 v0.1 CLI 功能**。

**Phase exit:** `npm test` 全綠 + 手動驗證 init/migration + Codex↔Gemini 0 🔴。

### Task A0: package.json + tsconfig（讓 lib 可寫 .ts）

**Files:** Modify `package.json`, Create `tsconfig.json`

- [ ] **Step 1:** 改 `package.json` 加 tsx + 升 deps：

```json
{
  "name": "design-lab",
  "version": "0.2.0-dev",
  "type": "module",
  "scripts": {
    "test": "node --test --import tsx \"skill/tests/**/*.test.{js,ts}\"",
    "test:dashboard": "cd skill/dashboard && npm test",
    "test:e2e": "cd skill/dashboard && npm run test:e2e",
    "deploy": "bash deploy.sh"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "chalk": "^5.3.0",
    "better-sqlite3": "^11.5.0",
    "chokidar": "^4.0.1"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/better-sqlite3": "^7.6.11"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 2:** 建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["skill/lib/**/*", "skill/tests/**/*"],
  "exclude": ["skill/dashboard", "node_modules"]
}
```

- [ ] **Step 3:** Run `npm install` → 0 vulnerabilities, `node_modules/tsx` exists
- [ ] **Step 4:** Run `npm test` → 既有 24 測試 PASS（無 regression）
- [ ] **Step 5:** Commit `chore(A): add tsx + tsconfig + bump deps for v0.2 ts lib`

---

### Task A1: lib/paths.ts + tests

**Files:** Create `skill/lib/paths.ts`, `skill/tests/paths.test.ts`

- [ ] **Step 1: failing test** `skill/tests/paths.test.ts`：

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getVaultPath, getClientDir, getCasePath, getAntiCasePath,
  getClientMetaPath, getStyleGuidePath, getScenarioOverridePath,
  getIndexDbPath, isValidSlug, assertSafePath
} from '../lib/paths.ts';
import { homedir } from 'node:os';
import { join } from 'node:path';

test('paths: getVaultPath default', () => {
  delete process.env.DESIGN_LAB_VAULT_PATH;
  assert.equal(getVaultPath(), join(homedir(), 'Documents', 'CC Cli', 'design-library'));
});

test('paths: getVaultPath honors env override', () => {
  process.env.DESIGN_LAB_VAULT_PATH = '/tmp/custom-vault';
  assert.equal(getVaultPath(), '/tmp/custom-vault');
  delete process.env.DESIGN_LAB_VAULT_PATH;
});

test('paths: derived paths', () => {
  process.env.DESIGN_LAB_VAULT_PATH = '/tmp/v';
  assert.equal(getClientDir('aicycle'), '/tmp/v/clients/aicycle');
  assert.equal(getCasePath('aicycle', '0001'), '/tmp/v/clients/aicycle/cases/0001.md');
  assert.equal(getAntiCasePath('aicycle', '0001'), '/tmp/v/clients/aicycle/anti-library/0001.md');
  assert.equal(getClientMetaPath('aicycle'), '/tmp/v/clients/aicycle/meta.yaml');
  assert.equal(getStyleGuidePath(), '/tmp/v/personal-style-guide.md');
  assert.equal(getScenarioOverridePath('landing'), '/tmp/v/scenario-overrides/landing.md');
  assert.equal(getIndexDbPath(), '/tmp/v/.index/library.db');
  delete process.env.DESIGN_LAB_VAULT_PATH;
});

test('paths: isValidSlug accept lowercase a-z 0-9 _ -', () => {
  for (const s of ['aicycle', 'client-foo', '_personal', 'a1b2']) assert.equal(isValidSlug(s), true);
});

test('paths: isValidSlug reject unsafe', () => {
  for (const s of ['../etc', 'a/b', 'A-Big', 'foo bar', '']) assert.equal(isValidSlug(s), false);
});

test('paths: assertSafePath blocks traversal', () => {
  process.env.DESIGN_LAB_VAULT_PATH = '/tmp/v';
  assert.doesNotThrow(() => assertSafePath('/tmp/v/clients/aicycle/cases/x.md'));
  assert.throws(() => assertSafePath('/tmp/v/../../etc/passwd'), /Path traversal blocked/);
  assert.throws(() => assertSafePath('/etc/passwd'), /Path traversal blocked/);
  delete process.env.DESIGN_LAB_VAULT_PATH;
});
```

- [ ] **Step 2:** Run test → FAIL（檔不存在）
- [ ] **Step 3: implementation** `skill/lib/paths.ts`：

```typescript
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_VAULT = join(homedir(), 'Documents', 'CC Cli', 'design-library');

export function getVaultPath(): string {
  return process.env.DESIGN_LAB_VAULT_PATH || DEFAULT_VAULT;
}
export function getClientDir(slug: string): string { return join(getVaultPath(), 'clients', slug); }
export function getCasePath(client: string, slug: string): string { return join(getClientDir(client), 'cases', `${slug}.md`); }
export function getAntiCasePath(client: string, slug: string): string { return join(getClientDir(client), 'anti-library', `${slug}.md`); }
export function getClientMetaPath(client: string): string { return join(getClientDir(client), 'meta.yaml'); }
export function getStyleGuidePath(): string { return join(getVaultPath(), 'personal-style-guide.md'); }
export function getScenarioOverridePath(scenario: string): string { return join(getVaultPath(), 'scenario-overrides', `${scenario}.md`); }
export function getIndexDbPath(): string { return join(getVaultPath(), '.index', 'library.db'); }

const SLUG_RE = /^[a-z0-9_-]+$/;
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.includes('..')) return false;
  return SLUG_RE.test(slug);
}

export function assertSafePath(targetPath: string): void {
  const resolved = resolve(targetPath);
  const vault = resolve(getVaultPath());
  if (!resolved.startsWith(vault)) throw new Error(`Path traversal blocked: ${targetPath}`);
}
```

- [ ] **Step 4:** Run test → 6/6 PASS
- [ ] **Step 5:** Commit `feat(A): add lib/paths.ts (centralized vault path resolver)`

---

### Task A2: schema.js v2 + check-schema.sh dynamic migration hint

**Files:** Modify `skill/lib/schema.js`, `skill/scripts/check-schema.sh`, `skill/tests/schema.test.js`

- [ ] **Step 1: failing tests** — 在 `schema.test.js` 末尾追加：

```javascript
test('check-schema: v2 vault passes', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    mkdirSync(join(vault, 'clients', '_personal', 'cases'), { recursive: true });
    writeFileSync(join(vault, 'clients', '_personal', 'cases', '0001.md'),
        '---\nschema_version: 2\nclient: _personal\n---\nbody');
    const out = execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.match(out, /OK: schema v2/);
});

test('check-schema: v1 vault prompts v1→v2 migration', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    mkdirSync(join(vault, 'cases'));
    writeFileSync(join(vault, 'cases', '0001.md'), '---\nschema_version: 1\n---\nbody');
    let exitCode = 0, stderr = '';
    try { execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8', stdio: 'pipe' }); }
    catch (e) { exitCode = e.status; stderr = e.stderr.toString(); }
    assert.equal(exitCode, 2);
    assert.match(stderr, /MIGRATION_NEEDED.*v1.*v2/);
    assert.match(stderr, /migrate-v1-to-v2\.sh/);
});
```

刪除既有「vault with schema_version=1 passes」測試（現在改成 prompt migration），改既有 v0 downgrade 測試斷言為 `/v0.*v2/`。

- [ ] **Step 2:** Run → 2 新 test FAIL
- [ ] **Step 3:** 改 `skill/lib/schema.js`：`export const CURRENT_SCHEMA_VERSION = 2;`
- [ ] **Step 4:** 改 `check-schema.sh` line 27-28：

```bash
echo "MIGRATION_NEEDED: vault has v$OLDEST, skill expects v$CURRENT" >&2
echo "Run: bash $SKILL_DIR/scripts/migrate-v${OLDEST}-to-v${CURRENT}.sh \"$VAULT\"" >&2
```

- [ ] **Step 5:** Run test → 4/4 PASS
- [ ] **Step 6:** Commit `feat(A): bump CURRENT_SCHEMA_VERSION to 2 + dynamic migration hint`

---

### Task A3: migrate-v1-to-v2.sh + 文件 + 測試

**Files:** Create `skill/scripts/migrate-v1-to-v2.sh`, `skill/migrations/v1-to-v2.md`, `skill/templates/client-meta.yaml`, `skill/tests/migration.test.ts`. Modify `skill/migrations/README.md`.

- [ ] **Step 1:** 建 `skill/templates/client-meta.yaml`：

```yaml
schema_version: 2
slug: PLACEHOLDER_SLUG
name: PLACEHOLDER_NAME
type: PLACEHOLDER_TYPE
created_at: PLACEHOLDER_CREATED_AT
notes: ""
theme_color: "#1F2937"
```

- [ ] **Step 2: failing test** `skill/tests/migration.test.ts`：

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const SCRIPT = fileURLToPath(new URL('../scripts/migrate-v1-to-v2.sh', import.meta.url));

function makeV1Vault(): string {
  const vault = mkdtempSync(join(tmpdir(), 'dl-v1-'));
  mkdirSync(join(vault, 'cases'));
  mkdirSync(join(vault, 'anti-library'));
  mkdirSync(join(vault, 'scenario-overrides'));
  writeFileSync(join(vault, 'personal-style-guide.md'), '---\nschema_version: 1\n---\nbody');
  writeFileSync(join(vault, 'scenario-overrides', 'landing.md'), '---\nschema_version: 1\n---\nL');
  writeFileSync(join(vault, 'cases', '0001-x.md'),
    '---\nschema_version: 1\nslug: 0001-x\nscenario: landing\nsentiment: positive\nquotes_from_user: ["nice"]\ntokens: {}\ntags: {style: [], mood: [], elements: [], industry: []}\n---\nbody');
  mkdirSync(join(vault, 'cases', '0001-x'));
  writeFileSync(join(vault, 'cases', '0001-x', 'snapshot.png'), 'fake');
  writeFileSync(join(vault, 'anti-library', '0001-bad.md'),
    '---\nschema_version: 1\nslug: 0001-bad\nscenario: brand\nsentiment: negative\nquotes_from_user: ["ugly"]\ntokens: {}\ntags: {style: [], mood: [], elements: [], industry: []}\n---\nbody');
  return vault;
}

test('migration: builds clients/_personal structure', () => {
  const vault = makeV1Vault();
  execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
  assert.ok(existsSync(join(vault, 'clients', '_personal', 'meta.yaml')));
  const meta = readFileSync(join(vault, 'clients', '_personal', 'meta.yaml'), 'utf8');
  assert.match(meta, /schema_version: 2/);
  assert.match(meta, /slug: _personal/);
  assert.match(meta, /type: self/);
  assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases', '0001-x.md')));
  assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases', '0001-x', 'snapshot.png')));
  assert.ok(!existsSync(join(vault, 'cases', '0001-x.md')));
  assert.ok(existsSync(join(vault, 'clients', '_personal', 'anti-library', '0001-bad.md')));
  const fm = matter(readFileSync(join(vault, 'clients', '_personal', 'cases', '0001-x.md'), 'utf8')).data;
  assert.equal(fm.schema_version, 2);
  assert.equal(fm.client, '_personal');
});

test('migration: leaves backup in parent dir', () => {
  const vault = makeV1Vault();
  execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
  const siblings = readdirSync(dirname(vault));
  assert.ok(siblings.some(s => s.startsWith(basename(vault) + '.v1-backup-')));
});

test('migration: idempotent (run twice no error)', () => {
  const vault = makeV1Vault();
  execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
  const out = execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
  assert.match(out, /already.*v2|skip|nothing to do/i);
});

test('migration: empty cases (Avy 當下情境) succeeds', () => {
  const vault = mkdtempSync(join(tmpdir(), 'dl-empty-'));
  mkdirSync(join(vault, 'cases'));
  mkdirSync(join(vault, 'anti-library'));
  writeFileSync(join(vault, 'personal-style-guide.md'), '---\nschema_version: 1\n---\nbody');
  execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
  assert.ok(existsSync(join(vault, 'clients', '_personal', 'meta.yaml')));
  assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases')));
});
```

- [ ] **Step 3:** Run → 4 FAIL（script 不存在）
- [ ] **Step 4: implementation** `skill/scripts/migrate-v1-to-v2.sh`：

```bash
#!/usr/bin/env bash
# Usage: migrate-v1-to-v2.sh <vault-path>
# Idempotent: 若 schema_version 已是 2 則 skip。
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
VAULT="$(cd "$VAULT" && pwd)"
[ -d "$VAULT" ] || { echo "ERROR: vault not found: $VAULT" >&2; exit 1; }

# Idempotency check
EXISTING_V2=$(grep -rl "^schema_version: 2$" "$VAULT" 2>/dev/null | head -1 || true)
if [ -n "$EXISTING_V2" ]; then
    echo "OK: vault already at v2 (found $EXISTING_V2). Nothing to do."
    exit 0
fi

# Backup
TS=$(date +%s)
PARENT="$(dirname "$VAULT")"
BACKUP="$PARENT/$(basename "$VAULT").v1-backup-$TS"
echo "Creating backup: $BACKUP"
cp -R "$VAULT" "$BACKUP"

# Build _personal structure
mkdir -p "$VAULT/clients/_personal/cases" "$VAULT/clients/_personal/anti-library"

CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$VAULT/clients/_personal/meta.yaml" <<META
schema_version: 2
slug: _personal
name: 我的品牌（未分類）
type: self
created_at: $CREATED_AT
notes: "預設容器。建議事後拆出 aicycle / zhenheco 等獨立 client（仍標 type: self）"
theme_color: "#1F2937"
META
echo "Created: $VAULT/clients/_personal/meta.yaml"

# Move cases & anti-library
move_dir() {
    local SRC="$1" DST="$2"
    if [ -d "$SRC" ]; then
        for entry in "$SRC"/* "$SRC"/.[!.]*; do
            [ -e "$entry" ] || continue
            mv "$entry" "$DST/"
        done
        rmdir "$SRC" 2>/dev/null || true
    fi
}
move_dir "$VAULT/cases" "$VAULT/clients/_personal/cases"
move_dir "$VAULT/anti-library" "$VAULT/clients/_personal/anti-library"

# Upgrade markdown frontmatter
upgrade_md() {
    local FILE="$1" CLIENT="${2:-}"
    [ -f "$FILE" ] || return
    node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
const [path, client] = [process.argv[1], process.argv[2]];
const parsed = matter(readFileSync(path, 'utf8'));
parsed.data.schema_version = 2;
if (client && !parsed.data.client) parsed.data.client = client;
writeFileSync(path, matter.stringify(parsed.content, parsed.data));
" "$FILE" "$CLIENT"
}

while IFS= read -r -d '' f; do
    upgrade_md "$f" "_personal"
done < <(find "$VAULT/clients/_personal/cases" "$VAULT/clients/_personal/anti-library" -maxdepth 1 -name '*.md' -print0 2>/dev/null)

[ -f "$VAULT/personal-style-guide.md" ] && upgrade_md "$VAULT/personal-style-guide.md"

if [ -d "$VAULT/scenario-overrides" ]; then
    while IFS= read -r -d '' f; do
        upgrade_md "$f"
    done < <(find "$VAULT/scenario-overrides" -maxdepth 1 -name '*.md' -print0 2>/dev/null)
fi

echo "OK: migration v1 → v2 complete. Backup at $BACKUP"
```

- [ ] **Step 5:** `chmod +x skill/scripts/migrate-v1-to-v2.sh`
- [ ] **Step 6:** 寫 `skill/migrations/v1-to-v2.md`（內容包含：what changed / how to run / side effects / idempotency / rollback 五段，仿 plan §A3 step 6 範例）
- [ ] **Step 7:** Run test → 4/4 PASS
- [ ] **Step 8:** Commit `feat(A): add v1→v2 migration (idempotent, with backup)`

---

### Task A4: init-library.sh v0.2 + style-guide template schema_version=2

**Files:** Modify `skill/scripts/init-library.sh`, `skill/templates/personal-style-guide.md`, `skill/tests/init-library.test.js`

- [ ] **Step 1: failing tests** — 加到 `init-library.test.js` 末尾：

```javascript
test('init-library: v0.2 builds clients/_personal structure', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-v2-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'meta.yaml')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'anti-library')));
    const meta = readFileSync(join(vault, 'clients', '_personal', 'meta.yaml'), 'utf8');
    assert.match(meta, /schema_version: 2[\s\S]*slug: _personal[\s\S]*type: self/);
});

test('init-library: style-guide template uses schema_version 2', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-v2-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.match(readFileSync(join(vault, 'personal-style-guide.md'), 'utf8'), /schema_version:\s*2/);
});
```

如尚未 import `readFileSync`，加入。

- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** 完整改寫 `skill/scripts/init-library.sh`：

```bash
#!/usr/bin/env bash
# Usage: init-library.sh <vault-path>
# v0.2: 多客戶結構 + _personal 預設客戶。Idempotent。
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$VAULT"/{scenario-overrides,candidates,clients/_personal/cases,clients/_personal/anti-library,.index}

[ -f "$VAULT/personal-style-guide.md" ] || {
    cp "$SKILL_DIR/templates/personal-style-guide.md" "$VAULT/personal-style-guide.md"
    echo "Created: $VAULT/personal-style-guide.md"
}

for scenario in landing saas-ui brand content; do
    target="$VAULT/scenario-overrides/$scenario.md"
    [ -f "$target" ] || {
        sed "s/SCENARIO_NAME/$scenario/g" "$SKILL_DIR/templates/scenario-override.md" > "$target"
        echo "Created: $target"
    }
done

META="$VAULT/clients/_personal/meta.yaml"
[ -f "$META" ] || {
    CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    cat > "$META" <<EOF
schema_version: 2
slug: _personal
name: 我的品牌（未分類）
type: self
created_at: $CREATED_AT
notes: "預設容器。建議事後拆出 aicycle / zhenheco 等獨立 client（仍標 type: self）"
theme_color: "#1F2937"
EOF
    echo "Created: $META"
}

echo "OK: design-library v0.2 initialized at $VAULT"
```

- [ ] **Step 4:** 改 `skill/templates/personal-style-guide.md` 第 2 行 `schema_version: 1` → `schema_version: 2`
- [ ] **Step 5:** Run test → PASS
- [ ] **Step 6:** Commit `feat(A): init-library.sh builds v0.2 multi-client structure`

---

### Task A5: Phase A 收尾驗收

- [ ] **Step 1:** 跑全測試 `npm test` → 0 fail
- [ ] **Step 2:** 手動跑 init + migration 在 `/tmp/dl-test-v2`、`/tmp/dl-v1-fixture` 兩個 vault 驗證行為
- [ ] **Step 3:** Codex ↔ Gemini cross-review on Phase A diff（dispatch 用 `codex-run.sh -r --uncommitted` + `gemini-rotate.sh -p "review uncommitted diff"`），0 🔴 才能進 Phase B
- [ ] **Step 4:** Tag commit `git tag phase-a-complete && git commit --allow-empty -m "ci(A): Phase A complete"`

---

# Phase B — Library refactor (multi-client case I/O)

**Goal:** 把 `case-loader.js / case-writer.js` 大改為 `.ts`（multi-client recursive scan、依 sentiment 分流到 cases/anti-library），新增 `client-loader.ts / client-writer.ts`，更新 `stats.js / feedback-log.js / design.sh` 引用新介面。

**Phase exit:** `npm test` 全綠 + `bash skill/scripts/design.sh "test task"` 在 v0.2 vault 跑得出 case summary（即使 0 case 也不爆）+ Codex↔Gemini 0 🔴。

### Task B1: case-loader.ts

**Files:** Create `skill/lib/case-loader.ts`, `skill/tests/case-loader.test.ts`. Delete `skill/lib/case-loader.js` (after callers migrated).

**Behavior:**
- `loadCaseSummaries(opts: { client?: string; sentiment?: 'positive' | 'negative'; scenario?: string })` recursive scan `clients/*/cases/*.md` + `clients/*/anti-library/*.md`
- 預設 `client` undefined → return all cases
- `client: 'aicycle'` → 依 §4.3.1 retrieval 邏輯：return `aicycle` 自己的 cases ∪ 所有 `type: self` clients 的 cases
- 缺漏 client meta（爛資料）→ skip 該 client + console.warn

**Key code:**

```typescript
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { getVaultPath, getClientDir } from './paths.ts';
import { loadAllClients } from './client-loader.ts';

export interface CaseSummary {
  slug: string;
  client: string;
  scenario: string;
  sentiment: 'positive' | 'negative';
  quotes_from_user: string[];
  tags: { style: string[]; mood: string[]; elements: string[]; industry: string[] };
  tokens: Record<string, unknown>;
  mdPath: string;
}

export interface LoadOpts {
  client?: string;
  sentiment?: 'positive' | 'negative';
  scenario?: string;
}

export function loadCaseSummaries(opts: LoadOpts = {}): CaseSummary[] {
  const vault = getVaultPath();
  const clientsRoot = join(vault, 'clients');
  if (!existsSync(clientsRoot)) return [];

  const allClients = loadAllClients();
  const targetClients = computeRetrievalScope(opts.client, allClients);

  const out: CaseSummary[] = [];
  for (const client of targetClients) {
    for (const sub of ['cases', 'anti-library'] as const) {
      const subDir = join(getClientDir(client), sub);
      if (!existsSync(subDir)) continue;
      for (const f of readdirSync(subDir)) {
        if (!f.endsWith('.md')) continue;
        const mdPath = join(subDir, f);
        if (!statSync(mdPath).isFile()) continue;
        const fm = matter(readFileSync(mdPath, 'utf8')).data;
        if (opts.sentiment && fm.sentiment !== opts.sentiment) continue;
        if (opts.scenario && fm.scenario !== opts.scenario) continue;
        out.push({
          slug: fm.slug,
          client: fm.client,
          scenario: fm.scenario,
          sentiment: fm.sentiment,
          quotes_from_user: fm.quotes_from_user || [],
          tags: fm.tags || { style: [], mood: [], elements: [], industry: [] },
          tokens: fm.tokens || {},
          mdPath,
        });
      }
    }
  }
  return out;
}

function computeRetrievalScope(targetClient: string | undefined, allClients: { slug: string; type: string }[]): string[] {
  if (!targetClient) return allClients.map(c => c.slug);
  // §4.3.1 retrieval: target client + all type:self clients (union)
  const set = new Set<string>([targetClient]);
  for (const c of allClients) {
    if (c.type === 'self') set.add(c.slug);
  }
  return [...set];
}
```

**Tests:** 至少 6 cases — empty vault returns []、single client、multi-client filter、_personal union 邏輯、sentiment filter、scenario filter。

- [ ] 5-step TDD（test → fail → impl → pass → commit `feat(B): add lib/case-loader.ts (multi-client + retrieval scope)`）

---

### Task B2: case-writer.ts

**Files:** Create `skill/lib/case-writer.ts`, `skill/tests/case-writer.test.ts`. Delete `skill/lib/case-writer.js`.

**Behavior:**
- `writeCase({ client, slug, sentiment, scenario, quote, sourceImagePath, tokens })`
- 依 sentiment 分流到 `clients/<client>/cases/` 或 `clients/<client>/anti-library/`
- 拷貝 image → `clients/<client>/cases/<slug>/snapshot.<ext>` 或 `anti-library/<slug>/snapshot.<ext>`
- 若 case 已存在 → throw error
- 若 `client` slug 無效 → throw `isValidSlug` failure
- Frontmatter schema_version=2

**Key code skeleton:**

```typescript
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import matter from 'gray-matter';
import { getClientDir, isValidSlug } from './paths.ts';

export interface WriteCaseInput {
  client: string;
  slug: string;
  sentiment: 'positive' | 'negative';
  scenario: 'landing' | 'saas-ui' | 'brand' | 'content';
  quote: string;
  sourceImagePath: string;
  tokens?: Record<string, unknown>;
}

export interface WriteCaseResult { casePath: string; assetsDir: string; }

export function writeCase(input: WriteCaseInput): WriteCaseResult {
  const { client, slug, sentiment, scenario, quote, sourceImagePath, tokens } = input;
  if (!isValidSlug(client)) throw new Error(`invalid client slug: ${client}`);
  if (!isValidSlug(slug)) throw new Error(`invalid case slug: ${slug}`);
  if (!existsSync(getClientDir(client))) throw new Error(`client not initialized: ${client}`);

  const sub = sentiment === 'positive' ? 'cases' : 'anti-library';
  const targetDir = join(getClientDir(client), sub);
  mkdirSync(targetDir, { recursive: true });

  const casePath = join(targetDir, `${slug}.md`);
  if (existsSync(casePath)) throw new Error(`case already exists: ${casePath}`);

  const assetsDir = join(targetDir, slug);
  mkdirSync(assetsDir, { recursive: true });

  const snapshotName = 'snapshot' + extname(sourceImagePath);
  if (existsSync(sourceImagePath)) copyFileSync(sourceImagePath, join(assetsDir, snapshotName));

  const frontmatter = {
    schema_version: 2,
    slug,
    client,
    captured_at: new Date().toISOString(),
    source: { type: 'upload', via: 'dashboard' },
    scenario,
    sentiment,
    quotes_from_user: [quote],
    tokens: tokens || {},
    tags: { style: [], mood: [], elements: [], industry: [] },
    related: [],
    lint_skip: [],
  };

  const body = `\n## 為什麼${sentiment === 'positive' ? '喜歡' : '不喜歡'}\n\n${quote}\n\n## 截圖\n\n![[${slug}/${snapshotName}]]\n\n## 解構觀察\n\n（事後在 Obsidian 補）\n`;

  writeFileSync(casePath, matter.stringify(body, frontmatter));
  return { casePath, assetsDir };
}
```

**Tests:** 至少 6 cases — happy path positive、happy path negative（去 anti-library）、duplicate throws、invalid slug throws、non-existent client throws、image copy 成功。

- [ ] 5-step TDD（commit `feat(B): add lib/case-writer.ts (sentiment dispatch)`）

---

### Task B3: client-loader.ts

**Files:** Create `skill/lib/client-loader.ts`, `skill/tests/client-loader.test.ts`.

**Behavior:**
- `loadAllClients(): ClientMeta[]` — 掃 `clients/*/meta.yaml` 並 parse
- `loadClient(slug): ClientMeta | null`
- `meta.yaml` 是純 YAML（不是 frontmatter），用 `js-yaml` parse（要加進 deps）

**Update package.json deps:** 加 `"js-yaml": "^4.1.0"` 與 `"@types/js-yaml": "^4.0.9"`。

**Key code:**

```typescript
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getVaultPath, getClientDir, getClientMetaPath } from './paths.ts';

export interface ClientMeta {
  schema_version: 2;
  slug: string;
  name: string;
  type: 'self' | 'client';
  created_at: string;
  notes: string;
  theme_color: string;
}

export function loadAllClients(): ClientMeta[] {
  const root = join(getVaultPath(), 'clients');
  if (!existsSync(root)) return [];
  const out: ClientMeta[] = [];
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry);
    if (!statSync(dir).isDirectory()) continue;
    const metaPath = join(dir, 'meta.yaml');
    if (!existsSync(metaPath)) {
      console.warn(`[client-loader] missing meta.yaml: ${dir}`);
      continue;
    }
    try {
      const data = yaml.load(readFileSync(metaPath, 'utf8')) as ClientMeta;
      out.push(data);
    } catch (e) {
      console.warn(`[client-loader] parse failed: ${metaPath}: ${(e as Error).message}`);
    }
  }
  return out;
}

export function loadClient(slug: string): ClientMeta | null {
  const path = getClientMetaPath(slug);
  if (!existsSync(path)) return null;
  try {
    return yaml.load(readFileSync(path, 'utf8')) as ClientMeta;
  } catch {
    return null;
  }
}
```

**Tests:** empty vault、single client、multiple clients、bad yaml skipped、type filter via consumer。

- [ ] 5-step TDD（commit `feat(B): add lib/client-loader.ts`）

---

### Task B4: client-writer.ts

**Files:** Create `skill/lib/client-writer.ts`, `skill/tests/client-writer.test.ts`.

**Behavior:**
- `createClient({ slug, name, type, theme_color, notes })` → 寫 `clients/<slug>/meta.yaml` + 建空 `cases/` `anti-library/`
- `updateClient(slug, partial)` → patch meta.yaml（slug 不可改）
- `archiveClient(slug)` → mv `clients/<slug>` → `clients/.archived/<slug>-<timestamp>`（不真刪）
- 驗 slug、驗 theme_color 在 12 色 palette、驗 type 是 'self' 或 'client'

**Key code skeleton:**

```typescript
import { writeFileSync, mkdirSync, renameSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getVaultPath, getClientDir, getClientMetaPath, isValidSlug } from './paths.ts';
import { THEME_COLOR_PALETTE } from './theme-palette.ts';   // 與 dashboard 共用，見 Task E4

export interface CreateClientInput {
  slug: string;
  name: string;
  type: 'self' | 'client';
  theme_color: string;
  notes?: string;
}

export function createClient(input: CreateClientInput): string {
  if (!isValidSlug(input.slug)) throw new Error(`invalid slug: ${input.slug}`);
  if (input.type !== 'self' && input.type !== 'client') throw new Error(`invalid type`);
  if (!THEME_COLOR_PALETTE.includes(input.theme_color)) throw new Error(`theme_color not in palette`);
  const dir = getClientDir(input.slug);
  if (existsSync(dir)) throw new Error(`client already exists: ${input.slug}`);
  mkdirSync(join(dir, 'cases'), { recursive: true });
  mkdirSync(join(dir, 'anti-library'), { recursive: true });
  const meta = {
    schema_version: 2,
    slug: input.slug,
    name: input.name,
    type: input.type,
    created_at: new Date().toISOString(),
    notes: input.notes || '',
    theme_color: input.theme_color,
  };
  const metaPath = getClientMetaPath(input.slug);
  writeFileSync(metaPath, yaml.dump(meta));
  return metaPath;
}

export function updateClient(slug: string, patch: Partial<Omit<CreateClientInput, 'slug'>>): void {
  const path = getClientMetaPath(slug);
  if (!existsSync(path)) throw new Error(`client not found: ${slug}`);
  const current = yaml.load(readFileSync(path, 'utf8')) as Record<string, unknown>;
  if (patch.theme_color && !THEME_COLOR_PALETTE.includes(patch.theme_color)) {
    throw new Error(`theme_color not in palette`);
  }
  Object.assign(current, patch);
  writeFileSync(path, yaml.dump(current));
}

export function archiveClient(slug: string): string {
  const src = getClientDir(slug);
  if (!existsSync(src)) throw new Error(`client not found: ${slug}`);
  const archiveRoot = join(getVaultPath(), 'clients', '.archived');
  mkdirSync(archiveRoot, { recursive: true });
  const dst = join(archiveRoot, `${slug}-${Date.now()}`);
  renameSync(src, dst);
  return dst;
}
```

**Tests:** create happy / duplicate throws / invalid slug throws / invalid theme_color throws / update theme_color / archive moves to .archived/.

- [ ] 5-step TDD（commit `feat(B): add lib/client-writer.ts (create/update/archive)`）

---

### Task B5: stats.js by-client + design.sh 引用新 .ts loader

**Files:** Modify `skill/lib/stats.js`, `skill/scripts/design.sh`, Create `skill/tests/stats.test.ts`.

**stats.js behavior:**
```javascript
import { loadCaseSummaries } from './case-loader.ts';   // 透過 tsx 載入

export function computeStats() {
  const all = loadCaseSummaries();
  const byClient = {};
  const byScenario = {};
  let positive = 0, negative = 0;
  for (const c of all) {
    byClient[c.client] = (byClient[c.client] || 0) + 1;
    byScenario[c.scenario] = (byScenario[c.scenario] || 0) + 1;
    if (c.sentiment === 'positive') positive++; else negative++;
  }
  return { totals: { positive, negative }, byClient, byScenario };
}
```

註：`stats.js` 沿用 `.js` 但 import `.ts` 需要 tsx runtime（design.sh + npm test 都已配 `--import tsx`）。如有問題改成 `stats.ts`。

**design.sh changes:** 把第 23-33 行 inline node script 改為：

```bash
node --import tsx --input-type=module -e "
import { loadCaseSummaries } from '$SKILL_DIR/lib/case-loader.ts';
const all = loadCaseSummaries();
console.log(JSON.stringify(all.map(c => ({
    slug: c.slug,
    client: c.client,
    scenario: c.scenario,
    quotes: c.quotes_from_user,
    tags: c.tags,
    palette: c.tokens.palette
})), null, 2));
"
```

第 35 行 `find "$VAULT/cases"` 改為 `find "$VAULT/clients" -name "*.md" -path "*/cases/*"`。

- [ ] 5-step TDD（commit `feat(B): stats by-client + design.sh uses ts loader`）

---

### Task B6: feedback-log.js 加 client field

**Files:** Modify `skill/lib/feedback-log.js`, Create `skill/tests/feedback-log.test.ts`.

**Behavior:**
- `appendFeedback({ sentiment, dimension, quote, target, client })` → JSONL `vault/feedback-log.jsonl`
- client 必填（從 dashboard 當前 selected client 帶入）
- 既有 v0.1 callers（沒 client）→ 預設 `_personal`（向後相容）

- [ ] 5-step TDD（commit `feat(B): feedback-log includes client field`）

---

### Task B7: Phase B 收尾

- [ ] `npm test` → 全綠
- [ ] 手動：在 v2 vault 跑 `bash skill/scripts/design.sh "test"` → output 含 `client:` 欄位、CASE_COUNT 正確
- [ ] 刪除 `skill/lib/case-loader.js` 與 `skill/lib/case-writer.js`（callers 已遷至 .ts）
- [ ] Codex ↔ Gemini cross-review，0 🔴
- [ ] Tag `phase-b-complete`

---

# Phase C — SQLite index + chokidar watcher

**Goal:** 建 `.index/library.db` SQLite 快取（cases / clients / documents 三表），用 chokidar 監聽 markdown 變動，content-hash invalidation，啟動 self-check。

**Phase exit:** dashboard 沒寫前先用 unit test 驗證 watcher 行為 + 啟動 self-check + 全 reindex 都正確。

### Task C1: lib/index/db.ts (schema + connection)

**Files:** Create `skill/lib/index/db.ts`, `skill/tests/index/db.test.ts`.

**Behavior:**
- 開 SQLite at `getIndexDbPath()`，自動 mkdir parent
- 建 4 表：`cases`, `clients`, `documents`, `index_meta`（spec §4.5）
- 設 `journal_mode = WAL`、`foreign_keys = ON`
- export `getDb(): Database`（singleton）+ `closeDb()`

**Key code:**

```typescript
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getIndexDbPath } from '../paths.ts';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const path = getIndexDbPath();
  mkdirSync(dirname(path), { recursive: true });
  _db = new Database(path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      client TEXT NOT NULL,
      scenario TEXT NOT NULL,
      sentiment TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      md_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      tags_json TEXT,
      tokens_json TEXT,
      quotes_json TEXT,
      UNIQUE(client, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client);
    CREATE INDEX IF NOT EXISTS idx_cases_scenario ON cases(scenario);
    CREATE INDEX IF NOT EXISTS idx_cases_sentiment ON cases(sentiment);

    CREATE TABLE IF NOT EXISTS clients (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      theme_color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT,
      meta_path TEXT NOT NULL,
      content_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      kind TEXT NOT NULL,
      scenario TEXT,
      md_path TEXT NOT NULL UNIQUE,
      content_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(kind, scenario)
    );

    CREATE TABLE IF NOT EXISTS index_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
```

**Tests:** open creates DB file、tables exist、indexes exist、re-open is idempotent、closeDb releases lock。

- [ ] 5-step TDD（commit `feat(C): SQLite schema + connection (better-sqlite3)`）

---

### Task C2: lib/index/reindex.ts (path classification + dispatch)

**Files:** Create `skill/lib/index/reindex.ts`, `skill/tests/index/reindex.test.ts`.

**Behavior:**
- `classifyPath(absPath): { kind; scenario? } | null`（spec §8.2）
- `reindexPath(absPath)` 讀檔 → hash → 比對 → upsert 對應表（cases / clients / documents）
- `removePath(absPath)` 對應 unlink event → 刪 row
- `fullReindex()` 掃整個 vault rebuild（drop tables + reinsert）

**Key code skeleton:**

```typescript
import { readFileSync, statSync } from 'node:fs';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { getDb } from './db.ts';
import { getVaultPath } from '../paths.ts';

type IndexedKind = 'case' | 'client-meta' | 'style-guide' | 'scenario-override';

export function classifyPath(path: string): { kind: IndexedKind; scenario?: string } | null {
  const rel = relative(getVaultPath(), path);
  if (/^clients\/[^/]+\/(cases|anti-library)\/[^/]+\.md$/.test(rel)) return { kind: 'case' };
  if (/^clients\/[^/]+\/meta\.yaml$/.test(rel))                       return { kind: 'client-meta' };
  if (rel === 'personal-style-guide.md')                              return { kind: 'style-guide' };
  const m = rel.match(/^scenario-overrides\/([^/]+)\.md$/);
  if (m) return { kind: 'scenario-override', scenario: m[1] };
  return null;
}

export async function reindexPath(path: string): Promise<void> {
  const klass = classifyPath(path);
  if (!klass) return;
  const content = readFileSync(path, 'utf8');
  const hash = createHash('sha256').update(content).digest('hex');

  const db = getDb();
  const existing = (() => {
    switch (klass.kind) {
      case 'case': return (db.prepare('SELECT content_hash FROM cases WHERE md_path = ?').get(path) as any)?.content_hash;
      case 'client-meta': return (db.prepare('SELECT content_hash FROM clients WHERE meta_path = ?').get(path) as any)?.content_hash;
      case 'style-guide':
      case 'scenario-override': return (db.prepare('SELECT content_hash FROM documents WHERE md_path = ?').get(path) as any)?.content_hash;
    }
  })();
  if (existing === hash) return;

  switch (klass.kind) {
    case 'case': upsertCase(path, content, hash); break;
    case 'client-meta': upsertClient(path, content, hash); break;
    case 'style-guide': upsertDocument('style-guide', null, path, hash); break;
    case 'scenario-override': upsertDocument('scenario-override', klass.scenario!, path, hash); break;
  }
}

function upsertCase(path: string, content: string, hash: string) {
  const fm = matter(content).data as any;
  getDb().prepare(`
    INSERT INTO cases (slug, client, scenario, sentiment, captured_at, md_path, content_hash, tags_json, tokens_json, quotes_json)
    VALUES (@slug, @client, @scenario, @sentiment, @captured_at, @md_path, @content_hash, @tags_json, @tokens_json, @quotes_json)
    ON CONFLICT(client, slug) DO UPDATE SET
      scenario=excluded.scenario, sentiment=excluded.sentiment, captured_at=excluded.captured_at,
      md_path=excluded.md_path, content_hash=excluded.content_hash,
      tags_json=excluded.tags_json, tokens_json=excluded.tokens_json, quotes_json=excluded.quotes_json
  `).run({
    slug: fm.slug, client: fm.client, scenario: fm.scenario, sentiment: fm.sentiment,
    captured_at: fm.captured_at, md_path: path, content_hash: hash,
    tags_json: JSON.stringify(fm.tags || {}),
    tokens_json: JSON.stringify(fm.tokens || {}),
    quotes_json: JSON.stringify(fm.quotes_from_user || []),
  });
}

function upsertClient(path: string, content: string, hash: string) {
  const meta = yaml.load(content) as any;
  getDb().prepare(`
    INSERT INTO clients (slug, name, type, theme_color, created_at, notes, meta_path, content_hash)
    VALUES (@slug, @name, @type, @theme_color, @created_at, @notes, @meta_path, @content_hash)
    ON CONFLICT(slug) DO UPDATE SET
      name=excluded.name, type=excluded.type, theme_color=excluded.theme_color,
      notes=excluded.notes, meta_path=excluded.meta_path, content_hash=excluded.content_hash
  `).run({
    slug: meta.slug, name: meta.name, type: meta.type, theme_color: meta.theme_color,
    created_at: meta.created_at, notes: meta.notes || '', meta_path: path, content_hash: hash,
  });
}

function upsertDocument(kind: string, scenario: string | null, path: string, hash: string) {
  getDb().prepare(`
    INSERT INTO documents (kind, scenario, md_path, content_hash, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(kind, scenario) DO UPDATE SET
      md_path=excluded.md_path, content_hash=excluded.content_hash, updated_at=excluded.updated_at
  `).run(kind, scenario, path, hash, new Date().toISOString());
}

export function removePath(path: string): void {
  const klass = classifyPath(path);
  if (!klass) return;
  const db = getDb();
  switch (klass.kind) {
    case 'case': db.prepare('DELETE FROM cases WHERE md_path = ?').run(path); break;
    case 'client-meta': db.prepare('DELETE FROM clients WHERE meta_path = ?').run(path); break;
    case 'style-guide':
    case 'scenario-override': db.prepare('DELETE FROM documents WHERE md_path = ?').run(path); break;
  }
}

export async function fullReindex(): Promise<void> {
  const db = getDb();
  db.exec('DELETE FROM cases; DELETE FROM clients; DELETE FROM documents;');
  // 掃 vault 全部 markdown / meta.yaml
  const { readdirSync, statSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const vault = getVaultPath();
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (e === '.index' || e === '.archived') continue;
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (e.endsWith('.md') || e === 'meta.yaml') reindexPath(p);
    }
  };
  walk(vault);
  db.prepare('INSERT INTO index_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('last_full_rebuild_at', new Date().toISOString());
}
```

**Tests:** classifyPath 對 5 種 path 都正確 / case row 寫入 + UNIQUE(client,slug) 不重複 / client meta 寫入 / documents 寫入 / hash 相同 skip / fullReindex 從零建。

- [ ] 5-step TDD（commit `feat(C): reindex with path classification dispatch`）

---

### Task C3: lib/index/watcher.ts (chokidar)

**Files:** Create `skill/lib/index/watcher.ts`, `skill/tests/index/watcher.test.ts`.

**Behavior:**
- `startWatcher()` 啟動 chokidar，監聽 §8.1 範圍（cases / anti-library / meta.yaml / personal-style-guide.md / scenario-overrides/*.md）
- `add` `change` → reindexPath；`unlink` → removePath
- debounce per-path 200ms（chokidar `awaitWriteFinish`）
- export `stopWatcher()`

**Key code:**

```typescript
import chokidar, { type FSWatcher } from 'chokidar';
import { getVaultPath } from '../paths.ts';
import { reindexPath, removePath } from './reindex.ts';

let _watcher: FSWatcher | null = null;

export function startWatcher(): FSWatcher {
  if (_watcher) return _watcher;
  const vault = getVaultPath();
  _watcher = chokidar.watch([
    `${vault}/clients/**/cases/**/*.md`,
    `${vault}/clients/**/anti-library/**/*.md`,
    `${vault}/clients/**/meta.yaml`,
    `${vault}/personal-style-guide.md`,
    `${vault}/scenario-overrides/*.md`,
  ], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    ignored: [/\.index\//, /\.archived\//],
  });
  _watcher.on('add', (p) => reindexPath(p).catch(e => console.error('reindex add fail', e)));
  _watcher.on('change', (p) => reindexPath(p).catch(e => console.error('reindex change fail', e)));
  _watcher.on('unlink', (p) => { try { removePath(p); } catch (e) { console.error('remove fail', e); } });
  return _watcher;
}

export async function stopWatcher(): Promise<void> {
  await _watcher?.close();
  _watcher = null;
}
```

**Tests:** create file → reindex called / change → re-reindex / unlink → remove called / multiple debounced events → 1 reindex（用 fake timer 或 await delay 驗）。

- [ ] 5-step TDD（commit `feat(C): chokidar watcher + debounced reindex`）

---

### Task C4: 啟動 self-check

**Files:** Add to `skill/lib/index/reindex.ts` 一個新 export `selfCheckOnStartup()`.

**Behavior:**
- 讀 `index_meta.last_full_rebuild_at`（沒有 → 跑 fullReindex）
- 用 `find` 三條（spec §8.4）找 newer files → 對每個跑 reindexPath

**Key code:**

```typescript
import { execFileSync } from 'node:child_process';

export async function selfCheckOnStartup(): Promise<void> {
  const db = getDb();
  const row = db.prepare('SELECT value FROM index_meta WHERE key = ?').get('last_full_rebuild_at') as { value: string } | undefined;
  if (!row) {
    await fullReindex();
    return;
  }
  const lastRebuild = row.value;
  const vault = getVaultPath();
  const cmds = [
    ['find', `${vault}/clients`, '(', '-name', '*.md', '-o', '-name', 'meta.yaml', ')', '-newer', '/dev/null'],   // /dev/null 假 placeholder，下面改
  ];
  // 實作上用 newermt 比較 timestamp 比 -newer 穩
  // 為簡化 spec，這裡用 readdir + stat.mtime 比對 lastRebuild
  const lastRebuildMs = new Date(lastRebuild).getTime();
  // 遞迴掃，stat.mtime > lastRebuildMs 才 reindex
  await scanNewer(vault, lastRebuildMs);
}

async function scanNewer(dir: string, since: number): Promise<void> {
  const { readdirSync, statSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    if (e === '.index' || e === '.archived' || e === 'node_modules') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) await scanNewer(p, since);
    else if ((e.endsWith('.md') || e === 'meta.yaml') && st.mtimeMs > since) {
      await reindexPath(p);
    }
  }
}
```

註：用 fs.stat.mtime 取代 spec §8.4 的 `find` shell 命令 — 跨平台、沒 escape 問題、純 Node 實作。Spec 描述的 find 是說明用，實作用 Node API。

**Tests:** empty meta → triggers fullReindex / has meta + new files → 只 reindex 新檔 / has meta + 0 new → no reindex。

- [ ] 5-step TDD（commit `feat(C): startup self-check (incremental reindex by mtime)`）

---

### Task C5: Phase C 收尾

- [ ] `npm test` 全綠
- [ ] 手動：建 vault → 建 case → 改 case → 刪 case，每步 sqlite3 query 驗 row 對 / 一致
- [ ] Codex ↔ Gemini cross-review
- [ ] Tag `phase-c-complete`

---

# Phase D — Vision adapter

**Goal:** 擴 `gemini-rotate.sh` 加 `--image`，建 vision adapter chain（gemini-rotate 為主，Anthropic API fallback），10s timeout + retry。

### Task D1: 擴 gemini-rotate.sh 加 --image flag (前置)

**Files:** Modify `~/.claude/skills/gemini-agent/scripts/gemini-rotate.sh`, Create `~/.claude/skills/gemini-agent/tests/gemini-rotate-image.test.ts`（或 sh test）.

**Behavior:**
- 加 `--image <path>` 參數，圖片用 base64 inline 進 prompt（Gemini CLI 支援的方式）
- 對 6 帳號 rotate 邏輯保持不變
- 對 model fallback (`pro` → `flash`) 邏輯保持不變
- 對 `should_rotate` 訊號（quota、429、timeout）保持不變

**Implementation hint:**

讀現有 `gemini-rotate.sh`，找 prompt assembly 的部分（通常用 `--prompt` 或從 stdin），改成：
- 若 `--image` flag set，把圖讀成 base64 → 用 Gemini CLI 的 inline image syntax（如 `@<file>` 或 `--media`）
- 若沒設 → 行為不變

**Acceptance criteria:**
- 既有 text-only call `gemini-rotate.sh -p "hello"` 仍 work
- 新 image call `gemini-rotate.sh -p "describe" --image foo.png` → 6 帳號 rotate 仍生效
- Quota error 仍觸發 rotate
- timeout 仍觸發 rotate

**Tests:** 寫 sh-based test（不要污染 design-lab repo，放 gemini-agent skill 自己的 tests/）。

- [ ] 5-step TDD（commit in **gemini-agent skill repo**: `feat(gemini-rotate): add --image flag with base64 inline`）

---

### Task D2: lib/vision/adapter.ts (interface)

**Files:** Create `skill/lib/vision/adapter.ts`, `skill/tests/vision/adapter.test.ts`.

**Behavior:** export interface only。

```typescript
export interface DesignTokens {
  palette?: string[];
  typography?: string[];
  spacing_scale?: number[];
  raw_observations?: string;
}

export interface VisionAdapter {
  name: string;
  isAvailable(): boolean;
  extractTokens(imagePath: string): Promise<DesignTokens>;
}
```

**Tests:** type compile check（執行 tsx + 一個假 adapter implementing interface）。

- [ ] 5-step TDD（commit `feat(D): add VisionAdapter interface`）

---

### Task D3: lib/vision/gemini-rotate.ts

**Files:** Create `skill/lib/vision/gemini-rotate.ts`, `skill/tests/vision/gemini-rotate.test.ts`.

**Behavior:** spec §6.2 完整實作。

```typescript
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import type { VisionAdapter, DesignTokens } from './adapter.ts';

const SCRIPT = resolve(homedir(), '.claude/skills/gemini-agent/scripts/gemini-rotate.sh');
const PROMPT = `Analyze the image. Extract design tokens as JSON inside <TOKENS>...</TOKENS> markers.

Required fields:
- palette: array of hex colors (3-7 main colors)
- typography: array of font family names you can identify
- spacing_scale: array of pixel values you can infer (e.g. [4,8,16,24])
- raw_observations: 1-2 sentences describing visual style

Output ONLY:
<TOKENS>
{ "palette": [...], "typography": [...], "spacing_scale": [...], "raw_observations": "..." }
</TOKENS>`;

export const geminiAdapter: VisionAdapter = {
  name: 'gemini-rotate',
  isAvailable() { return existsSync(SCRIPT); },
  async extractTokens(imagePath) {
    return new Promise((res, rej) => {
      const proc = spawn(SCRIPT, ['-p', PROMPT, '--image', imagePath, '-m', 'gemini-2.5-flash'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '', stderr = '';
      proc.stdout.on('data', (c) => { stdout += c; });
      proc.stderr.on('data', (c) => { stderr += c; });
      proc.on('error', rej);
      proc.on('exit', (code) => {
        if (code !== 0) return rej(new Error(`gemini-rotate exit ${code}: ${stderr}`));
        const m = stdout.match(/<TOKENS>([\s\S]*?)<\/TOKENS>/);
        if (!m) return rej(new Error('no <TOKENS> marker in output'));
        try { res(JSON.parse(m[1])); }
        catch (e) { rej(new Error(`JSON parse fail: ${(e as Error).message}`)); }
      });
    });
  },
};
```

**Tests:** mock spawn (用 Node mock or test fixture script)。case：success / no marker / json parse fail / non-zero exit / script not found。

- [ ] 5-step TDD（commit `feat(D): gemini-rotate adapter with TOKENS marker parsing`）

---

### Task D4: lib/vision/anthropic.ts (fallback)

**Files:** Create `skill/lib/vision/anthropic.ts`, `skill/tests/vision/anthropic.test.ts`.

**Behavior:**
- 只在 `process.env.ANTHROPIC_API_KEY` 存在時 `isAvailable()` 回 true
- 用 `@anthropic-ai/sdk`（要加 deps），呼叫 Sonnet 4.6 vision API
- 同樣輸出 `<TOKENS>...</TOKENS>` 解析

**Update package.json:** 加 `"@anthropic-ai/sdk": "^0.30.0"` 到 dependencies。

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { VisionAdapter, DesignTokens } from './adapter.ts';

const VISION_PROMPT = /* same as gemini */;

export const anthropicAdapter: VisionAdapter = {
  name: 'anthropic-sonnet',
  isAvailable() { return !!process.env.ANTHROPIC_API_KEY; },
  async extractTokens(imagePath) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const ext = extname(imagePath).slice(1).toLowerCase();
    const mediaType = ext === 'jpg' ? 'image/jpeg' : (`image/${ext}` as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif');
    const data = readFileSync(imagePath).toString('base64');
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: VISION_PROMPT },
        ],
      }],
    });
    const text = msg.content.find(b => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('no text response');
    const m = text.text.match(/<TOKENS>([\s\S]*?)<\/TOKENS>/);
    if (!m) throw new Error('no <TOKENS> marker');
    return JSON.parse(m[1]) as DesignTokens;
  },
};
```

**Tests:** mock Anthropic SDK / no API key → isAvailable false / success / no marker / JSON fail。

- [ ] 5-step TDD（commit `feat(D): Anthropic Sonnet vision fallback adapter`）

---

### Task D5: lib/vision/chain.ts (fallback chain + timeout)

**Files:** Create `skill/lib/vision/chain.ts`, `skill/tests/vision/chain.test.ts`.

**Behavior:** spec §6.1 完整。

```typescript
import { geminiAdapter } from './gemini-rotate.ts';
import { anthropicAdapter } from './anthropic.ts';
import type { DesignTokens, VisionAdapter } from './adapter.ts';

export function buildAdapterChain(): VisionAdapter[] {
  return [geminiAdapter, anthropicAdapter].filter(a => a.isAvailable());
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ]);
}

export async function extractWithFallback(imagePath: string): Promise<DesignTokens> {
  const adapters = buildAdapterChain();
  for (const adapter of adapters) {
    try {
      return await withTimeout(adapter.extractTokens(imagePath), 30_000);
    } catch (e) {
      console.warn(`[vision] adapter ${adapter.name} failed: ${(e as Error).message}`);
      continue;
    }
  }
  return {};   // 全 fail → 空 tokens
}
```

**Tests:** chain order (gemini first) / fallback to anthropic when gemini throws / both fail returns {} / timeout triggers fallback / no available adapter returns {}。

- [ ] 5-step TDD（commit `feat(D): vision adapter chain with timeout + graceful degradation`）

---

### Task D6: Phase D 收尾

- [ ] `npm test` 全綠
- [ ] 手動：放一張真圖到 `/tmp/test.png` → `node --import tsx -e "import {extractWithFallback} from './skill/lib/vision/chain.ts'; console.log(await extractWithFallback('/tmp/test.png'))"` → 印出 tokens
- [ ] Codex ↔ Gemini cross-review
- [ ] Tag `phase-d-complete`

---

# Phase E — Astro dashboard scaffold

**Goal:** 建 `skill/dashboard/` Astro 5 SSR app（Node adapter）+ Tailwind 4 + shadcn-ui + light theme + 12 色 palette + 5 個 page 空殼 + API routes 空殼。

**Phase exit:** `cd skill/dashboard && npm run dev` 起 server → 5 個 route 全 200（即使 placeholder）+ shadcn 一個範例 component 渲染正常 + Vitest 至少 1 條 unit test 跑通。

### Task E1: Astro project init + Node adapter

**Files:** Create `skill/dashboard/package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro` (placeholder).

**Setup steps:**
- [ ] `cd skill/dashboard && npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict --skip-houston`
- [ ] `npm install @astrojs/node @astrojs/react @astrojs/tailwind react react-dom @types/react @types/react-dom`
- [ ] `npm install -D vitest @playwright/test`

**`astro.config.mjs`:**

```javascript
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), tailwind({ applyBaseStyles: false })],
  server: { host: '127.0.0.1', port: 5173 },
});
```

- [ ] **Acceptance:** `npm run dev` 開 `http://127.0.0.1:5173/` 顯示 Astro placeholder + 0 console error。
- [ ] Commit `feat(E): scaffold Astro 5 SSR dashboard with Node adapter`

---

### Task E2: Tailwind 4

**Files:** `skill/dashboard/tailwind.config.ts`, `skill/dashboard/src/styles/global.css`.

**Tailwind config:**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#FFFFFF', muted: '#F9FAFB' },
        fg: { DEFAULT: '#1F2937', muted: '#6B7280' },
        border: { DEFAULT: '#E5E7EB' },
      },
    },
  },
} satisfies Config;
```

`global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body { @apply bg-bg text-fg; }
  /* light theme only — explicit no dark: variants */
}
```

`src/layouts/BaseLayout.astro`：

```astro
---
import '../styles/global.css';
---
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>design-lab dashboard</title>
  </head>
  <body class="min-h-screen">
    <slot />
  </body>
</html>
```

- [ ] **Acceptance:** index.astro 使用 `<h1 class="text-fg bg-bg">` → render 出白底深字
- [ ] Commit `feat(E): Tailwind 4 + light-only theme`

---

### Task E3: shadcn-ui 整合（限互動 island）

**Files:** Create `skill/dashboard/components.json`, `src/components/ui/button.tsx`（first shadcn component）.

**Setup steps:**
- [ ] `npx shadcn@latest init` (Astro mode)
- [ ] `npx shadcn@latest add button input dialog select label form` 加常用組件
- [ ] 改 `src/pages/index.astro` 加一個 `<Button client:load>Test</Button>` 驗證 React island 跑通
- [ ] **Acceptance:** index.astro render 出 shadcn 風格 button + 點擊有 hover state

註：按 spec § R1 採納，shadcn 限互動 island。靜態列表用 Astro native（`<button>`）即可。

- [ ] Commit `feat(E): shadcn-ui setup + Button island`

---

### Task E4: Theme palette + light theme CSS

**Files:** Create `skill/dashboard/src/lib/theme-palette.ts`, `skill/lib/theme-palette.ts` (mirror，給 client-writer 共用), `skill/dashboard/src/styles/theme.css`, `skill/dashboard/tests/unit/theme-palette.test.ts`.

```typescript
// skill/lib/theme-palette.ts (canonical, dashboard 用 import 而非 mirror)
export const THEME_COLOR_PALETTE = [
  '#1F2937', '#0F766E', '#1E40AF', '#7C3AED',
  '#BE185D', '#B91C1C', '#A16207', '#15803D',
  '#0E7490', '#6D28D9', '#9333EA', '#374151',
] as const;

export type ThemeColor = (typeof THEME_COLOR_PALETTE)[number];

export function isThemeColor(c: string): c is ThemeColor {
  return (THEME_COLOR_PALETTE as readonly string[]).includes(c);
}
```

Dashboard import from `../../../lib/theme-palette.ts`（透過 tsconfig path 或 relative path）。

`theme.css`:
```css
:root {
  --accent: #1F2937;   /* default; client switch 時 JS 改 */
}
.client-accent { color: var(--accent); }
.client-accent-bg { background: var(--accent); color: white; }
```

**Tests:** `THEME_COLOR_PALETTE` 12 色 / `isThemeColor` accept palette member, reject non-member。

- [ ] 5-step TDD（commit `feat(E): theme palette + accent CSS variable`）

---

### Task E5: 5 個 page 空殼 + API routes 空殼

**Files:**
- `src/pages/index.astro` (overview)
- `src/pages/clients/index.astro`
- `src/pages/clients/[slug].astro`
- `src/pages/collect.astro`
- `src/pages/feedback.astro`
- `src/pages/style-guide.astro`
- `src/pages/api/clients.ts`
- `src/pages/api/cases.ts`
- `src/pages/api/feedback.ts`
- `src/pages/api/style-guide.ts`
- `src/pages/api/vision.ts`
- `src/pages/api/reindex.ts`
- `src/lib/api-helpers.ts`
- `skill/dashboard/tests/unit/api-helpers.test.ts`

**Each page:** import BaseLayout，含 `<h1>` + 「TODO Phase F」註記。

**Each API route:**

```typescript
// src/pages/api/clients.ts (placeholder)
import type { APIRoute } from 'astro';
export const GET: APIRoute = () => new Response(JSON.stringify({ error: 'not implemented' }), { status: 501 });
export const POST: APIRoute = () => new Response(JSON.stringify({ error: 'not implemented' }), { status: 501 });
```

**`api-helpers.ts`** (將被 F1+ 用)：

```typescript
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
```

**Tests:** api-helpers.test.ts — jsonResponse / errorResponse 都產生正確 Response object。

- [ ] 5-step TDD（commit `feat(E): 5 page + 6 API route placeholders`）

---

### Task E6: Phase E 收尾

- [ ] `cd skill/dashboard && npm test` (Vitest) → PASS
- [ ] `npm run dev` 跑開，5 個 route + 6 API endpoint 全可達
- [ ] Codex ↔ Gemini review on Phase E diff
- [ ] Tag `phase-e-complete`

---

# Phase F — Dashboard pages 實作

**Goal:** 把 Phase E 的空殼填上完整功能。每 page + API route 一組 task，TDD + Playwright E2E。

### Task F1: GET /api/clients + ClientSwitcher + index.astro overview

**Files:**
- Modify `src/pages/api/clients.ts`（GET 部分）
- Create `src/components/ClientSwitcher.tsx`（React island）
- Modify `src/pages/index.astro`（overview：stats + 最近 5 case）
- Create `dashboard/tests/e2e/index.spec.ts`

**API GET behavior:** 從 SQLite `clients` 表 query 全部，依 type/created_at 排序，回 JSON `{ clients: ClientMeta[] }`。

**Index page behavior:**
- 顯示 by-client case count + 全域 totals（從 stats.computeStats()）
- 顯示最近 5 個 case（`SELECT * FROM cases ORDER BY captured_at DESC LIMIT 5`）
- 頂部 ClientSwitcher（React island，下拉切當前 client）

**ClientSwitcher.tsx:** shadcn `Select`，用 `fetch('/api/clients')` 載資料，選擇時 `localStorage.setItem('design-lab.currentClient', slug)` + 更新 CSS variable `--accent`。

**Tests:**
- Unit: api/clients GET returns correct shape
- E2E: 開 `/` → 顯示客戶 dropdown / 切客戶後 accent 顏色變

- [ ] 5-step TDD（commit `feat(F): /api/clients GET + ClientSwitcher + overview page`）

---

### Task F2: 客戶 CRUD (POST/PUT/DELETE /api/clients) + /clients page

**Files:**
- Modify `src/pages/api/clients.ts`（加 POST/PUT/DELETE）
- Create `src/pages/clients/index.astro`
- Create `src/components/ClientCrudForm.tsx`（shadcn Form + Dialog）
- Create `dashboard/tests/e2e/client-crud.spec.ts`

**API behavior:**
- POST `{ slug, name, type, theme_color, notes }` → 呼叫 `client-writer.ts:createClient` → 201 + ClientMeta
- PUT `?slug=<slug>` body `{ name?, theme_color?, notes? }` → `updateClient` → 200
- DELETE `?slug=<slug>` → `archiveClient` → 200 + 新路徑
- 全部 sanitize slug + theme_color 在 palette 內

**Page behavior:**
- 列出全部客戶（type=self 與 type=client 分區）+ 「+ 新增客戶」按鈕
- 每列含 edit / archive 按鈕

**Tests:**
- Unit: 4 個 API method 各自 happy + 1-2 error case
- E2E: 建客戶 → 看到列表多一條 → 改名 → archive → 列表移除

- [ ] 5-step TDD（commit `feat(F): client CRUD API + /clients page`）

---

### Task F3: GET /api/cases + /clients/[slug] case grid

**Files:**
- Modify `src/pages/api/cases.ts`（GET 部分）
- Create `src/pages/clients/[slug].astro`
- Create `src/components/CaseGrid.astro`（靜態，無 React island）
- Create `src/components/CaseFilter.tsx`（React island，filter 下拉）
- Create `dashboard/tests/e2e/case-grid.spec.ts`

**API GET behavior:**
- `?client=<slug>&scenario=<s>&sentiment=<positive|negative>&q=<keyword>`
- 呼叫 `loadCaseSummaries` （retrieval scope 邏輯：傳 client 進去 union type:self）
- 回 `{ cases: CaseSummary[] }` + 縮圖 base64 / URL

**Page behavior:**
- Breadcrumb：所有客戶 > <client name>
- CaseFilter（scenario / sentiment）
- CaseGrid 顯示 case 縮圖 + slug + scenario + sentiment + first quote
- 點 case 卡片 → open Obsidian wiki link `obsidian://open?path=<encoded>`

**Tests:**
- Unit: API filter 各組合
- E2E: 切客戶 → grid 顯示對應 case / filter 後正確 / 點卡片觸發 obsidian:// (skip 實際開啟)

- [ ] 5-step TDD（commit `feat(F): /api/cases GET + /clients/[slug] case grid + filter`）

---

### Task F4: POST /api/vision + /collect drag-drop

**Files:**
- Modify `src/pages/api/vision.ts`
- Create `src/pages/collect.astro`
- Create `src/components/DropZone.tsx`（React island）

**API behavior:**
- POST multipart/form-data with `image` field → 寫到 `/tmp/design-lab-uploads/<uuid>.<ext>` → 呼叫 `extractWithFallback` → 回 `{ tokens, tempPath }`
- 30s timeout
- 安全：sanitize ext，limit file size 10MB

**Page behavior:**
- DropZone 接受拖入 png/jpg/webp
- 上傳中 → 顯示 spinner
- 完成 → 顯示 raw image preview + tokens preview（palette swatches、typography badges）
- 「進到表單」按鈕 → navigate 到 collect 第二步（task F5）

**Tests:**
- Unit: api/vision happy / oversized rejected / unsupported ext rejected / vision timeout fallback to {}
- E2E (Playwright)：drag png → 看 tokens preview

- [ ] 5-step TDD（commit `feat(F): /api/vision + DropZone with vision preview`）

---

### Task F5: POST /api/cases + /collect 表單提交

**Files:**
- Modify `src/pages/api/cases.ts`（加 POST）
- Modify `src/pages/collect.astro`（加表單區）
- Create `src/components/CollectForm.tsx`（React island）
- Create `dashboard/tests/e2e/collect.spec.ts`

**API POST behavior:**
- Body `{ client, slug, sentiment, scenario, quote, sourceImagePath, tokens }`
- 呼叫 `case-writer.ts:writeCase`
- 觸發 chokidar reindex（自動由 watcher）
- 回 201 + `{ casePath, assetsDir }`

**Form behavior:**
- 預填 tokens（從 F4 vision result）
- 必填：client（dropdown，預填當前 selected）、scenario、sentiment、quote、slug
- Submit → POST → success 顯示 wiki link「在 Obsidian 看」

**Tests:**
- Unit: api/cases POST happy / duplicate slug rejected / invalid client rejected / image not found rejected
- E2E：drag png → 表單填完 → submit → cases page 看到新卡片

- [ ] 5-step TDD（commit `feat(F): /api/cases POST + collect form submission`）

---

### Task F6: GET/POST /api/style-guide + /style-guide editor

**Files:**
- Modify `src/pages/api/style-guide.ts`
- Create `src/pages/style-guide.astro`
- Create `src/components/StyleGuideEditor.tsx`（React island）
- Create `dashboard/tests/e2e/style-guide.spec.ts`

**API behavior:**
- GET → 讀 `getStyleGuidePath()` 內容 + content-hash → `{ markdown, hash }`
- POST `{ markdown, hash }` → 比對 hash（衝突偵測，spec §10.4）→ 寫回 → 回新 hash

**Editor behavior:**
- 讀取 markdown，parse `## DO`、`## NEVER`、`## SOMETIMES` 三段
- 三欄表單，每條規則一行：
  - DO/SOMETIMES：純 textarea
  - NEVER：textarea + 「regex 偵測器（選用）」展開區（id / pattern / target）
- Submit → POST → 衝突 (409) 提示「外部已修改」+ reload 按鈕

**Tests:**
- Unit: GET reads file / POST writes / hash conflict 409
- E2E：改 NEVER 加一條 regex → save → 跑 `lint.sh` 確認新規則生效

- [ ] 5-step TDD（commit `feat(F): /api/style-guide + editor with conflict detection`）

---

### Task F7: GET/POST /api/feedback + /feedback page

**Files:**
- Modify `src/pages/api/feedback.ts`
- Create `src/pages/feedback.astro`
- Create `src/components/ThumbVote.tsx`（React island）
- Create `dashboard/tests/e2e/feedback.spec.ts`

**API behavior:**
- GET → 讀 `last-artifact.js:readLastArtifact()`，回 markdown content
- POST `{ sentiment, quote?, persistAsCase: bool, scenario?, client? }`
- 若 `persistAsCase` true → 呼叫 `writeCase`（從 last-artifact 內容派生 slug + 拷一張 placeholder snapshot）
- 否則 append `feedback-log.jsonl`

**Page behavior:**
- 讀 last-artifact，render markdown（用 `marked` 或 Astro 內建）
- ThumbVote：👍 / 👎 + 可選 quote
- 「存進 cases/anti-library」checkbox

**Tests:**
- Unit: feedback log append / feedback as case writes
- E2E：mock last-artifact → /feedback → 點 👍 → cases page 見新 case

- [ ] 5-step TDD（commit `feat(F): /api/feedback + ThumbVote with optional case persist`）

---

### Task F8: POST /api/reindex + settings rebuild button

**Files:**
- Modify `src/pages/api/reindex.ts`
- Create `src/pages/settings.astro`（簡易 settings page，目前只有「重建索引」按鈕）

**API behavior:** POST → 呼叫 `fullReindex()` → 200 + `{ rebuilt: true, durationMs }`

**Page behavior:** 一個按鈕，點下發 POST，成功顯示「索引已重建」。

**Tests:** unit only（小範圍）

- [ ] 5-step TDD（commit `feat(F): /api/reindex + settings rebuild button`）

---

### Task F9: Phase F 收尾

- [ ] `npm test` 全綠（lib + dashboard unit + Playwright E2E）
- [ ] 手動：完整跑 collect → feedback → grid → style-guide flow，每步無 console error
- [ ] Codex ↔ Gemini cross-review
- [ ] Tag `phase-f-complete`

---

# Phase G — Glue (server entry + slash command + 整合)

**Goal:** 讓 `/design-dashboard` slash command 可實際 spawn 起 dashboard server，30 min idle auto-stop，PID file 管理，移除被取代的 4 個舊 slash command。

### Task G1: dashboard/src/server.ts + idle watcher

**Files:** Create `skill/dashboard/src/server.ts`.

**Behavior:**
- 啟動 Astro Node SSR server (`node dist/server/entry.mjs` after build)
- 寫 PID file `~/.claude/state/design-lab/dashboard.pid`
- 每分鐘檢查 `lastActivityAt`，超過 30 分鐘 `process.exit(0)`
- middleware 攔所有 request 更新 `lastActivityAt`
- `process.on('exit')` 清 PID file
- 啟動時呼叫 `startWatcher()` + `selfCheckOnStartup()`

```typescript
import { handler as ssrHandler } from './dist/server/entry.mjs';
import http from 'node:http';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { startWatcher, stopWatcher } from '../../lib/index/watcher.ts';
import { selfCheckOnStartup } from '../../lib/index/reindex.ts';

const PID_PATH = join(homedir(), '.claude', 'state', 'design-lab', 'dashboard.pid');
mkdirSync(dirname(PID_PATH), { recursive: true });
writeFileSync(PID_PATH, String(process.pid));

let lastActivityAt = Date.now();

const server = http.createServer((req, res) => {
  lastActivityAt = Date.now();
  ssrHandler(req, res);
});

await selfCheckOnStartup();
startWatcher();

server.listen(5173, '127.0.0.1', () => {
  console.log('design-lab dashboard listening on http://127.0.0.1:5173');
});

setInterval(() => {
  if (Date.now() - lastActivityAt > 30 * 60 * 1000) {
    console.log('[design-lab] idle 30 min, shutting down');
    process.exit(0);
  }
}, 60_000);

const cleanup = () => {
  try { unlinkSync(PID_PATH); } catch {}
  stopWatcher();
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
```

註：Astro 5 SSR Node adapter 把 handler export 在 `dist/server/entry.mjs`（標準位置）。`npm run build` 後產生。

- [ ] 5-step TDD（dashboard build + spawn 後驗 PID file 存在 + curl localhost:5173）
- [ ] Commit `feat(G): dashboard server entry + PID + idle auto-stop`

---

### Task G2: scripts/dashboard-start.sh + dashboard-stop.sh

**Files:** Create `skill/scripts/dashboard-start.sh`, `skill/scripts/dashboard-stop.sh`.

**dashboard-start.sh:** spec §9.1 完整：

```bash
#!/usr/bin/env bash
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$HOME/.claude/state/design-lab/dashboard.pid"
PORT=5173

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "dashboard already running (pid $(cat "$PID_FILE"))"
    open "http://localhost:$PORT"
    exit 0
fi

cd "$SKILL_DIR/dashboard"
[ -d dist ] || npm run build
nohup node dist/server/entry.mjs > /tmp/design-lab-dashboard.log 2>&1 &
echo $! > "$PID_FILE"
sleep 1
open "http://localhost:$PORT"
echo "dashboard started: http://localhost:$PORT (logs: /tmp/design-lab-dashboard.log)"
```

**dashboard-stop.sh:**

```bash
#!/usr/bin/env bash
set -euo pipefail
PID_FILE="$HOME/.claude/state/design-lab/dashboard.pid"
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "stopped pid $PID"
else
    echo "no pid file"
fi
```

- [ ] `chmod +x` 兩個 script
- [ ] 手動跑 start → 開瀏覽器 OK → 再跑 start → 偵測 already running 直接開 → 跑 stop → kill
- [ ] Commit `feat(G): dashboard-start.sh + dashboard-stop.sh`

---

### Task G3: SKILL.md v0.2 重寫 + 移除被取代的 slash command

**Files:** Modify `skill/SKILL.md`. Delete or thin-wrap `skill/scripts/{collect,feedback,stats,distill}.sh`.

**SKILL.md 改成 v0.2 路由表（2 個 slash command）：**

```markdown
---
name: design-lab
description: 個人化品牌設計系統 skill — multi-client + Astro local dashboard。v0.2：4 個 slash command 整合進 dashboard，保留 /design 與 /design-dashboard。
version: 0.2.0
---

# design-lab v0.2

## 啟動 hook

每個 slash command 第一個動作跑 schema check + auto-migrate prompt：

\`\`\`bash
bash $SKILL_DIR/scripts/check-schema.sh "$HOME/Documents/CC Cli/design-library"
\`\`\`

退出 2 → 提示用戶跑 `bash $SKILL_DIR/scripts/migrate-v1-to-v2.sh "$VAULT"`。
退出 0 + vault 不存在 → 跑 `bash $SKILL_DIR/scripts/init-library.sh "$VAULT"`。

## Slash commands

### `/design <task>` — 主入口（CLI，沿用 v0.1 升級）

讀 personal-style-guide + scenario-overrides，retrieve top 5 cases（依當前 client，type:self union），產出 design + 跑 lint。

cli script: `scripts/design.sh "<task>"`。

### `/design-dashboard` — 啟動 dashboard

`scripts/dashboard-start.sh` spawn Astro server + 開瀏覽器（localhost:5173），30 min idle auto-stop。

## v0.2 移除的 slash commands

下列功能全進 dashboard：
- ~~`/design-collect`~~ → dashboard `/collect` page（drag-drop + vision LLM）
- ~~`/design-feedback`~~ → dashboard `/feedback` page
- ~~`/design-stats`~~ → dashboard `/`（overview）
- ~~`/design-distill`~~ → dashboard 編輯 `/style-guide`（v0.3 才自動化）
```

**對 4 個被取代的 .sh script 的處理：**
- 直接刪除（git rm），spec §3.2 file structure 已 mark them as removed
- 若怕用戶肌肉記憶要 `/design-collect`，改成 thin wrapper：

```bash
#!/usr/bin/env bash
echo "[design-lab v0.2] /design-collect 已整合進 dashboard。"
echo "請跑：/design-dashboard 然後在瀏覽器 /collect page 操作。"
exit 0
```

決定：保留 thin wrapper（user instinct memory：「棄用服務必須清理標註」+ 「禁絕對路徑硬編碼」）。

- [ ] 5-step TDD（commit `feat(G): SKILL.md v0.2 + thin wrappers for deprecated commands`）

---

### Task G4: 整合 e2e + 驗收

**Files:** Create `skill/dashboard/tests/e2e/full-flow.spec.ts`.

**Full flow E2E:**
1. dashboard-start.sh 啟動 → wait `/api/clients` 200
2. 建一個 client `test-client` (type: client, theme: blue)
3. drag 一張 fixture png 進 /collect → 表單填 → submit → 201
4. /clients/test-client → grid 顯示 1 case
5. 改 personal-style-guide.md 加 NEVER 規則 → 跑 `/design "test"` → 確認 lint 偵測新規則
6. dashboard-stop.sh → kill server

**驗收 spec §14 11 條全跑一遍：**
- [ ] v0.1 24 測試全綠 + v0.2 新測試（預期 50+）全綠
- [ ] dashboard 啟動 1-2 秒可用
- [ ] drag-drop → vision tokens → case → grid 顯示（手動 + e2e）
- [ ] 2 client 切換 case 隔離
- [ ] style-guide NEVER 改後 lint 對 `/design` 生效
- [ ] migration v1 → v2 對 sample vault 跑通（A3 已測）
- [ ] SQLite cache 一致（手動改 markdown → query db 驗）
- [ ] Light theme + theme_color 在 12 色 palette 內 + WCAG AA（手動 contrast checker）
- [ ] Codex ↔ Gemini cross-review on entire v0.2 diff（用 `git diff phase-a-complete..HEAD` 範圍）
- [ ] 自我審查 4 項（資安 / TS strict / 錯誤處理 / i18n）
- [ ] `/destructive-qa` 破壞性測試（POST 無 body → 400、path traversal → 400、嘗試覆寫 vault 外檔案 → 400）

- [ ] Commit `ci(G): Phase G complete — v0.2 GA candidate`
- [ ] Tag `v0.2.0`
- [ ] 更新 `package.json` version → `"version": "0.2.0"`
- [ ] 跑 `bash deploy.sh`（v0.1 既有 deploy script，更新 symlink）

---

# Self-Review Checklist

寫完 plan 後跑：

## 1. Spec coverage（每個 spec section 對應 task）

| Spec section | 對應 task |
|---|---|
| §1.2 multi-client 分流 | A2 + A3 + A4 + B1-B4 |
| §1.2 Astro dashboard | E + F |
| §1.2 SaaS-ready 預留 | A1（paths.ts 集中）+ §3.3 純 slug 規約 by B writers |
| §3.2 目錄結構 | 所有 phase 對應 file create |
| §4.2 case schema_version=2 | A2 + A3 + B2 |
| §4.3 client meta.yaml | A4 + B3 + B4 |
| §4.3.1 retrieval scope | B1 (computeRetrievalScope) |
| §4.4 12 色 palette | E4 (theme-palette.ts) + B4 (validation) |
| §4.5 SQLite schema (含 documents) | C1 |
| §5.1 Routes | E5 + F |
| §5.2-5.5 工作流 | F4-F7 |
| §6 Vision adapter | D2-D5 |
| §7 Migration | A3 |
| §8 chokidar + content hash | C2 + C3 |
| §8.4 啟動 self-check | C4 |
| §9 啟動 / idle | G1 + G2 |
| §10 安全 | path traversal in A1, multipart limits in F4, hash conflict in F6 |
| §11 測試策略 | TDD all phases + Playwright F + 整合 G4 |
| §12 phase 順序 | 本 plan phase A-G |
| §13 待解問題 | D1 (gemini-rotate)、E1 (Astro+sqlite native)、E3 (shadcn+Astro)、C3 spike (chokidar+Obsidian) |
| §14 驗收標準 | G4 |

✅ All sections covered.

## 2. Placeholder scan

`grep -nE "TBD|TODO|implement later|fill in details|similar to" plans/*.md` → 預期 0 hits（除「⏰ TODO Phase F」這種 page placeholder 字串本身屬於設計）。

## 3. Type consistency check

- `WriteCaseInput.client` (B2) ↔ frontmatter `client` (A2/A3) ↔ SQLite `cases.client` (C1)：全 string 純 slug ✅
- `ClientMeta.type` (B3) ↔ frontmatter type (A4 meta.yaml)：'self' | 'client' ✅
- `THEME_COLOR_PALETTE` (E4) ↔ client-writer 驗 (B4) ↔ meta.yaml field (A4)：12 色 hex ✅
- `extractTokens(imagePath: string): Promise<DesignTokens>` (D2) ↔ gemini (D3) ↔ anthropic (D4) ↔ chain (D5)：簽名一致 ✅
- `classifyPath` 4 種 kind (C2) ↔ documents.kind 'style-guide'|'scenario-override' (C1) ↔ chokidar 監聽範圍 (C3) ↔ self-check (C4)：對齊 ✅

✅ No type drift detected.

---

# Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-design-lab-v0.2.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Sonnet PM 每 task dispatch 一個新 Codex subagent，task 之間 Sonnet PM review + Codex/Gemini cross-review。快速迭代、context 清晰、適合長 plan。

**2. Inline Execution** — 在當前 session 用 `superpowers:executing-plans` 跑，每 phase 一個 checkpoint review。適合短 plan / 想 step-by-step 看每個改動。

選 1 或 2？選 1 我接下來 invoke `superpowers:subagent-driven-development`；選 2 我 invoke `superpowers:executing-plans`。

