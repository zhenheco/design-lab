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

> **Plan 採分階段呈現。本檔包含 Phase A-G 全部任務分解。**
> 由於 plan 篇幅長（~2000 行 + code），先 commit 此 header + Phase A，後續 Phase B-G 在獨立 commit 加入，避免單檔過大造成 review 困難。
> 預期 plan 完成後總長 ~1800 行。下一步 Codex 用 `superpowers:executing-plans` 或 `superpowers:subagent-driven-development` 逐 phase 執行。
