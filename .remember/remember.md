# Handoff (2026-05-05 — v0.3 GA 收尾)

## State：v0.3 GA shipped，等待手動 tag

design-lab v0.3 Auto-startup + Auth 已完成。`v0.3.0` tag 待 Avy 手動建立。

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

## 未驗證 / 待用戶手動

- open-design fork 內 `design-memory-bridge` skill 尚未手動建立。需按 `docs/superpowers/specs/2026-05-05-design-lab-v0.3-auto-auth.md` §4.1 template 寫入 fork。
- 真實 bridge smoke 尚未做：`/design` auto-spawn 後，open-design fork bridge 讀 `$HOME/.claude/state/design-lab/api-token` 並帶 `X-Design-Lab-Token` 呼叫 `/api/context`。

## Active spec / plan

- `docs/superpowers/specs/2026-05-05-design-lab-v0.3-auto-auth.md`
- `docs/superpowers/plans/2026-05-05-design-lab-v0.3-auto-auth.md`

## Next session

1. 確認 P4 commit 已在 main。
2. Avy 手動 tag：

```bash
git tag v0.3.0
git push origin v0.3.0
```

3. 若開始 v0.4，建議先做 Global Search FTS5 或 Feedback log UI；Auto-distill / LLM NEVER detector、URL screenshot 收 case 維持次順位。
