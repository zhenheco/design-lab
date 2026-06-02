# design-lab — 個人化品牌設計系統 Skill

**Date**: 2026-05-02
**Status**: Design (pending review → writing-plans)
**Owner**: Avy
**Skill location (target)**: `~/.claude/skills/design-lab/`
**Memory location (target)**: `~/Documents/CC Cli/design-library/` (Obsidian vault)

## 1. 問題與目標

### 1.1 痛點

既有的 design 類 skill（`ui-ux-pro-max` / `cis-design` / `frontend-design` / `gemini-design`）跑出來的設計成品**風格不符合 Avy 的個人偏好**，且**沒有「記住個人偏好 + 自我演化」的能力**。每次設計都從零開始，重複犯同樣的偏好錯誤（例：用了不喜歡的漸層、字型太細）。

### 1.2 目標

打造 `design-lab` skill：

1. **跨場景通用**：cover brand 案、landing page、SaaS UI、內容視覺四大場景
2. **記憶 + 學習**：把 Avy 喜歡 / 不喜歡的設計累積成個人 memory 庫，做新設計時自動 retrieve 當 reference
3. **自我演化**：從個案累積中 distill 出規則層（DO + NEVER + SOMETIMES），形成「Avy 設計法則」
4. **lint 提醒**：AI 設計時自動檢查是否違反 NEVER 規則，違反就修正
5. **跨場景 + 場景特化**：通用美學法則 + 各場景的 override 參數

### 1.3 取代範圍

`design-lab` 取代 `ui-ux-pro-max` 在 Avy 工作流中的主角位置。`ui-ux-pro-max` 降級為「starter pool dataset 提供者」（僅在個案庫 < 50 筆時被內部 fallback 引用）。`cis-design` / `frontend-design` / `gemini-design` 不受影響、繼續存在。

## 2. 系統架構

### 2.1 高階流程（之前 vs 之後）

```
之前：你 → /ui-ux-pro-max（50 styles 通用 dataset）→ 設計

之後：你 → /design (design-lab)
              ├─ 讀 personal-style-guide.md（你的 DO + NEVER + SOMETIMES）
              ├─ 讀 scenario-overrides/<scenario>.md（場景特化參數）
              ├─ 從個案庫抽相似 case top 5（混合檢索：LLM / tag+LLM / embedding）
              ├─ Cold start fallback：< 50 筆時內部呼叫 ui-ux-pro-max 借 starter pool
              ├─ 產出 design（依場景 template）
              ├─ NEVER lint 自動掃描 + 修正違規
              └─ 你給 feedback → memory 寫入 → 下次更準
```

### 2.2 目錄結構

#### Skill 程式碼（`~/.claude/skills/design-lab/`）

```
~/.claude/skills/design-lab/
├── SKILL.md                    # 入口 + 5 個 slash command 路由
├── scripts/
│   ├── collect.sh              # /design-collect 實作（Playwright 解構）
│   ├── distill.sh              # /design-distill 實作（個案 → 規則）
│   ├── stats.sh                # /design-stats 報表
│   ├── lint.sh                 # 設計時 NEVER lint check
│   └── index-rebuild.sh        # SQLite 索引快取 rebuild（增量 / 全量）
├── templates/
│   ├── landing.md              # 場景模板（landing page）
│   ├── saas-ui.md              # 場景模板（SaaS UI）
│   ├── brand.md                # 場景模板（brand 案）
│   └── content.md              # 場景模板（內容視覺）
└── lib/
    ├── playwright-scrape.js    # URL → design tokens 解構
    ├── retrieval.js            # 三層檢索（LLM / tag+LLM / embedding）
    └── inheritance.ts          # base + scenario override 合併
```

#### Memory（`~/Documents/CC Cli/design-library/`，Obsidian vault 內）

```
~/Documents/CC Cli/design-library/
├── personal-style-guide.md     # 跨場景通用法則（DO + NEVER + SOMETIMES）
├── scenario-overrides/
│   ├── landing.md
│   ├── saas-ui.md
│   ├── brand.md
│   └── content.md
├── cases/
│   ├── 0001-zhenheco-landing.md         # page (Obsidian 編輯)
│   └── 0001-zhenheco-landing/           # 同 slug 的資產目錄
│       ├── snapshot.png
│       ├── tokens.json
│       └── source.html                  # URL 收藏才有
├── anti-library/                # 不喜歡的個案（同 cases 結構）
│   └── 0001-too-flat.md
│       └── 0001-too-flat/
├── candidates/
│   └── pending.md               # AI 偵測語氣後的候選池（待 review）
└── .index/
    └── library.db               # SQLite 索引快取（hidden）
```

