# design-lab v0.2 Sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作 sidecar daemon (`localhost:5174`) + 精簡 Astro dashboard (4 page) + bridge skill in fork open-design，3.5 天工期。

**Architecture:** 依 sidecar spec §3，`~/Documents/CC Cli/design-library/` 仍是 source of truth；sidecar 只負責把 markdown vault 同步進 SQLite 快取，並透過 Express 提供讀寫 API。Open Design daemon 維持在 `localhost:5173` 做 generation，sidecar 維持在 `localhost:5174` 做 memory 與 dashboard，bridge skill 僅在 pre-flight fetch `/api/context`，避免 fork core。

**Tech Stack:** Node 20 ESM、TypeScript strict、Express、better-sqlite3、chokidar、Astro 5 SSR + Node adapter、Tailwind 4（**不用 shadcn**）、gray-matter、yaml、Vitest + Playwright

**Spec reference:** `docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md`

**Phase A 既有 commits:** `4444062`（A0 deps）、`ea30e36`（A1 paths.ts）— 沿用，下方從 Phase α2 開始。

---

## Phase Order & Dependencies

```text
Phase α  Foundation 補完
  -> schema v2 + migration + init-library v0.2
Phase β  Library refactor
  -> multi-client case/client I/O + retrieval scope
Phase γ  SQLite + watcher + sidecar daemon
  -> durable cache + API surface + /api/context
Phase δ  Dashboard 4 page
  -> Astro SSR UI mounted behind sidecar
Phase ε  Bridge skill + startup integration
  -> open-design pre-flight fetch + PID scripts + end-to-end validation
```

**Dependency rule:** 不跳 phase。每個 phase 結尾必跑 `npm test`、做 Codex↔Gemini cross-review、打 phase tag，綠燈後才進下一 phase。

---

## File Structure（v0.2 sidecar 目標態）

```text
skill/
├── SKILL.md
├── dashboard/
│   ├── astro.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   ├── playwright.config.ts
│   ├── src/
│   │   ├── layouts/
│   │   │   └── BaseLayout.astro
│   │   ├── pages/
│   │   │   ├── index.astro
│   │   │   ├── clients/
│   │   │   │   ├── index.astro
│   │   │   │   └── [slug].astro
│   │   │   └── style-guide.astro
│   │   ├── components/
│   │   │   ├── ClientSwitcher.tsx
│   │   │   ├── ClientCrudForm.tsx
│   │   │   ├── CaseGrid.astro
│   │   │   ├── CaseFilter.tsx
│   │   │   └── StyleGuideEditor.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   └── styles/
│   │       └── global.css
│   └── tests/e2e/
│       ├── client-crud.spec.ts
│       ├── case-grid.spec.ts
│       ├── style-guide.spec.ts
│       └── full-flow.spec.ts
├── lib/
│   ├── paths.ts
│   ├── schema.js
│   ├── theme-palette.ts
│   ├── case-loader.ts
│   ├── case-writer.ts
│   ├── client-loader.ts
│   ├── client-writer.ts
│   ├── stats.js
│   ├── feedback-log.js
│   └── index/
│       ├── db.ts
│       ├── reindex.ts
│       └── watcher.ts
├── sidecar/
│   ├── server.ts
│   ├── routes/
│   │   ├── clients.ts
│   │   ├── cases.ts
│   │   ├── style-guide.ts
│   │   ├── scenario-overrides.ts
│   │   └── context.ts
│   └── tests/
│       └── api.test.ts
├── scripts/
│   ├── check-schema.sh
│   ├── migrate-v1-to-v2.sh
│   ├── init-library.sh
│   ├── design.sh
│   ├── sidecar-start.sh
│   └── sidecar-stop.sh
├── templates/
│   ├── personal-style-guide.md
│   ├── scenario-override.md
│   └── client-meta.yaml
├── migrations/
│   ├── README.md
│   └── v1-to-v2.md
└── tests/
    ├── schema.test.js
    ├── init-library.test.js
    ├── migration.test.ts
    ├── case-loader.test.ts
    ├── case-writer.test.ts
    ├── client-loader.test.ts
    ├── client-writer.test.ts
    ├── stats.test.ts
    ├── feedback-log.test.ts
    └── index/
        ├── db.test.ts
        ├── reindex.test.ts
        └── watcher.test.ts

/Volumes/500G/Claude Code Projects/open-design/
└── skills/
    └── design-memory-bridge/
        └── SKILL.md
```

---

## Conventions

- **Test runners:** root 用 `node --test --import tsx "skill/tests/**/*.test.{js,ts}"`；dashboard 用 Vitest + Playwright。
- **TS execution:** `skill/lib/**/*.ts` 走 `tsx` runtime，不額外 build；Astro dashboard 獨立 build，sidecar 只 mount SSR middleware。
- **Imports:** ESM only；`.ts` 互引用帶 `.ts` 副檔名，`.js` 檔 import `.ts` 也顯式帶副檔名。
- **Source of truth:** markdown vault 永遠是 canonical；SQLite 只是快取，不反向成為作者編輯入口。
- **Validation first:** slug/path/theme_color 在 writer 邊界驗；API route 不重寫同一套驗證。
- **No shadcn:** dashboard 用 Astro + 小量 React islands + vanilla Tailwind 元件，不引入 shadcn。
- **Cross-review gate:** phase boundary review 重點是 spec drift、type drift、route contract drift、migration safety。

---

# Phase α — Foundation 補完

**Goal:** 延續已完成的 A0/A1，把 schema 升到 v2、補 migration 腳本、升級 init-library 到多客戶結構，且不破壞 v0.1 既有 CLI。

**Phase exit:** `npm test` 全綠、手動驗 `init-library.sh` 與 `migrate-v1-to-v2.sh`、Codex↔Gemini cross-review 0 blocking、tag `phase-alpha-complete`。

### Task α2: schema.js 升 v2 + check-schema.sh dynamic migration hint

**Files:** Modify `skill/lib/schema.js`, `skill/scripts/check-schema.sh`, `skill/tests/schema.test.js`

- [ ] **Step 1 — write failing tests:** 在 `schema.test.js` 新增 `v2 vault passes` 與 `v1 vault prompts migration`；刪除舊的「schema_version=1 passes」斷言，並把 downgrade case 改成檢查 `v0 -> v2`。
- [ ] **Step 2 — run and confirm fail:** 跑 `npm test` 或最小範圍 `node --test --import tsx skill/tests/schema.test.js`，確認新增案例先紅。
- [ ] **Step 3 — implement minimal change:** 將 `CURRENT_SCHEMA_VERSION` 升為 `2`，並把 migration hint 改為 `migrate-v${OLDEST}-to-v${CURRENT}.sh`，不再硬編 `migrate.sh`。

```javascript
export const CURRENT_SCHEMA_VERSION = 2;
```

