# design-lab v0.1 Handoff（2026-05-02）

> 給下個 session 的接續指南。第一個動作：跑 `bash ~/.claude/skills/design-lab/scripts/stats.sh` 看 vault 狀態。

## 狀態總結

✅ **v0.1 MVP 完整交付**：12 commit / tag `v0.1.0` / 24 tests pass / `~/.claude/skills/design-lab` symlink 已部署。

| 階段 | 狀態 | 產出 |
|---|---|---|
| Brainstorm | ✅ | 9 題澄清 + 5 段 design + 命名 design-lab |
| Spec | ✅ | `docs/superpowers/specs/2026-05-02-design-lab-design.md`（12 節、含 Gemini cross-review 4 處修補） |
| Plan | ✅ | `docs/superpowers/plans/2026-05-02-design-lab-v0.1.md`（11 task / 62 step / 1700 行） |
| Implementation | ✅ | 6 phase Codex dispatch（A 失敗自接、B 抓 plan bug 修補、C-F 完美） |
| Deploy | ✅ | `~/.claude/skills/design-lab` → repo symlink |
| Memory | ✅ | 3 檔記憶（knowledge-base/nodejs-esm-testing-quirks + experience/skill-codex-agent + skill-gemini-agent）+ 索引同步 |

## 下次 session 該繼續的事（按優先順序）

### 1. 🟢 Dogfood v0.1（最重要，等用戶實作）

當前 vault 狀態：**未初始化**。下次 session 第一個動作：

```bash
# 1. Init vault
bash ~/.claude/skills/design-lab/scripts/init-library.sh "$HOME/Documents/CC Cli/design-library"

# 2. 編 NEVER 規則（必要 — design lint 才有東西可掃）
open "$HOME/Documents/CC Cli/design-library/personal-style-guide.md"
# 加 5 條 NEVER（no-pure-black / no-gradient / no-elevated-card / no-serif-body 等）

# 3. 收集 5-10 個喜歡的設計（每張 1 分鐘）
bash ~/.claude/skills/design-lab/scripts/collect.sh /path/to/design.png
# 配合 Claude 看圖抽 tokens 給 stdin

# 4. 試跑 /design
bash ~/.claude/skills/design-lab/scripts/design.sh "做 aicycle.cc landing page"
```

詳細 Step-by-step 在 SKILL.md 跟我前一輪回的「怎麼用」訊息（catchup 可以看 daily-records）。

### 2. 🟡 GitHub 調研類似專案（Brainstorm 階段沒做完）

Brainstorm 第 0 題用戶要求「先到 GitHub 上看有沒有類似的」，但 Gemini `gemini-2.5-pro` server capacity 之前爆失敗。**現在已知用 flash model 可以**：

```bash
bash "$HOME/.claude/skills/gemini-agent/scripts/gemini-rotate.sh" \
    -m gemini-2.5-flash \
    -p "$(cat /tmp/gemini-design-system-research.txt)" \
    --approval-mode plan > /tmp/gemini-design-research-result.txt 2>&1
```

prompt 檔還在：`/tmp/gemini-design-system-research.txt`（如果被清，從 brainstorm 對話 reconstitute）。
**意義**：補上 brainstorm 階段該有的市場 reference（v0.1 已 ship 不會回頭改 spec，但對 v0.2 規劃有幫助）。

### 3. 🟡 `gemini-rotate.sh` patch（避免再被 server capacity 誤判）

現有 script 把 `MODEL_CAPACITY_EXHAUSTED`（server-side）誤當成 `QUOTA_EXHAUSTED`（account-side）處理 → 連續 6 個帳號跑同一滿載 model 都失敗。

**修法**（已記錄在 `experience/skill-gemini-agent.md`）：
- 解析 stderr `reason` 欄位
- `MODEL_CAPACITY_EXHAUSTED` → 自動換 model（pro → flash），不換帳號
- `rateLimitExceeded` 無 MODEL_CAPACITY_EXHAUSTED → 換帳號
- `AUTH_FAILURE` → 換帳號 + mark stale

涉及檔：`~/.claude/skills/gemini-agent/scripts/gemini-rotate.sh` 第 195-200 行附近的 `is_capacity_error` / `is_auth_failure` / `needs_rotate` function。

### 4. 🔵 v0.2 brainstorm（dogfood 6 週後）

按 spec 第 8 節，v0.2 該 cover：
- Playwright URL 自動截圖
- Hook keyword pre-filter + candidates 候選池
- LLM detector for NEVER

**先別開始** — 等 v0.1 dogfood 累積 30+ case，根據實際痛點調整 v0.2 scope。

## 關鍵 context（下次 session 必看）

### Codex dispatch 經驗
- **嚴格 sequential**：prompt 必須明示「STRICT SEQUENTIAL」+「禁止並行涉及 file lock 的 commands」。Phase A 沒寫，Codex 把 git config 並行跑造成 lock conflict 失敗。
- 每次 dispatch 加 environment quirks section（已知坑）給 Codex 預先警告
- Plan 含 human-in-the-loop step 要明示「跳過 step X」

### Gemini 使用經驗
- 預設 `gemini-2.5-pro` 在熱門時段會 server capacity 爆（**不是**帳號 quota）
- 大量 prompt 用 `-m gemini-2.5-flash` 比較穩
- 6 個 rotate 帳號全失敗 ≠ 帳號爆，第一反應該檢查 server-side（MODEL_CAPACITY_EXHAUSTED）

### Plan 級 bug（已修補進 plan，但下次寫類似 plan 注意）
1. macOS 含空格路徑 → `new URL(...).pathname` 會 url-encode，要用 `fileURLToPath()`
2. ESM module 不能 `require()`，要 `import`
3. Node 25 `node --test` 不吃 directory 模式，要 glob `"*.test.js"`

詳見 `~/.claude/skills/auto-skill/knowledge-base/nodejs-esm-testing-quirks.md`。

## 檔案地圖

```
<repo-root>/   ← 本 repo
├── docs/superpowers/
│   ├── HANDOFF.md                                  # 本檔
│   ├── specs/2026-05-02-design-lab-design.md       # spec（12 節）
│   └── plans/2026-05-02-design-lab-v0.1.md         # plan（已 done）
├── skill/                                          # 實際 skill 程式碼
│   ├── SKILL.md
│   ├── scripts/        # 8 個 sh
│   ├── lib/            # 7 個 js
│   ├── tests/          # 8 個 test 檔（24 tests）
│   ├── templates/
│   └── migrations/
├── package.json
├── deploy.sh
└── .git/

~/.claude/skills/design-lab → <repo-root>/skill   # symlink
~/Documents/CC Cli/design-library/                       # vault（待 init）
~/.claude/skills/auto-skill/
├── knowledge-base/nodejs-esm-testing-quirks.md         # 新增
└── experience/
    ├── skill-codex-agent.md                            # 新增
    └── skill-gemini-agent.md                           # 新增
```

## 開新 session 第一句

建議：

> 「Catchup design-lab 進度，看 docs/superpowers/HANDOFF.md。下一步我要 [init vault / 收第 1 張 case / 跑 GitHub 調研 / patch gemini-rotate]」

或更短：

> 「/catchup design-lab，繼續 dogfood」