### 2.3 關鍵設計決策

| # | 決策 | 理由 |
|---|---|---|
| 1 | skill 與 memory 分離 | skill 程式碼可 reinstall / 升級不影響 memory；memory 跨 skill 升級保留 |
| 2 | memory 放 Obsidian vault | 你能直接在 Obsidian 看 / 編輯 / 全文搜尋 / graph view 看個案關係 |
| 3 | markdown 為 source of truth + SQLite 索引快取 | 編輯體驗保留 + query 不慢；SQLite 從 markdown frontmatter rebuild |
| 4 | 個案 + 規則 雙層 memory | 個案層做 case-based reasoning、規則層做 first-principles 約束，互補 |
| 5 | 「包」ui-ux-pro-max 而非完全取代 | 保留 cold start 體驗；個案累積後逐漸斷奶 |
| 6 | 候選池 + review-then-commit | AI 偵測語氣易誤判，先進候選池、review 後才 commit 避免雜訊 |
| 7 | NEVER 規則用 regex/LLM 雙模式 detector | 機械可判的用 regex（穩、快）；無法機械判的用 LLM（彈性） |

## 3. 資料模型

### 3.1 個案 markdown（`cases/<slug>.md`）

```markdown
---
id: 0001
slug: zhenheco-landing
captured_at: 2026-05-02T10:30:00+08:00
source:
  type: url            # url | upload | session-capture
  url: https://zhenhe-co.com
  via: /design-collect
scenario: landing       # landing | saas-ui | brand | content
sentiment: positive     # positive | negative
tags:
  style: [minimal, editorial]
  mood: [warm, professional]
  elements: [glass, serif-headline, grid-12]
  industry: [b2b-saas]
tokens:
  palette:
    primary: "#1F2937"
    accent: "#F59E0B"
    bg: "#FFFFFF"
    text: "#111827"
  typography:
    heading: "Inter 700 / 56px / 1.1"
    body: "Inter 400 / 16px / 1.6"
    cjk_pair: "Noto Sans TC 500"
  spacing: "8pt grid, section padding 96px"
  radius: "8px (lg) / 4px (md)"
  shadow: "subtle (0 1px 2px rgba(0,0,0,.05))"
quotes_from_user:
  - "這個 hero 留白很爽"
  - "配色組合很有質感、不會太冰"
related: [0007, 0012]
lint_skip: []           # 此個案要跳過的 lint 規則 id
---

## 為什麼喜歡

（自由文 — 為什麼這個設計值得收藏）

## 截圖

![[0001-zhenheco-landing/snapshot.png]]

## 解構觀察

- Hero CTA 用 accent 色但只佔 2% 面積（60-30-10 法則嚴格）
- ...
```

### 3.2 規則層 `personal-style-guide.md`

```markdown
---
version: 3
updated: 2026-05-02
distilled_from_cases: 47
distilled_anti_cases: 12
---

# Avy 設計法則 v3

## DO（你偏好的）

- **配色**：60-30-10 法則嚴格、accent 飽和度 70-80%、避免純黑用 #1F2937
- **字型**：Heading 用 Inter 700+、body 1.6 行高、CJK 配 Noto Sans TC 500
- **留白**：section padding ≥ 80px、hero 上下 1:1.6
- **層次**：subtle shadow（不用 elevated card）、border 用 1px #E5E7EB

## NEVER（你絕對不要的）

- id: no-gradient
  rule: "不要漸層（除 1% accent fade）"
  detector:
    type: regex
    pattern: 'linear-gradient|radial-gradient|conic-gradient'
    target: css
  exceptions: ["1% accent fade"]
- id: no-elevated-card
  rule: "不要 Material elevated card"
  detector:
    type: regex
    pattern: 'box-shadow:\s*0\s+\d+px\s+\d{2,}px'  # shadow blur > 10px
    target: css
- id: no-pure-black
  rule: "不要純黑 #000000"
  detector:
    type: regex
    pattern: '#000(?![0-9a-fA-F])|#000000|rgb\(0,\s*0,\s*0\)'
    target: css
- id: no-serif-body
  rule: "body 不要 serif"
  detector:
    type: llm
    prompt: "Does this design use serif fonts for body text?"

## SOMETIMES（context-dependent）

- 暗色模式：B2C 行銷頁可、B2B 工具頁不可
- 動畫：landing 可 micro-interaction、SaaS dashboard 禁
```

