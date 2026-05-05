# design-lab v0.3 — Auto-startup + Auth 統一方案

**Date**: 2026-05-05
**Status**: Design (active — Claude↔Gemini cross-review consensus，user 拍板 go)
**Owner**: Avy (nelsonjou1101@gmail.com)
**Predecessor**: `2026-05-02-design-lab-v0.2-sidecar.md`（v0.2.1 GA shipped）

## 1. Why

v0.2.1 GA 後留兩個痛點需 v0.3 解：

### 1.1 DX 痛點 #1 — sidecar 啟動麻煩
`/design` 自身不啟 sidecar（design.sh 純讀 vault md）。但 open-design fork 的 bridge skill 在 generation pre-flight 打 `GET /api/context` 抓 retrieval-scoped payload — sidecar 沒啟 = bridge fallback 到無記憶 generation = 失去 design-lab 全部價值。用戶需手動記得跑 `bash skill/scripts/sidecar-start.sh`。

### 1.2 P0 security #6 — DNS rebinding
v0.2.1 audit 找到的 P0：sidecar 只靠 `app.listen(5174, '127.0.0.1')` 限 access，但 evil.com 透過 DNS rebinding（DNS TTL 過期後解到 127.0.0.1）能讓瀏覽器在 evil.com 域名下 fetch sidecar。所有 write route（POST/PUT/DELETE）都會被攻擊者改 vault 內容。

兩痛點共解最自然 — auth token 同期解決 DX（auto-startup 順便管 token lifecycle）+ security（write route 必帶 token）。

## 2. Scope

### 2.1 v0.3 (本 spec) 包含
- **Token auth**: `~/.claude/state/design-lab/api-token`（0600，每次 cold spawn 用 `openssl rand -hex 32` 重生）
- **Auth middleware**: 所有 `/api/*` route 驗 Host header allowlist + write route 加驗 `X-Design-Lab-Token`
- **Health endpoint**: `GET /api/health`（unauthenticated，給 spawn poll）
- **Auto-spawn**: `skill/scripts/ensure-sidecar.sh`（mkdir-lock 防 race + health check + spawn + 等就緒）
- **`design.sh` self-spawn**: 開頭呼叫 `ensure-sidecar.sh`（fail soft：印 warning 繼續，design.sh 仍可純讀 vault md）
- **`sidecar-start.sh` 重構**: 委派給 `ensure-sidecar.sh`，外觀向後相容
- **Dashboard token 注入**: SSR 階段 `<meta name="design-lab-token" content="...">` + `api.ts` 統一加 header + 401 → reload 一次
- **Bridge skill spec**: 寫死 contract（讀 token path / call header / 401 retry → fallback）給 open-design fork 照寫
- **既有 supertest 改寫**: `tests/helpers/auth-headers.ts` 統一注入 token，所有 .post/.put/.delete 用 helper

### 2.2 不包含（明確 v0.4+）
- Multi-vault token 隔離
- Token rotation cron / TTL（每次 cold spawn 重生已夠）
- OAuth / JWT / RSA（single-user 過重）
- launchd / pm2 daemon manager（被限制）
- Windows 支援（macOS/Linux only）

## 3. Architecture decisions

### 3.1 Token storage
- 路徑: `${HOME}/.claude/state/design-lab/api-token`
- Perm: 0600
- Format: 64 char hex string + newline
- Lifecycle: 每次 sidecar cold spawn 重生覆寫；warm restart（PID 還活）不換
- 駁回 alternatives: vault/.index/api-token（couples vault data 與 auth）/ env var（cross-process 不可達）

### 3.2 防 DNS rebinding
**雙層防護**：

| Route 類型 | Host allowlist | Token |
|---|---|---|
| Read (GET) | ✅ 必驗 | ❌ 不驗（dashboard SSR 友善 + bridge 簡化） |
| Write (POST/PUT/DELETE) | ✅ 必驗 | ✅ 必驗 `X-Design-Lab-Token` |
| `/api/health` | ❌ 不驗 | ❌ 不驗（只回 `{status:"ok"}`） |

Host allowlist: `['127.0.0.1:5174', 'localhost:5174', 'localhost:4322']`（最後一個給 astro dev proxy）。

**Why 不對 read 也驗 token**: bridge skill 是 server-to-server 抓 context，能讀 token file；但 dashboard SSR 若 read 也驗 token，每個 page request server-side fetch 都要注 token = 過度。Read leak 風險可接受（vault 是個人設計品味，不是真正 secret）。Host allowlist 已防 DNS rebinding 主攻擊面。

**駁回**: token-only（read leak）/ CSRF double-submit（curl/CLI 不友善）。

