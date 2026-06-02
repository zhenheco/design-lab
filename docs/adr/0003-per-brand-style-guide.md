# Brand taste = global self-brand guide + per-brand style guide + per-brand cases

**Status:** accepted (2026-06-02)

A **Brand**'s taste is modeled in three layers: (1) the global **self-brand** Style Guide (`personal-style-guide.md`) with universal DO/NEVER/SOMETIMES rules, (2) a new **per-brand Style Guide** (`clients/<slug>/style-guide.md`, same format) with brand-specific textual rules, and (3) per-brand image **Cases** / **Anti-cases**. `/api/context` merges the global + per-brand guides and unions their NEVER rules, scoped to the queried Brand.

## Why

- Dogfooding whatcanido surfaced that brand-specific *textual* style rules (its 禪意 / CJK-typography rules) had no home: the only Style Guide was global self-brand (putting brand rules there leaks them across all Brands), and per-brand memory was image-Cases only.
- "分 brand 風格" requires brand-specific rules to actually reach generation (the Context), not just example images.

## Considered options

- **Image-cases only** — rejected: discards the textual brand rules the user already writes (the 19 KB whatcanido doc).
- **Stuff into `meta.notes` / a brand README** — rejected: `/api/context` doesn't read it, so it never reaches generation.
- **Defer** — rejected: it is the core of "分 brand", and the change is additive/cheap.

## Consequences

- Additive schema change — a new optional `clients/<slug>/style-guide.md`; absent ⇒ empty, so no migration and existing vaults keep working.
- `/api/context` `ContextResponse` gains `brandStyleGuide`, and `neverRules` becomes the union of global + per-brand rules. This is a contract change — both consumers (the new MCP server and the open-design Bridge) and the Phase-1 contract test must track it. `context.ts` stays the SSOT.
- `paths.ts` adds `getClientStyleGuidePath(slug)`; the MCP `edit_style_guide` tool takes a Brand argument (global self-brand vs per-brand).
- Retrieval: the global self-brand guide always loads (baseline taste); the per-brand guide loads only for the queried Brand — consistent with the existing Case retrieval-scope rule.
