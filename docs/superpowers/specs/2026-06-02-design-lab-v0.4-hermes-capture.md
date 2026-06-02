# Design Lab v0.4 — Hermes-driven capture + conversational use

**Status:** spec (grilled 2026-06-02, pre-implementation). Pending Gemini cross-validation before planning.
**Supersedes the v0.4 backlog framing in** `.remember/remember.md` and `skill/SKILL.md` "v0.4 backlog".

## Vision (user's words, decomposed)

> 「可以透過我看到喜歡的加到 vault，然後我平常可以用 hermes agent（ace hermes 本機端）和他對話，讓整個系統越來越有我想要的風格（同時要分 brand）。」

1. **Capture** — see something I like → add it to the Vault (brand-scoped).
2. **Converse** — daily, talk to **ace hermes** (local Hermes Agent v0.14), which has the brand's taste memory.
3. **Compound** — output increasingly matches my taste over time.
4. **Brand-scoped** — kept separate per Brand (self-brand `_personal` baseline flows into all).

## Reality at grill time

- v0.3 is **code-complete & tested** (229 + 24 tests green, tsc clean, bridge 6/6 smoke) but **zero-dogfood**: the **Vault does not exist** (`design.sh:9` hard-fails), so `/design` has never run for real; all tests use `.tmp-test-homes/` fixtures.
- The user already does this work ad-hoc: `~/.hermes/design/whatcanido-style-revision.md` (19 KB, 2026-06-01) — a freeform brand-style doc that should become structured Vault memory.
- `~/.hermes` shows ace hermes has **skills + mcp + tools + memory + profiles**; profiles exist (ads/analyst/manager/researcher/strategist) but **no `designer`**.

## Decisions (grill outcomes)

| # | Decision | Where recorded |
|---|----------|----------------|
| 1 | Do **not** merge design-lab + open-design codebases | ADR-0001 |
| 2 | Daily loop = **ace hermes** ← MCP tools → Design Lab memory → inline generation | ADR-0002 |
| 3 | ace hermes ↔ Design Lab via **MCP server wrapping the sidecar** (read + write) | ADR-0002 |
| 4 | **Capture** = 4 adapters → one vision-ingest pipeline → Case | this spec §Capture |
| 5 | **Learning** = manual-curate first; auto-distill (approval-gated) later | this spec §Compound |
| 6 | open-design = optional heavy studio; keeps existing read-only Bridge; not in daily loop | ADR-0001 |
| 7 | First dogfood **Brand = whatcanido**; distill the existing `.hermes/design` doc into it; deprecate the ad-hoc `~/.hermes/design/` location in favour of the Vault SSOT | this spec §Phase 0 |

Domain terms: see root `CONTEXT.md`.

## Architecture

```
                 ┌──────────── Capture adapters ────────────┐
  local image ──▶│                                           │
  URL screenshot▶│  vision token extraction → writeCase()    │──▶ Vault (SSOT)
  chat image ───▶│  (Claude/ace hermes vision)               │    ~/Documents/CC Cli/design-library/
  Obsidian aa ──▶│                                           │      brands → cases / anti-library / style-guide
                 └───────────────────────────────────────────┘            │
                                                                           ▼
                                              Sidecar :5174  (Retrieval + CRUD, token auth)
                                                   │  /api/context  /api/cases  /api/style-guide ...
                          ┌────────────────────────┼───────────────────────────┐
                          ▼                                                     ▼
              MCP server (wraps sidecar)                            Bridge skill (open-design fork)
              get_context / list_clients /                         pre-flight GET /api/context (read-only)
              add_case / add_feedback / edit_style_guide                        │
                          │                                                     ▼
                          ▼                                          open-design studio (OPTIONAL)
                 ace hermes (DAILY)                                  110 skills / 129 systems / export
```

## Capture (§decision 4)

All four adapters converge on one pipeline: **acquire image → vision extracts Design Tokens → `writeCase()` brand-scoped**.

- **A. local image file** — exists today (`collect.sh`, `/api/cases`, allowlist `~/Pictures/Screenshots:~/Downloads`).
- **B. URL auto-screenshot** — new; Playwright headless capture → temp image → pipeline. (Was v0.4 backlog "URL screenshot".)
- **C. chat image to ace hermes** — new; ace hermes receives a pasted/dropped image → saves it to an allowed dir → `add_case` MCP tool (asks Brand/Scenario/sentiment/quote) → pipeline.
- **D. Obsidian `aa` promotion** — new; pick a design item from the existing `aa` inbox → promote into the Vault.

**Responsibility & data contract (resolves cross-val 🔴1, 🔴2):**
- **Vision token extraction is done by the conversing agent** (ace hermes, which is vision-capable) — *not* the sidecar (no LLM) and *not* the MCP server. The agent looks at the image, produces **Design Tokens** JSON, then calls `add_case`.
- `add_case` receives `(client, scenario, sentiment, quote, tokens, sourceImagePath)` where `sourceImagePath` is an **absolute file path** under the allowlist — **never raw image bytes / base64** (stdio JSON-RPC would blow `maxBuffer` on large images). This mirrors the existing `/api/cases` contract.
- Adapter C therefore must first persist the pasted image to an allowed dir (e.g. `~/Downloads` or tmp) and pass that path.

