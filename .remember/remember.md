# Handoff (2026-05-03 上午 — v0.2.1 security patch 完成)

## 🎉 State：v0.2.1 GA + 雙端 audit 收尾完成

design-lab v0.2 從 v0.2.0 GA 經 phase ζ-A/C/D 三輪 patch 抵達 **v0.2.1**。

```
phase-alpha-complete   (v0.1)
phase-beta-complete    (v0.2 lib refactor)
phase-gamma-complete   (v0.2 SQLite cache + sidecar API)
phase-delta-complete   (v0.2 dashboard SSR)
v0.1.0
v0.2.0                 (epsilon scripts + SKILL.md 重寫)
                       + ζ-A: e2e → vitest (5c8da7a)
                       + ζ-C: γ2 walkVault symlink hardening (8ab3285)
                       + ζ-D: v0.2.1 audit-driven security patch (b22fa4c)
v0.2.1                 ✨ 本次達成
```

skill 已 symlink 在 `~/.claude/skills/design-lab` → 本 repo `skill/`，
重啟後 `/design` `/design-dashboard` 可直接用。

## 本次 session（2026-05-03）3 commits

| Commit | What | Tests delta |
|---|---|---|
| `5c8da7a` | ζ-A: Playwright e2e (4/11 pass) → vitest 19/19 + RTL，移除 @playwright/test | dashboard 0 → 19 |
| `8ab3285` | ζ-C: walkVault lstatSync skip symlink + readdirSync try-catch + 3 tests | top 191 → 194 |
| `b22fa4c` | ζ-D: v0.2.1 security patch — 5 P0 + 2 P1 fix | top 194 → 208 |

最終：**top npm test 208/208 + dashboard vitest 19/19 + astro check 0 + tsc clean**

## 雙端 audit 過程

### 1. Codex code review（找 6 P0 + 3 P1）
2 commits 後跑全 repo audit，找到的 P0：
1. watcher 沒設 followSymlinks:false（drift from walkVault Fix）
2. sourceImagePath 用 blocklist 而非 allowlist
3. reindex parse fail 留 stale row
4. fullReindex partial fail 仍寫 last_full_rebuild_at
5. errorHandler 直接回 error.message（內部 path 洩漏）
6. write routes 沒 auth/origin guard（只靠 127.0.0.1）

### 2. Gemini arch/UX/spec audit（找 4 caveats）
- ❌ 「hardcoded vault path」誤判（DESIGN_LAB_VAULT_PATH 已 wire）
- ❌ 「atomic file write race」誤判（β2/β4 已用 wx + EISDIR）
- ✅ Sidecar 必啟動是真痛點（auto-startup 進 v0.3）
- ✅ feedback-log.jsonl 沒 UI 是真痛點（v0.3）

### 3. v0.2.1 patch 由 Codex 實作（TDD per fix，dispatch 一輪 ~15 min）
做 7/8（Fix #6 #9 推遲 v0.3）。Gemini cross-review verdict:
**ship-with-3-followups**（0 P0 blocker）。

## v0.3 Backlog（必修，從這 session audit 帶過去）