```bash
echo "MIGRATION_NEEDED: vault has v$OLDEST, skill expects v$CURRENT" >&2
echo "Run: bash $SKILL_DIR/scripts/migrate-v${OLDEST}-to-v${CURRENT}.sh \"$VAULT\"" >&2
```

- [ ] **Step 4 — rerun targeted then full tests:** 先重跑 `schema.test.js`，再跑 `npm test`，確認 v0.1 既有測試無 regression。
- [ ] **Step 5 — commit:** 提交一個只包含 schema/hint/test 的小 diff。

**Acceptance**
- [ ] `check-schema.sh` 對空 vault 仍回 `OK: schema v2 (no files yet)`。
- [ ] `schema_version: 2` vault 回 `OK: schema v2`。
- [ ] `schema_version: 1` vault 退出碼為 `2`，stderr 含 `migrate-v1-to-v2.sh`。
- [ ] `schema_version: 0` vault 明確提示 `v0` 到 `v2`，不誤導成舊 v0.1 文案。

**Commit:** `feat(alpha): bump schema to v2 + dynamic migration hint`

### Task α3: migrate-v1-to-v2.sh + 文件 + migration tests

**Files:** Create `skill/scripts/migrate-v1-to-v2.sh`, `skill/migrations/v1-to-v2.md`, `skill/templates/client-meta.yaml`, `skill/tests/migration.test.ts`; Modify `skill/migrations/README.md`

- [ ] **Step 1 — add fixtures and failing tests:** 建 `migration.test.ts` 覆蓋四個情境：標準 v1 vault、空 `cases/anti-library` vault、idempotent second run、backup directory 留存。
- [ ] **Step 2 — run and confirm fail:** 因 script 不存在，測試應直接紅；這一步也確認 test fixture 沒寫錯。
- [ ] **Step 3 — implement migration script and docs:** 寫 idempotent shell script、補 `client-meta.yaml` 模板、更新 `README.md` 與 `v1-to-v2.md`，明確說明備份、移動路徑、frontmatter 升版、rollback 方式。

```bash
#!/usr/bin/env bash
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
BACKUP="$PARENT/$(basename "$VAULT").v1-backup-$TS"
mkdir -p "$VAULT/clients/_personal/cases" "$VAULT/clients/_personal/anti-library"
mv "$VAULT/cases"/* "$VAULT/clients/_personal/cases/" 2>/dev/null || true
mv "$VAULT/anti-library"/* "$VAULT/clients/_personal/anti-library/" 2>/dev/null || true
```

```yaml
schema_version: 2
slug: PLACEHOLDER_SLUG
name: PLACEHOLDER_NAME
type: PLACEHOLDER_TYPE
created_at: PLACEHOLDER_CREATED_AT
notes: ""
theme_color: "#1F2937"
```

- [ ] **Step 4 — rerun tests and inspect artifacts:** 確認 `clients/_personal/meta.yaml`、`cases/`、`anti-library/`、backup sibling 皆存在，frontmatter 補上 `client: _personal` 與 `schema_version: 2`。
- [ ] **Step 5 — commit:** 只提交 migration script、template、docs、tests。

**Acceptance**
- [ ] v1 vault 轉換後建立 `clients/_personal/` 結構，舊 flat `cases/` 與 `anti-library/` 被搬入。
- [ ] 每個 migrated case frontmatter 至少包含 `schema_version: 2` 與 `client: _personal`。
- [ ] script 第二次執行安全 skip，不重覆搬檔、不覆寫資料。
- [ ] migration 前自動留一份 sibling backup，路徑可從 stdout/stderr 找到。
- [ ] `migrations/v1-to-v2.md` 說明 how-to、side effects、rollback、idempotency。

**Commit:** `feat(alpha): add idempotent v1-to-v2 migration with docs`

### Task α4: init-library.sh v0.2 多客戶結構 + style-guide schema v2

**Files:** Modify `skill/scripts/init-library.sh`, `skill/templates/personal-style-guide.md`, `skill/tests/init-library.test.js`; Create `skill/templates/client-meta.yaml` if α3 尚未落地於同一 commit 前

- [ ] **Step 1 — extend failing tests:** 在 `init-library.test.js` 新增 `clients/_personal` 結構檢查、`personal-style-guide.md` schema v2 檢查，並保留 idempotent 測試。
- [ ] **Step 2 — run and confirm fail:** 目前腳本仍會建立 flat `cases/anti-library`，測試應紅。
- [ ] **Step 3 — rewrite init script minimally:** 建 `clients/_personal/cases`、`clients/_personal/anti-library`、`.index/`，產生 `_personal/meta.yaml`，把 style-guide 模板升為 `schema_version: 2`，scenario override 保持沿用。

```bash
mkdir -p "$VAULT"/{scenario-overrides,candidates,.index,clients/_personal/cases,clients/_personal/anti-library}
cp "$SKILL_DIR/templates/personal-style-guide.md" "$VAULT/personal-style-guide.md"
cat > "$VAULT/clients/_personal/meta.yaml" <<EOF
schema_version: 2
slug: _personal
name: 我的品牌（未分類）
type: self
created_at: $CREATED_AT
notes: "預設容器。後續可拆出獨立 self clients。"
theme_color: "#1F2937"
EOF
```

- [ ] **Step 4 — rerun targeted then full tests:** 確認 style-guide、scenario-overrides、`clients/_personal/*` 全建立且重跑不覆寫使用者內容。
- [ ] **Step 5 — commit:** 這個 commit 只處理 init/library template，不混入 migration 或 loader 改動。

**Acceptance**
- [ ] 新 vault 初始化後不存在 root-level `cases/` 與 `anti-library/`。
- [ ] `_personal/meta.yaml` 包含 `schema_version: 2`、`type: self`、合法 `theme_color`。
- [ ] `personal-style-guide.md` schema 升為 `2`，DO/NEVER/SOMETIMES 區段仍存在。
- [ ] 腳本重跑不覆寫手改 style-guide 與既有 `meta.yaml`。

**Commit:** `feat(alpha): init-library builds v0.2 multi-client structure`

### Task α5: Phase α 收尾

**Files:** No new product files; may add tag only

- [ ] **Step 1 — full verification:** 跑 `npm test`，記錄總測試數；再手動跑一個 fresh init vault 與一個 v1 migrate fixture。
- [ ] **Step 2 — manual smoke:** 驗證 `check-schema.sh` 對 empty/v1/v2 vault 回應正確，並確認 migration 後 `design.sh` 尚未因 schema bump 爆掉。
- [ ] **Step 3 — cross-review:** 讓 Codex 與 Gemini 各 review Phase α diff，關注 migration safety、idempotency、模板 drift。
- [ ] **Step 4 — phase gate:** 清掉 review blocking issues 後建立 tag `phase-alpha-complete`。
- [ ] **Step 5 — commit if needed:** 若需紀錄驗收，可用空 commit；否則僅留 tag。

