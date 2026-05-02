# design-lab v0.2 — Multi-client + Local Dashboard

**Date**: 2026-05-02
**Status**: Design (pending user review → writing-plans)
**Owner**: Avy (nelsonjou1101@gmail.com)
**Predecessor**: v0.1 (`docs/superpowers/specs/2026-05-02-design-lab-design.md`)
**Skill location**: `~/.claude/skills/design-lab/`（symlink → repo `skill/`）
**Memory location**: `~/Documents/CC Cli/design-library/`（Obsidian vault）

## 1. 問題與目標

### 1.1 痛點

v0.1 完成後出現兩個未解決問題：

1. **多客戶風險**：未來會接客戶（除自己品牌 aicycle / zhenheco 外），客戶 A 的視覺 case 不應在做客戶 B 設計時被 retrieve（風格污染、NDA 風險）
2. **CLI 操作密度低**：批量 collect、case browse、stat 觀察、規則編輯這些低頻但高 leverage 操作，全靠 5 個 slash command 體驗破碎；用戶要的是「打開瀏覽器一站式管理」

### 1.2 v0.2 目標

1. **Multi-client 分流**：每個客戶（含自己品牌）獨立資料夾，case 收集 / retrieval 自動 scope 到當前客戶 + 自己品牌
2. **Astro local dashboard**：取代 4 個 slash command（collect / feedback / stats / distill），保留 `/design <task>` 為主入口
3. **SaaS-ready 預留**：vault path 集中化 + slug user-scoped 命名規約，為 v0.3+ 多 tenant 抽象做準備（**只做這 2 點，其他不做**）

### 1.3 範圍邊界（YAGNI）

**v0.2 包含**：
- Multi-client 資料夾結構 + schema_version 升級 v1→v2
- Astro 5 SSR dashboard（功能：view + collect + feedback + 編輯 style-guide + 客戶 CRUD）
- Vision LLM adapter（gemini-rotate 為主 + Anthropic API fallback）
- Migration 工具（v1 → v2 自動化，雖然用戶當下 0 case 但仍寫齊）
- chokidar-based markdown 監聽 + SQLite 索引快取
- `/design-dashboard` slash command（spawn + auto-stop 30 min idle）

**v0.2 不包含（明確 v0.3+）**：
- Auth / login / multi-tenant infra
- Cloud storage adapter 實作（介面也不抽，只做 path resolver 集中）
- Billing / quota 管理
- Auto distill（v0.3）
- LLM detector for NEVER lint（v0.2 仍只 regex）
- URL 自動截圖（v0.2 仍要手動上傳）
- Hook 自動偵測語氣（v0.2 仍要明說「存進去」）

## 2. 與 v0.1 的差異總覽

| 項目 | v0.1 | v0.2 |
|---|---|---|
| Vault 結構 | flat `cases/<slug>.md` | `clients/<client-slug>/cases/<case-slug>.md` |
| schema_version | 1 | 2 |
| Case frontmatter | 無 client field | 加 `client: <slug>`（必填） |
| Slash commands | 5 個（design / collect / feedback / stats / distill） | 2 個（design / design-dashboard）+ migration（隱性）|
| 索引快取 | 無（純 readdir） | SQLite `.index/library.db`（chokidar 監聽 markdown 變動） |
| Dashboard | 無 | Astro 5 SSR，`/design-dashboard` 啟動 |
| Vision LLM | 概念存在但未實作（v0.1 是手動填表） | 實作：gemini-rotate adapter + Anthropic fallback |
| Theme color | 無客戶概念 | 客戶 metadata 含 `theme_color`（限預定義 12 色 palette） |
| Path 管理 | 各 script 各自處理 vault path | 集中 `lib/paths.ts:getVaultPath()` |

## 3. 系統架構

### 3.1 高階流程

