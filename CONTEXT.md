# Design Lab

Design Lab is a personal, brand-scoped design-taste memory: you capture designs you like, and a conversational agent retrieves that memory so generated UI increasingly matches your taste. It is the source of truth for design preferences — it does not generate designs itself.

## Language

### Memory model

**Vault**:
The on-disk store of all design memory at `~/Documents/CC Cli/design-library/`. Source of truth.
_Avoid_: database, library (for the whole store), `.hermes/design`

**Brand**:
A distinct visual identity the memory is scoped to. Modeled in code as a **Client**; the special brand `_personal` is the **self-brand** (your own baseline taste). External brands: `whatcanido`, `aicycle`, `zhenheco`.
_Avoid_: client (in conversation), account, tenant, project

**Case**:
One captured design you liked — stored as **Design Tokens** + a **Quote** + **Tags**, scoped to a **Scenario** and a **Brand**. `sentiment: positive`.
_Avoid_: example, sample, reference

**Anti-case**:
A captured design you disliked — a negative signal in the brand's `anti-library/`. `sentiment: negative`.
_Avoid_: bad example, blacklist entry

**Style Guide**:
Markdown rules expressed as **DO rules**, **NEVER rules**, and SOMETIMES rules. Two scopes: the **global self-brand** guide (`personal-style-guide.md`, universal taste) and a **per-brand** guide (`clients/<slug>/style-guide.md`, brand-specific). **Retrieval** merges both for the queried Brand (see ADR-0003).
_Avoid_: guidelines, design system

**NEVER rule**:
A machine-checkable prohibition parsed from the Style Guide (`{id, pattern, target}`), enforced by lint and surfaced in **Retrieval**.
_Avoid_: lint rule, ban

**Scenario**:
The kind of surface a Case/override applies to: `landing | saas-ui | brand | content`.
_Avoid_: page type, category

**Scenario Override**:
Per-scenario markdown that refines the Style Guide for one **Scenario** (`scenario-overrides/landing.md`).

**Design Tokens**:
The extracted visual primitives of a Case — palette, spacing, type, etc. Distinct from **API Token**.
_Avoid_: tokens (unqualified), styles

### Flow

**Capture**:
Turning a source you liked into a **Case** via vision token extraction. Has four **Adapters**, all funnelling into one ingest pipeline.
_Avoid_: collect, import

**Adapter**:
A capture front-door. Four: local image file, URL auto-screenshot, chat image to **ace hermes**, Obsidian `aa` promotion.

**Retrieval**:
Reading a brand-scoped slice of the Vault — top-5 positive **Cases**, all **Anti-cases**, **Style Guide**, **Scenario Override**, **NEVER rules** — assembled as a **Context**.
_Avoid_: search, query

**Context**:
The `/api/context` payload — the **Retrieval** result injected into an agent before it designs.
_Avoid_: payload (unqualified), prompt

**Distill**:
Compounding taste: promoting **Feedback** into sharper Style Guide rules / new Cases. Manual-curated first; auto-distill later.

**Feedback**:
A reaction logged during a design session (`feedback-log.jsonl`) — raw material for **Distill**.

### Systems

**Sidecar**:
Design Lab's local Express daemon on `:5174` serving **Retrieval** + CRUD over the **Vault**. Auth: host allowlist + **API Token** for writes.

**API Token**:
The 32-byte secret at `~/.claude/state/design-lab/api-token`, minted per cold-spawn, required on write requests. Distinct from **Design Tokens**.

**ace hermes**:
The user's local conversational agent (Hermes Agent v0.14). The **primary daily consumer** of Design Lab, via an **MCP server** wrapping the **Sidecar**.
_Avoid_: Hermes (unqualified — see ambiguities), team_manager, "the python wrapper"

**MCP server**:
The thin wrapper exposing **Sidecar** read+write as MCP tools (`get_context`, `list_clients`, `add_case`, `add_feedback`, `edit_style_guide`) so **ace hermes** can retrieve memory and capture Cases in conversation.

**Bridge**:
The `design-memory-bridge` skill inside the **open-design** fork that optionally fetches **Context** pre-generation. A secondary, read-only consumer.

**open-design**:
A separate, heavyweight design-generation studio (forked from `nexu-io/open-design`). Optional; not in the daily loop.
_Avoid_: "the generator", "the other folder"

## Relationships

- A **Vault** holds many **Brands**; exactly one is the self-brand (`_personal`).
- A **Brand** owns many **Cases** and **Anti-cases**, and may own a **per-brand Style Guide**; the self-brand owns the **global Style Guide** and **Scenario Overrides**. **Retrieval** merges the global + per-brand guides (NEVER rules unioned) for the queried Brand.
- A **Case** has **Design Tokens**, one **Quote**, **Tags**, one **Scenario**, one `sentiment`.
- **Capture** (via one of four **Adapters**) produces a **Case**.
- The **Sidecar** assembles **Retrieval** into a **Context**, scoped to one **Brand** + **Scenario**.
- **ace hermes** reads **Context** and writes **Cases** through the **MCP server** (read + write).
- **open-design** optionally reads **Context** through the **Bridge** (read only).
- **Retrieval scope**: a `type:client` **Brand** returns its own Cases + all self-brand Cases; the self-brand returns self only — baseline taste flows into every brand, brand-specific cases never leak across brands.

## Example dialogue

> **Dev:** "When I capture a screenshot I like for whatcanido, does it become part of the `whatcanido` **Brand** or my personal taste?"
> **Ace:** "The whatcanido **Brand**. My personal taste is the self-brand `_personal`. whatcanido **Retrieval** pulls whatcanido **Cases** *plus* `_personal` Cases — baseline taste flows in, but brand-specific Cases never leak across Brands."
> **Dev:** "And if I hate a design?"
> **Ace:** "That's an **Anti-case** — it goes in whatcanido's anti-library and shows up as a NEVER signal in the **Context**, so generation avoids it."
> **Dev:** "Does open-design see this too?"
> **Ace:** "Only if I launch it — it reads the same **Context** through the **Bridge**. Day to day I just talk to **ace hermes**, which has the **MCP** tools."

## Flagged ambiguities

- **"merge"** — meant "combine design-lab and open-design into one codebase." Resolved: do **not** merge codebases (see `docs/adr/0001`); they integrate via the **MCP server** (ace hermes) and the **Bridge** (open-design).
- **"Token"** — split into **Design Tokens** (visual primitives in a Case) vs **API Token** (sidecar write auth). Always qualify.
- **"memory"** — the design-lab **Vault** is the SSOT for design taste; **ace hermes** has its own native memory subsystem. They are distinct — the Vault is not stored in ace hermes memory.
- **"Hermes"** — resolved to **ace hermes** (the local Hermes Agent v0.14 you chat with). Distinct from `ai-team-system/team_manager.py`, which is not the daily design entry point.
- **"client" vs "Brand"** — code says `client`; domain says **Brand**. `_personal` is the self-brand, not an external client.
