# Handoff (2026-05-03 凌晨)

## State

design-lab v0.2 sidecar plan **Phase α complete** (tag `phase-alpha-complete`) + **β1 done** + **α hotfix done**。**52/52 npm test 全綠**。

**Active spec**: `docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md`
**Active plan**: `docs/superpowers/plans/2026-05-02-design-lab-v0.2-sidecar.md`（27 task / 5 phase α-ε）
**Spike resolved**: Open Design SKILL.md 內 curl 命令會被 agent 執行（confirmed 在 `apps/daemon/src/prompts/system.ts:146-150`），sidecar bridge skill 路線可行。

## Commits（這次 session 6 個）

| Commit | Phase | What |
|---|---|---|
| `25aab58` | α2 | bump schema to v2 + dynamic migration hint |
| `69bc237` | α2 review | harden check-schema (bash 數字防呆 + mixed vault test) |
| `4ce0bc7` | α3 | idempotent v1-to-v2 migration + docs |
| `f049487` | α3 review | harden migrate (mixed-state + trap + awk END) |
| `20b242d` | α4 | init-library v0.2 multi-client 結構 |
| **TAG** | — | `phase-alpha-complete` at `20b242d` |
| `f5bcf88` | β1 | case-loader.ts multi-client + retrieval scope union (8 tests) |
| `b3ef026` | β1 review | harden case-loader (broken symlink try-catch + YAML inline comment) |
| `8ff6a1b` | α hotfix | **vault path validation + atomic mkdir lock**（堵 destructive-qa 找到的 2 個 P0 BLOCKING）|

## Test count history
v0.1: 24 → α2: 32 → α3: 37 → α4: 38 → β1: 46 → β1 fix: 48 → α hotfix: 52

## /test + /destructive-qa 已跑 (本 session)

報告位置：
- `e2e/test-skill/reports/2026-05-02-explore.md`（199 行 — backend skill /test adaptation）
- `e2e/test-skill/reports/2026-05-02-destructive-qa.md`（backend CLI 10-attack 結果，找到 2 P0 BLOCKING 已 hotfix）

Skill experience 已寫入：
- `~/.claude/skills/auto-skill/experience/skill-test.md`（backend skill /test adaptation：Step 1-8 對應 + CLI Matrix Smoke + Internal Flow Verification + Pre-flight Risk Audit）
- `~/.claude/skills/auto-skill/experience/skill-destructive-qa.md`（backend CLI 10-attack 清單 + M1-M4 meta-pattern translation）
- `~/.claude/skills/auto-skill/experience/skill-codex-agent.md`（plan 漏寫範圍補進當前 commit + message 標明）
- `~/.claude/skills/auto-skill/experience/skill-gemini-agent.md`（gemini-rotate 只吃 -p 不吃 -f）

## Next session — 從這裡開始

### Step 1: 確認 baseline
```bash
cd "/Volumes/500G/Claude Code Projects/Design skill"
npm test 2>&1 | tail -8
# 預期 52/52 全綠
git log --oneline -5
# HEAD 應是 8ff6a1b
```

### Step 2: Phase β 剩餘 5 task

| Task | 估時 | 風險 | Dispatch prompt 必補 |
|---|---|---|---|
| **β2** `case-writer.ts` sentiment dispatch | 0.5 day | 低 | 不動 case-writer.js (β6 才刪) |
| **β3** `client-loader.ts` + js-yaml dep | 0.5 day | **中** | js-yaml pin `^3.14` 跟 gray-matter indirect dep 一致（避免 dual install）|
| **β4** `client-writer.ts` + theme palette validation | 0.5 day | 低 | 12-color THEME_COLOR_PALETTE 寫死在 lib/theme-palette.ts |
| **β5** stats by-client + design.sh ts loader + feedback-log client | 0.5 day | **高** | **必修 e2e-smoke.test.js** — Test 2 (`Total cases: 1 positive`) 在 stats 改 multi-client 後必 fail，要選方案 B (改 e2e-smoke 用 case-writer.ts) |
| **β6** 刪舊 .js + tag `phase-beta-complete` | 0.25 day | **高** | 7 個 caller chain（不只 plan 寫的 4 個 .js test，還含 6 個 .sh inline `node -e "import('...')"`，全要改成 `node --import tsx -e`）|

### Step 3: SKILL.md drift（α5 收尾遺漏）

