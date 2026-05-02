---
name: design-lab
description: 個人化品牌設計系統 skill — multi-client cases + Astro local dashboard + sidecar HTTP bridge for Open Design integration. v0.2 sidecar 架構：每個 client 獨立累積喜歡/不喜歡的設計、自動演化「Avy 設計法則」、`/api/context` 提供 retrieval-scoped payload 給 Open Design 注入 prompt。Memory 在 ~/Documents/CC Cli/design-library/。
version: 0.2.0
---

# design-lab v0.2 — sidecar 架構

個人化品牌設計系統。三大組件：

1. **Multi-client vault**：v0.2 schema_version=2，每個 client 獨立 `cases/` + `anti-library/`，retrieval scope 自動 union（type:self clients 跨 client 共享）。
2. **Sidecar daemon**（Express + SQLite + chokidar，`localhost:5174`）：watch vault → SQLite cache → 5 個 API + dashboard SSR mount。
3. **Local dashboard**（Astro 5 SSR + Tailwind 4，從 sidecar 同 port serve）：4 page UI（overview / clients CRUD / case grid / style-guide editor）。

**Memory 庫位置**：`~/Documents/CC Cli/design-library/`（Obsidian vault 內）。

---

## 啟動 hook

每個 slash command 第一個動作都跑 schema check：

```bash
bash $SKILL_DIR/scripts/check-schema.sh "$HOME/Documents/CC Cli/design-library"
```

退出碼 2 = 提示用戶跑 migration；退出碼 1 = 致命錯誤；退出碼 0 = 繼續。

**如 vault 不存在**：先跑 `bash $SKILL_DIR/scripts/init-library.sh "$HOME/Documents/CC Cli/design-library"` 初始化（v0.2 結構：clients/_personal/、scenario-overrides/、personal-style-guide.md）。

**如 vault 是 v1 結構**（root `cases/` + `anti-library/`，無 `clients/`）：check-schema 會提示跑 `bash $SKILL_DIR/scripts/migrate-v1-to-v2.sh "$HOME/Documents/CC Cli/design-library"`，自動把 root cases 搬到 `clients/_personal/cases/`，sibling 備份原 vault。

---

## Slash commands（v0.2 只保留 2 個）

### `/design <task description>` — 主入口

**做什麼**：根據任務描述，從個案庫抽相似 case，綜合 personal-style-guide 規則層，產出 design。

執行：

```bash
bash $SKILL_DIR/scripts/design.sh "<task description>"
```

`design.sh` 行為：
1. 跑 schema check（exit 2 提示 migration / exit 1 致命）
2. 印 task description
3. 印 `personal-style-guide.md` 全文（DO / NEVER / SOMETIMES 給 Claude）
4. 透過 `node --import tsx` 載入 `lib/case-loader.ts`，輸出 `cases/ frontmatter summary`（含 client / slug / scenario / quotes / tags / palette）
5. 印 case_count（用 `find clients/*/cases/*.md`）+ fallback flag
6. 印 INSTRUCTIONS：Claude 從 summary 挑 top 5 → 載 scenario-override → 產出 design → 跑 lint

**Claude 接著做**：
- 從 summary 挑跟 task 相似的 top 5 cases
- 載入 `scenario-overrides/<scenario>.md`
- 綜合 personal-style-guide DO + NEVER + top 5 個案 → 產 design
- 把 css 部分 echo 到 `.design-output.css` 跑 lint：
  ```bash
  bash $SKILL_DIR/scripts/lint.sh .design-output.css "$VAULT/personal-style-guide.md"
  ```
- 違反 NEVER 自動修正、提示用戶
- 寫 artifact slug 到 last-artifact.txt（給 `/design-feedback` 對應 target）

### `/design-dashboard` — 啟動 local dashboard

**做什麼**：啟 sidecar daemon (port 5174) + dashboard，瀏覽器開 `http://localhost:5174/`。

執行：

```bash
bash $SKILL_DIR/scripts/sidecar-start.sh
```

Script 行為：
1. vault 不存在 → 提示先跑 init-library.sh，exit 1
2. 已 running（PID file 偵測）→ 直接印 URL
3. dashboard dist 不存在 → 自動 `cd dashboard && npm install && npm run build`
4. spawn `node --import tsx sidecar/server.ts`（背景）
5. 寫 PID 到 `~/.claude/state/design-lab/sidecar.pid`
6. poll `http://127.0.0.1:5174/api/clients` 最多 10s 等 ready
7. 印 PID + URL + log path

**4 個 dashboard page**：
- `/` — overview（totals / byClient / scenarios / recent cases / ClientSwitcher）
- `/clients` — client CRUD（new / edit / archive）
- `/clients/[slug]` — case grid + scenario/sentiment filter
- `/style-guide` — personal-style-guide.md editor（hash conflict 偵測）