### 3.3 場景特化 `scenario-overrides/saas-ui.md`

```markdown
---
parent: personal-style-guide.md
---

# SaaS UI 場景特化

## 覆蓋通用法則

- **配色**：accent 改用低飽和（避免分散功能注意力）
- **字級**：base 14px（通用是 16px）
- **間距**：嚴格 8pt grid
- **元件**：偏好 shadcn/ui base、tailwind container queries

## 場景專屬偏好

- 不用 hero pattern、避免 marketing 化
- icon 統一 lucide stroke=1.5
```

### 3.4 SQLite 索引快取 `.index/library.db`

```sql
-- 個案索引（從 markdown frontmatter rebuild）
CREATE TABLE cases (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  scenario TEXT NOT NULL,           -- landing | saas-ui | brand | content
  sentiment TEXT NOT NULL,          -- positive | negative
  captured_at TEXT NOT NULL,
  source_type TEXT,
  source_url TEXT,
  md_path TEXT NOT NULL,            -- 反向指回 markdown 檔
  tokens_json TEXT,                 -- 完整 tokens 序列化
  md_mtime INTEGER NOT NULL         -- 偵測 stale
);

CREATE TABLE case_tags (
  case_id INTEGER REFERENCES cases(id),
  tag_kind TEXT,                    -- style | mood | elements | industry
  tag_value TEXT,
  PRIMARY KEY (case_id, tag_kind, tag_value)
);
CREATE INDEX idx_tags_value ON case_tags(tag_value);

CREATE TABLE feedback_log (
  id INTEGER PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  case_id INTEGER REFERENCES cases(id),
  signal TEXT,                      -- like | dislike | edit | reject | lint-violation
  user_quote TEXT,
  derived_rule TEXT,                -- distill 階段抽出的規則
  rule_id TEXT                      -- lint-violation 時記錄違反哪條
);
```

### 3.5 候選池 `candidates/pending.md`

```markdown
---
generated: 2026-05-02
session_id: abc123
---

# 待 review 候選池

## 1. 偵測到正面語氣（you said: "就這個版本吧"）

- 時間: 2026-05-02 11:23
- context: zhenheco landing page redesign
- 推測 design: <session log link>
- [ ] confirm → 寫入 cases/
- [ ] reject → 丟棄

## 2. 偵測到負面語氣（you said: "字太細了"）
...
```

**保險繩**: 24 小時沒 review 的候選自動歸檔到 `candidates/expired/<date>.md`（不刪）。

## 4. 五個 Slash Command 流程

### 4.1 `/design <task description>`（主入口）

**Input**: 自然語言描述（「幫 aicycle.cc 做新 landing page，B2B SaaS 調性」）

**流程**:
1. **場景分類**（LLM judge）→ scenario = landing
2. **載入規則層**：personal-style-guide.md + scenario-overrides/landing.md（用 inheritance 算法合併）
3. **檢索個案**（D 混合策略，注意：此 threshold 是「檢索策略選擇」，跟第 5.2 的 starter pool 斷奶 threshold 是兩個不同決策）：
   - case_count < 100：LLM 直接挑 top 5（個案 frontmatter 摘要餵 Claude）
   - case_count < 500：tag pre-filter（scenario + tags）→ LLM 從結果挑
   - case_count >= 500：embedding 檢索（後期版本才上，見第 8 節）
4. **生成 design 草案**：Claude 綜合（規則層 + top 5 個案 + ui-ux-pro-max starter pool 兜底）→ 依場景 template 產出
5. **NEVER lint 檢查**（執行 `scripts/lint.sh`）：違反就自動修正 + 提示
6. **顯示 design + rationale + reference 來源**：「使用個案 [[0001-zhenheco-landing]] [[0007-...]]」