```
Slash command:
  /design <task>           → CLI（生成 design）
  /design-dashboard        → spawn dashboard server + open browser

Dashboard：
  http://localhost:5173/
    ├─ /                   → overview（stats + 最近收藏 + 切客戶）
    ├─ /clients            → 客戶 CRUD
    ├─ /clients/<slug>     → 該客戶的 case grid + filter
    ├─ /collect            → drag-drop 上傳 + vision LLM + 表單
    ├─ /feedback           → 看當下 design artifact + 給 thumb up/down
    ├─ /style-guide        → 編 personal-style-guide.md（DO/NEVER/SOMETIMES 三段表單）
    └─ /api/*              → Astro API routes（讀寫 vault + spawn vision）

Storage:
  Markdown vault (source of truth)
       ↑
       │ chokidar watch + content hash 比對
       ↓
  SQLite index (.index/library.db) ← dashboard 快速查詢用
```

### 3.2 目錄結構

#### Skill repo（`/Volumes/500G/Claude Code Projects/Design skill/`）

```
skill/
├── SKILL.md                       # 入口 + 2 個 slash command 路由（design + design-dashboard）
├── scripts/
│   ├── check-schema.sh            # 啟動前 schema 檢查（沿用 v0.1）
│   ├── design.sh                  # /design 主入口（沿用 v0.1，加 client filter）
│   ├── init-library.sh            # init vault（v0.2 加客戶資料夾結構）
│   ├── lint.sh                    # NEVER regex check（沿用 v0.1）
│   ├── dashboard-start.sh         # /design-dashboard 啟動（spawn + PID file）
│   ├── dashboard-stop.sh          # idle 自動停 / 手動停
│   └── migrate-v1-to-v2.sh        # schema 升級（讀 schema_version，自動搬 cases/<slug>.md → clients/_personal/cases/）
├── lib/                           # 副檔名規約：v0.1 既有純 .js 沿用；v0.2 新增 / 大改的 lib 一律 .ts
│   ├── paths.ts                   # 新增：getVaultPath() / getClientDir(slug) / getIndexDbPath()
│   ├── case-loader.ts             # 大改 → 遷 .ts（recursive scan clients/*/cases/，client filter）
│   ├── case-writer.ts             # 大改 → 遷 .ts（寫到 clients/<slug>/cases/）
│   ├── client-loader.ts           # 新增 .ts：列客戶、讀 meta.yaml
│   ├── client-writer.ts           # 新增 .ts：建立 / 更新客戶
│   ├── feedback-log.js            # 沿用 v0.1（小改：加 client field）
│   ├── lint.js                    # 沿用 v0.1（NEVER regex）
│   ├── schema.js                  # 沿用 v0.1，加 v1 → v2 偵測邏輯
│   ├── stats.js                   # 沿用 v0.1，加 by-client breakdown
│   ├── last-artifact.js           # 沿用 v0.1
│   ├── index/
│   │   ├── db.ts                  # better-sqlite3 connection + schema
│   │   ├── reindex.ts             # 全量 / 增量 rebuild
│   │   └── watcher.ts             # chokidar + debounce 200ms + content hash
│   └── vision/
│       ├── adapter.ts             # interface VisionAdapter { extractTokens(imagePath): Promise<DesignTokens> }
│       ├── gemini-rotate.ts       # spawn ~/.claude/skills/gemini-agent/scripts/gemini-rotate.sh
│       └── anthropic.ts           # ANTHROPIC_API_KEY 有就啟用，fallback
├── dashboard/                     # Astro 5 SSR app（新增）
│   ├── astro.config.mjs           # output: 'server', adapter: '@astrojs/node'
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro        # /
│   │   │   ├── clients/
│   │   │   │   ├── index.astro    # /clients
│   │   │   │   └── [slug].astro   # /clients/<slug>
│   │   │   ├── collect.astro      # /collect
│   │   │   ├── feedback.astro     # /feedback
│   │   │   ├── style-guide.astro  # /style-guide
│   │   │   └── api/
│   │   │       ├── clients.ts     # GET / POST / PUT / DELETE
│   │   │       ├── cases.ts
│   │   │       ├── feedback.ts
│   │   │       ├── style-guide.ts
│   │   │       ├── vision.ts      # POST image → extractTokens
│   │   │       └── reindex.ts     # POST → full rebuild
│   │   ├── components/
│   │   │   ├── ClientSwitcher.tsx     # React island（互動）
│   │   │   ├── CaseGrid.astro          # 靜態 grid
│   │   │   ├── DropZone.tsx            # React island（drag-drop）
│   │   │   ├── StyleGuideEditor.tsx    # React island（form）
│   │   │   └── ThumbVote.tsx           # React island（feedback）
│   │   ├── styles/
│   │   │   └── theme.css                # light only + 12 色 theme_color palette
│   │   └── server.ts                    # Node entry，PID file，30 min idle watcher
│   └── tests/
│       ├── e2e/                         # Playwright
│       │   ├── collect.spec.ts
│       │   ├── client-switch.spec.ts
│       │   └── style-guide-edit.spec.ts
│       └── unit/                        # Vitest（補測 dashboard lib）
├── templates/                       # 沿用 v0.1
│   ├── personal-style-guide.md
│   ├── scenario-override.md
│   └── client-meta.yaml             # 新增：建立客戶時用的範本
├── migrations/
│   ├── README.md
│   └── v1-to-v2.md                  # migration 邏輯文件
└── tests/                              # v0.1 既有 .test.js 沿用 + v0.2 新測試 .test.ts
    ├── schema.test.js                  # v0.1 沿用
    ├── init-library.test.js            # 沿用 + 加 v0.2 結構驗證
    ├── case-loader.test.ts              # 新增 / 改寫（recursive scan + client filter）
    ├── case-writer.test.ts              # 新增 / 改寫
    ├── client-loader.test.ts            # 新增
    ├── client-writer.test.ts            # 新增
    ├── migration.test.ts                # 新增（v1 sample vault → v2 驗證）
    ├── paths.test.ts                    # 新增
    └── vision-adapter.test.ts           # 新增（mock spawn）
```

