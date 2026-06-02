# Cases carry aspectual feedback (per-dimension like/dislike), not just binary sentiment

**Status:** accepted (2026-06-02)

A captured design is rarely entirely good or bad. Each **Case** therefore carries an `aspects` array — `[{ dimension, verdict: like|dislike, note }]` (dimension ∈ typography | color | layout | motion | spacing | content | …) — alongside its overall `sentiment`. `/api/context` returns aspects with each case so generation can emulate the *liked* aspects and avoid the *disliked* ones of the same reference.

## Why

- The capture source is a **daily Hermes search cron** the user reviews; the verdict is usually partial ("typography good, colors too cold"), which the binary positive/negative `sentiment` cannot represent.
- Aspect-level signal lets generation extract "do X like this, but not Y" from a single reference, and lets future auto-distill derive NEVER rules from recurring disliked dimensions.

## Considered options

- **feedback-log only** — rejected: feedback isn't in `/api/context` and the case↔feedback link is weak.
- **quote text only** — rejected: unstructured; generation can't target a specific dimension.

## Consequences

- Additive schema: `aspects` is optional on case frontmatter; absent ⇒ `[]` (backward compatible). `sentiment` stays as the overall signal.
- `CaseSummary` + `/api/context` cases gain `aspects`; `writeCase`, the `add_case` and `capture_url` tools accept `aspects`. The `dimension` vocabulary is shared with the feedback-log.
- **Capture source shifts** from user-pasted URLs to **Hermes-cron suggestions the user reviews**; `capture_url` is invoked by the cron-import step, not only the user. The user reviews the daily search output and tells Hermes the per-aspect verdict, which Hermes records on the imported case.