**Output**: design 檔（依場景：landing/saas-ui 給 Astro 組件、brand 給 brand-guideline.md、content 給 HTML 卡片）+ rationale。

**互動點**: 你追問「換掉那個漸層」「字型再粗一點」→ skill 自動觸發 `/design-feedback`。

### 4.2 `/design-collect [url|file] [scenario] [--negative]`

**3 種觸發**:
- `A. /design-collect https://stripe.com/`（URL 自動截）
- `B. /design-collect ~/Downloads/inspiration.png landing`（手動丟檔）
- `C. /design-collect --negative https://...`（進 anti-library）

**URL 流程**（`scripts/collect.sh`）:
1. chrome-devtools MCP 或 Playwright headless 開頁
2. 截圖整頁 → `cases/<slug>/snapshot.png`
3. DOM scrape：getComputedStyle、CSS variables、字型、配色（chroma.js k-means k=5）、layout
4. 存 `tokens.json` + `source.html`（首屏）
5. **Minimal mode 互動**：只問
   - sentiment（喜歡/不喜歡）
   - 1 句 quote（「為什麼喜歡」）
   - scenario（自動偵測，按 Enter 接受）
   - 其他 tags 留空，事後在 Obsidian 補
6. 寫 `cases/<slug>.md`（frontmatter 預填）
7. 觸發 SQLite 增量 re-index

**檔案上傳流程**: 跳過 DOM scrape，改 vision LLM 從截圖抽 tokens。

### 4.3 `/design-feedback [optional: target case|design]`

**4 種觸發**:
- A. 對話自然：「太花了 / 字太細 / 換掉那個漸層」→ hook 偵測 → 候選池
- B. 明說 positive：「這個讚、存進去」→ 直接 commit cases/
- C. 明說 negative：「這個我不要」→ 寫 anti-library/
- D. session 結束 review 候選池（透過 Stop hook 觸發 review 提醒）

**流程**:
1. 解析 feedback（LLM）：sentiment、dimension（color/typography/layout/spacing/mood/overall）、quote、target
2. 寫 `feedback_log` SQLite
3. positive + 還沒收進 → 觸發 collect 流程進 candidates 或直接 commit
4. negative → 寫 `anti-library/<slug>.md`，提示「這條偏好已記錄」

### 4.4 `/design-distill [--dry-run]`

**觸發**: 手動 + 月度 cron（launchd 1 號 09:00）

**流程**:
1. 掃 since last-distill-checkpoint：新增 cases / feedback 數
2. IF (new_cases >= 10 || new_feedback >= 30 || force=manual)：開始 distill
3. 餵 Claude（structured prompt）：上次 personal-style-guide + 新增 cases + anti + feedback_log → 任務「抽 3-7 條新 rule（DO/NEVER），標出處個案 ID」
4. 產出 diff（v3 → v4 變化）：新增 DO / 新增 NEVER / 修改既有規則 / 移除過期規則
5. **規則衝突偵測**（見 4.4.1）→ 4 選項給用戶決定
6. dry-run：只顯示 diff、不寫檔
7. confirm：apply diff → personal-style-guide.md v4 + git commit

#### 4.4.1 規則衝突解決

舊規則 vs 新趨勢矛盾時，產出衝突報告：
```
⚠️ Conflict: 同 dimension 的規則矛盾
舊規則 (v3): "Heading 用 Inter 700"
  - 出處: 0001, 0007, 0012 (3 個案，2 個月前)
新趨勢 (v4 候選): "Heading 用 Manrope 600"
  - 出處: 0023~0044 (8 個案，過去 1 個月)

選項:
[A] 替換: 新規則勝（你品味演化了）
[B] 並列: 兩者都列為 acceptable
[C] 保留舊
[D] 細分: 加場景條件（landing 用 Manrope、其他用 Inter）
```

### 4.5 `/design-stats`

直接終端顯示：
```
=== Avy Design Library Stats ===
- Total cases: 47 positive / 12 negative
- By scenario: landing(18), saas-ui(15), brand(8), content(6)
- Top tags: minimal(23), professional(19), warm(15), editorial(12)
- Top palette: #1F2937 + accent #F59E0B 出現 8 次
- Most violated NEVER: "no gradients"（lint 攔截 14 次）
- Distill 狀態: v3, 距上次 distill 18 天 (建議 12 天後跑)
- 最近收藏: zhenheco-landing (3 天前)
```

