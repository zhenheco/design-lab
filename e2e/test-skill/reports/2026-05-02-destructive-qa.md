# /destructive-qa 報告 — design-lab (backend CLI adaptation)

**日期**: 2026-05-02
**Repo**: `<repo-root>`
**HEAD**: `b3ef026` (Phase α complete + β1)
**Skill adaptation**: 原 destructive-qa 是 web/API 取向（Chrome MCP + curl + 注入），design-lab 是 CLI skill → 改套 M1-M4 meta-pattern 到 backend：**vault input 不可信、path 注入、symlink 攻擊、race condition、partial fail consistency**

---

## 攻擊向量 + 結果

| # | Attack | M-Pattern | 結果 | 嚴重度 |
|---|---|---|---|---|
| 1 | Path traversal: vault arg = `../../../tmp/PWNED` | M1 (input 不可信) | mkdir -p 直接建到任意 path | 🟡 caller 責任 |
| 2 | Symlink case file → /etc/hosts | M1 + M3 邊界 | case-loader.ts 跟隨 symlink，返回 metadata（不含 raw content）；mdPath 暴露給 caller | 🟡 medium (depends on caller) |
| 3 | **Race: 兩個 migrate 同時跑** | M3 邊界 + M4 defense in depth | A 完成、B 因 backup TS 同秒 collision (cp `File exists`) silent fail；**無 lock 機制** | 🔴 BLOCKING |
| 4 | Vault is symlink | M1 邊界 | backup 建在 symlink parent，行為合理 | ✅ |
| 5 | YAML injection: `slug: "evil\\ninjected: pwn"` | M1 input 不可信 | `\\n` 字面字串不展開 → awk 處理正常 | ✅ |
| 6 | Partial migration kill mid-flight | M3 邊界 | migrate 速度快過 sleep+kill；再跑 idempotent skip 恢復 | ✅ |
| 7 | Read-only case file (chmod 444) | M3 邊界 | mv + awk rewrite via tmp file 不需 source write perm → migrate 仍成功 | ✅ |
| 8 | NULL byte in vault arg | M1 input | bash `${1:?usage}` 觸發 usage error，未進 mkdir | ✅ |
| 9 | **migrate `/tmp` (system path) as vault** | M1 + M3 + M4 | `cp -R /tmp /tmp.v1-backup-...` 試圖複製整個 /tmp，**會塞滿磁碟**（被 timeout 救） | 🔴 CRITICAL |
| 10 | 100 cases stress | M3 | （未跑完，attack 9 timeout 後跳過） | n/a |

---

## 🔴 BLOCKING #1: 無 vault path validation → 磁碟 DoS

**Reproduce**:
```bash
bash skill/scripts/migrate-v1-to-v2.sh /tmp     # 試圖 cp -R /tmp /tmp.v1-backup-...
bash skill/scripts/migrate-v1-to-v2.sh "$HOME"  # 同樣 cp 整個 home
bash skill/scripts/migrate-v1-to-v2.sh /        # 試圖 cp -R / /.v1-backup-... → 死掉
```

**Root cause**: `migrate-v1-to-v2.sh` 只驗 `[ -d "$VAULT" ]`，沒驗「這看起來像 design-lab vault」。任何目錄都會被當 vault 處理 → cp -R 整個目錄樹 backup → 磁碟塞爆。

**Fix（建議）**: 在 migrate 開頭加 vault sanity check：
```bash
# 必須長得像 design-lab vault（含特徵檔/目錄至少一個）
if [ ! -f "$VAULT_ABS/personal-style-guide.md" ] && \
   [ ! -d "$VAULT_ABS/cases" ] && \
   [ ! -d "$VAULT_ABS/clients" ]; then
    echo "ERROR: $VAULT does not look like a design-lab vault" >&2
    echo "Expected at least one of: personal-style-guide.md, cases/, clients/" >&2
    exit 1
fi
```

**對 init-library.sh 同樣建議加**（避免 user 在錯誤路徑誤建空 design-lab 結構，浪費 inode）。

---

## 🔴 BLOCKING #2: Concurrent migrate race condition

**Reproduce**:
```bash
# Same vault, two parallel migrations
( bash skill/scripts/migrate-v1-to-v2.sh "$VAULT" ) & \
( bash skill/scripts/migrate-v1-to-v2.sh "$VAULT" ) & wait
# Result: A succeeds, B fails with `cp: ...: File exists`
```

**Root cause**:
1. backup naming `<vault>.v1-backup-$(date +%Y%m%d-%H%M%S)` — 同秒兩個 instance 會撞名
2. 沒 lock 機制 — 兩個 instance 同時跑 mv，會 race（A 已搬走檔案 B 找不到）
3. backup TS collision 時 macOS `cp -R` 預設不覆蓋 → exit 1，但 A 已 in-flight。最終 vault state 取決於 A/B 哪個贏

