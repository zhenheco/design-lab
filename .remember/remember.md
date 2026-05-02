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

### Step 1: 讀 sidecar spec + plan
- spec: `docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md`
- plan: `docs/superpowers/plans/2026-05-02-design-lab-v0.2-sidecar.md`（commit `36f97c4`，998 行 / 27 task / 5 phase α-ε）

### Step 2: spike 驗證（執行第一個 task 前必跑）
**Open Design 是否會吃 SKILL.md 內 curl 命令？**
- 讀 `/Volumes/500G/Claude Code Projects/open-design/apps/daemon/src/prompts/` 看 system prompt 拼裝
- 確認 agent 會主動跑 shell command（curl）還是只生成 artifact
- 若不行 → fallback 回 A1（fork + 改 daemon prompt assembly），這會變回 4-5 天 估算

### Step 3: 執行 sidecar plan
用 `superpowers:subagent-driven-development`（Codex 實作 + Gemini review），27 task / 5 phase。
從 Phase α2（schema_v2）開始 — α0/α1 已在前 session 完成（commits `4444062`、`ea30e36`）。

### Step 4: 解 _index.json conflict
`~/.claude/skills/auto-skill/knowledge-base/_index.json` 第 5/37/236 行有 git merge conflict marker (`<<<<<<<`/`=======`/`>>>>>>>`)。下個 session 解 conflict 時順便加我寫的新 entry：
```json
{"id": "brainstorm-prior-art-search", "file": "brainstorm-prior-art-search.md", "lines": 64, "summary": "brainstorm Q1 前強制 GitHub prior-art search，避免重複造輪子（2026-05-02 design-lab incident 教訓）"}
```
也更新 `~/.claude/skills/auto-skill/knowledge-base/INDEX.md` 加對應一行。

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
- `~/.claude/skills/auto-skill/knowledge-base/brainstorm-prior-art-search.md` — **跨專案強制規則**：brainstorm Q1 前強制 GitHub prior-art search（user feedback 2026-05-02 evening：「之後用 brainstorm 要先找 github 看，不要重複造輪」）