## 5. 學習與 Distill 機制

### 5.1 NEVER lint 引擎

**目標**: 每次 `/design` 產出後，機械化掃描違規。

**流程**（`scripts/lint.sh`）:
1. extract css/html from design output
2. 對每條 NEVER 規則跑對應 detector
3. 違反處理：
   - regex detector 違反 → 自動修正 + 標記「auto-fixed: replaced X with Y per rule no-gradient」
   - LLM detector 違反 → 警告（不自動改）
4. lint 結果寫 `feedback_log`（signal=lint-violation），統計到 `/design-stats`

**關鍵**: 規則寫死後 detector 機械跑，不靠每次 LLM 重判（穩、快、可解釋）。

### 5.2 ui-ux-pro-max 「starter pool」fallback

**觸發條件**: 個案庫 < 50 筆 / 新場景沒個案 / 找不到相似 positive case

**借用方式**:
1. read `~/.claude/skills/ui-ux-pro-max/SKILL.md`
2. 從其 50 styles / 21 palettes / 50 fonts 抽 3-5 個 starter
3. 餵 Claude 時標明「starter pool，謹慎當參考」
4. design rationale 註明「個案庫 < 10 筆，此設計參考 starter pool」+ 建議跑 collect

**斷奶曲線（簡化版，所有版本皆用此）**:
- case_count < 50：引用 starter pool（在 system prompt 標明此為 starter，謹慎當參考）
- case_count >= 50：完全不引用 starter pool

**修正 Gemini review Q2**：原 spec 規劃 v0.4 上「三階段細膩權重曲線（10%/30%/50% 斷奶）」，但這透過 prompt engineering 實現的微調收益遠不及調試成本（YAGNI）。砍掉，永遠用上述二元簡化版。

### 5.3 跨場景 inheritance（合併算法）

```python
def merge_rules(base, override, current_scenario):
    merged = deepcopy(base)
    # DO: override 補強 / 替換
    for rule in override.do:
        if rule.id in merged.do:
            merged.do[rule.id] = rule
        else:
            merged.do.append(rule)
    # NEVER: override 只能新增、不能解除
    for rule in override.never:
        merged.never.append(rule)
    # SOMETIMES: 場景條件啟用
    for rule in override.sometimes:
        if rule.activate_for_scenario == current_scenario:
            merged.do.append(rule.as_do())
        elif rule.deactivate_for_scenario == current_scenario:
            merged.never.append(rule.as_never())
    return merged
```

### 5.4 候選池語氣偵測（Layer 1 + Layer 2）

**修正 Gemini review Q1**：原版 hook 只 echo keyword，缺「對應到哪個 design」上下文。改成 hook 會帶上「last design artifact slug」當關聯鍵，Layer 2 LLM judge 歸因準確度大幅提升。

**前置條件**：`/design` 跑完時把 artifact slug 寫到 `~/.claude/state/design-lab/last-artifact.txt`（atomic write）。每個 design 產出視為一個有 slug 的 artifact（例：`landing-aicycle-2026-05-02-1230`）。

**Layer 1 — hook keyword pre-filter**（`settings.json`）:
```json
{
  "hooks": {
    "user-prompt-submit": [
      {
        "match": "(就這個|讚|不錯|OK|完美|喜歡|好看|這版|留下)",
        "command": "LAST=$(cat ~/.claude/state/design-lab/last-artifact.txt 2>/dev/null || echo 'unknown'); echo \"$(date -Iseconds) [positive] artifact=$LAST keyword_matched=true\" >> ~/.claude/state/design-lab/signal.log"
      },
      {
        "match": "(太|不行|換掉|難看|醜|不喜歡|不要)",
        "command": "LAST=$(cat ~/.claude/state/design-lab/last-artifact.txt 2>/dev/null || echo 'unknown'); echo \"$(date -Iseconds) [negative] artifact=$LAST keyword_matched=true\" >> ~/.claude/state/design-lab/signal.log"
      }
    ]
  }
}
```

每筆 signal log 含：時間戳 / sentiment / 對應 artifact slug。