#### Memory（`~/Documents/CC Cli/design-library/`）

```
~/Documents/CC Cli/design-library/
├── personal-style-guide.md          # 跨客戶共用 NEVER/DO/SOMETIMES（沿用 v0.1）
├── scenario-overrides/              # 沿用 v0.1
│   ├── landing.md
│   ├── saas-ui.md
│   ├── brand.md
│   └── content.md
├── clients/                         # ⭐ v0.2 新增
│   ├── _personal/                   # type: self（aicycle、zhenheco 等）
│   │   ├── meta.yaml
│   │   ├── cases/
│   │   │   ├── 0001-aicycle-landing.md
│   │   │   └── 0001-aicycle-landing/
│   │   │       └── snapshot.png
│   │   └── anti-library/
│   ├── <client-slug>/               # type: client（外部客戶）
│   │   ├── meta.yaml
│   │   ├── cases/
│   │   └── anti-library/
│   └── ...
├── candidates/                      # AI 偵測候選池（v0.2 仍 stub，沿用 v0.1）
│   └── pending.md
├── feedback-log.jsonl               # 沿用 v0.1（加 client 欄位）
└── .index/
    └── library.db                   # ⭐ v0.2 新增 SQLite 快取
```

### 3.3 SaaS-ready 預留（明確 limit）

**v0.2 只做這 2 件**：

1. **Path resolver 集中化**
   - 所有 vault 路徑存取必須走 `lib/paths.ts:getVaultPath() / getClientDir(slug) / getCasePath(client, slug) / getIndexDbPath()`
   - 禁止任何 script / lib 直接寫 `~/Documents/CC Cli/...` 字串
   - SaaS 化時改 `getVaultPath()` 一個函式（return cloud blob URI），影響範圍可控

2. **Tenant 隔離透過 path 結構，不污染 slug 字串**
   - v0.2 vault 結構：`<vault>/clients/<slug>/`（無 user namespace 因為單用戶）
   - SaaS v0.3+：`<vault-root>/users/<uid>/clients/<slug>/` —— user namespace 加在 path，不在 slug
   - Slug 永遠是純 slug（如 `aicycle`），跨 source of truth 一致：
     - meta.yaml `slug: aicycle`
     - case frontmatter `client: aicycle`
     - SQLite `clients.slug = 'aicycle'`、`cases.client = 'aicycle'`
   - SaaS 化時 client 全表加 `user_id` 欄位 + 改 query `WHERE user_id = ?`，slug 在 user 內唯一即可

**明確不做（v0.3+）**：
- ❌ Storage adapter pattern（YAGNI，避免過度抽象）
- ❌ Auth / session
- ❌ Cloud storage 實作
- ❌ Tenant data isolation 機制
- ❌ Billing / quota
- ❌ Server-side LLM API key 統一管理