**Acceptance**
- [ ] `npm test` 全綠。
- [ ] 手動 init 與 migration 都可成功完成。
- [ ] cross-review 沒有 blocking issue。
- [ ] tag `phase-alpha-complete` 存在。

**Commit:** `ci(alpha): phase alpha verification complete`

---

# Phase β — Library refactor

**Goal:** 把 flat v0.1 case I/O 換成 multi-client `.ts` loader/writer，加入 retrieval scope、client metadata、theme palette 驗證，並讓 v0.1 CLI 能吃新資料結構。

**Phase exit:** `npm test` 全綠、`bash skill/scripts/design.sh "test"` 在 v2 vault 可輸出 case summary、Codex↔Gemini cross-review 0 blocking、tag `phase-beta-complete`。

### Task β1: lib/case-loader.ts（recursive scan + computeRetrievalScope）

**Files:** Create `skill/lib/case-loader.ts`, `skill/tests/case-loader.test.ts`

- [ ] **Step 1 — tests first:** 用至少 6 個案例覆蓋 empty vault、single client、multi-client、`type:self` union、scenario filter、sentiment filter。
- [ ] **Step 2 — prove failure:** loader 尚不存在，測試先紅。
- [ ] **Step 3 — implement loader + retrieval scope:** 掃 `clients/*/{cases,anti-library}/*.md`；`computeRetrievalScope(targetClient, clients)` 回 `target + all type:self` union；遇到缺 `meta.yaml` 的 client 直接 skip + `console.warn`。

```typescript
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

export function computeRetrievalScope(
  targetClient: string | undefined,
  allClients: Array<{ slug: string; type: 'self' | 'client' }>
): string[] { /* target + all self */ }
```

- [ ] **Step 4 — rerun tests:** 先跑 `case-loader.test.ts`，再重跑 `stats` / `design.sh` 會依賴的測試。
- [ ] **Step 5 — commit:** 保持只動 loader 與其 tests。

**Acceptance**
- [ ] `loadCaseSummaries()` 無參數時回全部 cases。
- [ ] `client=aicycle` 時包含 `aicycle` 與所有 `type:self` clients，不包含其他 `type:client`。
- [ ] `sentiment=negative` 能只回 anti-library cases。
- [ ] 異常 client meta 不讓整體 scan fail。

**Commit:** `feat(beta): add case-loader.ts with retrieval scope union`

### Task β2: lib/case-writer.ts（sentiment dispatch）

**Files:** Create `skill/lib/case-writer.ts`, `skill/tests/case-writer.test.ts`

- [ ] **Step 1 — tests first:** 覆蓋 positive path、negative path、duplicate slug、invalid client slug、missing client dir、snapshot copy。
- [ ] **Step 2 — confirm fail:** writer 尚不存在，測試先紅。
- [ ] **Step 3 — implement writer:** 依 sentiment 寫到 `clients/<client>/cases/` 或 `anti-library/`；frontmatter 固定 `schema_version: 2`、`client` 必填。

```typescript
export interface WriteCaseInput {
  client: string;
  slug: string;
  sentiment: 'positive' | 'negative';
  scenario: 'landing' | 'saas-ui' | 'brand' | 'content';
  quote: string;
  sourceImagePath: string;
  tokens?: Record<string, unknown>;
}
```

- [ ] **Step 4 — rerun tests:** 確認 markdown body 與 asset 目錄同時建立。
- [ ] **Step 5 — commit:** writer 與 tests 一起提交。

**Acceptance**
- [ ] positive case 只進 `cases/`，negative case 只進 `anti-library/`。
- [ ] frontmatter 為 schema v2，且帶 `client`。
- [ ] duplicate slug 與非法 slug 明確丟錯。
- [ ] source image 存在時會複製成 `snapshot.<ext>`。

**Commit:** `feat(beta): add case-writer.ts with sentiment dispatch`

### Task β3: lib/client-loader.ts + js-yaml deps

**Files:** Create `skill/lib/client-loader.ts`, `skill/tests/client-loader.test.ts`; Modify `package.json`

- [ ] **Step 1 — tests first:** 覆蓋 empty vault、single client、multiple clients、壞 YAML skip、`loadClient(slug)` miss 回 `null`。
- [ ] **Step 2 — confirm fail:** 新模組與 deps 尚未存在。
- [ ] **Step 3 — implement loader and deps:** `package.json` 加 `js-yaml` 與 `@types/js-yaml`；掃 `clients/*/meta.yaml`，parse 成 `ClientMeta[]`。

```typescript
export interface ClientMeta {
  schema_version: 2;
  slug: string;
  name: string;
  type: 'self' | 'client';
  created_at: string;
  notes: string;
  theme_color: string;
}
```

- [ ] **Step 4 — rerun tests:** 確認壞 YAML 只 warn 不 crash。
- [ ] **Step 5 — commit:** deps + loader + tests 一起提交，避免 broken install。

**Acceptance**
- [ ] `loadAllClients()` 回傳純 YAML meta，不依賴 frontmatter。
- [ ] `loadClient(slug)` 找不到時回 `null`。
- [ ] meta parse 錯誤只影響單一 client。
- [ ] `ClientMeta.type` 嚴格為 `'self' | 'client'`。

**Commit:** `feat(beta): add client-loader.ts and yaml parsing`

### Task β4: lib/client-writer.ts + theme palette validation

**Files:** Create `skill/lib/client-writer.ts`, `skill/lib/theme-palette.ts`, `skill/tests/client-writer.test.ts`

- [ ] **Step 1 — tests first:** 覆蓋 create happy path、duplicate slug、invalid slug、invalid `theme_color`、update patch、archive move。
- [ ] **Step 2 — confirm fail:** writer/palette 未存在，測試先紅。
- [ ] **Step 3 — implement palette and writer:** 提取 canonical `THEME_COLOR_PALETTE` 到 `skill/lib/theme-palette.ts`，writer 負責 `createClient`、`updateClient`、`archiveClient`。

```typescript
export const THEME_COLOR_PALETTE = [
  '#1F2937', '#0F766E', '#1E40AF', '#7C3AED',
  '#BE185D', '#B91C1C', '#A16207', '#15803D',
  '#0E7490', '#6D28D9', '#9333EA', '#374151',
] as const;
```

```typescript
export function createClient(input: CreateClientInput): string { /* mkdir + meta.yaml */ }
export function updateClient(slug: string, patch: Partial<Omit<CreateClientInput, 'slug'>>): void { /* patch yaml */ }
export function archiveClient(slug: string): string { /* move to clients/.archived */ }
```

- [ ] **Step 4 — rerun tests:** 確認 `archiveClient` 實際搬到 `clients/.archived/<slug>-<ts>`。
- [ ] **Step 5 — commit:** palette 與 writer 保持在同一 commit，避免型別漂移。

