# Design Lab Backlog

## From v0.4 Phase 0a cross-review (2026-06-02, 3-lens adversarial, 0🔴/6🟡)

Resolved in Phase 0a: vision-responsibility doc, base64→path contract, sidecar launchd plan, P0 acceptance target, security self-guard (`getClientStyleGuidePath` now `isValidSlug`+`assertSafePath`), ghost-client assertion, empty-global+brand-only NEVER test, build-time contract test (Phase 1).

Deferred:
- 🟡 **Test isolation (global vault path):** per-brand `/api/context` tests mutate the process-global `DESIGN_LAB_VAULT_PATH` via `withVaultEnv`; under heavy concurrent load this can flake (observed brandStyleGuide=='' / lost brand neverRule). Impl logic is correct. Fix: thread an explicit vault through the route/app factory in tests, or isolate each test in its own process. Ref `skill/sidecar/tests/api.test.ts`.
- 🟡 **Unbounded file read:** `readOptionalFile` (`context.ts`) reads styleGuide / scenarioOverride / brandStyleGuide with no size cap, serialized whole into the JSON response. Pre-existing class; add a size cap across all callers.
- **chore(security):** `npm audit` reports 2 moderate vulns after the better-sqlite3 12.x bump — triage `npm audit`.

## From v0.4 Phase 1 (MCP server + launchd, 2026-06-02)

- 🟡 **MCP Host header fixed value:** `skill/mcp/sidecar-client.ts` sends `Host: 127.0.0.1:5174` always (matches the sidecar's fixed host-allowlist; this is why ephemeral-port integration tests pass). If `DESIGN_LAB_SIDECAR_URL` is ever pointed at a non-`:5174` host, the host-allowlist must be extended too. Documented constraint, not a bug.
- 🟡 **launchd re-install over crash-looping service:** `launchd-install.sh`'s inline `bootout || true` can fail with `Bootstrap failed: 5: Input/output error` when re-installing over an already-loaded/crash-looping instance; a clean `launchd-uninstall.sh` first resolves it. Harden install to wait for bootout to settle (or retry bootstrap) before bootstrap.

## From v0.4 Phase 2 (capture + use-side, 2026-06-02)

- 🟡 **/design fallback fragility:** `design.sh` `render_fallback` (sidecar-down path) calls case-loader and `exit 1` on failure (`set -e`); a double failure (sidecar down AND vault corrupt) hard-exits instead of degrading gracefully. Rare (launchd daemon makes the fallback path seldom taken). Make fallback echo + continue.
- 🟡 **URL capture SSRF depth:** `captureUrl` blocks literal private/loopback hosts + `localhost`, but does not DNS-resolve hostnames (a public host resolving to a private IP / DNS-rebinding is not caught). Acceptable for the local, token-protected, user-reviewed-cron threat model; revisit if capture is ever exposed beyond local.

## From v0.4 Phase 3 (auto-distill, 2026-06-02)

- 🟡 **Stateless re-proposal noise:** `distill_taste` recomputes clusters each call, so an already-distilled cluster keeps reappearing until the user has added a covering NEVER rule (Hermes dedups against `get_context.neverRules`). If noise grows, add a "distilled" watermark on cases (e.g. a `distilled_at` marker) so addressed clusters drop out. Deferred per ADR-0005.
- 🟡 **Feedback verdict heuristic is keyword-based:** `verdictFromSignal` classifies a feedback `signal` as like/dislike by substring match (dislike/negative/avoid/bad · like/positive/good/prefer). A signal with neither keyword is silently skipped from distillation (still stored). Acceptable — `aspects` are the primary structured signal; feedback is secondary. Revisit if many feedback entries fail to classify.

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

## Pre-existing (from v0.3 SKILL.md)

- E2E dashboard Playwright selectors need fixing (not blocking phase tag).
- open-design Bridge fidelity: currently blind-dumps `/api/context` JSON (no semantic NEVER framing). Revisit if open-design daily use grows.