## 4. 資料模型

### 4.1 schema_version=2

升級後所有 frontmatter 加 `schema_version: 2`。`lib/schema.ts` 在 dashboard 啟動 / `/design` 觸發時檢查 version：
- v1：列出 v1 cases，prompt 用戶跑 migration（exit code 2）
- v2：繼續執行
- 未知：fatal（exit code 1）

### 4.2 Case frontmatter（v2）

```yaml
schema_version: 2
slug: 0001-aicycle-landing
client: aicycle                  # ⭐ 新增（v0.2 必填，純 slug；v1 case 在 migration 時設 _personal）
captured_at: 2026-05-02T10:00:00Z
source:
  type: upload
  via: dashboard               # 新增枚舉值（v0.1 只有 /design-collect）
scenario: landing
sentiment: positive
quotes_from_user:
  - "字體層級乾淨，CTA 對比強"
tokens:                          # vision LLM 抽出（可 {} 若 vision 失敗）
  palette: ["#FFFFFF", "#1F2937", "#3B82F6"]
  typography: ["Inter", "sans-serif"]
  spacing_scale: [8, 16, 24, 48]
tags:
  style: ["minimal", "tech"]
  mood: ["clean", "trustworthy"]
  elements: ["hero", "pricing-grid"]
  industry: ["saas"]
related: []
lint_skip: []
```

### 4.3 Client meta.yaml

```yaml
schema_version: 2
slug: aicycle
name: AICycle
type: self                      # self | client
created_at: 2026-05-02
notes: ""
theme_color: "#3B82F6"          # 限 12 色 palette（見 §4.4）
```

`_personal/meta.yaml` 是特殊客戶（type: self 的 union 容器，v0.1 case 在 migration 時都歸這裡）：

```yaml
schema_version: 2
slug: _personal
name: 我的品牌（自己品牌統稱）
type: self
created_at: <vault init 時間>
notes: "自己品牌的 case 預設 retrieve 都會 union 進來。如要單獨切 aicycle / zhenheco，自己另開 client（仍標 type: self）"
theme_color: "#1F2937"
```

### 4.4 Theme color palette（12 色，全 WCAG AA pass on #FFFFFF bg）

```typescript
export const THEME_COLOR_PALETTE = [
  "#1F2937",  // slate-800（預設，自己品牌）
  "#0F766E",  // teal-700
  "#1E40AF",  // blue-800
  "#7C3AED",  // violet-600
  "#BE185D",  // pink-700
  "#B91C1C",  // red-700
  "#A16207",  // amber-700
  "#15803D",  // green-700
  "#0E7490",  // cyan-700
  "#6D28D9",  // violet-700
  "#9333EA",  // purple-600
  "#374151",  // gray-700
] as const;
```

UI 上顯示色塊讓用戶選，不接受任意 hex。

### 4.5 SQLite index schema

```sql
-- .index/library.db
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,                        -- e.g. 0001-aicycle-landing
  client TEXT NOT NULL,                      -- e.g. aicycle（純 slug，v0.3 SaaS 加 user_id 欄位）
  scenario TEXT NOT NULL,
  sentiment TEXT NOT NULL,                   -- positive | negative
  captured_at TEXT NOT NULL,
  md_path TEXT NOT NULL,                     -- absolute path
  content_hash TEXT NOT NULL,                -- sha256 of md content（chokidar 用）
  tags_json TEXT,
  tokens_json TEXT,
  quotes_json TEXT,
  UNIQUE(client, slug)
);

CREATE INDEX idx_cases_client ON cases(client);
CREATE INDEX idx_cases_scenario ON cases(scenario);
CREATE INDEX idx_cases_sentiment ON cases(sentiment);

CREATE TABLE IF NOT EXISTS clients (
  slug TEXT PRIMARY KEY,                     -- aicycle（純 slug；SaaS 化時改 (user_id, slug) 複合 key）
  name TEXT NOT NULL,
  type TEXT NOT NULL,                        -- self | client
  theme_color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notes TEXT,
  meta_path TEXT NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS index_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- 寫入：last_full_rebuild_at, schema_version
```

## 5. Dashboard 範圍