**Acceptance**
- [ ] 只接受 palette 內 12 色。
- [ ] `createClient` 會建立 `cases/` 與 `anti-library/` 空資料夾。
- [ ] `updateClient` 不允許改 slug。
- [ ] `archiveClient` 不真刪資料，只搬到 `.archived/`。

**Commit:** `feat(beta): add client-writer.ts with palette validation`

### Task β5: stats.js by-client + design.sh 用 ts loader + feedback-log.js client field

**Files:** Modify `skill/lib/stats.js`, `skill/lib/feedback-log.js`, `skill/scripts/design.sh`; Create `skill/tests/stats.test.ts`, `skill/tests/feedback-log.test.ts`

- [ ] **Step 1 — tests first:** stats 覆蓋 `byClient + byScenario + totals`；feedback-log 覆蓋 client explicit 與 backward-compatible default `_personal`。
- [ ] **Step 2 — confirm fail:** 現況仍吃 flat `cases/` 且 feedback log 無 client 欄位。
- [ ] **Step 3 — implement integration updates:** `stats.js` 改呼叫 `loadCaseSummaries()`；`design.sh` 用 `node --import tsx` 讀 `case-loader.ts`；`appendFeedback()` 自動補 `client`。

```javascript
import { loadCaseSummaries } from './case-loader.ts';

export function computeStats() {
  const all = loadCaseSummaries();
  return { totals, byClient, byScenario };
}
```

```javascript
const record = {
  occurred_at: new Date().toISOString(),
  client: entry.client || '_personal',
  ...entry
};
```

- [ ] **Step 4 — rerun tests and manual CLI smoke:** 手動執行 `bash skill/scripts/design.sh "test"`，確認 JSON summary 含 `client` 欄位。
- [ ] **Step 5 — commit:** 把 CLI glue 與 supporting tests 一起收斂。

**Acceptance**
- [ ] stats 輸出含 `byClient`。
- [ ] `design.sh` 在 v2 vault 不再讀 root `cases/`。
- [ ] feedback-log 每筆記錄都有 `client` 欄位。
- [ ] 舊 caller 未傳 client 時預設 `_personal`，不破壞相容性。

**Commit:** `feat(beta): wire stats, design.sh, and feedback-log to v2 loaders`

### Task β6: 刪舊 loader/writer JS + Phase β 收尾

**Files:** Delete `skill/lib/case-loader.js`, `skill/lib/case-writer.js`

- [ ] **Step 1 — verify callers migrated:** 搜尋 repo 確認不再引用 `case-loader.js` / `case-writer.js`。
- [ ] **Step 2 — delete legacy files:** 只在 callers 全部改完後刪檔，避免中間 commit 斷鏈。
- [ ] **Step 3 — full test run:** 跑 `npm test`，再手動跑 `design.sh`。
- [ ] **Step 4 — cross-review + tag:** Codex/Gemini review 檢查 retrieval scope、palette、CLI 相容性，完成後打 tag `phase-beta-complete`。
- [ ] **Step 5 — commit:** 將刪檔與 phase 收尾分成同一個小 commit。

**Acceptance**
- [ ] repo 內無舊 `.js` case loader/writer 依賴。
- [ ] `npm test` 全綠。
- [ ] `design.sh` 手動 smoke 正常。
- [ ] tag `phase-beta-complete` 存在。

**Commit:** `refactor(beta): remove legacy case js modules and close phase beta`

---

# Phase γ — SQLite + chokidar + sidecar daemon

**Goal:** 建 SQLite 索引、watcher、自我修復啟動檢查與 Express sidecar API。這一 phase 完成後，memory daemon 應可在 `localhost:5174` 獨立提供全部 API。

**Phase exit:** `npm test` 全綠、手動驗檔案變動同步進 SQLite、`/api/context` 回 retrieval-scoped payload、Codex↔Gemini cross-review 0 blocking、tag `phase-gamma-complete`。

### Task γ1: lib/index/db.ts（4 表 schema + singleton）

**Files:** Create `skill/lib/index/db.ts`, `skill/tests/index/db.test.ts`

- [ ] **Step 1 — tests first:** 驗 DB file 自動建立、四張表存在、index 存在、重開 idempotent、`closeDb()` 可釋放 lock。
- [ ] **Step 2 — confirm fail:** 模組不存在時測試先紅。
- [ ] **Step 3 — implement db layer:** `getDb()` 建 singleton；schema 包含 `cases`、`clients`、`documents`、`index_meta`；設定 `WAL` 與 `foreign_keys = ON`。

```typescript
export function getDb(): Database.Database { /* singleton + initSchema */ }
export function closeDb(): void { /* close + null */ }
```

- [ ] **Step 4 — rerun tests:** 確認 DB 在 `.index/library.db` 建立。
- [ ] **Step 5 — commit:** db 層獨立提交。

**Acceptance**
- [ ] `.index/library.db` 會自動建立。
- [ ] schema 含 4 表與必要索引。
- [ ] 重複呼叫 `getDb()` 不重建 schema。
- [ ] `closeDb()` 後可重新開啟。

**Commit:** `feat(gamma): add sqlite db schema and connection singleton`

### Task γ2: lib/index/reindex.ts（classifyPath + content hash + fullReindex）

**Files:** Create `skill/lib/index/reindex.ts`, `skill/tests/index/reindex.test.ts`

- [ ] **Step 1 — tests first:** 覆蓋 4 種 kind path classification、case/client/document upsert、same hash skip、unlink delete、full rebuild。
- [ ] **Step 2 — confirm fail:** 模組不存在時測試先紅。
- [ ] **Step 3 — implement path dispatcher:** `classifyPath()` 識別 case、client-meta、style-guide、scenario-override；`reindexPath()` 做 hash compare；`fullReindex()` 遞迴掃 vault，略過 `.index` 與 `.archived`。

```typescript
type IndexedKind = 'case' | 'client-meta' | 'style-guide' | 'scenario-override';

export function classifyPath(absPath: string): { kind: IndexedKind; scenario?: string } | null { /* regex on relative path */ }
export async function reindexPath(absPath: string): Promise<void> { /* hash + upsert */ }
export function removePath(absPath: string): void { /* delete by md_path/meta_path */ }
export async function fullReindex(): Promise<void> { /* clear tables + rescan */ }
```

- [ ] **Step 4 — rerun tests:** 確認 `UNIQUE(client, slug)` 正常，document kind 與 path 規則一致。
- [ ] **Step 5 — commit:** reindex 與 tests 一起提交。

**Acceptance**
- [ ] `classifyPath()` 只接受 spec §4.1 定義的 4 類檔案。
- [ ] 同內容重複 reindex 不重寫 row。
- [ ] `fullReindex()` 可從零 rebuild 三張資料表資料。
- [ ] `.archived` 與 `.index` 不會被掃描。