**潛在後果**:
- B 看到 cp fail 早期 abort → vault 仍是 v1 partial（被 A 處理）→ user 困惑
- 如果改 cp -Rf 互相覆蓋 → backup corruption，用戶 rollback 失敗

**Fix（建議）**: 使用 atomic mkdir lock：
```bash
LOCK_DIR="$VAULT_ABS/.migration.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "ERROR: another migration in progress (lock: $LOCK_DIR)" >&2
    echo "If migration crashed previously, manually remove: rmdir $LOCK_DIR" >&2
    exit 1
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT
```

`mkdir` 是 POSIX atomic（不像 `touch` + content 寫入有 race window）。trap EXIT 確保 normal/abnormal exit 都釋放 lock。

---

## 🟡 NICE-TO-HAVE 觀察

### 1. Symlink case file 沒檢查（Attack 2）

`case-loader.ts` `readFileSync` 跟隨 symlink → 讀 `/etc/hosts` 內容當 markdown parse → matter() 回 `{ data: {}, content: 'file content...' }`。返回 metadata 含 mdPath 指向 vault 內 symlink。

**目前風險**: 低 — case-loader 只回 metadata（slug/scenario/sentiment/tokens/mdPath），不回 raw content。但 caller 拿 mdPath 自己 readFileSync 會讀到 /etc/hosts 內容。

**Sidecar (Phase γ) API 風險**: `/api/cases` 回的 mdPath 給 dashboard，dashboard `fs.readFile(mdPath)` 會洩漏 /etc/hosts。需 sidecar API 層加 path containment check。

**Fix（v0.4 sidecar）**: case-loader 內 `realpath(mdPath).startsWith(realpath(vault))` 檢查；或讀 file 後返回 absolute resolved path。

### 2. Path traversal in init-library（Attack 1）

`init-library.sh` 用 `mkdir -p` 對相對 / traversal path 不驗證，會建到任意 path。但這是 user 主動帶的 arg，**符合 mkdir -p 慣例**，不算漏洞。

**Fix**: 跟 BLOCKING #1 同步驗 vault path 看起來合理（不是系統路徑、不是空字串、abs 化後 contained 在合理區）。

---

## 採用的 Meta-Pattern

| 跟原 destructive-qa skill 對應 | Backend CLI adaptation |
|---|---|
| **M1 客戶端輸入不可信** | **vault input 不可信** — vault arg / frontmatter / meta.yaml / symlink target |
| **M2 字串匹配陷阱** | **path 匹配陷阱** — `/etc/hosts` ≠ `cases/0001.md`，但 case-loader 不分 |
| **M3 邊界 case > happy path** | **vault state 邊界** — race / partial / read-only / corrupt frontmatter |
| **M4 Defense in depth** | **filesystem layer + script 內部 + test 各層都驗** — backup trap + awk END + lock + path sanity |

---

## ⏭️ 建議行動項（按優先序）

| 優先 | 項目 | 範圍 | 估時 |
|---|---|---|---|
| **P0** | 補 vault path sanity check（migrate + init） | `skill/scripts/migrate-v1-to-v2.sh` + `init-library.sh` | 0.5 hr |
| **P0** | 補 atomic mkdir lock（migrate） | `skill/scripts/migrate-v1-to-v2.sh` | 0.5 hr |
| **P1** | 補對應 test（path validation + lock collision） | `skill/tests/migration.test.ts` | 1 hr |
| **P2** | sidecar API (γ phase) 加 mdPath path containment check | `skill/sidecar/routes/cases.ts` (γ phase) | 後做 |
| **P3** | symlink case file 直接 reject in case-loader | `skill/lib/case-loader.ts` | 0.5 hr |

**P0 修法可作為 α 收尾的 hotfix commit**（在進 β2 之前），或合併到 β phase 開頭。建議**現在就做**：兩條都是 prod-time data integrity 風險（race 跟磁碟 DoS），不該帶到 β phase 新功能。

---

## 📂 報告檔案

- 本檔: `e2e/test-skill/reports/2026-05-02-destructive-qa.md`
- /test 報告: `e2e/test-skill/reports/2026-05-02-explore.md`
- 攻擊腳本: 已 inline 在本報告（reproduce 命令）；tmp 已清

---

**結論**: backend CLI 一樣有 destructive-qa 價值。M1-M4 meta-pattern 對 web 跟 backend 都適用，只是 attack vector 從 HTTP/API 變成 vault path / filesystem / race。發現 2 個真 BLOCKING + 2 個 nice-to-have。