### 安全/正確性（不能再延）
1. **Fix #6 auth/origin guard** — DNS rebinding 防護，跟 auto-startup 統一做
2. **Fix #9 client meta ETag** — drift from style-guide / scenario-overrides
3. **Default allowlist 移除 tmpdir()** — multi-user DoS（Avy single-user 邊際但要修）
4. **routes/*.ts catch echo error.message 仍洩漏 path** — 要 normalize 或統一 fallback
5. **allowlist split 用 path.delimiter** — Windows ';' vs POSIX ':'

### UX/DX（高 user value）
6. **Auto sidecar startup** — `/design` `/design-dashboard` 啟動前 self-check + spawn（最大 DX 痛點）
7. **Global search API + UI** — SQLite FTS5 索引 cases + documents（沒 search 累到 50+ cases 就難用）
8. **Feedback log UI + API** — dashboard 新一頁列 feedback-log.jsonl，提供 edit endpoint

### Original v0.3 plan（降權）
9. Auto-distill / LLM NEVER detector
10. URL screenshot 收 case

### Test 品質
11. `.tmp-test-homes/` 改用 mkdtemp(tmpdir) + afterEach cleanup（Gemini 建議）
12. Watcher symlink test 升級成 chokidar event 整合測試（Gemini 建議）

### 留給未來的 v0.3+ 範圍外建議（從 phase ζ-C audit）
- walkVault 遞迴改迭代（防深度 DOS）
- readdirSync 改 fs.opendir（防百萬 entry OOM）
- Mount point dev check (`stats.dev` 跨 fs boundary)
- DESIGN_LAB_FOLLOW_SYMLINKS opt-in env var

## v0.4 Roadmap（不變動）

1. Cloud sidecar prototype（Cloud Run / Fly.io）— SaaS path 第一步
2. Multi-vault 切換
3. Case export/import zip

## 未驗證 / 待用戶手動

- **ε1 open-design fork bridge skill** — 用戶手動寫在 open-design fork：
  - `skills/design-memory-bridge/SKILL.md` 按 spec §3.1
  - pre-flight `curl -s http://localhost:5174/api/context?client=$C&scenario=$S`
  - 注入 system prompt: styleGuide + scenarioOverride + cases + antiCases + neverRules
  - sidecar down 時 fallback 不 fail hard
- **真實 vault 累積使用**：本 session smoke test 建了 fresh `~/Documents/CC Cli/design-library/`（v0.2 結構，含 `_personal` client + 4 scenario-overrides）。可立即開始用 `/design <task>` 收 case。

## Active spec / plan

- `docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md`
- `docs/superpowers/plans/2026-05-02-design-lab-v0.2-sidecar.md`
- v0.3 plan 待寫（建議先 brainstorm Auto-startup + Search 兩個 P0 design）

## Next session — 從這裡開始

### Step 1: 確認 baseline
```bash
cd "/Volumes/500G/Claude Code Projects/Design skill"
git log --oneline -5
# HEAD 應是 b22fa4c security(v0.2.1): 7 個 P0/P1 fix
git tag --list | grep v0
# 預期含 v0.1.0 / v0.2.0 / v0.2.1
npm test 2>&1 | tail -8
# 預期 208/208
cd skill/dashboard && npm test 2>&1 | tail -8
# 預期 19/19 vitest + astro check 0
cd ../.. && npx tsc --noEmit
# 預期 clean
```

### Step 2: 啟 sidecar smoke
```bash
bash skill/scripts/sidecar-start.sh
# 應 PID file + 5174 listen + dashboard mount
curl -s http://127.0.0.1:5174/api/clients | head
# 應 {"clients":[{"slug":"_personal",...}]}
bash skill/scripts/sidecar-stop.sh
```

### Step 3: 進 v0.3 設計

優先序：

**A. 設計 Auto-startup + Auth 統一方案**（建議先做）
- `/design` `/design-dashboard` 啟動前 spawn sidecar（讓 Avy 不用記 sidecar-start.sh）
- 同時加 auth：sidecar 啟動產生隨機 token 寫 `~/.claude/state/design-lab/api-token`，bridge skill 從同檔讀，所有 write route 要 X-Design-Lab-Token header
- 解 Fix #6 + DX 痛點 #1

**B. Global Search API + UI**
- backend：SQLite FTS5 virtual table 索引 cases (frontmatter + body) + documents (style-guide, scenario-overrides) + clients (name, notes)
- API：`GET /api/search?q=&kind=&client=`
- UI：dashboard 加 search bar in BaseLayout

**C. 修 v0.3 backlog 的 P1 (#9, #3, #4, #5)**

**D. Feedback log UI + auto-distill 兩個 v0.3 原本 plan**

### Step 4: brainstorm 完成才寫 plan / 進 implement

按 CLAUDE.md「方案階段交叉驗證主導權」：
- 既有 repo 修改 → Claude 主導 + Gemini 驗證
- 新功能（auto-distill / search / auth）→ Gemini 主導 + Claude 驗證

## Context to load (next session)

```
# Plan + spec
docs/superpowers/plans/2026-05-02-design-lab-v0.2-sidecar.md
docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md

# v0.2.1 改的核心
skill/lib/index/reindex.ts        # walkVault lstat + scanError + onError chain
skill/lib/index/watcher.ts        # followSymlinks:false + scanAddedDirectory hardening
skill/sidecar/routes/cases.ts     # sourceImagePath allowlist + DESIGN_LAB_SOURCE_ALLOWLIST
skill/sidecar/server.ts           # errorHandler 不洩漏

# Test
skill/tests/index/{reindex,watcher}.test.ts
skill/sidecar/tests/api.test.ts   # 5 個新 sourceImagePath test
skill/dashboard/tests/components/  # 19 vitest

# 入口
skill/SKILL.md                    # v0.2 spec
skill/scripts/sidecar-start.sh
skill/scripts/sidecar-stop.sh
```

## Open questions

1. v0.3 先做 Auto-startup+Auth (A) 還是 Search (B)？
   - A 解最大 DX 痛點 + 1 個 P0 security
   - B 解 user value 痛點（cases 累積後必需）
   - 建議 A 先（30% 工作量解 60% 痛點），B 跟在後
2. Auth token 寫到 `~/.claude/state/design-lab/api-token` vs `vault/.index/api-token` vs 純 env var — 哪個跟 bridge skill 接最自然
3. open-design fork bridge skill 你打算何時寫？建議跟 v0.3 auth 同期（auth 完成後寫，因為 bridge 要讀 token）
4. SQLite FTS5 索引 frontmatter 還是 body 或都索引？schema 設計需要先想
