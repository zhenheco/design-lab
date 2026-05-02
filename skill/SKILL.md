---
name: design-lab
description: 個人化品牌設計系統 skill — 跨場景（landing / SaaS UI / brand / content）累積你喜歡/不喜歡的設計、自動演化「Avy 設計法則」、設計時自動 retrieve 相關個案 + lint NEVER 規則。v0.1 MVP：4 commands 有最小可用功能 + 1 stub。Memory 在 ~/Documents/CC Cli/design-library/。
version: 0.1.0
---

# design-lab v0.1 MVP

個人化品牌設計系統。Memory 庫位置：`~/Documents/CC Cli/design-library/`（Obsidian vault 內）。

## 啟動 hook

每個 slash command 第一個動作都跑 schema check：

```bash
bash $SKILL_DIR/scripts/check-schema.sh "$HOME/Documents/CC Cli/design-library"
```

退出碼 2 = 提示用戶跑 migration；退出碼 1 = 致命錯誤；退出碼 0 = 繼續。

如 vault 不存在，先跑 `bash $SKILL_DIR/scripts/init-library.sh "$HOME/Documents/CC Cli/design-library"` 初始化。

## Slash Commands

### `/design <task description>` — 主入口

**做什麼**：根據任務描述，從個案庫抽相似 case，綜合 personal-style-guide 規則層，產出 design。

執行流程（v0.1 簡化版）:
1. 跑 `scripts/design.sh "<task description>"`，腳本會:
   - LLM judge 場景（landing / saas-ui / brand / content）
   - 載入 `personal-style-guide.md` + `scenario-overrides/<scenario>.md`
   - 把 vault `cases/*.md` 全部 frontmatter 摘要餵 Claude，挑 top 5 相似案
   - **如果 case_count < 50**：呼叫內部 fallback `read-starter-pool.sh`（從 `~/.claude/skills/ui-ux-pro-max/SKILL.md` 抽 starter，標明為 starter pool）
   - 產出 design markdown（依場景 template）
   - 跑 `scripts/lint.sh` 對 design 中的 css/html 跑 NEVER regex check
   - 顯示 design + rationale + reference 個案 wiki link

### `/design-collect [image-path]` — 收藏個案（v0.1 只支援檔案上傳）

**做什麼**：把一張圖收進 cases/ 或 anti-library/。

執行流程：
1. 跑 `scripts/collect.sh <image-path>`
2. 腳本把圖讀入後 → vision LLM 看圖抽 design tokens（palette、typography、spacing 等）
3. 互動 minimal mode 問用戶:
   - sentiment: positive | negative
   - 1 句 quote「為什麼喜歡 / 不喜歡」
   - scenario: landing | saas-ui | brand | content（自動偵測，按 Enter 接受）
4. 寫 `cases/<slug>.md`（positive）或 `anti-library/<slug>.md`（negative），含 frontmatter（schema_version=1）+ embed 截圖
5. URL 自動截圖路徑 v0.2 才上（請用戶手動截圖丟進來）

### `/design-feedback [optional: target]` — 對 design 給回饋

**做什麼**：寫 feedback log（JSONL）+ 必要時 commit case 進 library。

執行流程：
1. 跑 `scripts/feedback.sh "<feedback text>"`
2. LLM 解析 feedback：sentiment / dimension / quote / target
3. 寫 `~/Documents/CC Cli/design-library/feedback-log.jsonl`（v0.2 才搬到 SQLite）
4. positive + 用戶明說「存進去」→ 觸發 collect 流程把當下 design 寫進 cases/
5. negative + 用戶明說「不要」→ 寫 anti-library/
6. v0.1 不做 hook 自動偵測語氣（v0.2 才上）

### `/design-stats` — 看 library 狀態

**做什麼**：顯示基礎報表（case count、scenario 分布、最近收藏）。

執行流程：跑 `scripts/stats.sh`。

### `/design-distill` — STUB（v0.1 不實作）

**做什麼**：v0.1 只顯示提示文字。

執行流程：跑 `scripts/distill.sh`，會印:
```
[design-lab v0.1] /design-distill 在 v0.3 自動化。
目前請手動編輯 ~/Documents/CC Cli/design-library/personal-style-guide.md
（DO / NEVER / SOMETIMES 三段直接編輯）。
```

## 環境變數

- `DESIGN_LAB_VAULT_PATH`：default `$HOME/Documents/CC Cli/design-library`
- `DESIGN_LAB_STATE_PATH`：default `$HOME/.claude/state/design-lab/`（last-artifact.txt 等 transient state）

## v0.1 已知限制

- 不支援 URL 自動截圖（v0.2）
- 不支援 hook 自動偵測語氣 → candidates pending review（v0.2）
- 不支援 LLM detector for NEVER（只 regex）（v0.2）
- 不支援自動 distill（v0.3）
- 不支援 SQLite 索引（純 markdown grep + LLM 挑）（v0.2）
