# Keep Design Lab and open-design as separate codebases

**Status:** accepted (2026-06-02)

Design Lab (brand-taste memory + sidecar + Astro dashboard) and open-design (a heavyweight design-generation studio forked from `nexu-io/open-design`) stay as two separate repositories. They integrate through skill-level consumers of the sidecar's `/api/context` — never by merging code.

## Why

- open-design is an active **fork of a live upstream**; mixing Design Lab into it would make `upstream` rebases painful and pollute a ~3.5 GB pnpm-monorepo / Next.js project with an unrelated npm/Astro skill.
- Design Lab must remain a Claude Code skill (symlinked into `~/.claude/skills/design-lab`); that shape is incompatible with living inside open-design.
- The two do genuinely different things — memory store vs generation engine — and only overlap on dashboards (~80% divergent). The integration is already clean at the API boundary.

## Considered options

- **Merge design-lab into open-design as a package/skill** — rejected: breaks fork rebasing, forces two toolchains, no real gain.
- **Fold only the dashboard into open-design's UI** — rejected for now: dashboards are 80% different and the daily loop is ace hermes, not open-design's UI.
- **Drop open-design entirely** — rejected: loses 110 skills / 129 design systems / multi-format artifact export; keep it as an optional studio.

## Consequences

- The daily design loop runs through **ace hermes**, not open-design (see ADR-0002). open-design is optional and out of the daily loop.
- The `/api/context` shape now has multiple consumers; treat `skill/sidecar/routes/context.ts` as the single source of truth for that contract, and beware fail-soft silently masking drift.
