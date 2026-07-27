# design-lab

<samp>[English](README.md) · **繁體中文** · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**為 Claude Code 打造、屬於你個人且依品牌劃分的設計品味記憶。**

你看到喜歡的設計，給出細膩的評價（「字體排印很棒，但配色太冷了」），這些評價會逐漸累積成一份本機記憶。日後當你請 Claude Code 製作前端時，`/design` 會載入這份累積的品味，讓產出更貼近*你自己*——以品牌為單位，每跑一輪就更加精準。

```
   capture                     store                         generate
┌──────────────┐        ┌──────────────────┐         ┌────────────────────┐
│ liked designs│  ───▶  │  Vault (SSOT)     │  ───▶   │ /design <task>     │
│ (URL / image)│        │  cases + aspects  │         │  loads merged      │
│ + verdicts   │        │  style guides     │         │  brand memory →    │
└──────────────┘        │  NEVER rules      │         │  on-taste frontend │
       ▲                └──────────────────┘         └────────────────────┘
       │                         │  ▲
       │                  ┌──────┴──┴───────┐
       └───────────────── │  local sidecar  │  HTTP @ 127.0.0.1:5174
         MCP write tools  │  (Express)      │  + MCP server (7 tools)
                          └─────────────────┘
```

它是**以品牌劃分的（brand-scoped）**：有一個作為基準的自我品牌（`_personal`），其品味會流入每一個品牌；另外還有各個具名品牌，彼此的案例（Case）永遠不會互相外洩。

---

## 運作方式

- **保管庫（Vault）**——你品味的唯一真實來源（single source of truth），是一個由 markdown 與 YAML 組成的純資料夾，完全由你掌控、可自行用 `git` 管理（存放在本 repo 之外）。它保存了各品牌的**風格指南（style guides）**、喜歡的**案例（cases）**、一份反面資料庫（anti-library），以及 **NEVER 規則**。
- **Sidecar**——一個小型、長駐的本機 Express daemon（`127.0.0.1:5174`），透過 HTTP（`/api/context`、`/api/distill/:brand`……）提供保管庫經過檢索範圍篩選後的合併視圖。讀取端點對 loopback 開放；寫入則需要本機 API token。
- **MCP server**——將 sidecar 包裝起來，讓代理人（例如本機的 Hermes agent）能用 7 個工具讀取脈絡並擷取新的品味。
- **`/design`**——Claude Code 端的消費者：載入該品牌的合併記憶，並將其框定（品牌指南 → 遵循、NEVER 規則 → 硬性約束、喜歡的案例 → 模仿、反面案例 → 避免）後注入到生成 prompt 中。

### 核心概念

| 術語 | 意義 |
|------|---------|
| **品牌（Brand）** | 一個品味範疇。`_personal` = 自我品牌（基準，會流入所有品牌）。具名品牌則專屬於特定客戶。 |
| **案例（Case）** | 一筆擷取下來的設計（截圖 + 萃取出的 tokens），附上你的引述與評價。 |
| **面向（Aspect）** | 針對某案例在某一維度上的評價——`{dimension, verdict: like\|dislike, note}`。一個設計很少全部都好。 |
| **風格指南（Style guide）** | 各品牌的 markdown 規則（全域自我品牌指南 + 各品牌的覆寫）。 |
| **NEVER 規則** | 一條附帶偵測器的硬性約束，由 linter 在產出的 CSS 上強制執行。 |
| **提煉（Distillation）** | 將累積的喜歡／不喜歡訊號聚類，產生候選的 NEVER 規則或風格註記——**須經核可（approval-gated）**，絕不自動寫入。 |

---

## 這個迴圈

- **輸入**——本機 Hermes agent 的每日 cron 會浮現設計候選；你進行檢視，並以逐面向（per-aspect）的評價回覆；它再透過 MCP 工具將其擷取進保管庫。
- **輸出**——在 Claude Code 中：`/design "<task>" <brand> <scenario>` 載入該品牌的合併記憶，並依累積的品味生成前端。
- **複利**——隨著訊號累積，`distill_taste` 會將它們聚類為持久的規則候選；你核可後，規則便落入該品牌的風格指南；`/design` 也就愈來愈精準。