**停止**：

```bash
bash $SKILL_DIR/scripts/sidecar-stop.sh
```

Stale PID 會自動 self-heal（清 PID file 後可重啟）。

---

## v0.1 commands（已收斂進 dashboard）

| v0.1 command | v0.2 替代 |
|---|---|
| `/design-collect` | dashboard `/clients/[slug]` 右上 + 按鈕（呼叫 `POST /api/cases`），或 `bash $SKILL_DIR/scripts/collect.sh <image>` 仍可用（v0.2 互動加問 client，預設 `_personal`） |
| `/design-feedback` | dashboard 中編輯（v0.3 完整 UI），或 `bash $SKILL_DIR/scripts/feedback.sh "<text>"` 仍可用（自動補 client field） |
| `/design-stats` | dashboard 首頁 overview（含 byClient + byScenario + totals），或 `bash $SKILL_DIR/scripts/stats.sh` 仍可用 |
| `/design-distill` | 暫無 UI；v0.3 才自動化 distill |

---

## v0.2 vault 結構

```
~/Documents/CC Cli/design-library/
├── personal-style-guide.md           # DO / NEVER / SOMETIMES（含 NEVER regex rules）
├── scenario-overrides/
│   ├── landing.md
│   ├── saas-ui.md
│   ├── brand.md
│   └── content.md
├── clients/
│   ├── _personal/                    # type: self（個人案例）
│   │   ├── meta.yaml                 # schema_version: 2 + slug + name + type + theme_color
│   │   ├── cases/                    # positive cases
│   │   │   └── <slug>.md             # frontmatter: client / slug / scenario / sentiment / tokens / tags
│   │   └── anti-library/             # negative cases (NEVER signals)
│   ├── aicycle/                      # type: client（外部品牌）
│   │   ├── meta.yaml
│   │   ├── cases/
│   │   └── anti-library/
│   └── .archived/                    # archiveClient 搬到這（不真刪）
├── feedback-log.jsonl                # JSONL，每行含 client field
└── .index/
    └── library.db                    # SQLite cache (sidecar 寫，schema 4 表)
```

**Retrieval scope union 規則**（`/api/context` + `loadCaseSummaries`）：
- 沒指定 client → 全 client union
- 指定 type:client → target + 所有 type:self union
- 指定 type:self → 全 type:self union（不含其他 type:client）
- 未知 client slug → unknown + 全 type:self union

---

## Bridge to Open Design

Sidecar 提供 `/api/context?client=X&scenario=Y` 讓 open-design fork 內 `design-memory-bridge` skill 在 generation pre-flight 抓 context：

```bash
curl -s "http://localhost:5174/api/context?client=$CLIENT&scenario=$SCENARIO"
```

Response shape：

```json
{
  "client": ClientMeta | null,
  "styleGuide": "...full markdown...",
  "scenarioOverride": "...landing.md content or empty...",
  "cases": [...top 5 positive in scope...],
  "antiCases": [...all negative in scope...],
  "neverRules": [{ "id", "pattern", "target" }, ...],
  "retrievedFrom": ["aicycle", "_personal", "zhenheco"]
}
```

Bridge skill 把 `styleGuide` + `scenarioOverride` 注入 system prompt、把 `cases` 當參考、`antiCases` 提示 NEVER。詳見 spec §3.1 / §4.3。

Sidecar 不可用時 bridge 應 fallback 到無記憶 generation 而非 fail hard。

---

## 環境變數

- `DESIGN_LAB_VAULT_PATH`：default `$HOME/Documents/CC Cli/design-library`
- `DESIGN_LAB_STATE_PATH`：default `$HOME/.claude/state/design-lab/`（PID file + last-artifact.txt 等 transient state）

---

## 開發 / 測試

```bash
# 跑全部單元測試（含 sidecar API supertest）
npm test

# tsc 類型檢查
npx tsc --noEmit

# dashboard 獨立 build / dev
cd skill/dashboard
npm run build
npm run dev    # http://localhost:4322（dev mode 透過 vite proxy 打 :5174）

# Playwright e2e（需先啟 sidecar）
bash skill/scripts/sidecar-start.sh
cd skill/dashboard
npx playwright install chromium
npx playwright test
```

---

## v0.2 已知限制

- E2E specs 部分 selector 待修（不擋 phase tag）
- bridge skill 在 open-design fork 待寫（用戶手動補）
- v0.3：自動 distill、LLM NEVER detector、URL 截圖
- v0.4+：SaaS 化（multi-tenant、auth、cloud sidecar）