### 5.1 Routes

| Route | 用途 | Hydration |
|---|---|---|
| `/` | Overview（stats + 最近 5 個 case + 客戶切換） | static + 1 React island (ClientSwitcher) |
| `/clients` | 客戶列表 + CRUD | static + 1 React island (form modal) |
| `/clients/<slug>` | 該客戶 case grid + 篩 scenario / sentiment / tag | static + 1 React island (filter) |
| `/collect` | drag-drop 上傳 + vision LLM 預覽 + 表單 | full React island (DropZone + form) |
| `/feedback` | 看 last-artifact + 👍 👎 表單 | full React island |
| `/style-guide` | 編輯 personal-style-guide.md（DO / NEVER / SOMETIMES） | full React island (editor) |
| `/api/*` | server-only API endpoints | N/A |

### 5.2 工作流：Collect

```
1. 用戶 drag-drop 圖片進 DropZone
2. POST /api/vision { imagePath } → spawn gemini-rotate
3. Gemini 看圖回 <TOKENS>{...}</TOKENS>，server regex extract
4. 表單預填 tokens（用戶可改），requrie 用戶填：
   - client（dropdown，當前 selected client 預填）
   - scenario（dropdown）
   - sentiment（radio: positive / negative）
   - quote（textarea，「為什麼喜歡 / 不喜歡」）
5. Submit → POST /api/cases
6. server：
   - 寫 markdown 到 clients/<slug>/cases/<case-slug>.md
   - 拷貝圖到 clients/<slug>/cases/<case-slug>/snapshot.<ext>
   - chokidar 觸發 → SQLite reindex 該 row
7. UI 顯示「已收藏」+ wiki link 給 Obsidian
```

### 5.3 工作流：Feedback

```
1. 用戶在 /design 跑完設計後（CC session 內），artifact 寫進 ~/.claude/state/design-lab/last-artifact.md
2. dashboard /feedback 讀該檔，render 設計內容
3. 用戶點 👍 / 👎，可加 quote
4. 👍 + quote → POST /api/cases (sentiment: positive)，case 來源 type: design-output
5. 👎 + quote → POST /api/cases (sentiment: negative，寫 anti-library/)
6. 不點 → 寫進 feedback-log.jsonl（不轉成 case）
```

### 5.4 工作流：Style-guide 編輯

```
1. 讀 personal-style-guide.md，parse markdown sections（## DO / ## NEVER / ## SOMETIMES）
2. UI 三欄表單（list edit），每條規則一行
3. 規則格式（純文字）：
   - DO：自由 prose
   - NEVER：開頭可加 `regex:/.../i` → lint engine 用；否則純 prose
   - SOMETIMES：自由 prose + 條件
4. Submit → 重新組 markdown 寫回，content-hash 比對避免覆蓋外部編輯
5. 衝突（hash 不符）→ 警告「外部已修改，請重新 load」
```

### 5.5 客戶 CRUD

```
- 建立：填 slug / name / type / theme_color（palette 選） / notes
  → 寫 clients/<slug>/meta.yaml + 建空 cases/ 與 anti-library/
- 重命名（改 name / theme_color）：直接寫 meta.yaml，slug 不可改（避免破壞 case.client 索引）
- 刪除：必填確認文字「DELETE <slug>」+ check case count > 0 警告
  → mv clients/<slug>/ 到 clients/.archived/<slug>-<timestamp>/（不真刪）
```

## 6. Vision LLM Adapter

### 6.1 介面

```typescript
// lib/vision/adapter.ts
export interface DesignTokens {
  palette?: string[];
  typography?: string[];
  spacing_scale?: number[];
  raw_observations?: string;
}

export interface VisionAdapter {
  name: string;
  extractTokens(imagePath: string): Promise<DesignTokens>;
}

export async function extractWithFallback(imagePath: string): Promise<DesignTokens> {
  const adapters = buildAdapterChain();   // [gemini, anthropic?]
  for (const adapter of adapters) {
    try {
      return await withTimeout(adapter.extractTokens(imagePath), 30_000);
    } catch (e) {
      log.warn(`vision adapter ${adapter.name} failed: ${e.message}`);
      continue;
    }
  }
  return {};   // 全 fail，回空 tokens（讓用戶手動填）
}
```

