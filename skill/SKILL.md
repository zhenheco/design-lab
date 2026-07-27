---
name: design-lab
description: 個人化品牌設計系統 skill — multi-client cases + Astro local dashboard + authenticated sidecar HTTP bridge for Open Design integration. v0.3 auto-auth 架構：`/design` 自動 ensure sidecar、cold spawn 旋轉 local API token、`/api/context` 提供 retrieval-scoped payload 給 Open Design 注入 prompt。Memory 在 ~/Documents/CC Cli/design-library/。
version: 0.3.0
---

# design-lab v0.3 — sidecar auto-auth 架構

個人化品牌設計系統。三大組件：

1. **Multi-client vault**：v0.2 schema_version=2，每個 client 獨立 `cases/` + `anti-library/`，retrieval scope 自動 union（type:self clients 跨 client 共享）。
2. **Sidecar daemon**（Express + SQLite + chokidar，`localhost:5174`）：watch vault → SQLite cache → 5 個 API + dashboard SSR mount；v0.3 起有 host allowlist + write-route token auth。
3. **Local dashboard**（Astro 5 SSR + Tailwind 4，從 sidecar 同 port serve）：4 page UI（overview / clients CRUD / case grid / style-guide editor），SSR 注入 API token 給 CSR fetch。

**Memory 庫位置**：`~/Documents/CC Cli/design-library/`（Obsidian vault 內）。

---

## 啟動 hook

每個 slash command 第一個動作都跑 schema check；v0.3 起 `/design` 在 schema check 後會自動 ensure sidecar，讓 Open Design bridge skill 在 generation pre-flight 可抓 context：

```bash
bash $SKILL_DIR/scripts/check-schema.sh "$HOME/Documents/CC Cli/design-library"
```

退出碼 2 = 提示用戶跑 migration；退出碼 1 = 致命錯誤；退出碼 0 = 繼續。

**如 vault 不存在**：先跑 `bash $SKILL_DIR/scripts/init-library.sh "$HOME/Documents/CC Cli/design-library"` 初始化（v0.2 結構：clients/_personal/、scenario-overrides/、personal-style-guide.md）。

**如 vault 是 v1 結構**（root `cases/` + `anti-library/`，無 `clients/`）：check-schema 會提示跑 `bash $SKILL_DIR/scripts/migrate-v1-to-v2.sh "$HOME/Documents/CC Cli/design-library"`，自動把 root cases 搬到 `clients/_personal/cases/`，sibling 備份原 vault。

`/design` 專用 auto-spawn：

```bash
bash $SKILL_DIR/scripts/ensure-sidecar.sh
```

spawn 失敗時 `design.sh` fail soft，只提示 bridge 將 fallback 到 no-memory generation，不阻塞本次 design。

---

## Slash commands（v0.3 只保留 2 個）

### `/design <task description>` — 主入口

**做什麼**：根據任務描述，組 `brand.yaml token > personal-style-guide > taste-overrides > taste-skill baseline` 的 design context，從個案庫抽相似 case，產出 design。

執行：

```bash
bash $SKILL_DIR/scripts/design.sh "<task description>"
```

`design.sh` 行為：
1. 跑 schema check（exit 2 提示 migration / exit 1 致命）
2. v0.3: 開頭自動 `ensure-sidecar.sh`（fail soft），給 bridge skill 抓 context；cold spawn 會產生 token 並啟 sidecar
3. 印 task description
4. 印 `composed-design-context`：brand.yaml tokens、personal-style-guide、taste-overrides、section-filtered taste-skill baseline
5. 透過 `node --import tsx` 載入 `lib/case-loader.ts`，輸出 `cases/ frontmatter summary`（含 client / slug / scenario / quotes / tags / palette）
6. 印 case_count（用 `find clients/*/cases/*.md`）+ fallback flag
7. 印 INSTRUCTIONS：Claude 從 summary 挑 top 5 → 載 scenario-override → 產出 design → 跑 lint

