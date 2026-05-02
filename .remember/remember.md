# Handoff (2026-05-02 evening)

## State

design-lab v0.2 **pivoted** to sidecar architecture mid-session after discovering [`nexu-io/open-design`](https://github.com/nexu-io/open-design)（13.7k⭐, Apache 2.0）已實作我們 v0.2 dashboard 80%。Cross-review (Claude+Gemini) 共識：不 fork core，sidecar daemon 解耦。

**Active spec:** `docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md`（剛寫，~600 行精簡版）

**Superseded:** `docs/superpowers/specs/2026-05-02-design-lab-v0.2-design.md` 與 `docs/superpowers/plans/2026-05-02-design-lab-v0.2.md`（標頭已標 SUPERSEDED）

**Phase A 已完成（保留為 sidecar foundation）:**
- A0: `4444062` — package.json + tsconfig + tsx + better-sqlite3 + chokidar deps
- A1: `ea30e36` — `skill/lib/paths.ts` + 6 tests（30/30 全綠）
- pivot commit: `5ec35bc` — superseded markers

**Fork:**
- `https://github.com/zhenheco/open-design` (forked from nexu-io/open-design)
- Cloned to `/Volumes/500G/Claude Code Projects/open-design/` (127MB)
- 目前用途：未來加 `skills/design-memory-bridge/SKILL.md`（Phase ε）。**目前不主修 fork**

## Next session — 從這裡開始

### Step 1: 讀 sidecar spec
`docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md`

### Step 2: 寫 sidecar v0.2 plan（取代既有 v0.2 plan）
精簡版，5 phase（α/β/γ/δ/ε），總計約 25 task。仿原 plan TDD 形式。

### Step 3: spike 驗證（plan 階段第一件事）
**Open Design 是否會吃 SKILL.md 內 curl 命令？**
- 讀 `/Volumes/500G/Claude Code Projects/open-design/apps/daemon/src/prompts/` 看 system prompt 拼裝
- 確認 agent 會主動跑 shell command（curl）還是只生成 artifact
- 若不行 → fallback 回 A1（fork + 改 daemon prompt assembly），這會變回 4-5 天 估算

### Step 4: 執行 sidecar
仿原 v0.2 plan 的 subagent-driven-development（Codex 實作 + Gemini review），但 task 數從 43 降到 ~25，工期從 10 天降到 3.5 天。

## Context to Load

```
docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md   # active spec
docs/superpowers/specs/2026-05-02-design-lab-design.md          # v0.1 base
skill/lib/paths.ts                                               # Phase A1 已寫
skill/lib/schema.js                                              # 要升 v2
skill/lib/case-loader.js                                         # 要改寫 .ts (multi-client)
skill/lib/case-writer.js                                         # 同上
skill/scripts/init-library.sh                                    # 要升級 v0.2 結構
package.json                                                     # 已升 v0.2.0-dev
tsconfig.json                                                    # 已建
/Volumes/500G/Claude Code Projects/open-design/skills/dashboard/SKILL.md  # bridge skill 範本
/Volumes/500G/Claude Code Projects/open-design/apps/daemon/src/skills.ts   # skill 機制（249 行）
/Volumes/500G/Claude Code Projects/open-design/apps/daemon/src/db.ts       # 7 表 schema（不 modify）
```

## Key decisions

- **Path A2** (sidecar + bridge) over A1 (fork core)
- Sidecar listen on **localhost:5174** (Open Design 用 5173)
- Dashboard 4 page only（index/clients/[slug]/style-guide），不做 collect/feedback（Open Design 已有）
- 不用 shadcn-ui（精簡，vanilla components）
- design-skill repo 自己當 sidecar 宿主，不分 repo

## Open questions（plan 階段定）

1. Open Design 的 SKILL.md prompt 內，agent 是否會主動跑 curl？(spike step 3)
2. Dashboard 要不要 health check Open Design daemon？
3. SaaS v0.4+ 路徑：sidecar 獨立成 cloud service vs PR 進 Open Design 加 plugin system

## Memory written this session

- `~/.claude/projects/-Volumes-500G-Claude-Code-Projects-Design-skill/memory/feedback_brainstorm_consensus.md` — brainstorm cross-review 共識直接做不問用戶（user feedback）