### 6.2 Gemini-rotate adapter（主）

```typescript
// lib/vision/gemini-rotate.ts
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const SCRIPT = resolve(homedir(), '.claude/skills/gemini-agent/scripts/gemini-rotate.sh');
const PROMPT = `
Analyze the image. Extract design tokens as JSON inside <TOKENS>...</TOKENS> markers.

Required fields:
- palette: array of hex colors (3-7 main colors)
- typography: array of font family names you can identify
- spacing_scale: array of pixel values you can infer (e.g. [4,8,16,24])
- raw_observations: 1-2 sentences describing visual style

Output ONLY:
<TOKENS>
{ "palette": [...], "typography": [...], "spacing_scale": [...], "raw_observations": "..." }
</TOKENS>
`;

export const geminiAdapter: VisionAdapter = {
  name: 'gemini-rotate',
  async extractTokens(imagePath) {
    const proc = spawn(SCRIPT, ['-p', PROMPT, '--image', imagePath, '-m', 'gemini-2.5-flash'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    const exitCode = await new Promise<number>((res) => proc.on('exit', res));
    if (exitCode !== 0) throw new Error(`gemini-rotate exit ${exitCode}`);

    const match = stdout.match(/<TOKENS>([\s\S]*?)<\/TOKENS>/);
    if (!match) throw new Error('no <TOKENS> marker in output');
    return JSON.parse(match[1]);
  },
};
```

**錯誤處理**：
- exit non-zero → throw（fallback chain 會抓）
- 沒有 `<TOKENS>` 標記 → throw（避免吃到 log prefix 噪音）
- JSON parse fail → throw
- timeout 30s → throw（withTimeout wrapper）

**注意**：gemini-rotate.sh 目前不支援 `--image` flag，這個 adapter 實作前要先擴 gemini-rotate.sh 加 image input 支援（或改用 cat image as base64 進 prompt）。在 plan phase 處理。

### 6.3 Anthropic adapter（fallback）

```typescript
// lib/vision/anthropic.ts
// 只在 ANTHROPIC_API_KEY env 存在時才 register 進 adapter chain
```

用 `@anthropic-ai/sdk` Sonnet vision call。實作細節 plan 階段詳述。

## 7. Migration v1→v2

### 7.1 觸發點

`lib/schema.ts:checkSchema()` 在 dashboard / `/design` 啟動時跑：
- 讀 vault 任何一個 case 的 frontmatter
- 若 schema_version: 1 或缺欄位 → 退回 exit 2 + 提示用戶跑 `bash scripts/migrate-v1-to-v2.sh`
- 若 schema_version: 2 → continue

### 7.2 Migration 邏輯

```bash
# scripts/migrate-v1-to-v2.sh
1. 備份：cp -r ~/Documents/CC Cli/design-library ~/Documents/CC Cli/design-library.v1-backup-$(date +%s)
2. 建 clients/_personal/cases/ 與 clients/_personal/anti-library/
3. 寫 clients/_personal/meta.yaml（type: self，name: 我的品牌）
4. mv vault/cases/* → vault/clients/_personal/cases/
5. mv vault/anti-library/* → vault/clients/_personal/anti-library/
6. 對每個 case：
   - 讀 frontmatter
   - 加 schema_version: 2
   - 加 client: _personal
   - 寫回
7. 跑全量 reindex 建 SQLite
8. 顯示「migration 完成」+ backup 路徑
```

用戶當下 0 case → migration 是空操作（仍跑，建立 `_personal` 客戶 + 空 SQLite），但腳本仍 production-ready，未來其他用戶（v0.3 SaaS）可重用邏輯。

### 7.3 Idempotency

跑兩次不爆。第二次偵測到 schema_version: 2 直接 exit 0。

## 8. SQLite + chokidar 同步策略

### 8.1 Watch 範圍

```typescript
// lib/index/watcher.ts
import chokidar from 'chokidar';
const VAULT = getVaultPath();

const watcher = chokidar.watch([
  `${VAULT}/clients/**/cases/**/*.md`,
  `${VAULT}/clients/**/anti-library/**/*.md`,
  `${VAULT}/clients/**/meta.yaml`,
  `${VAULT}/personal-style-guide.md`,
], {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  ignored: [/\.index\//, /\.archived\//],
});

watcher.on('add', enqueueReindex);
watcher.on('change', enqueueReindex);
watcher.on('unlink', enqueueDelete);
```