**Commit:** `feat(gamma): add reindex pipeline with path classification`

### Task γ3: lib/index/watcher.ts（chokidar 範圍 + debounce）

**Files:** Create `skill/lib/index/watcher.ts`, `skill/tests/index/watcher.test.ts`

- [ ] **Step 1 — tests first:** 覆蓋 add/change/unlink、debounce、忽略 `.index`/`.archived`。
- [ ] **Step 2 — confirm fail:** watcher 尚不存在。
- [ ] **Step 3 — implement watcher:** 監聽 `clients/**/{cases,anti-library}/*.md`、`clients/**/meta.yaml`、`personal-style-guide.md`、`scenario-overrides/*.md`；`awaitWriteFinish` 200ms；事件映射到 `reindexPath/removePath`。

```typescript
export function startWatcher(): FSWatcher { /* chokidar.watch([...]) */ }
export async function stopWatcher(): Promise<void> { /* close */ }
```

- [ ] **Step 4 — rerun tests:** 確認 change storm 不會造成重複 reindex。
- [ ] **Step 5 — commit:** watcher 單獨提交，便於回滾。

**Acceptance**
- [ ] add/change 事件都會 reindex。
- [ ] unlink 事件會刪除對應 row。
- [ ] `.index` 和 `.archived` 永遠忽略。
- [ ] burst write 只產生一次穩定 reindex。

**Commit:** `feat(gamma): add chokidar watcher for vault sync`

### Task γ4: selfCheckOnStartup（mtime 增量修補）

**Files:** Modify `skill/lib/index/reindex.ts`; add tests in `skill/tests/index/reindex.test.ts`

- [ ] **Step 1 — tests first:** 覆蓋 `index_meta` 缺失時全量 rebuild、僅新檔 reindex、無新檔不動作。
- [ ] **Step 2 — confirm fail:** 新 export 尚不存在。
- [ ] **Step 3 — implement startup repair:** 用 `index_meta.last_full_rebuild_at` 對比 `stat.mtimeMs`；沒有 meta 就 `fullReindex()`，有 meta 就只補新檔。

```typescript
export async function selfCheckOnStartup(): Promise<void> {
  const row = db.prepare('SELECT value FROM index_meta WHERE key = ?').get('last_full_rebuild_at');
  if (!row) return fullReindex();
  return scanNewer(vault, new Date(row.value).getTime());
}
```

- [ ] **Step 4 — rerun tests:** 確認不用 shell `find` 也能達成 spec 要求，且跨平台。
- [ ] **Step 5 — commit:** 只提交 self-check 補強。

**Acceptance**
- [ ] 首次啟動沒有 `index_meta` 時會全量 rebuild。
- [ ] 已建立索引後只重建較新的檔案。
- [ ] 無更新時啟動成本低且不重寫全部 rows。
- [ ] 行為在 tests 中可重現，不靠 shell 巧合。

**Commit:** `feat(gamma): add startup self-check incremental reindex`

### Task γ5: sidecar/server.ts + 5 route modules + supertest API suite

**Files:** Create `skill/sidecar/server.ts`, `skill/sidecar/routes/clients.ts`, `skill/sidecar/routes/cases.ts`, `skill/sidecar/routes/style-guide.ts`, `skill/sidecar/routes/scenario-overrides.ts`, `skill/sidecar/routes/context.ts`, `skill/sidecar/tests/api.test.ts`; Modify `package.json` for `express`, `supertest`, types if missing

- [ ] **Step 1 — tests first:** `api.test.ts` 先用 `createApp()` 跑 supertest，覆蓋 `/api/clients`、`/api/cases`、`/api/style-guide`、`/api/scenario-overrides`、`/api/context` 的基本 200/4xx contract。
- [ ] **Step 2 — confirm fail:** app/route 尚不存在。
- [ ] **Step 3 — implement app shell:** `server.ts` 匯出 `createApp()` 與 `startServer()`；Express 監聽 `127.0.0.1:5174`；先串起 routes、JSON body parser、簡單 health logging。

```typescript
export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/clients', clientsRouter());
  app.use('/api/cases', casesRouter());
  app.use('/api/style-guide', styleGuideRouter());
  app.use('/api/scenario-overrides', scenarioOverridesRouter());
  app.use('/api/context', contextRouter());
  return app;
}
```

- [ ] **Step 4 — rerun tests:** 讓非 `/api/context` 路由先用 loader/writer/file IO 版本通過。
- [ ] **Step 5 — commit:** server shell 與 route skeleton 同 commit。

**Acceptance**
- [ ] `createApp()` 可被 tests 直接 import，不需真的 listen 才能測。
- [ ] sidecar listen 位址固定 `127.0.0.1:5174`。
- [ ] 5 個 route module 都有最基本 method contract 與錯誤碼。
- [ ] `api.test.ts` 可在不啟動 dashboard 的情況下跑通。

**Commit:** `feat(gamma): add express sidecar server and core api routes`

### Task γ6: /api/context 完整實作（retrieval scope union + topN + neverRules）

**Files:** Modify `skill/sidecar/routes/context.ts`, `skill/sidecar/tests/api.test.ts`; optionally add helper `skill/lib/never-rules.ts` if needed

- [ ] **Step 1 — tests first:** 擴充 context tests，覆蓋 `client + all self union`、scenario override 讀取、top 5 case 限制、antiCases 分流、neverRules parse。
- [ ] **Step 2 — confirm fail:** 先前 route 只會回簡化 payload。
- [ ] **Step 3 — implement response assembly:** 用 `loadClient()`、`loadCaseSummaries()`、style-guide markdown、scenario override、`extractNeverRules()` 組成 bridge payload；保留 `retrievedFrom` 做 debug。

```typescript
export interface ContextResponse {
  client: ClientMeta | null;
  styleGuide: string;
  scenarioOverride: string;
  cases: CaseSummary[];
  antiCases: CaseSummary[];
  neverRules: Array<{ id: string; pattern: string; target: string }>;
  retrievedFrom: string[];
}
```

- [ ] **Step 4 — rerun tests + manual curl:** `curl "http://localhost:5174/api/context?client=aicycle&scenario=landing"` 手動看 payload 是否符合 spec §4.3。
- [ ] **Step 5 — commit:** context route 單獨提交，方便未來 bridge 調整。

**Acceptance**
- [ ] 回傳 payload 結構與 spec §4.3 一致。
- [ ] positive cases 與 negative antiCases 分開回傳。
- [ ] `retrievedFrom` 反映實際 union 到的 clients。
- [ ] `neverRules` 至少能抽出 style-guide 中 regex detector 條目。

**Commit:** `feat(gamma): complete /api/context bridge payload`

### Task γ7: Phase γ 收尾