**Layer 2 — LLM judge（session 結束批次跑，由 Stop hook 觸發）**:
讀 session log + signal.log → Claude 判斷：(a) 每筆 signal 真針對 design vs code/config？(b) artifact slug 對應到 cases/ 或 in-session design？(c) sentiment / dimension / quote 抽出 → 寫 `candidates/pending.md`。

**failsafe**：若 `last-artifact.txt` 不存在或內容是 `unknown`（用戶 session 沒跑過 `/design` 但說了 keyword），signal 仍記錄但標 `artifact=unknown`，Layer 2 判定「無 design context、丟棄」。

**review 流程**: session 結束 hook 提醒 / 下次 session 開始 → 看 pending.md → 勾要的 → commit 進 cases/。

## 6. 錯誤處理

| 失敗點 | 應對 |
|---|---|
| Playwright 開不了 URL（404 / paywall / Cloudflare 擋）| 提示 → 改 vision LLM 從手動截圖；或讓你貼 HTML |
| DOM scrape 抽不到 CSS variables | fallback `getComputedStyle` + 配色 k-means |
| vision LLM 抽 tokens 結果亂 | 提示「信心度 < 0.7，請手動補」+ 預填欄位 |
| `/design` 找不到任何相似 + ui-ux-pro-max 也讀不到 | 退化「純對話設計」+ 警示 "running blind, no library reference" |
| lint regex 誤判 | case-by-case 加 `lint_skip: [no-gradient]` 到 design metadata |
| SQLite 索引壞掉 / 跟 markdown 不同步 | `scripts/index-rebuild.sh --full` 從零 rebuild |
| distill LLM call 失敗（quota / capacity）| retry 3 次，fail 存原始 prompt 到 `.distill-pending.txt`，下次帶上 |
| Obsidian 同時開檔導致寫入衝突 | atomic write（先 .tmp 再 rename），衝突偵測就提示 reload |
| candidates 過期 24h 沒 review | 自動歸檔到 `candidates/expired/<date>.md`（不刪） |

## 7. 測試計劃（TDD 強制）

### 單元測試
- `tests/lint.test.sh` — NEVER regex detector 對 fixture HTML 的命中率
- `tests/inheritance.test.ts` — base + override 合併算法
- `tests/index-rebuild.test.sh` — 手改 markdown frontmatter 後跑 rebuild，驗 SQLite 對得上
- `tests/playwright-scrape.test.js` — 對固定 URL（zhenheco / aicycle）跑 scrape，驗 tokens.json 結構

### 整合測試
E2E：從零 init library → 3 個 URL collect → /design 出設計 → /design-feedback 改一輪 → /design-distill 看規則 → /design-stats 看報表。

### 回歸測試
每次改 distill 邏輯，跑 `tests/golden/distill-v3-to-v4.expected.md` 比對輸出（golden file）。

### TDD 順序
先寫測試（fail）→ 再實作（pass）→ refactor。

## 8. 上線階段（增量交付）

按 CLAUDE.md「升級或新增功能 → 一次一個功能 → deploy → 測 → 確認 → 下一個」。

### v0.1 — MVP（純讀寫，無智慧）

**修正 Gemini review Q4：原描述「5 個 slash command 全部能跑」與「沒 distill」自相矛盾，改成 4 commands 有最小可用功能 + 1 個 stub。**

- **4 個 slash command 有最小可用功能 + 1 個 stub**：
  - `/design`：純 LLM 挑 case（D 方案小庫模式）+ 載入 style-guide + NEVER lint regex detector
  - `/design-collect`：手動丟檔模式（vision LLM 抽 tokens）；URL Playwright 路徑 v0.2 才做
  - `/design-feedback`：寫 feedback_log + commit cases/anti-library；自動偵測語氣（hook + candidates）v0.2 才做
  - `/design-stats`：基礎 stats（case count、scenario 分布、最近收藏）；完整報表 v0.4
  - **`/design-distill`：v0.1 為 stub** — 呼叫時顯示「請手動編輯 `personal-style-guide.md`，自動 distill 在 v0.3 上線」
- NEVER lint 只支援 regex detector（LLM detector v0.2）
- 規則層手動編輯（無 distill 自動化）
- 含 schema migration framework 起手式（見第 12 節，初始 schema_version=1）
- **測試**：手動跑 5 個個案的 capture → /design 出 1 個 landing → /design-feedback 改 → 看路徑通