### 8.2 Content hash 比對

```typescript
// 避免重複 reindex 相同內容（Obsidian 的 atomic write 可能觸發多事件）
async function enqueueReindex(path: string) {
  const content = await readFile(path, 'utf8');
  const hash = sha256(content);
  const existing = db.prepare('SELECT content_hash FROM cases WHERE md_path = ?').get(path);
  if (existing?.content_hash === hash) return;   // 內容沒變
  await reindex(path, content, hash);
}
```

### 8.3 手動 rebuild

`POST /api/reindex` → 全量 rebuild（drop tables + 重建 + scan vault）。Dashboard UI 在 settings 區放按鈕。

### 8.4 啟動時 self-check

Dashboard server 啟動：
1. 讀 SQLite `index_meta.last_full_rebuild_at`
2. 跑 `find ~/Documents/CC Cli/design-library/clients -name "*.md" -newer <last_rebuild>` 找未索引的檔
3. 若 > 0 → 增量 reindex 那些 files

## 9. 啟動 / 停止

### 9.1 `/design-dashboard` slash command

```bash
# scripts/dashboard-start.sh
PID_FILE="$HOME/.claude/state/design-lab/dashboard.pid"
PORT=5173

if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
  echo "dashboard already running (pid $(cat $PID_FILE))"
  open "http://localhost:$PORT"
  exit 0
fi

cd "$SKILL_DIR/dashboard"
nohup node dist/server/entry.mjs > /tmp/design-lab-dashboard.log 2>&1 &
echo $! > "$PID_FILE"
sleep 1
open "http://localhost:$PORT"
```

### 9.2 30 min idle auto-stop

```typescript
// dashboard/src/server.ts
let lastActivityAt = Date.now();

app.use((_, __, next) => { lastActivityAt = Date.now(); next(); });

setInterval(() => {
  if (Date.now() - lastActivityAt > 30 * 60 * 1000) {
    console.log('[design-lab] idle 30 min, shutting down');
    process.exit(0);
  }
}, 60_000);
```

PID file 在 `process.on('exit')` cleanup。

## 10. 安全與錯誤處理

### 10.1 Localhost-only

Dashboard 只 listen `127.0.0.1:5173`（不 listen 0.0.0.0）。沒有 auth 因為純 localhost。

### 10.2 File path traversal

所有 `/api/*` 接收的 client slug / case slug **必須 sanitize**：
- 只允許 `[a-z0-9_-]+`
- 拒絕 `..` / `/` / 絕對路徑
- 寫入前 `path.resolve` 後檢查 `startsWith(getVaultPath())`

### 10.3 Vision LLM 失敗

兩個 adapter 全失敗 → tokens 回 `{}`，UI 提示「自動抽取失敗，請手動填」+ 顯示 raw image 旁的純文字 textarea。

### 10.4 Markdown 編輯衝突

dashboard 寫 markdown 前比對 content-hash（讀 → modify → 寫前再讀檢查 hash 沒變）。Obsidian 同時開 + 編輯時會撞，UI 顯示「外部已修改，請重新 load」。

### 10.5 SQLite 壞掉

`POST /api/reindex` 提供完整 rebuild。SQLite 是 cache，刪除可重建。

## 11. 測試策略

### 11.1 沿用 v0.1 既有 24 個 unit test

不刪不改（schema check / init-library / lint regex 仍適用）。

### 11.2 v0.2 新增 unit test（Vitest）

- `paths.test.ts`：getVaultPath() / getClientDir() 路徑解析
- `case-loader.test.ts`：recursive scan、client filter、_personal union
- `case-writer.test.ts`：寫到對的 client 資料夾
- `client-loader.test.ts` / `client-writer.test.ts`
- `migration.test.ts`：v1 sample vault → 跑 migration → 驗 v2 結構
- `vision-adapter.test.ts`：mock spawn，驗 `<TOKENS>` 解析、timeout、fallback chain
- `index/reindex.test.ts`：mock fs，驗 SQLite 寫入

