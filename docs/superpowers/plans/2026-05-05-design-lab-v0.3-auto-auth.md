# design-lab v0.3 — Auto-startup + Auth 實作 Plan

**Date**: 2026-05-05
**Spec**: `docs/superpowers/specs/2026-05-05-design-lab-v0.3-auto-auth.md`
**Branch**: main（直接 commit per phase）

## 整體流程

每 phase 嚴格 TDD（🔴 failing test → 🟢 minimal impl → 🔵 refactor），單獨 commit + tag-able。Phase 內 dispatch Codex 實作（單次 Edit > 3 行），跑完我親自跑 cross-review (Gemini) → 0 🔴 才進下一 phase。

## Phase 0 — Test infra (auth-headers helper + supertest setup)

**Why first**: P1 加 auth middleware 會 break 既有 208 個 supertest。先把 helper 鋪好讓既有 test 一過 P1 仍綠。

### 步驟
1. 🔴 寫 `skill/sidecar/tests/helpers/auth-headers.test.ts` — 測試 `authHeaders()` helper 回傳 `{ 'X-Design-Lab-Token': '...', 'Host': '127.0.0.1:5174' }`，並驗 `process.env.DESIGN_LAB_API_TOKEN` 缺失時 throw clear error
2. 🟢 寫 `skill/sidecar/tests/helpers/auth-headers.ts` 最小實作
3. 🔵 改既有 `skill/sidecar/tests/api.test.ts` — 在每個 test 之前 set `process.env.DESIGN_LAB_API_TOKEN = 'test-token-for-supertest'`，所有 .post/.put/.delete 補 `.set(authHeaders())`，驗證所有 test 仍綠（這時 auth middleware 還沒加，所以 helper 加 header 不會影響行為）
4. 跑 `npm test` 預期 208/208 ✓

### Acceptance
- helper 自身有 test
- 既有 supertest 加 helper 後 208/208 仍綠
- tsc clean

### Commit
`test(v0.3 P0): auth-headers helper + supertest setup 鋪 P1 路`

---

## Phase 1 — Auth middleware + /api/health

### 步驟
1. 🔴 寫 `skill/sidecar/tests/middleware/auth.test.ts` — 4 個情境：
   - 無 token POST → 401
   - 錯 token POST → 401
   - 對 token POST → pass through (回 400 invalid body 或 業務 layer 結果)
   - 錯 Host header GET → 403
   - 對 Host + 對 token POST → 200/201
   - GET /api/clients 不帶 token + 對 Host → 200（read 不驗 token）
   - GET /api/health 不驗任何 → 200 `{status:"ok"}`
2. 🟢 寫 `skill/sidecar/middleware/auth.ts`：
   - `hostAllowlist`：default `['127.0.0.1:5174', 'localhost:5174', 'localhost:4322']`，可 env override `DESIGN_LAB_HOST_ALLOWLIST`
   - `requireHostAllowlist` middleware
   - `requireToken` middleware（讀 `process.env.DESIGN_LAB_API_TOKEN`，沒 set 即 throw startup error）
   - 套用 logic：health = no-auth, GET = host-only, POST/PUT/DELETE = host + token
3. 🟢 改 `skill/sidecar/server.ts`：
   - `createApp()` 開頭驗 `DESIGN_LAB_API_TOKEN` set，沒設報 fatal
   - 加 `app.get('/api/health', ...)`（在 middleware 之前，免驗）
   - 套用 `requireHostAllowlist` 全 `/api/*`
   - write route 用 `requireToken`（routes 內加 method check 或 router level mount）
4. 🔵 跑 `npm test` 預期 全綠 + 4 個新 middleware test 過

### Acceptance
- 新 middleware test 全綠
- 既有 208 supertest（含 P0 加的 helper）全綠
- 啟動時 `DESIGN_LAB_API_TOKEN` 沒設 → fatal exit

### Commit
`feat(v0.3 P1): auth middleware + /api/health endpoint`

---

## Phase 2 — ensure-sidecar.sh + design.sh self-spawn