**Files:** No product file required beyond fixes from review

- [ ] **Step 1 — full test run:** 跑 `npm test`，並手動用 sample vault 驗 create/change/unlink 對 SQLite row 的同步。
- [ ] **Step 2 — daemon smoke:** 啟 sidecar，逐一 `curl` 五個 API，確認 200/4xx 與資料 shape。
- [ ] **Step 3 — cross-review:** review 重點是 schema drift、hash invalidation、context contract。
- [ ] **Step 4 — phase tag:** 綠燈後建立 `phase-gamma-complete`。
- [ ] **Step 5 — commit if needed:** 僅在驗收修補需要時補一個 phase close commit。

**Acceptance**
- [ ] `npm test` 全綠。
- [ ] watcher 對 create/change/unlink 可觀察到正確 DB 變化。
- [ ] `/api/context` 手動 smoke 正常。
- [ ] tag `phase-gamma-complete` 存在。

**Commit:** `ci(gamma): phase gamma verification complete`

---

# Phase δ — Dashboard 4 page

**Goal:** 建一個只服務 sidecar v0.2 的精簡 Astro SSR dashboard，四個 page 都透過 sidecar API 工作，不重做 Open Design 的 generation flow。

**Phase exit:** `cd skill/dashboard && npm test` 與 Playwright E2E 全綠、sidecar 可在 `localhost:5174` 提供 dashboard、Codex↔Gemini cross-review 0 blocking、tag `phase-delta-complete`。

### Task δ1: dashboard scaffold（Astro 5 SSR + Node adapter middleware + Tailwind 4）

**Files:** Create `skill/dashboard/package.json`, `skill/dashboard/astro.config.mjs`, `skill/dashboard/tsconfig.json`, `skill/dashboard/playwright.config.ts`, `skill/dashboard/src/layouts/BaseLayout.astro`, `skill/dashboard/src/styles/global.css`, `skill/dashboard/src/pages/index.astro`; Modify `skill/sidecar/server.ts`

- [ ] **Step 1 — tests/scaffold first:** 建最小 Astro app、Vitest/Playwright config、`BaseLayout`、`global.css`，先放 smoke page。
- [ ] **Step 2 — confirm fail/build gap:** 在安裝 deps 前，`npm run test` 或 `npm run build` 應失敗。
- [ ] **Step 3 — implement scaffold:** `output: 'server'`，Node adapter 用 middleware mode，讓 `sidecar/server.ts` 直接 mount Astro handler；Tailwind 4 只做 light theme 變數與基本元件層。

```javascript
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  integrations: [react()],
});
```

```typescript
// sidecar/server.ts
app.use(await import('../dashboard/dist/server/entry.mjs').then(m => m.handler));
```

- [ ] **Step 4 — rerun build/test:** 讓 dashboard 可獨立 build 與跑最小 smoke。
- [ ] **Step 5 — commit:** scaffold 與 config 一起提交。

**Acceptance**
- [ ] dashboard 可獨立 `npm run build`。
- [ ] `BaseLayout` 套上 Tailwind 4 global styles。
- [ ] config 不引入 shadcn。
- [ ] `sidecar/server.ts` 可 mount dashboard，最終由 `localhost:5174` 提供 UI。

**Commit:** `feat(delta): scaffold astro dashboard in middleware mode`

### Task δ2: index.astro（overview + ClientSwitcher island）

**Files:** Modify `skill/dashboard/src/pages/index.astro`; Create `skill/dashboard/src/components/ClientSwitcher.tsx`, `skill/dashboard/src/lib/api.ts`

- [ ] **Step 1 — tests first:** 為 `api.ts` 補最小 unit test，並準備 overview 頁的資料 loading mock。
- [ ] **Step 2 — confirm fail:** 目前只有空殼首頁。
- [ ] **Step 3 — implement overview page:** 首頁顯示 totals、by-client、小型最近案例區塊；`ClientSwitcher` 用 sidecar `/api/clients` 載入資料並同步 localStorage/current accent。

```tsx
export function ClientSwitcher() {
  const [clients, setClients] = useState<ClientMeta[]>([]);
  // fetch('/api/clients') -> set selected -> persist slug
}
```

- [ ] **Step 4 — rerun unit/smoke:** 確認首頁 render 與切 client 無 runtime error。
- [ ] **Step 5 — commit:** 首頁與 switcher 一起提交。

**Acceptance**
- [ ] 首頁可讀 sidecar stats/client list。
- [ ] 切 client 會記住目前選擇。
- [ ] overview 至少顯示 totals、by-client、recent cases 三塊。
- [ ] 無 dark-mode 或 shadcn 依賴。

**Commit:** `feat(delta): add overview page and client switcher`

### Task δ3: /clients page（CRUD form + Dialog）+ e2e

**Files:** Create `skill/dashboard/src/pages/clients/index.astro`, `skill/dashboard/src/components/ClientCrudForm.tsx`, `skill/dashboard/tests/e2e/client-crud.spec.ts`

- [ ] **Step 1 — tests first:** Playwright 覆蓋 create、edit、archive 基本流程；必要時加最小 unit helper test。
- [ ] **Step 2 — confirm fail:** page/form 尚不存在。
- [ ] **Step 3 — implement CRUD UI:** 頁面按 type 分區列出 clients，表單呼叫 `/api/clients` 的 POST/PUT/DELETE，archive 需有確認對話。

```tsx
type ClientCrudMode = 'create' | 'edit';
// submit -> fetch('/api/clients', { method, body })
```

- [ ] **Step 4 — rerun e2e:** 確認建立 client 後列表更新，archive 後移出 active list。
- [ ] **Step 5 — commit:** page、form、e2e 一起提交。

**Acceptance**
- [ ] 可新增 `self` 或 `client` 類型客戶。
- [ ] 可修改 `name/theme_color/notes`。
- [ ] archive 後 active list 移除，不需硬刪。
- [ ] Playwright `client-crud.spec.ts` 綠燈。

**Commit:** `feat(delta): add clients page with CRUD dialog`

### Task δ4: /clients/[slug] page（CaseGrid + filter）+ e2e

**Files:** Create `skill/dashboard/src/pages/clients/[slug].astro`, `skill/dashboard/src/components/CaseGrid.astro`, `skill/dashboard/src/components/CaseFilter.tsx`, `skill/dashboard/tests/e2e/case-grid.spec.ts`

- [ ] **Step 1 — tests first:** Playwright 覆蓋指定 client grid、scenario/sentiment filter、切 client 後隔離顯示。
- [ ] **Step 2 — confirm fail:** page/grid/filter 尚不存在。
- [ ] **Step 3 — implement case browser:** 從 `/api/cases?client=<slug>` 載資料；grid 顯示 slug、scenario、sentiment、first quote；filter 用 query string 驅動。