### 11.3 Dashboard E2E（Playwright）

- `collect.spec.ts`：drag-drop 圖 → vision mock → 表單 → 寫 case → 驗 markdown 存在
- `client-switch.spec.ts`：建立 2 個 client → grid 切換 → 驗 case 隔離
- `client-crud.spec.ts`：建 / rename / delete client
- `style-guide-edit.spec.ts`：改 NEVER → 寫回 markdown → 驗 lint regex 生效
- `feedback.spec.ts`：跑 mock /design → /feedback 點 👍 → 驗 case 寫入

### 11.4 TDD 順序（CLAUDE.md 強制）

每個 feature：先寫 failing test → 確認 fail → 寫最小實作 → pass → 重構。

## 12. 實作順序（給 writing-plans skill 的 hint）

建議分 7 phase：

1. **Phase A**：`lib/paths.ts` + schema_version=2 + migration script + 對應測試
2. **Phase B**：`lib/case-loader/writer/client-loader/writer` 改 v0.2 結構 + 測試
3. **Phase C**：SQLite index（schema + reindex + chokidar watcher） + 測試
4. **Phase D**：Vision adapter（gemini-rotate + Anthropic） + 測試（含修補 gemini-rotate.sh 加 --image 支援）
5. **Phase E**：Astro dashboard scaffold + Tailwind + shadcn-ui setup + 主路由空殼
6. **Phase F**：Dashboard 各 page 實作（client CRUD → grid → collect → feedback → style-guide）+ Playwright E2E
7. **Phase G**：dashboard-start.sh + idle watcher + `/design-dashboard` slash command + 整合測試

每 phase 跑 Codex ↔ Gemini cross-review、0 🔴 才進下一 phase。

## 13. 待解問題（plan 階段需處理）

1. `gemini-rotate.sh` 目前不支援 `--image` flag。Phase D 開頭要先擴它（或改 base64 inline 進 prompt）。需驗證對 6 帳號 rotate 邏輯沒副作用。
2. Astro 5 SSR + Node adapter + better-sqlite3 在 Mac M1 / x86 跨平台 build 有沒有 native binding 問題。Phase E 開始時驗證。
3. shadcn-ui 在 Astro 整合的 boilerplate（`shadcn-ui` skill 主要是 Next.js 範本）。Phase E 寫前查 Astro + shadcn 整合官方範例。
4. chokidar 在 macOS 對 Obsidian 的 atomic write 行為實測（rename pattern → unlink + add 還是 change）。Phase C 開頭做 spike。

## 14. 驗收標準

v0.2 ship 條件：

1. 所有 v0.1 test 仍 pass（24 個）+ v0.2 新測試全 pass（預期 40+ 個）
2. `/design-dashboard` 啟動 1-2 秒內 dashboard 可用
3. drag-drop 一張圖 → 自動填 tokens（gemini 跑通）→ 寫 case → grid 看得到
4. 建 2 個 client（me-_personal 已預設 + me-test-client）→ 切換看 case 隔離
5. 改 personal-style-guide.md NEVER 段 → 跑 `/design <task>` 觸發 lint 對新規則生效
6. Migration 從 v0.1 vault（手動建 sample）→ v0.2 結構正確
7. SQLite cache 與 markdown 一致（手動改 markdown → chokidar 偵測 → SQLite 同步）
8. Light theme + theme_color 在 12 色 palette 內 + WCAG AA 對比
9. Codex ↔ Gemini cross-review 0 🔴
10. 自我審查 4 項（資安 / TS strict / 錯誤處理 / i18n）通過
11. `/destructive-qa` 破壞性測試（POST 無 body / path traversal / SQL injection）通過

## 15. 開放問題 / 未來方向

不在 v0.2 範圍但記下來：

- v0.2.1：URL 自動截圖（Playwright 在 dashboard 內）
- v0.2.2：Hook 自動偵測語氣（讀 conversation transcript → 進 candidates）
- v0.3：Auto distill（個案 → 規則層自動演化）
- v0.3：LLM detector for NEVER（regex 之外加 LLM 語意 check）
- v0.4：SaaS 化第一步（auth + cloud storage adapter + tenant isolation）

---

**End of design spec v0.2.**