### 步驟
1. 🔴 寫 `skill/scripts/tests/ensure-sidecar.test.sh` (bash test，用 bats 或純 bash assert)：
   - fresh start：無 PID file → spawn → token 寫到 `~/.claude/state/design-lab/api-token` (0600) → health pass → exit 0
   - already-running：PID alive + health 200 → no respawn → exit 0
   - stale PID：PID file 存在但 process 死 → 清 stale + spawn 新 → exit 0
   - port conflict：5174 被別 process 佔 → spawn fail → exit non-0 + clear msg
   - concurrent (race)：兩個並行呼叫 → 其中一個 mkdir lock 成功，另一個 poll health 等就緒 → 兩個都 exit 0 + 只有一個 sidecar
2. 🟢 寫 `skill/scripts/ensure-sidecar.sh`：
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   STATE_DIR="${HOME}/.claude/state/design-lab"
   PID_FILE="${STATE_DIR}/sidecar.pid"
   TOKEN_FILE="${STATE_DIR}/api-token"
   LOCK_DIR="${STATE_DIR}/spawn.lock"
   HEALTH_URL="http://127.0.0.1:5174/api/health"
   VAULT="${DESIGN_LAB_VAULT_PATH:-${HOME}/Documents/CC Cli/design-library}"
   SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
   LOG_FILE="${TMPDIR:-/tmp}/design-lab-sidecar.log"

   mkdir -p "$STATE_DIR"

   # Already running + healthy → done
   if [ -f "$PID_FILE" ]; then
       OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
       if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null \
          && curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
           exit 0
       fi
       rm -f "$PID_FILE"
   fi

   # Try acquire lock; if fail, poll health (someone else is spawning)
   if ! mkdir "$LOCK_DIR" 2>/dev/null; then
       for i in $(seq 1 30); do
           if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
               exit 0
           fi
           sleep 0.5
       done
       echo "ensure-sidecar: timeout waiting for concurrent spawn" >&2
       exit 1
   fi
   trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

   # Generate token + spawn
   TOKEN=$(openssl rand -hex 32)
   umask 077
   echo "$TOKEN" > "$TOKEN_FILE"
   chmod 600 "$TOKEN_FILE"

   DESIGN_LAB_VAULT_PATH="$VAULT" DESIGN_LAB_API_TOKEN="$TOKEN" \
   nohup node --import tsx --input-type=module -e "
       import { startServer } from '$SKILL_DIR/sidecar/server.ts';
       startServer(5174, '127.0.0.1').catch(err => { console.error(err); process.exit(1); });
   " > "$LOG_FILE" 2>&1 &
   SIDECAR_PID=$!
   echo "$SIDECAR_PID" > "$PID_FILE"

   # Poll health
   for i in $(seq 1 20); do
       if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
           exit 0
       fi
       sleep 0.5
   done
   echo "ensure-sidecar: spawn timeout (10s); see $LOG_FILE" >&2
   exit 1
   ```
3. 🟢 改 `skill/scripts/sidecar-start.sh` — 替換內部 spawn 邏輯為 `bash "${SKILL_DIR}/scripts/ensure-sidecar.sh"`，保留外觀（印 URL / open 行為），向後相容
4. 🟢 改 `skill/scripts/design.sh` — 開頭加 `bash "${SKILL_DIR}/scripts/ensure-sidecar.sh" || echo "[design] sidecar 啟動失敗，bridge 將 fallback to no-memory" >&2`（fail soft）
5. 🔵 手動 smoke test：
   - kill -9 任何 sidecar → `bash design.sh "test"` → token file 出現 + sidecar 跑 + design.sh 完成
   - 兩 terminal 同時 `bash ensure-sidecar.sh` → 只有 1 sidecar

### Acceptance
- ensure-sidecar.test.sh 5 情境全過
- design.sh 自動 spawn + 手動 smoke 通
- sidecar-start.sh 行為向後相容（PID file / URL print / 重複呼叫 no-op）

### Commit
`feat(v0.3 P2): ensure-sidecar.sh auto-spawn + design.sh self-check`

---

## Phase 3 — Dashboard token + bridge skill spec

### 步驟
1. 🔴 寫 `skill/dashboard/tests/components/api-auth.test.ts` (vitest)：
   - `authFetch()` 從 `<meta name=design-lab-token>` 讀 token，加 `X-Design-Lab-Token` header
   - 401 → `window.location.reload()` 一次（且不 loop）
2. 🟢 改 `skill/dashboard/src/lib/api.ts` — 加 `authFetch()` wrapper，所有 fetch 改用它；401 處理 + reload guard（用 sessionStorage 防止無限 reload）
3. 🟢 改 `skill/dashboard/src/layouts/BaseLayout.astro`：
   - SSR 階段 `const token = process.env.DESIGN_LAB_API_TOKEN ?? ''`
   - render `<meta name="design-lab-token" content={token}>` 到 `<head>`
   - 加 `<meta http-equiv="Cache-Control" content="no-store">` 防快取
4. 🟢 寫 bridge spec section in `docs/superpowers/specs/2026-05-05-design-lab-v0.3-auto-auth.md` §4（spec 內已含 §3.4 contract，這 phase 只補完整 SKILL.md 段落 + 範例 fork bridge 路徑說明）
5. 🔵 手動 smoke：開 dashboard → DevTools Network 看每 request 帶 X-Design-Lab-Token + Cache-Control: no-store

### Acceptance
- dashboard 4 page 全 work
- 401 reload 邏輯不無限循環（測試：手動 kill sidecar → reload page → spawn 新 → 拿新 token → ok）
- bridge contract 章節 self-contained 可讓 user 在 fork 照寫

### Commit
`feat(v0.3 P3): dashboard token meta + bridge skill spec contract`

---

## Phase 4 — Docs + dev proxy

### 步驟
1. 改 `skill/SKILL.md` — `啟動 hook` 章節改為自動 spawn 描述；`/design` 行為加「自動 self-check + spawn sidecar」；`/design-dashboard` 行為不變但說明改為「sidecar-start.sh 內部委派」
2. 改 `skill/dashboard/astro.config.mjs` — dev mode proxy 從 token file 讀 token 注入 `X-Design-Lab-Token`（讓 `npm run dev` 工作流可用）
3. 改 `.remember/remember.md` — v0.3 progress + 下次 session 提示
4. 跑全 test 一次（top + dashboard） + tsc + astro check：208+ / 19+ / 0 / clean
5. 跑 `/destructive-qa`（CLAUDE.md 鐵律 — 全功能完成必跑）

### Acceptance
- SKILL.md 與實作行為一致
- `cd skill/dashboard && npm run dev` 仍可用 :4322 → :5174 proxy
- 全 test 綠 / tsc clean / astro check 0
- destructive-qa 0 P0/P1

### Commit
`docs(v0.3 P4): SKILL.md + astro dev proxy + handoff`
+ `git tag v0.3.0`

---

## Cross-review per phase

每 phase commit 前必跑：
```bash
gemini-rotate -p "Review skill/.../<file> uncommitted diff per spec docs/superpowers/specs/2026-05-05-design-lab-v0.3-auto-auth.md acceptance" --approval-mode plan
```
找到 🔴 → 修 → 重 review。0 🔴 才 commit。

## 自我審查 4 項（per phase）

1. 資安：注入 / 路徑洩漏 / token 寫到非 0600 / unauth path bypass
2. TS strict：no any / null check / proper types
3. 錯誤處理：spawn fail / token missing / port conflict 都有 user-friendly msg
4. 文字：所有 user-visible string 用中文（既有 convention）

## 風險

- ensure-sidecar.sh 的 bash race 在 macOS 跟 Linux 行為可能不同 — 用 mkdir atomic 是 POSIX 標準
- bash test framework：先試純 bash assert + temp dir；若太脆弱再考慮 bats

## 預估時間

- P0 ~30 min（test infra + 既有 test 改 helper）
- P1 ~45 min（middleware + test）
- P2 ~60 min（ensure-sidecar 跟 bash test）
- P3 ~45 min（dashboard meta + api.ts wrapper + bridge spec）
- P4 ~30 min（docs + dev proxy + smoke）

合計 ~3.5h dispatch + cross-review。
