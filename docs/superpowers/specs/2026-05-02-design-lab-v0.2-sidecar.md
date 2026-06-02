# design-lab v0.2 — Sidecar daemon + Open Design bridge

**Date**: 2026-05-02
**Status**: Design (active — supersedes `2026-05-02-design-lab-v0.2-design.md`)
**Owner**: Avy
**Predecessors**:
- v0.1：`docs/superpowers/specs/2026-05-02-design-lab-design.md`
- v0.2 attempt 1（dashboard from-scratch，已 SUPERSEDED）：`2026-05-02-design-lab-v0.2-design.md`

**Strategy**: Sidecar daemon + skill bridge（不 fork open-design core）

## 1. Why this pivot

### 1.1 Discovery
2026-05-02 同日得知 [`nexu-io/open-design`](https://github.com/nexu-io/open-design)（13.7k⭐ / 1566 fork / Apache 2.0）已實作 design-lab v0.2 dashboard 80% 範圍：
- Astro/Next.js + local daemon + iframe preview ✅
- SQLite persistence ✅
- Vision LLM (gpt-image-2 / Seedance / HyperFrames) ✅
- Multi-project ✅
- 31 skill + 72 design system markdown ✅
- 10 個 agent CLI 自動偵測 + BYOK proxy ✅
- Vercel 部署支援 ✅
- Claude Code SKILL.md 規範相容 ✅

### 1.2 Cross-review consensus（Claude ↔ Gemini）
重新 brainstorm 後達成共識：**不重新造輪子**。但 Open Design 的 skill 概念是「artifact 產出器」，我們的「個人設計品味記憶」**不產 artifact**，所以不該作為 skill 加進去。

兩個 sub-option：
- **A1（駁回）**：Fork open-design + 改 core（db.ts/server.ts/web）→ 4-5 天 + 長期 fork divergence
- **A2（採用）**：Sidecar daemon + skill bridge → 3-4 天 + 兩邊解耦

### 1.3 A2 核心
design-skill repo 當 **sidecar daemon**（localhost:5174），提供個人設計品味的讀寫 API + 精簡 dashboard。Open Design 的 skill 內 hint agent「pre-flight: fetch http://localhost:5174/api/context?client=X 拿上下文」。

兩個 daemon 並存：
- Open Design daemon（localhost:5173）：**generation**（產 artifact、跑 agent、preview iframe）
- Sidecar daemon（localhost:5174）：**memory**（讀寫個人 cases/style-guide/clients、Obsidian markdown vault 共存）

## 2. Scope

### 2.1 v0.2 包含
- **Sidecar daemon** (`skill/sidecar/`)：
  - Express + better-sqlite3 + chokidar
  - 5 個 API：`/api/clients`, `/api/cases`, `/api/style-guide`, `/api/scenario-overrides`, `/api/context`
  - 30 min idle auto-stop
  - PID file 管理
- **精簡 Dashboard** (`skill/dashboard/`)：
  - Astro 5 SSR + Tailwind 4（不用 shadcn — 太重，用 vanilla components）
  - 4 個 page：`/`, `/clients`, `/clients/[slug]`, `/style-guide`
  - 不做 generation flow（Open Design 已有）
- **Multi-client schema_version=2**（沿用 v0.2 attempt 1 的設計）
- **chokidar + SQLite cache**（沿用）
- **Bridge skill** in fork (`open-design/skills/design-memory-bridge/SKILL.md`)
- **Migration v1→v2**（沿用）

### 2.2 v0.2 不包含（明確 v0.3+）
- ~~Vision LLM adapter~~ — Open Design 已有，sidecar 不重複
- ~~5 流派視覺方向~~ — Open Design 已有
- ~~iframe preview~~ — Open Design 已有
- ~~SaaS auth / billing~~（v0.4+）
- ~~Auto distill~~（v0.3）
- ~~LLM detector for NEVER~~（v0.3）

### 2.3 跟 v0.2 attempt 1 比工作量縮減
| 模組 | attempt 1 | A2 sidecar |
|---|---|---|
| Vision adapter | Phase D 1-2 天 | ❌ Open Design 已有 |
| Astro dashboard 5 page | Phase E-F 4 天 | 4 page 簡化 1.5 天 |
| Glue + slash command | Phase G 1 天 | server entry 0.5 天 |
| **總計** | **~10 天** | **~3.5 天** |

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User                                                         │
│  ┌──────────────────┐         ┌──────────────────────┐      │
│  │ /design-dashboard│         │ open-design web      │      │
│  │ → localhost:5174 │         │ → localhost:5173     │      │
│  └──────────────────┘         └──────────────────────┘      │
└──────────┬─────────────────────────────┬─────────────────────┘
           │                              │
           ▼                              ▼
  ┌────────────────┐            ┌─────────────────────────────┐
  │ Sidecar daemon │            │ Open Design daemon          │
  │ (Express)      │            │ (Express + Astro Web)       │
  │                │   HTTP     │                             │
  │ /api/context ──┼────────────┤ skill prompt assembly       │
  │ /api/cases     │            │   ↓                         │
  │ /api/clients   │            │ injects fetched context     │
  │ /api/style-guide│           │   into agent prompt          │
  │                │            │   ↓                         │
  │ chokidar +     │            │ spawn(claude/codex/...)     │
  │ SQLite cache   │            │                             │
  └────────┬───────┘            └─────────────────────────────┘
           │
           ▼
  ~/Documents/CC Cli/design-library/
  (markdown source of truth, Obsidian-compatible)
```

### 3.1 Bridge skill prompt（in fork）

```markdown
# skills/design-memory-bridge/SKILL.md
---
name: design-memory-bridge
description: |
  Inject Avy's personal design memory (cases, anti-library, style-guide,
  client-specific overrides) into the agent's prompt before generating any
  artifact. Pre-flight reads sidecar API at localhost:5174 to fetch
  per-client retrieval-scoped context.