## Compound (§decision 5)

- **Now (manual):** user explicitly adds liked Cases; ace hermes helps edit the Brand Style Guide (DO/NEVER) via `edit_style_guide`. System sharpens because the corpus grows + rules tighten.
- **Later (auto-distill, approval-gated):** `feedback-log.jsonl` → LLM proposes new NEVER rules / promotes Cases → user approves in ace hermes before they enter the Vault.

## Phased roadmap (proposed)

- **Phase 0 — Bootstrap & dogfood (make it runnable).**
  - **0a (code, TDD — per ADR-0003):** add per-brand Style Guide support — `paths.ts:getClientStyleGuidePath(slug)`, `context.ts` merges global + per-brand guide and unions `neverRules`, `ContextResponse` gains `brandStyleGuide`. Dispatch Codex with confirmed critical behaviors.
  - **0b (content):** `init-library.sh` (done); create `whatcanido` Brand (`clients/whatcanido/meta.yaml`, type:client); distill `~/.hermes/design/whatcanido-style-revision.md` → `clients/whatcanido/style-guide.md` (brand 禪意/CJK rules) + push only *universal* rules to the global self-brand guide; 3–5 seed Cases later (need images).
  - **Exit (resolves cross-val 🟡5):** `curl /api/context?client=whatcanido&scenario=landing` (the ace-hermes-facing path) returns the merged whatcanido guide + unioned neverRules; CC `/design` is a secondary check, not primary acceptance.
- **Phase 1 — MCP server (keystone).** Thin MCP server wrapping the sidecar (`get_context`, `list_clients`, `add_case`, `add_feedback`, `edit_style_guide`); `add_case` takes a file **path**, not bytes; MCP server re-reads the API token per request + 401-reload-once (never caches at startup). `hermes mcp add design-lab`; verify ace hermes reads Context + writes a Case in conversation. **Required deliverable (resolves cross-val 🟡6):** a build-time **contract test** asserting the MCP tool shapes + the open-design Bridge both match `context.ts`'s `ContextResponse` — runtime stays fail-soft. **Exit:** ace hermes ↔ Design Lab live (read+write).
- **Phase 0.5 / 1 — Sidecar lifecycle → launchd (resolves cross-val 🔴3, 🔴4).** Since the primary consumer (ace hermes) and the MCP server are both long-lived, migrate the sidecar from cold-spawn-per-`/design` to a **launchd-managed always-on daemon** (keep `ensure-sidecar.sh`'s atomic lock as fallback). This removes the concurrent-spawn race on `:5174` + the api-token file, and the "who kills the sidecar when the MCP server exits" zombie ambiguity. `/design` and the MCP server then assume the daemon is up.
- **Phase 2 — Capture adapters.** B (URL screenshot, Playwright), D (Obsidian `aa` promotion); C largely lands with Phase 1; A already works. **Exit:** all four capture paths usable.
- **Phase 3 — Compound.** Feedback logging through MCP + Hermes-assisted Style Guide curation; approval-gated auto-distill as a later sub-phase.
- **Doc fixes (this session, done):** `CONTEXT.md`, ADR-0001/0002, and the stale `skill/SKILL.md` bridge lines.

## Open items / risks

- **Contract drift:** `/api/context` shape is consumed by both the MCP server and the open-design Bridge; runtime fail-soft hides breakage. Mitigation: `context.ts` is SSOT + a **required Phase-1 build-time contract test** (not optional) catches shape drift before runtime; runtime stays fail-soft so the daily loop never blocks (we deliberately reject runtime hard-fail).
- **Bridge fidelity:** the existing open-design Bridge blind-dumps the whole JSON (no semantic NEVER framing). Out of scope for the daily loop; revisit if open-design use grows.
- **whatcanido distillation quality:** turning a 19 KB freeform doc into structured DO/NEVER + Cases is a judgement task — review the distilled Style Guide before relying on it.
- **Token reach from MCP server:** the MCP server must read `~/.claude/state/design-lab/api-token` **per request** (not cache at startup) and forward `X-Design-Lab-Token`; respect the 401-reload-once contract. Mitigated further by the launchd sidecar (token stops rotating per-call).

## Cross-validation (2026-06-02, Gemini, <reviewer-account>)

Adversarial review raised 4 🔴 + 2 🟡 — all spec/ADR-level (nothing built yet); core decisions unchanged. Resolutions folded in above:
- 🔴 vision responsibility unstated → **conversing agent extracts tokens**, sidecar/MCP only persist (§Capture).
- 🔴 base64 image over MCP stdio crash → `add_case` takes a **file path, not bytes** (§Capture, ADR-0002).
- 🔴 token/spawn race + 🔴 sidecar zombie lifecycle → **sidecar → launchd always-on daemon** + MCP re-reads token per request (§Phase 0.5/1, ADR-0002).
- 🟡 P0 tested the wrong target → P0 exit verifies `/api/context` via curl/MCP, not CC `/design` (§Phase 0).
- 🟡 fail-soft masks drift → **required Phase-1 build-time contract test**; runtime stays fail-soft (rejected Gemini's runtime hard-fail as it breaks "never block").

Verdict after repair: 0 open 🔴. Cleared to proceed to planning.