### v0.2 — 自動化解構引擎
- 加 Playwright URL scrape（chrome-devtools MCP 整合）
- 加 candidates 候選池 + hook keyword pre-filter
- 加 LLM detector for NEVER

### v0.3 — Distill 引擎
- distill 流程 + 規則衝突解決互動
- launchd 月度 cron
- design-library 加 git init + auto commit

### v0.4 — Stats + Polish
- `/design-stats` 完整報表（top palette、最常違反 NEVER、distill 健康度等）
- 場景 inheritance（saas-ui / brand / content override）完整實作
- ~~starter pool 斷奶曲線~~ — 已砍（見第 5.2 修正 Q2，永遠用簡化版）

### v1.0 — Dogfood 6 週後檢視
- 累積 30+ 個案、實際使用 6 週後再修正方向（可能規則 schema 要重設、檢索策略要調）
- v1 才正式公開、SKILL.md 寫完整
- 之前 v0.x 標 experimental

每階段交付後跑：(1) build + test (2) Codex↔Gemini cross-review (3) `/destructive-qa` (4) 用戶 dogfood 1 週確認再進下一階段。

**writing-plans 階段邊界**：本 spec 涵蓋 v0.1 → v1.0 完整路線圖，但**第一個 implementation plan 只 cover v0.1 MVP**。v0.2/0.3/0.4/1.0 各自需要獨立 brainstorm（檢視 v 前一階段 dogfood 結果）+ 獨立 writing-plans。避免一次 plan 過大失準。

## 9. 安全 / 隱私 / 治理

| 項目 | 處理 |
|---|---|
| 截圖隱私 | 收藏的 URL 截圖可能含他人版權 → 個人 library 不公開分享，僅本機使用 |
| Vault 備份 | 在 `~/Documents/CC Cli/design-library/` sub-tree 跑 `git init`（不影響 vault 既有同步），每次 distill commit；推 private GitHub 做備份。注意：vault path 含空格，所有 script 須 quote 處理 |
| Hook 誤觸發 | keyword pre-filter 只 log 不直接寫 library，靠 Layer 2 LLM judge + candidates review 過濾誤判 |
| Skill 升級不破壞 memory | skill 與 memory 分離（不同根目錄）；升級只動 `~/.claude/skills/design-lab/` |
| Obsidian 同步衝突 | atomic write + 衝突偵測 reload；建議停掉 Obsidian Sync 衝突合併功能 |

## 10. 待解決疑問（移交 writing-plans 前）

1. v0.1 MVP 的 SKILL.md 跟現有 superpowers / auto-skill / ui-ux-pro-max 的整合方式（特別是 SKILL.md frontmatter 的 description 寫法、要不要進 auto-skill 索引）
2. Playwright 引擎選用：自帶 `npx playwright` vs chrome-devtools MCP — 最終取決於 v0.2 實作時的 dependency 偏好
3. v0.3 distill 衝突解決的互動 UI（純文字 prompt vs 開 markdown 讓你 inline 編輯）
4. ui-ux-pro-max starter pool 的 dataset 怎麼讀（read SKILL.md 抽？需要它 export 結構化 JSON？）

這些等 writing-plans 階段拆任務時再決議。

## 11. Schema 演化與資料遷移

**修正 Gemini review Q3**：原 spec 雖有 `version` / `schema_version` 概念但未說明 schema 改變後如何安全 migrate 舊資料。長期累積 100+ case 後改 schema 不可能手動，必須有自動化 framework。

### 11.1 版本欄位

每個 markdown frontmatter 強制有 `schema_version` 整數欄位：
- `cases/<slug>.md` → `schema_version: 1`
- `anti-library/<slug>.md` → `schema_version: 1`
- `personal-style-guide.md` → `schema_version: 1`（檔案頭一行）
- `scenario-overrides/*.md` → `schema_version: 1`

`design-lab` skill 內部維護一個 `CURRENT_SCHEMA_VERSION` 常數（在 `lib/schema.ts`），新版本上線時 +1。

### 11.2 Migration 目錄結構