od:
  mode: prototype
  scenario: design
  preview:
    type: html
  design_system:
    requires: false   # design-memory provides its own context
---

# Pre-flight (REQUIRED)

Before generating, fetch context from sidecar:

```bash
curl -s "http://localhost:5174/api/context?client=$CLIENT&scenario=$SCENARIO"
```

Response shape: `{ styleGuide: string, cases: CaseSummary[], antiCases: CaseSummary[], retrievedFrom: string[] }`.

If sidecar is down → fall back to standard Open Design flow.
Otherwise → use returned `styleGuide` (DO/NEVER/SOMETIMES) + 5 most-relevant cases as design references; respect anti-library NEVER patterns.

[Rest of skill: standard design generation workflow，引用 Open Design 既有 skill 結構]
```

## 4. Sidecar daemon design

### 4.1 File structure

```
skill/
├── sidecar/                              # ⭐ NEW
│   ├── server.ts                         # Express entry + idle watcher
│   ├── routes/
│   │   ├── clients.ts                    # GET/POST/PUT/DELETE
│   │   ├── cases.ts                      # GET/POST
│   │   ├── style-guide.ts                # GET/POST
│   │   ├── scenario-overrides.ts         # GET/POST
│   │   └── context.ts                    # GET — bridge endpoint for agent
│   └── tests/
│       └── api.test.ts                   # supertest
├── lib/                                  # 沿用 v0.1 + Phase A
│   ├── paths.ts                          # ✅ 既存（Phase A1）
│   ├── case-loader.ts                    # 改寫（v0.2 multi-client）
│   ├── case-writer.ts                    # 改寫
│   ├── client-loader.ts                  # 新增
│   ├── client-writer.ts                  # 新增
│   ├── feedback-log.js                   # 沿用
│   ├── lint.js                           # 沿用
│   ├── schema.js                         # ✅ 既存（CURRENT_SCHEMA_VERSION=1，要升 2 by A2）
│   ├── stats.js                          # 沿用 + by-client
│   └── index/
│       ├── db.ts                         # SQLite cache schema
│       ├── reindex.ts                    # Path classify + dispatch
│       └── watcher.ts                    # chokidar
├── dashboard/                            # ⭐ 精簡 Astro
│   ├── astro.config.mjs                  # SSR + Node adapter
│   ├── package.json
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro               # overview
│   │   │   ├── clients/
│   │   │   │   ├── index.astro           # client list + CRUD
│   │   │   │   └── [slug].astro          # case grid + filter
│   │   │   ├── style-guide.astro         # editor
│   │   │   └── api/                      # （proxy 給 sidecar 即可，不重做）
│   │   └── components/
│   │       ├── ClientSwitcher.tsx        # React island
│   │       ├── CaseGrid.astro            # 靜態
│   │       ├── ClientCrudForm.tsx        # React island
│   │       └── StyleGuideEditor.tsx      # React island
│   └── tests/e2e/
│       └── full-flow.spec.ts
├── scripts/
│   ├── sidecar-start.sh                  # spawn sidecar + dashboard
│   ├── sidecar-stop.sh
│   ├── init-library.sh                   # ✅ 既存（A4 要升級 v0.2 結構）
│   ├── migrate-v1-to-v2.sh               # ⭐ A3
│   ├── design.sh                         # ✅ 既存（B5 要改 ts loader）
│   └── ...
└── tests/
    ├── ... (沿用 v0.1)
    └── ... (新加，仿 v0.2 attempt 1 plan)
```

### 4.2 API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/clients` | List all clients (含 type filter) |
| `POST` | `/api/clients` | Create client |
| `PUT` | `/api/clients/:slug` | Update meta |
| `DELETE` | `/api/clients/:slug` | Archive (move to .archived) |
| `GET` | `/api/cases?client=X&scenario=Y&sentiment=Z` | List cases (retrieval scope) |
| `POST` | `/api/cases` | Write case (drag-drop from dashboard or external) |
| `GET` | `/api/style-guide` | Read personal-style-guide.md + hash |
| `POST` | `/api/style-guide` | Write back (hash conflict 偵測) |
| `GET` | `/api/scenario-overrides` | List + content |
| `POST` | `/api/scenario-overrides/:scenario` | Write override |
| `GET` | `/api/context?client=X&scenario=Y` | **Bridge endpoint** — return styleGuide + topN cases + antiCases for prompt injection |
| `POST` | `/api/reindex` | Full SQLite rebuild |

