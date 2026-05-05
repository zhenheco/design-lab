# Handoff (2026-05-05 — v0.3 真 GA 完成)

## State：v0.3 真 GA shipped + bridge fork 已串通

design-lab v0.3 Auto-startup + Auth 已完成、`v0.3.0` tag 已建（指向 P4 `8ff874e`）、open-design fork 內 `design-memory-bridge` skill 已 commit + smoke 通過。

已 ship commits：

| Commit | Phase | What |
|---|---|---|
| `91fe356` | P0 | auth-headers helper + supertest setup |
| `33a41d4` | P1 | auth middleware + `/api/health` |
| `67ac997` | P2 | `ensure-sidecar.sh` auto-spawn + `design.sh` self-check |
| `4a52978` | P3 | dashboard token meta + bridge skill spec contract |
| `<pending P4>` | P4 | SKILL.md + Astro dev proxy + handoff |

## v0.3 deliverables

- Token auth：cold spawn 自動產生 token，寫 `$HOME/.claude/state/design-lab/api-token`，0600 permissions，每次 cold spawn rotate。
- Auth middleware：Host allowlist case-insensitive；write route token auth 使用 timing-safe compare。
- `/api/health` no-auth，供 ensure/poll/dev smoke 使用。
- `ensure-sidecar.sh`：PID-aware health check、stale PID cleanup、atomic lock、dashboard build check、6 case test。
- `design.sh`：schema check 後 fail-soft self-spawn sidecar，spawn fail 不阻塞 design。
- `sidecar-start.sh`：委派 `ensure-sidecar.sh`，保留舊入口與 URL/PID/log output。
- Dashboard auth：SSR meta token、isomorphic `authFetch`、CSR fetch 自動帶 token、401 reload-once、200 clear reload flag。
- Bridge skill spec：§3.4 bridge contract + §4.1 `design-memory-bridge` SKILL.md template，要求 fork bridge 讀 token、401 retry once、never print token。
- Astro dev proxy：`npm run dev` 的 SSR process 從 token file 補 `DESIGN_LAB_API_TOKEN`，Vite proxy forward `/api` 時注入 `X-Design-Lab-Token`。

## 驗收狀態

- Top-level `npm test`：229 pass，0 fail。
- Dashboard `npm test`：24 pass，包含 `astro check` 0 errors / 0 warnings / 0 hints。
- `npx tsc --noEmit`：clean。
- Dashboard `npm run build`：pass。
- Manual smoke：fresh ensure-sidecar、401 no-token、400 with token、403 forbidden host、sidecar-stop 全 pass。

## v0.4 backlog

v0.3 原 backlog 中尚未 ship 的項目降權到 v0.4：

- Global Search FTS5。
- Feedback log UI。
- Default allowlist 移除 tmpdir 等 v0.2.1 handoff 留下的次要項。
- Auto-distill / LLM NEVER detector。
- URL screenshot 收 case。

## v0.4 Roadmap（不變）

1. Cloud sidecar prototype（Cloud Run / Fly.io）— SaaS path 第一步。
2. Multi-vault 切換。
3. Case export/import zip。

## Bridge fork 整合（2026-05-05 收尾）

- open-design fork commit `101f2d3` (`feat(skills): add design-memory-bridge for design-lab sidecar`)：
  - `skills/design-memory-bridge/SKILL.md`（98 行，agent manifest，純 Claude Code base format，無 fork `od:` 擴展）
  - `skills/design-memory-bridge/lib/design-lab-context.ts`（74 行，TypeScript helper，verbatim from spec §3.4）
- 兩檔皆 verbatim from spec，Gemini review PASS（無 P0/P1）。
- 6/6 smoke 通過（從 fork cwd 跑 helper）：
  1. happy `/api/context` → 完整 payload (`client, styleGuide, scenarioOverride, cases, antiCases, neverRules, retrievedFrom`)
  2. unknown client → 仍回 payload（sidecar 預設行為）
  3. `buildGenerationPrompt` 注入 context（length 1027）
  4. corrupt token → 200（spec §3.2 GET 不驗 token，行為符合）
  5. token file missing → null fail-soft
  6. `DESIGN_LAB_SIDECAR_URL=http://127.0.0.1:1` → null fail-soft
- 直接 curl 對照 spec §3.2：GET 三種 token (none/bad/ok) 全 200；POST no/bad token 401；evil Host 403。

## 已知非 bug（不需修）

- spec §3.4 (.ts) 用 `token.length > 0 ? token : null`、§4.1 (SKILL.md template) 用 `token || null`，兩處本身就有差異，verbatim 保留。
- bridge skill 在 fork mode picker 會被 daemon `od.mode` zero-config fallback 為 "prototype"，但因無 `preview.entry`，picker 行為待 fork daemon 實測。本 v0.3 不處理（不是 user-facing artifact skill）。

## Active spec / plan

- `docs/superpowers/specs/2026-05-05-design-lab-v0.3-auto-auth.md`
- `docs/superpowers/plans/2026-05-05-design-lab-v0.3-auto-auth.md`

## Next session

v0.3 真 GA 已封板（design-lab + open-design bridge 都 ship）。下一動作：

1. 開 v0.4：建議先做 Global Search FTS5 或 Feedback log UI。
2. Cloud sidecar prototype（v0.4 roadmap #1，SaaS path 起點）— 需獨立 spec。
3. Auto-distill / LLM NEVER detector、URL screenshot 收 case 維持次順位。

design-lab repo 無 remote `origin`，純本地。`v0.3.0` tag 已存在於本地。如要備份建議 push 到私 GitHub。