**Claude 接著做**：
- 從 summary 挑跟 task 相似的 top 5 cases
- 載入 `scenario-overrides/<scenario>.md`
- 綜合 personal-style-guide、taste-overrides、scenario override + top 5 個案 → 產 design
- 把 css 部分 echo 到 `.design-output.css` 跑 lint：
  ```bash
  bash $SKILL_DIR/scripts/lint.sh .design-output.css "$VAULT/personal-style-guide.md"
  ```
- 違反 NEVER 自動修正、提示用戶
- 寫 artifact slug 到 last-artifact.txt（給 `/design-feedback` 對應 target）

### `/design-dashboard` — 啟動 local dashboard

**做什麼**：啟 authenticated sidecar daemon (port 5174) + dashboard，瀏覽器開 `http://localhost:5174/`。v0.3 起 `sidecar-start.sh` 內部委派 `ensure-sidecar.sh`，保留舊入口向後相容。

執行：

```bash
bash $SKILL_DIR/scripts/sidecar-start.sh
```

Script 行為：
1. vault 不存在 → 提示先跑 init-library.sh，exit 1
2. 委派 `ensure-sidecar.sh`
3. 已 running（PID file + `/api/health` 偵測）→ 直接印 URL
4. dashboard dist 不存在 → 自動 `cd dashboard && npm install && npm run build`
5. cold spawn 時產生 API token，寫 `~/.claude/state/design-lab/api-token`（0600），並 export 給 sidecar process
6. spawn `node --import tsx sidecar/server.ts`（背景）
7. 寫 PID 到 `~/.claude/state/design-lab/sidecar.pid`
8. poll `http://127.0.0.1:5174/api/health` 最多 10s 等 ready
9. 印 PID + URL + log path

Auth 行為：
- `GET /api/health` 不需 auth。
- API host 必須符合 allowlist（default 包含 `127.0.0.1:5174`、`localhost:5174`、`localhost:4322`，case-insensitive）。
- `POST` / `PUT` / `DELETE` write route 必須帶 `X-Design-Lab-Token`。
- Dashboard SSR 會把 `DESIGN_LAB_API_TOKEN` 注入 `<meta name="design-lab-token">`，CSR fetch 自動帶 token；401 時 reload 一次後清旗標。

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

## Training layers（MCP canonical）

Training side uses a layered write model:

- **Capture**：Hermes / local agents call MCP `add_feedback` with `signal`, `user_quote`, `verdict`, `client`, `case_slug`, `dimension`, `derived_rule`. This is the canonical capture path into sidecar + `feedback-log.jsonl`.
- **Distill**：scheduled/script distill is machine-only training. It deterministically regenerates `design-library/taste-overrides.md` from `feedback-log.jsonl`.
- **Style-guide edits**：`personal-style-guide.md` is human-curated. The only write path is MCP cluster/review → user approval → MCP `edit_style_guide` with `expectedHash`.

Distill must not write, mutate, append to, or frontmatter-bump `personal-style-guide.md`.

---

## v0.1 commands（已收斂進 dashboard）

| v0.1 command | v0.2 替代 |
|---|---|
| `/design-collect` | dashboard `/clients/[slug]` 右上 + 按鈕（呼叫 `POST /api/cases`），或 `bash $SKILL_DIR/scripts/collect.sh <image>` 仍可用（v0.2 互動加問 client，預設 `_personal`） |
| `/design-feedback` | MCP `add_feedback` 是 canonical capture；舊 dashboard / script feedback 入口僅視為相容層 |
| `/design-stats` | dashboard 首頁 overview（含 byClient + byScenario + totals），或 `bash $SKILL_DIR/scripts/stats.sh` 仍可用 |
| `/design-distill` | scheduled/script distill 只重生 `taste-overrides.md`；不寫 `personal-style-guide.md` |

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
├── feedback-log.jsonl                # JSONL，canonical write path is MCP add_feedback
├── taste-overrides.md                # machine layer regenerated by distill; never human approval source
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

> 架構更新（2026-06）：日常設計迴圈改走 **ace hermes 本機端**，經一個包 sidecar 的 **MCP server** 讀 context + 寫 capture（見 `docs/adr/0002`）。open-design 退為**選用**重型生成 studio，本段 bridge 仍有效但非日常主路徑；兩 repo 不合併（見 `docs/adr/0001`）。設計域術語見根目錄 `CONTEXT.md`，完整 v0.4 願景見 `docs/superpowers/specs/2026-06-02-design-lab-v0.4-hermes-capture.md`。