```astro
---
const { slug } = Astro.params;
const cases = await fetchCases({ client: slug, scenario, sentiment });
---
```

- [ ] **Step 4 — rerun e2e:** 確認 filter 與 union retrieval 行為都能被 UI 呈現。
- [ ] **Step 5 — commit:** case browser 與 e2e 一起提交。

**Acceptance**
- [ ] `/clients/[slug]` 可顯示 case grid。
- [ ] scenario / sentiment filter 可用。
- [ ] grid 資料來源是 sidecar API，不直接讀檔。
- [ ] Playwright `case-grid.spec.ts` 綠燈。

**Commit:** `feat(delta): add client case grid page and filters`

### Task δ5: /style-guide page（StyleGuideEditor island + hash conflict）+ e2e

**Files:** Create `skill/dashboard/src/pages/style-guide.astro`, `skill/dashboard/src/components/StyleGuideEditor.tsx`, `skill/dashboard/tests/e2e/style-guide.spec.ts`

- [ ] **Step 1 — tests first:** Playwright 覆蓋 GET/編輯/保存/409 conflict；必要時對 markdown split helper 補 unit test。
- [ ] **Step 2 — confirm fail:** page/editor 尚不存在。
- [ ] **Step 3 — implement editor:** 讀 `/api/style-guide` 取得 `markdown + hash`；將 DO/NEVER/SOMETIMES 做可編輯欄位；POST 時帶 hash，409 時顯示 reload 提示。

```tsx
type StyleGuideDoc = { markdown: string; hash: string };
// save -> POST /api/style-guide { markdown, hash }
```

- [ ] **Step 4 — rerun e2e:** 確認 hash conflict 可重現，不會靜默覆蓋 vault。
- [ ] **Step 5 — commit:** page/editor/e2e 一起提交。

**Acceptance**
- [ ] style-guide 可讀可寫。
- [ ] 409 conflict 有明確 UI 提示。
- [ ] NEVER 條目編輯後，下一次 `/api/context` 能反映新規則。
- [ ] Playwright `style-guide.spec.ts` 綠燈。

**Commit:** `feat(delta): add style-guide editor with conflict detection`

### Task δ6: Phase δ 收尾

**Files:** No new product file required beyond fixes from review

- [ ] **Step 1 — dashboard test run:** 在 `skill/dashboard/` 跑 unit + Playwright；在 repo root 再跑 `npm test` 確認 skill tests 也仍綠。
- [ ] **Step 2 — mount smoke:** 暫時用 sidecar mount dashboard middleware，確認 `/`, `/clients`, `/clients/<slug>`, `/style-guide` 四頁都可達。
- [ ] **Step 3 — cross-review:** review 重點是 no-shadcn compliance、route coupling、conflict handling。
- [ ] **Step 4 — phase tag:** 建立 `phase-delta-complete`。
- [ ] **Step 5 — commit if needed:** 只收 phase close fixes。

**Acceptance**
- [ ] dashboard tests 全綠。
- [ ] 四個 page 都能從 sidecar 入口打開。
- [ ] cross-review 無 blocking issue。
- [ ] tag `phase-delta-complete` 存在。

**Commit:** `ci(delta): phase delta verification complete`

---

# Phase ε — Bridge skill + 啟動整合

**Goal:** 把 sidecar 實際接進 open-design fork、補 sidecar 啟停腳本、重寫本 repo 的 SKILL.md，最後用整合 e2e 驗證「建 client → 建 case → bridge fetch → prompt context 可見」。

**Phase exit:** `npm test`、dashboard E2E、整合 full-flow 綠燈，Open Design bridge skill 手動 smoke 成功，tag `v0.2.0`。

### Task ε1: open-design fork 內寫 design-memory-bridge skill

**Files:** Create or modify `/Volumes/500G/Claude Code Projects/open-design/skills/design-memory-bridge/SKILL.md`

- [ ] **Step 1 — tests/verification plan first:** 先定義手動驗證點：skill pre-flight 會 `curl` sidecar `/api/context`，sidecar down 時 fallback，不影響 Open Design 既有流程。
- [ ] **Step 2 — confirm current gap:** open-design fork 內尚無此 skill。
- [ ] **Step 3 — implement bridge skill:** 依 spec §3.1 撰寫 metadata、pre-flight `curl`、response shape 說明、fallback 行為與 prompt 注入規則。

```markdown
# Pre-flight (REQUIRED)

curl -s "http://localhost:5174/api/context?client=$CLIENT&scenario=$SCENARIO"

If sidecar returns 200:
- inject styleGuide
- inject scenarioOverride
- inject top 5 cases + antiCases NEVER signals
```

- [ ] **Step 4 — manual validation:** 在 open-design fork 內實跑一次 design flow，確認 agent pre-flight 至少會執行 fetch 或明確觀察到 fallback。
- [ ] **Step 5 — commit:** 在 open-design fork 內獨立 commit，避免與本 repo 混在一起。

**Acceptance**
- [ ] skill 文案明確要求 pre-flight fetch。
- [ ] sidecar 不可用時會 fallback，而非讓整個 generation fail hard。
- [ ] response shape 與 sidecar `/api/context` 對齊。
- [ ] 手動 smoke 至少可證明 fetch 路徑或 fallback 路徑其一可行。

**Commit:** `feat(bridge): add design-memory-bridge skill for sidecar context fetch`

### Task ε2: scripts/sidecar-start.sh + sidecar-stop.sh + PID file

**Files:** Create `skill/scripts/sidecar-start.sh`, `skill/scripts/sidecar-stop.sh`

- [ ] **Step 1 — tests/manual plan first:** 定義 smoke：start、already-running、stop、stale pid recovery。
- [ ] **Step 2 — confirm current gap:** repo 內尚無 sidecar 啟停 script。
- [ ] **Step 3 — implement scripts:** `sidecar-start.sh` 啟 `tsx skill/sidecar/server.ts`、寫 PID file、若已存在且活著則直接提示；`sidecar-stop.sh` 安全 kill 並清 PID。

```bash
PID_FILE="$HOME/.claude/state/design-lab/sidecar.pid"
[ -d "$SKILL_DIR/dashboard/dist" ] || (cd "$SKILL_DIR/dashboard" && npm run build)
nohup node --import tsx "$SKILL_DIR/sidecar/server.ts" > /tmp/design-lab-sidecar.log 2>&1 &
echo $! > "$PID_FILE"
open "http://localhost:5174/"
```

- [ ] **Step 4 — manual validation:** 連跑兩次 start 要能辨識 already running；stop 後 PID file 清掉。
- [ ] **Step 5 — commit:** scripts 單獨提交。

**Acceptance**
- [ ] start 能把 sidecar 拉起來並寫 PID file。
- [ ] second start 不重複起第二個 sidecar。
- [ ] stop 可清 PID file 並終止 process。
- [ ] stale pid 情況可自我修復。
- [ ] sidecar 啟動後瀏覽器入口為 `http://localhost:5174/`。