```
~/.claude/skills/design-lab/migrations/
├── README.md                      # migration 規範
├── v1-to-v2.sh                    # 例：加新 frontmatter 欄位「license」
├── v2-to-v3.sh                    # 例：規則層 NEVER 從 list-of-strings 改 list-of-objects
└── ...
```

每個 migration 腳本接受 `<vault-path>` 參數，遞迴處理該目錄下所有有 `schema_version` 欄位的 markdown，原地修改 frontmatter + 更新 `schema_version` 欄位到新值。

### 11.3 Migration 流程

每次 skill 啟動（任何 slash command 第一個動作）：

```bash
1. Skill 讀 lib/schema.ts → CURRENT_SCHEMA_VERSION = N
2. Skill 掃 ~/Documents/CC Cli/design-library/ 找最舊的 schema_version：
   - grep -r "^schema_version:" → 取最小值 M
   - 若沒有檔案（cold start）M = N
3. 若 M < N：
   a. 提示用戶：「偵測到 schema 從 v$M 升級到 v$N，需要遷移 $count 個檔案。執行嗎？(y/n)」
   b. y → 跑 git commit（pre-migration snapshot）→ 依序跑 v$M-to-v$(M+1).sh ... v$(N-1)-to-v$N.sh → git commit（post-migration）
   c. n → skill 退出，提示「請先手動跑 migration 或降級 skill 版本」
4. M == N：正常啟動
5. M > N（用戶降級 skill）：拒絕啟動，提示「memory schema 比 skill 新，請升級 skill 或手動降級 memory」
```

### 11.4 Migration 腳本規範

```bash
#!/usr/bin/env bash
# v1-to-v2.sh — example: 加 license 欄位 default "personal-only"

set -euo pipefail
VAULT_PATH="${1:?usage: $0 <vault-path>}"
[ -d "$VAULT_PATH" ] || { echo "vault not found"; exit 1; }

# 必須 idempotent — 重跑不該破壞已 migrate 的資料
find "$VAULT_PATH" \( -name "*.md" -not -path "*/.index/*" \) | while read -r f; do
    if grep -q "^schema_version: 1$" "$f"; then
        # 在 frontmatter 加 license 欄位（如果還沒有）
        grep -q "^license:" "$f" || sed -i '' '/^schema_version:/a\
license: personal-only
' "$f"
        # 更新 schema_version
        sed -i '' 's/^schema_version: 1$/schema_version: 2/' "$f"
    fi
done

echo "[migration v1→v2] 完成 $VAULT_PATH"
```

### 11.5 Rollback 機制

每次 migration 前 `git commit -m "pre-migration snapshot v$M"`（在 design-library sub-tree 內，第 9 節已說明）。失敗時 `git reset --hard HEAD~1` 回復。

### 11.6 SQLite 索引重建

migration 後**強制 full rebuild SQLite 索引**（`scripts/index-rebuild.sh --full`），因為 frontmatter 已改、舊索引必然 stale。

### 11.7 v0.1 起手式

v0.1 雖然 schema 不會立刻改，但 framework 必須先建：
- `lib/schema.ts` 含 `CURRENT_SCHEMA_VERSION = 1`
- `migrations/` 目錄存在但空（v1 是初始版本，無 migration script）
- `migrations/README.md` 寫規範
- skill 啟動時跑「schema check」→ 比對版本 → 無 diff 直接過

這樣 v0.2 第一次有 schema 變動時不用回頭補 framework。

## 12. 簽結

設計確認流程已跑完：9 題澄清 + 3 個 approach 提案 + 5 段 design 分段確認 + 命名定案 + spec 自審 4 項 + Gemini flash 交叉驗證 + 4 處修補（Q1/Q2/Q3/Q4）。

下一步：
1. 用戶 review 本 spec（修補後）
2. transition to `superpowers:writing-plans` 寫 v0.1 MVP 實作 plan
3. 後續 v0.2/0.3/0.4/1.0 各自獨立 brainstorm + writing-plans

**遺留 follow-up**:
- GitHub 調研類似專案（Gemini gemini-2.5-pro server capacity 之前爆，可改 flash model 重跑）
- `gemini-rotate.sh` 該 patch：把 `MODEL_CAPACITY_EXHAUSTED`（server-side）跟 `QUOTA_EXHAUSTED`（account-side）分開處理