Sidecar 提供 `/api/context?client=X&scenario=Y` 讓 open-design fork 內 `design-memory-bridge` skill 在 generation pre-flight 抓 context：

```bash
TOKEN="$(cat "$HOME/.claude/state/design-lab/api-token")"
curl -s "http://127.0.0.1:5174/api/context?client=$CLIENT&scenario=$SCENARIO" \
  -H "X-Design-Lab-Token: $TOKEN"
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

Bridge contract（理想注入）：把 `styleGuide` + `scenarioOverride` 注入 system prompt、`cases` 當參考、`antiCases` 提示 NEVER。**現況**：open-design fork 內 `design-memory-bridge` skill（commit `101f2d3`）目前把整包 `/api/context` JSON 直接 `JSON.stringify` 進 prompt（盲轉，未做上述語意框定），保真度提升列 backlog。任一 bridge consumer 必須按 v0.3 spec §3.4 bridge contract + §4.1 `design-memory-bridge` SKILL.md template：
- 從 `$HOME/.claude/state/design-lab/api-token` 讀 token。
- `GET /api/context` 帶 `X-Design-Lab-Token`。
- 401 時重新讀 token 並 retry 一次。
- 不要詢問、印出、寫入或旋轉 token；token lifecycle 由 design-lab `ensure-sidecar.sh` 管。

Sidecar 不可用時 bridge 應 fallback 到無記憶 generation 而非 fail hard。

DELETE route 也是 write route；bridge skill 或 fork helper 若未來要呼叫 DELETE，必須先讀 token 並帶 `X-Design-Lab-Token`。

---

## Auth & Auto-spawn (v0.3+)

Token lifecycle：
- 每次 cold spawn 由 `ensure-sidecar.sh` 產生新的 32-byte hex token。
- token 寫到 `$HOME/.claude/state/design-lab/api-token`，`umask 077` + `chmod 600`。
- token 透過 `DESIGN_LAB_API_TOKEN` export 給 sidecar process；dashboard SSR 從同 env 注入 meta token。
- 已健康運行的 sidecar 不重生、不旋轉 token；PID stale 或 sidecar dead 時清 PID 後 cold spawn 旋轉。

Host allowlist：
- default allowlist：`127.0.0.1:5174`、`localhost:5174`、`localhost:4322`。
- compare case-insensitive；可用 `DESIGN_LAB_HOST_ALLOWLIST` 覆寫。

Failure mode：
- `/design` 的 auto-spawn 失敗 → `design.sh` fail soft，bridge fallback 到 no-memory generation，CLI design 繼續。
- Dashboard CSR fetch 遇 401 → reload once，讓 SSR 讀新 token 後重試；成功 200 後清 reload flag。
- Fork bridge skill sidecar down、token 讀不到、non-2xx 或 retry 後仍 401 → fallback no-memory，不 fail hard。

---

## 環境變數

- `DESIGN_LAB_VAULT_PATH`：default `$HOME/Documents/CC Cli/design-library`
- `DESIGN_LAB_STATE_PATH`：default `$HOME/.claude/state/design-lab/`（PID file + last-artifact.txt 等 transient state）
- `DESIGN_LAB_API_TOKEN`：sidecar write-route auth token；由 `ensure-sidecar.sh` cold spawn 自動生成並 export，不需 user 手動設定
- `DESIGN_LAB_HOST_ALLOWLIST`：optional override，覆寫 sidecar API Host allowlist（逗號分隔）

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

## v0.3 已知限制 / v0.4 backlog

- E2E specs 部分 selector 待修（不擋 phase tag）
- bridge skill 已寫於 open-design fork（commit `101f2d3`）；現為盲轉 JSON、語意注入保真度待提升。日常主消費者改為 ace hermes 經 MCP server（見 `docs/adr/0002`）
- v0.4：Global Search FTS5、Feedback log UI、自動 distill、LLM NEVER detector、URL 截圖
- v0.4+：SaaS 化（multi-tenant、auth、cloud sidecar）