### 3.3 Auto-spawn
- 共用 script: `skill/scripts/ensure-sidecar.sh`
- 呼叫方: `design.sh` 開頭 + `sidecar-start.sh`（後者保留 wrapper 向後相容）
- Race 防護: `mkdir $LOCK_DIR` atomic acquire；失敗端 poll health 等別人完成
- Spawn 命令對齊既有: `node --import tsx --input-type=module -e "import { startServer } ..."`（不用 ts-node）
- Token export: spawn 前 `export DESIGN_LAB_API_TOKEN=$TOKEN`，sidecar process.env 讀取
- 失敗 fallback: design.sh 接受 spawn fail → 印 warning「sidecar 啟動失敗，bridge 將 fallback to no-memory」→ 繼續純 vault 讀

### 3.4 Bridge skill contract
寫進 `docs/superpowers/specs/2026-05-05-design-lab-v0.3-auto-auth.md` §4 與 SKILL.md 章節，open-design fork 照寫：

```typescript
// pseudo-code, bridge skill 內邏輯
const tokenPath = `${process.env.HOME}/.claude/state/design-lab/api-token`;
let token: string | null = null;
try {
    token = fs.readFileSync(tokenPath, 'utf-8').trim();
} catch {
    return null;  // fallback to no-memory generation
}

let resp = await fetch(`http://127.0.0.1:5174/api/context?client=${c}&scenario=${s}`, {
    headers: { 'X-Design-Lab-Token': token }
});

if (resp.status === 401) {
    // sidecar restarted, token rotated — re-read once
    token = fs.readFileSync(tokenPath, 'utf-8').trim();
    resp = await fetch(url, { headers: { 'X-Design-Lab-Token': token } });
}

if (!resp.ok) return null;  // fallback
return await resp.json();
```

### 3.5 Dashboard token 注入
- SSR 階段: `BaseLayout.astro` 讀 `process.env.DESIGN_LAB_API_TOKEN`，render `<meta name="design-lab-token" content="...">` 到 `<head>`
- Client `api.ts`: `document.querySelector('meta[name=design-lab-token]')?.getAttribute('content')` 讀，每個 fetch 加 header
- 401 處理: `api.ts` catch 401 → `window.location.reload()`（一次，避免 loop）
- **不**放 `window.DESIGN_LAB_API_TOKEN` global（XSS 風險小但避免 anti-pattern）

## 4. Acceptance

整體 acceptance（v0.3 GA）：

1. **Auth 生效**: `curl -X POST http://127.0.0.1:5174/api/cases -H 'Content-Type: application/json' -d '{}'` 回 401（沒帶 token）；帶對 token 回 400/201（業務 layer）
2. **Host allowlist 生效**: `curl http://127.0.0.1:5174/api/clients -H 'Host: evil.com'` 回 403
3. **Auto-spawn 生效**: 無 sidecar running 時跑 `bash skill/scripts/design.sh "test"` → script 自動 spawn → 完成後 sidecar 仍在跑
4. **Race 安全**: 兩個 process 同時呼叫 `ensure-sidecar.sh` 不會雙 spawn / port conflict
5. **既有 test 全綠**: top npm test 加 auth header helper 後仍 208/208（或新加 test 後更多）
6. **Dashboard 可用**: `bash sidecar-start.sh` 開瀏覽器 → 4 page 全 work（auth header 自動注）
7. **Bridge spec 可實作**: spec §3.4 contract 完整，open-design fork 照寫能接通
8. **Fail soft**: kill sidecar 後跑 `/design` 印 warning 但完成（純 vault 讀仍可）
9. **Tests**: ensure-sidecar.sh 單元測試（fresh / stale-pid / concurrent / port-conflict）+ middleware test (4 個情境)

## 5. Out of scope (v0.3+)

- Token rotation 排程（手動 sidecar restart 已夠）
- Multi-vault token isolation
- LLM NEVER detector（原 v0.3 plan，降權到 v0.4）
- URL 截圖收 case（降權到 v0.4）
- Global Search FTS5（v0.3 後做，獨立 spec）
- Feedback log UI（v0.3 後做）

## 6. Risks

- **R1**: ensure-sidecar.sh bash race condition 細節 bug — 用 mkdir lock + concurrent test 防
- **R2**: 既有 supertest 大批改寫過程出錯 — TDD red-green 嚴守，先全 supertest 改 helper 再加 middleware
- **R3**: Dashboard token <meta> 在 SSR 階段被快取（HTTP cache）導致 token 不同步 — `Cache-Control: no-store` 在 BaseLayout 設
- **R4**: bridge skill 401 retry loop 寫錯導致無限呼叫 — spec 強制「retry 1 次後 fallback」+ 寫入 contract test
