# Design Lab Backlog

## ✅ 2026-06-02 🟡 sweep — ALL resolved (UAT 32/32 green, 296 unit pass, npm audit 0)

All open v0.4 🟡 closed in one hardening pass (2 Codex TDD batches + 1 security fix; cavecrew-reviewer cross-review caught a host-allowlist bypass, empirically confirmed + fixed). main `f66501b`.

- ✅ **#2 Unbounded file read:** `readOptionalFile` (`context.ts`) now caps at `MAX_CONTEXT_FILE_BYTES = 256KB` (statSync; >cap reads first cap bytes + `<!-- truncated -->` marker). `4131867`.
- ✅ **#3 npm audit (qs DoS):** `npm audit fix` (no --force) → qs 6.15.2 / express 4.22.2, **0 vulnerabilities**. `6e526a5`.
- ✅ **#4 MCP Host fixed value:** `sidecar-client.ts` derives `Host` from the configured sidecar URL; `auth.ts` host-allowlist now accepts any **loopback hostname** (127.0.0.1/localhost/::1) on **any port** while rejecting non-loopback hosts (DNS-rebinding defense preserved). `b119c78`.
- ✅ **#4b host-allowlist userinfo bypass** (found in cross-review): `new URL('http://evil.com@127.0.0.1').hostname === '127.0.0.1'` let `Host: evil.com@127.0.0.1:5174` pass `isLoopbackHost`. Fixed: reject any Host containing `@` (RFC 7230 forbids userinfo in Host). `f66501b`. UAT confirms evil.com / evil.com@127.0.0.1 / user:pass@127.0.0.1 → 403 on guarded routes.
- ✅ **#5 launchd reinstall race:** `launchd-install.sh` waits for bootout to settle (poll `launchctl print`) then retries bootstrap ≤5× (treats "already loaded" as success). UAT: install ×2 back-to-back, no I/O error. `7bedef0`.
- ✅ **#6 /design fallback fragility:** `design.sh` `render_fallback` guards `cat personal-style-guide.md` + makes case-loader non-fatal → sidecar-down + missing vault file still prints INSTRUCTIONS and exits 0. `3cedd6e`.
- ✅ **#7 URL capture SSRF DNS depth:** `assertPublicHost` DNS-resolves hostnames and blocks any resolving to a private/loopback address (literal-IP / allowPrivate skip lookup). Injectable lookup for tests. `8e840a7`. (Residual TOCTOU between resolve and Playwright re-resolve is the documented local-threat-model limit.)
- ✅ **#8 distill re-proposal noise:** `/api/distill/:brand` + `aggregateDistill` now return `existingNeverRuleIds` (global+brand rule ids) so Hermes dedups inline. `d04c8e6`. **Full "distilled watermark" on cases stays deferred per ADR-0005** (zero cases exist yet, no observed noise — YAGNI).
- ✅ **#9 feedback verdict heuristic:** explicit `verdict?: 'like'|'dislike'` on `FeedbackEntry` + feedback route (400 on invalid) + `add_feedback` MCP schema; `aggregateDistill` uses `entry.verdict ?? verdictFromSignal(signal)`. Keyword fallback retained for unstructured feedback. `8d9ebde`.
- ✅ **Test isolation (Phase 0a 🟡):** already resolved in Phase 2a (serialized env-mutating api.test.ts + isolated ensure-sidecar port test).

## Infra (resolved)

- ✅ **node26 × better-sqlite3:** Homebrew default node v26 could not gyp-build better-sqlite3@11.10.0 (V8 API errors) → sidecar/full-suite broke on node26. Fixed by bumping to better-sqlite3@12.10.0 (prebuilt binaries, gyp-free). `engines: >=20` is fine with 12.x.
- ✅ **ensure-sidecar rotated the launchd daemon's token:** the early-skip only fired when `sidecar.pid` existed, but the launchd daemon doesn't write it, so every `/design` run rotated the api-token + broke the daemon's write-auth (writes → 401). Fixed (`2ae16ce`): ensure-sidecar now health-checks first and exits without touching the token when any healthy sidecar is up; cold-spawn stays the no-daemon fallback.
- ✅ **Test isolation (global vault path):** Codex serialized env-mutating api.test.ts + isolated ensure-sidecar port test during Phase 2a (was a Phase 0a 🟡).

## v0.4 phases (see specs/2026-06-02-design-lab-v0.4-hermes-capture.md)

- Phase 0b remaining: whatcanido has a per-brand **style-guide** seeded, but **no image Cases yet** (need capture adapters). Seed cases once Phase 2 capture lands.
- Phase 0.5/1: sidecar → launchd always-on daemon (ADR-0002).
- Phase 1: MCP server wrapping sidecar (`get_context`/`list_clients`/`add_case`/`add_feedback`/`edit_style_guide`) + build-time contract test; `hermes mcp add design-lab`.
- Phase 2: capture adapters (URL screenshot, Obsidian `aa` promotion; chat-image lands with Phase 1; local-image already works).
- ✅ Phase 3: compound — deterministic `aggregateDistill` + `GET /api/distill/:brand` + MCP `distill_taste` (#7); Hermes drafts rule text from clusters, user approves, persists via `edit_style_guide` (ADR-0005). 277 pass.

## Pre-existing (from v0.3 SKILL.md) — ✅ resolved 2026-06-02

- ✅ **E2E dashboard:** the old "Playwright selectors" note was stale — no Playwright suite ever existed; dashboard component tests (24) + `astro check` (0 err) already pass, and root `test:e2e` was a *dangling* reference to a non-existent dashboard script. Replaced with a real lightweight HTTP E2E smoke `skill/tests/dashboard-e2e.test.js` (boots `startServer(0)` incl. dashboard mount, asserts `GET /` → 200 HTML `<title>Design Lab`, `GET /api/health` → ok; skips if dist unbuilt). `test:e2e` repointed to it. `713c476`,`14672fe`. **298 unit + 2 e2e pass.**
- ✅ **open-design Bridge fidelity:** `design-memory-bridge` (open-design fork, commit `cd2bf563`) no longer blind-dumps `/api/context` JSON. New pure `framePrompt()` semantically frames it: brand guide (follow) / scenario override / **HARD CONSTRAINTS NEVER** / liked references (emulate) / anti-patterns (avoid). Fail-soft preserved; `design-lab-context.test.ts` 3 pass. Mirrors `design.sh` render_context framing + the v0.3 §3.4 bridge contract.