`skill/SKILL.md` 仍是 v0.1 文案（行 7 寫 `# design-lab v0.1 MVP`、行 50 寫 `cases/<slug>.md`），但實際是 v0.2 結構。Phase ε3 task 才會 rewrite，但建議**β phase 開始前**加短 deprecation banner（≤5 行），避免 user 跑 SKILL.md 指引走錯。

### Step 4: 後續 phase（沒要求順序但記著）

- **γ** SQLite + chokidar + sidecar daemon (1 day)
- **δ** Dashboard 4 page (1 day)
- **ε** Bridge skill + 啟動整合 (0.5 day) → tag `v0.2.0`

## β2-β6 Pre-flight Risk 詳細（出自 /test 報告）

**Risk 1 (β6)**: 7 個 caller chain（plan 漏寫 6 個 .sh inline import）
- `case-loader.js` → `tests/case-loader.test.js` + `scripts/design.sh:24`
- `case-writer.js` → `tests/case-writer.test.js` + `tests/e2e-smoke.test.js:38` + `scripts/collect.sh:38`
- `stats.js` → `tests/stats.test.js` + `scripts/stats.sh:9`
- `feedback-log.js` → `tests/feedback-log.test.js` + `scripts/feedback.sh:18`
- `schema.js` → `scripts/check-schema.sh:10` (`node -e "import('...')"`)
- `lint.js` → `scripts/lint.sh:15`
- `last-artifact.js` → `scripts/design.sh:54`
- bash inline 跑 .ts 必須 `node --import tsx -e "..."` 而非 `node -e "..."`

**Risk 2 (β5)**: e2e-smoke.test.js 流程 `init → case-writer 寫 root cases/ → stats 看 Total cases: 1`
- β5 改 stats 多 multi-client 後 → stats 改吃 _personal/cases/ → case-writer.js 仍寫 root cases/ → 必 fail
- 採方案 B：β5 一併改 e2e-smoke 用 case-writer.ts（最小擴張）

**Risk 3 (β3)**: package.json 沒 js-yaml 直接 dep，但 node_modules 有 gray-matter@4 indirect 帶的 js-yaml@3
- β3 加 `js-yaml@^3.14` (跟 gray-matter 一致) + `@types/js-yaml@^3`，避免 dual install / type 衝突

**Risk 4 (SKILL.md drift)**: v0.1 文案 vs v0.2 實作不符 — α5 收尾應補 banner（短期），ε3 完整 rewrite（長期）

## 2 個 nice-to-have（不擋進 β）

- **CLI Matrix Hole 1**: v1 vault 跑 init-library 默默升級結構，沒警告 → 用戶可能困惑
- **CLI Matrix Hole 2**: check-schema 看不到 corrupt frontmatter（grep 不 care 閉合 marker）

## Context to load (next session)

```
# Plan + spec
docs/superpowers/plans/2026-05-02-design-lab-v0.2-sidecar.md  # task β2-β6
docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md

# Phase α 已完成
skill/lib/schema.js                # CURRENT_SCHEMA_VERSION = 2
skill/scripts/check-schema.sh      # dynamic migration hint + bash 防呆
skill/scripts/migrate-v1-to-v2.sh  # 含 vault path validation + atomic lock + idempotent + sibling backup
skill/scripts/init-library.sh      # v0.2 結構
skill/templates/{personal-style-guide,scenario-override,client-meta}.yaml
skill/lib/case-loader.ts           # β1 done

# β phase 要動
skill/lib/case-writer.js           # β2 改寫 .ts
skill/lib/feedback-log.js          # β5 加 client field
skill/lib/stats.js                 # β5 改吃 case-loader.ts
skill/scripts/design.sh            # β5 改 ts runtime（node --import tsx -e ...）
skill/scripts/collect.sh / stats.sh / feedback.sh  # β6 改 .ts import path
package.json                       # β3 加 js-yaml@^3.14

# Reports（這 session 寫的）
e2e/test-skill/reports/2026-05-02-explore.md
e2e/test-skill/reports/2026-05-02-destructive-qa.md
```

## Key decisions confirmed

- Path A2 (sidecar + bridge over fork core)
- Sidecar `localhost:5174`, Open Design `localhost:5173`
- Dashboard 4 page only，不用 shadcn
- design-skill repo 自己當 sidecar 宿主
- v1→v2 migration **idempotent + sibling backup + 不 double-backup + atomic lock + vault validation**

## Open questions still open

1. Dashboard health check Open Design daemon？（δ phase 再定）
2. SaaS v0.4+ sidecar 獨立 cloud service vs PR 進 Open Design 加 plugin？（v0.4+ 才需決定）