### 4.3 `/api/context` shape（bridge 核心）

```typescript
GET /api/context?client=aicycle&scenario=landing
→ {
  client: { slug: 'aicycle', name: 'AICycle', type: 'self', theme_color: '#1F2937', ... },
  styleGuide: '...full markdown of personal-style-guide.md...',
  scenarioOverride: '...landing.md content...',
  cases: [
    { slug: '0001-x', client: 'aicycle', scenario: 'landing', sentiment: 'positive', tokens: {...}, quotes: [...] },
    ...top 5 by retrieval scope (client X + all type:self union)
  ],
  antiCases: [
    ...negative cases，supply NEVER signals
  ],
  neverRules: [...regex rules from style-guide for lint],
  retrievedFrom: ['aicycle', '_personal', 'zhenheco']   // debug：哪些 client 被 union
}
```

Agent 在 generation 前 fetch 此 endpoint，把 styleGuide + scenarioOverride + cases 注入 system prompt 範例參考、antiCases 提示「絕對不做」。

## 5. Implementation phases（精簡版，~3.5 天）

### Phase α — Foundation（Phase A 既有 + 補完）
- A0 ✅ 已完成（package.json + tsconfig）
- A1 ✅ 已完成（paths.ts + 6 tests）
- A2: schema.js 升 v2 + check-schema 動態 hint （0.5 天）
- A3: migrate-v1-to-v2.sh + 測試 （0.5 天）
- A4: init-library.sh v0.2 結構 （0.25 天）

### Phase β — Library refactor（沿用 v0.2 attempt 1 Phase B）
- case-loader.ts / case-writer.ts (multi-client、sentiment 分流)
- client-loader.ts / client-writer.ts
- stats by-client、feedback-log + client field
- 0.75 天

### Phase γ — SQLite + chokidar + sidecar daemon
- db.ts / reindex.ts / watcher.ts（沿用 v0.2 attempt 1 Phase C 設計，含 documents 表 + path dispatch）
- sidecar/server.ts + 5 個 routes
- /api/context 完整實作（retrieval scope + topN）
- 1 天

### Phase δ — Dashboard 4 page（精簡）
- index.astro overview
- /clients CRUD
- /clients/[slug] case grid + filter
- /style-guide editor
- Playwright E2E（4 個 spec）
- 1 天

### Phase ε — Bridge skill + 啟動整合
- fork open-design 加 `skills/design-memory-bridge/SKILL.md`
- sidecar-start.sh / sidecar-stop.sh
- SKILL.md 改寫 v0.2（指向 sidecar）
- 整合 e2e（sidecar + Open Design 並行測試）
- 0.5 天

### 總工期 3.5 天

## 6. Acceptance criteria

1. ✅ v0.1 24 tests + 新測試（預期 35+）全 PASS
2. `/design-dashboard` slash command spawn sidecar + dashboard，2 秒內可用
3. Sidecar 5 個 API 全 200/4xx 正確
4. `/api/context?client=X&scenario=Y` 回傳：retrieval scope 正確（type:self union）+ topN cases + neverRules
5. Dashboard 建客戶 → drag case → grid 看到 → 切客戶 → case 隔離正確
6. Style-guide 編輯後 chokidar 偵測 → SQLite 同步 → 下次 `/api/context` 回新 rules
7. Open Design + sidecar 並行跑 → fork 內的 design-memory-bridge skill 在 generation 前成功 fetch sidecar context（手動驗證）
8. Migration v1 → v2 在 sample vault 跑通
9. Light theme + theme_color palette WCAG AA
10. Codex ↔ Gemini cross-review 0 🔴
11. 自我審查 4 項通過

## 7. Decisions / open questions

### 7.1 已決定
- 不 fork core，sidecar 路線
- design-skill repo 自己當 sidecar 宿主（不分 repo）
- Dashboard 用 Astro 但**不用 shadcn**（精簡）
- 4 page dashboard（不做 collect、feedback 由 Open Design 負責 + sidecar fetch）
- Bridge skill 透過 HTTP fetch（不用更深整合）

### 7.2 開放問題（plan 階段定）
1. Open Design 的 prompt assembly 是否會吃 SKILL.md 內的 `curl` 命令？看 `apps/daemon/src/prompts/` 確認 agent 是否會主動 spawn shell 跑 fetch
2. 如果 agent 不會主動 fetch，要改成「Open Design proxy fetch sidecar 後注入」需要 modify daemon — fall back 回 A1 sub-route。Phase γ 結束前 spike 驗證
3. Dashboard 如何知道 Open Design 在跑？要不要加 sidecar 對 Open Design daemon 的 health check？

## 8. SaaS path（v0.4+）

A2 路徑天然支援 SaaS：
- Sidecar 完全獨立，未來可獨立成 cloud service
- Bridge skill 改成 fetch cloud URL（user 配置 `OD_MEMORY_API_URL`）
- 不依賴 Open Design 的 SaaS 化進度

---

**End of sidecar v0.2 spec.**