[`open-design`](https://github.com/zhenheco/open-design) 可選擇性地透過 `design-memory-bridge` skill 消費同一份脈絡，作為第三個（唯讀的）生成工作室。

---

## 安裝

需求：**Node ≥ 20**（sidecar 使用 `better-sqlite3` 12.x；Node 26 也沒問題），以及 [Claude Code](https://claude.com/claude-code)。

一行指令——clone 後執行安裝程式：

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` 會安裝相依套件、建置 dashboard、將 skill 連結進 Claude Code（`~/.claude/skills/design-lab`）、初始化一個保管庫、啟動 sidecar（在 macOS 上是一個 launchd daemon；在其他平台則於需要時自動啟動），並印出如何註冊 MCP server 的說明。它是冪等的——在 `git pull` 之後重新執行也很安全。

驗證：

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

保管庫預設位於 `~/Documents/CC Cli/design-library`；可用 `DESIGN_LAB_VAULT_PATH` 覆寫。若要使用 `capture_url` 截圖工具，請另外執行 `npx playwright install chromium`。

### 註冊 MCP server

讓你的代理人指向 stdio 進入點 `skill/mcp/start.sh`——它會自動探索全部 7 個工具。例如：

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### 依你的品味生成

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP 工具

| 工具 | 用途 |
|------|---------|
| `get_context` | 讀取該品牌經檢索範圍篩選後的脈絡（風格指南 + 案例 + NEVER 規則）。 |
| `list_clients` | 列出品牌。 |
| `add_case` | 從本機圖片路徑擷取一個案例。 |
| `capture_url` | 對某個 URL 截圖，萃取即時計算出的設計 tokens，並存成一個案例。 |
| `add_feedback` | 記錄一筆不綁定特定圖片的品味訊號。 |
| `edit_style_guide` | 編輯全域或各品牌的風格指南（具備雜湊衝突保護）。 |
| `distill_taste` | 將累積的喜歡／不喜歡訊號聚類為規則候選（唯讀；你核可後才持久化）。 |

寫入需要本機 API token（`X-Design-Lab-Token`，每次請求都從 `~/.claude/state/design-lab/api-token` 讀取）。Host 允許清單（allowlist）加上 token，可保護 sidecar 免於來自本機瀏覽器的 DNS-rebinding 攻擊。

---

## 專案結構

```
skill/
  sidecar/      Express HTTP sidecar (routes + auth middleware)
  mcp/          MCP server wrapping the sidecar (7 tools)
  lib/          case loader/writer, distill aggregator, URL capture, lint
  dashboard/    Astro local dashboard (served by the sidecar at /)
  scripts/      design.sh, ensure-sidecar.sh, launchd-install.sh, …
  launchd/      LaunchAgent plist template
docs/
  adr/          architecture decisions (0001–0005)
  superpowers/  specs + plans
```

## 測試

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## 設計決策

參見 [`docs/adr/`](docs/adr/)：

- **0001**——將 design-lab 與 open-design 維持為各自獨立的程式碼庫。
- **0002**——透過一個包裝 sidecar 的 MCP server 與代理人整合。
- **0003**——各品牌的風格指南合併進 `/api/context`。
- **0004**——以面向（逐維度）為單位的案例回饋。
- **0005**——須經核可的提煉（在 sidecar 中做確定性聚類，再由 LLM 起草、經人工核可後才寫入任何內容）。

## 安全

本機優先（local-first）且以 token 保護。每個 PR 都跑免費的 SAST（Semgrep + Gitleaks + Trivy），另加 Dependabot 與密鑰掃描。保管庫與 API token 存放在本 repo 之外，永不提交（commit）。

---

*狀態：v0.4——擷取、對話、複利。*