**Commit:** `feat(epsilon): add sidecar start-stop scripts with pid management`

### Task ε3: SKILL.md v0.2 重寫（只留 /design 與 /design-dashboard）

**Files:** Modify `skill/SKILL.md`

- [ ] **Step 1 — tests/review plan first:** 先定義預期 routing：`/design` 走 `design.sh`；`/design-dashboard` 走 `sidecar-start.sh`；其餘舊 commands 不再作為主入口。
- [ ] **Step 2 — confirm current gap:** 現有 `SKILL.md` 仍是 v0.1 四個 command。
- [ ] **Step 3 — rewrite skill doc:** 更新版本、啟動 hook、schema check、`/design`、`/design-dashboard`；對 `/design-collect`、`/design-feedback`、`/design-stats`、`/design-distill` 改為說明已收斂進 dashboard 或後續 phase。

```markdown
### `/design-dashboard`

Runs `bash $SKILL_DIR/scripts/sidecar-start.sh`

Then opens `http://localhost:5174/`.
```

- [ ] **Step 4 — manual smoke:** 在 CLI 環境確認 slash command 說明與 sidecar script 路徑一致。
- [ ] **Step 5 — commit:** 只提交 `SKILL.md` 更新。

**Acceptance**
- [ ] `SKILL.md` 版本與 v0.2 scope 一致。
- [ ] 僅保留兩個主要 slash command。
- [ ] hook 文案與 schema/migration 腳本名稱一致。
- [ ] 文件不再指向 flat v0.1 library 結構。

**Commit:** `docs(epsilon): rewrite SKILL.md for sidecar v0.2`

### Task ε4: 整合 e2e full-flow + final gate + tag v0.2.0

**Files:** Create `skill/dashboard/tests/e2e/full-flow.spec.ts`; modify existing configs only if needed

- [ ] **Step 1 — tests first:** 寫 full-flow：start sidecar → 建 client → 建 case → `/clients/[slug]` 顯示 → open-design bridge fetch sidecar context → payload 含 cases。
- [ ] **Step 2 — confirm fail:** 在 bridge skill與 start script 尚未完備前先紅。
- [ ] **Step 3 — implement integration glue:** 補 test fixture、wait helper、必要的 sidecar lifecycle hook，讓 Playwright 與外部 `curl`/Open Design smoke 可串起來。

```typescript
test('full flow: client -> case -> bridge context', async ({ page }) => {
  // 1. spawn sidecar
  // 2. create client via dashboard
  // 3. create case via API/UI
  // 4. assert /api/context returns matching case
  // 5. assert open-design bridge pre-flight can fetch same payload
});
```

- [ ] **Step 4 — final verification:** 跑 root `npm test`、dashboard tests、full-flow、manual Open Design smoke；整理驗收證據並打 `v0.2.0`。
- [ ] **Step 5 — final commit:** 只在所有 gates 綠燈後提交 final integration commit。

**Acceptance**
- [ ] `full-flow.spec.ts` 綠燈。
- [ ] `npm test` 與 dashboard tests 全綠。
- [ ] Open Design + sidecar 並行時，bridge skill 可取得 context 或明確 fallback。
- [ ] tag `v0.2.0` 存在。

**Commit:** `ci(epsilon): finalize sidecar v0.2 integration and tag release`

---

# Self-Review

## 1. Spec coverage

| Spec section | Coverage in this plan |
|---|---|
| §1.1 Discovery | Header goal + architecture keep A2 sidecar split explicit |
| §1.2 Cross-review consensus | Architecture + ε1 bridge skill + no core fork across all phases |
| §1.3 A2 核心 | γ5-γ6 sidecar API + ε1 pre-flight fetch |
| §2.1 v0.2 包含 | α2-α4、β1-β5、γ1-γ6、δ1-δ5、ε1-ε4 |
| §2.2 v0.2 不包含 | Conventions + δ scope explicitly exclude generation flow and shadcn |
| §2.3 工作量縮減 | 5-phase split, no vision adapter / iframe / extra pages |
| §3 Architecture | Header architecture + γ5 sidecar + δ1 middleware dashboard + ε1 bridge |
| §3.1 Bridge skill prompt | ε1 |
| §4.1 File structure | File Structure section + all task file lists |
| §4.2 API endpoints | γ5 route shell + γ6 context + δ2-δ5 UI consumers |
| §4.3 `/api/context` shape | β1 retrieval scope + γ6 response assembly + ε1 bridge contract |
| §5 Implementation phases | This entire α/β/γ/δ/ε plan |
| §6 Acceptance criteria | α5, β6, γ7, δ6, ε4 phase gates |
| §7.1 已決定 | No shadcn in conventions; sidecar host in γ5/ε2; bridge via HTTP in ε1 |
| §7.2 開放問題 | ε1 manual validation explicitly checks pre-flight fetch/fallback behavior |
| §8 SaaS path | Header architecture + γ6 HTTP boundary keep sidecar independently hostable |

**Coverage result:** §1-§8 皆有對應 task 或 phase gate，沒有 orphaned spec section。

## 2. Placeholder scan

Run:

```bash
rg -n 'TB[D]|TO[D]O|implement[[:space:]]later|fill[[:space:]]in[[:space:]]details' \
  docs/superpowers/plans/2026-05-02-design-lab-v0.2-sidecar.md
```

Expected: `0` hits.

## 3. Type consistency

- `CaseSummary`：β1 定義，γ6 直接沿用於 `cases` / `antiCases`，不另造 shape。
- `ClientMeta`：β3 定義，β4 writer、γ6 context payload、δ2/δ3 UI 消費都共用同一欄位集。
- `THEME_COLOR_PALETTE`：β4 定義 canonical source；client writer 與 dashboard UI 都引用同一份，不複製。
- `computeRetrievalScope()`：β1 定義 union 規則，γ6 `/api/context` 與 δ4 case grid 不重寫第二套邏輯。
- `classifyPath()` kinds：γ2 定義四種 kind，γ3 watcher 與 γ4 self-check 都用同一組判斷。

**Type review result:** 無明顯簽名漂移；若實作時新增 `ContextResponse` helper 型別，需從 γ6 向 δ/ε 單點匯出。

## 4. Execution Handoff

**Preferred:** `superpowers:subagent-driven-development`

- 把每個 task 當成單獨工作單元執行。
- 嚴守 test-first、單 task 單 commit、phase gate review。
- 適合 Phase γ/δ/ε 這類跨多檔整合工作。

**Acceptable fallback:** inline implementation

- 只適合 α2、α4、β5 這類檔案數少、回歸面可控的小 task。
- 仍必須保留 5-step TDD 節奏與 phase boundary gate。

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-design-lab-v0.2-sidecar.md`.
