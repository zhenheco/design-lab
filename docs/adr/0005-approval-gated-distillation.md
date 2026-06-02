# ADR-0005: Approval-gated taste distillation (deterministic clusters in sidecar, LLM drafting in Hermes)

- Status: Accepted
- Date: 2026-06-02
- Supersedes: none
- Related: ADR-0002 (MCP server wraps sidecar), ADR-0004 (aspectual case feedback)

## Context

v0.4's third pillar is **compound** — as a brand accumulates cases (each with per-dimension
`aspects`, ADR-0004) and free-form `feedback-log.jsonl` entries, the system should turn that
raw signal into durable taste rules (NEVER rules / style-guide notes) so `/design` keeps
getting sharper without the user re-stating preferences.

"Auto-distill" could mean several things, and they trade off differently:

1. **Where does the clustering run?** In the sidecar (deterministic, unit-testable, no model
   cost, runs offline) or in an LLM call (smarter grouping, but non-deterministic, costs
   tokens, and can't be tested with fixtures)?
2. **Who writes the rule text?** A deterministic template ("avoid color patterns disliked in
   cases X, Y") is testable but reads like a robot; an LLM ("avoid cold, low-saturation
   palettes — the brand wants warm paper tones") reads like the user's own voice but is
   non-deterministic.
3. **Does it write automatically?** Auto-writing distilled rules into the style guide is the
   "magic" version, but it silently mutates the SSOT vault the user owns, and a wrong rule
   poisons every future `/design` until noticed.

## Decision

Split the responsibility on the deterministic/non-deterministic seam, and gate every write:

- **Sidecar = deterministic clustering only.** `GET /api/distill/:brand?minSupport=N` loads the
  brand's retrieval-scoped cases (brand + self, same scope as `/api/context`) plus the
  brand + `_personal` feedback log, and returns **clusters** grouped by
  `(dimension, verdict)` with support count, supporting case slugs, supporting feedback
  quotes, and deduped notes. Pure function `aggregateDistill()` does the work; the route is a
  thin adapter. No model, no writes, fully fixture-testable.
- **Hermes = LLM drafting + curation.** The `distill_taste` MCP tool returns those clusters.
  Hermes (which already has the conversation + the user's voice) drafts the human-readable
  NEVER rule / style note from a cluster.
- **The user approves; persistence reuses `edit_style_guide`.** Hermes shows the drafted rule,
  the user edits/approves, and only then does Hermes call the existing `edit_style_guide`
  tool (hash-conflict-protected, ADR-0002). There is **no** new auto-write endpoint.

## Consequences

- Good: the smart part (grouping nuance, voice) lives where the LLM + conversation already
  are; the sidecar stays a deterministic, testable, offline-capable core. No new write path,
  no new file format, no new auth surface — distillation persistence is just an
  `edit_style_guide` call the user approved.
- Good: a wrong distillation can never silently poison the vault — every durable rule passes
  through a human yes.
- Cost: distillation is not "one button". The user must review clusters and approve drafts.
  This is intentional for v0.4 (the vault is hand-curated taste, not a scraped dataset).
- Cost: clusters are recomputed each call (stateless). Already-distilled clusters reappear
  until the user has added a covering NEVER rule; Hermes dedups against `get_context`'s
  current `neverRules`. A "distilled" watermark on cases is deferred (backlog) if noise grows.
- `minSupport` defaults to 2 — a single like/dislike is an observation, not yet a pattern.
