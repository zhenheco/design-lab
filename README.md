# design-lab

**A personal, brand-scoped design-taste memory for Claude Code.**

You see designs you like, give nuanced verdicts ("the typography is great, the palette is too cold"), and they accumulate into a local memory. When you later ask Claude Code to build a frontend, `/design` loads that accumulated taste so the output looks more like *you* — per brand, getting sharper every cycle.

```
   capture                     store                         generate
┌──────────────┐        ┌──────────────────┐         ┌────────────────────┐
│ liked designs│  ───▶  │  Vault (SSOT)     │  ───▶   │ /design <task>     │
│ (URL / image)│        │  cases + aspects  │         │  loads merged      │
│ + verdicts   │        │  style guides     │         │  brand memory →    │
└──────────────┘        │  NEVER rules      │         │  on-taste frontend │
       ▲                └──────────────────┘         └────────────────────┘
       │                         │  ▲
       │                  ┌──────┴──┴───────┐
       └───────────────── │  local sidecar  │  HTTP @ 127.0.0.1:5174
         MCP write tools  │  (Express)      │  + MCP server (7 tools)
                          └─────────────────┘
```

It is **brand-scoped**: a baseline self-brand (`_personal`) whose taste flows into every brand, plus named brands whose cases never leak across each other.

---

## How it works

- **Vault** — the single source of truth for your taste, a plain folder of markdown + YAML you own and can `git` yourself (kept outside this repo). Holds per-brand **style guides**, liked **cases**, an **anti-library**, and **NEVER rules**.
- **Sidecar** — a small always-on local Express daemon (`127.0.0.1:5174`) that serves a retrieval-scoped, merged view of the vault over HTTP (`/api/context`, `/api/distill/:brand`, …). Read endpoints are open to loopback; writes need a local API token.
- **MCP server** — wraps the sidecar so an agent (e.g. a local Hermes agent) can read context and capture new taste with 7 tools.
- **`/design`** — the Claude Code consumer: loads the brand's merged memory and frames it (brand guide → follow, NEVER rules → hard constraints, liked cases → emulate, anti-cases → avoid) into the generation prompt.

### Core concepts

| Term | Meaning |
|------|---------|
| **Brand** | A taste scope. `_personal` = self-brand (baseline, flows into all). Named brands are client-specific. |
| **Case** | One captured design (screenshot + extracted tokens) with your quotes and verdict. |
| **Aspect** | A per-dimension verdict on a case — `{dimension, verdict: like\|dislike, note}`. A design is rarely all-good. |
| **Style guide** | Per-brand markdown rules (global self-brand guide + per-brand overrides). |
| **NEVER rule** | A hard constraint with a detector, enforced on generated CSS by the linter. |
| **Distillation** | Clustering accumulated like/dislike signals into proposed NEVER / style-note candidates — **approval-gated**, never auto-written. |

---

## The loop

- **Input** — a local Hermes agent's daily cron surfaces design candidates; you review and reply with per-aspect verdicts; it captures them into the vault via the MCP tools.
- **Output** — in Claude Code: `/design "<task>" <brand> <scenario>` loads the brand's merged memory and generates a frontend in the accumulated taste.
- **Compound** — as signals build up, `distill_taste` clusters them into durable rule candidates; you approve; the rule lands in the brand's style guide; `/design` gets sharper.

[`open-design`](https://github.com/zhenheco/open-design) can optionally consume the same context as a third (read-only) generation studio via the `design-memory-bridge` skill.

---

## Quick start

Requirements: **Node ≥ 20** (the sidecar uses `better-sqlite3` 12.x; Node 26 is fine).

```bash
npm install

# Install the skill into Claude Code (symlinks skill/ → ~/.claude/skills/design-lab)
bash deploy.sh

# Run the sidecar as an always-on launchd daemon (macOS)
bash skill/scripts/launchd-install.sh
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

The vault defaults to `~/Documents/CC Cli/design-library`; override with `DESIGN_LAB_VAULT_PATH`. Initialise an empty one with `bash skill/scripts/init-library.sh <path>`.

Register the MCP server with your agent by pointing it at `skill/mcp/start.sh` (stdio). It auto-discovers all 7 tools.

### Generate with your taste

```bash
/design "build a landing hero" whatcanido landing
```

---

## MCP tools

| Tool | Purpose |
|------|---------|
| `get_context` | Read the brand's retrieval-scoped context (style guide + cases + NEVER rules). |
| `list_clients` | List brands. |
| `add_case` | Capture a case from a local image path. |
| `capture_url` | Screenshot a URL, extract live computed design tokens, save as a case. |
| `add_feedback` | Log a taste signal not tied to one image. |
| `edit_style_guide` | Edit the global or per-brand style guide (hash-conflict protected). |
| `distill_taste` | Cluster accumulated like/dislike signals into rule candidates (read-only; you approve before persisting). |

Writes require the local API token (`X-Design-Lab-Token`, read per request from `~/.claude/state/design-lab/api-token`). The Host allowlist + token guard the sidecar against DNS-rebinding from local browsers.

---

## Project layout

```
skill/
  sidecar/      Express HTTP sidecar (routes + auth middleware)
  mcp/          MCP server wrapping the sidecar (7 tools)
  lib/          case loader/writer, distill aggregator, URL capture, lint
  dashboard/    Astro local dashboard (served by the sidecar at /)
  scripts/      design.sh, ensure-sidecar.sh, launchd-install.sh, …
  launchd/      LaunchAgent plist template
docs/
  adr/          architecture decisions (0001–0005)
  superpowers/  specs + plans
```

## Tests

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Design decisions

See [`docs/adr/`](docs/adr/):

- **0001** — keep design-lab and open-design as separate codebases.
- **0002** — integrate with the agent via an MCP server wrapping the sidecar.
- **0003** — per-brand style guides merged into `/api/context`.
- **0004** — aspectual (per-dimension) case feedback.
- **0005** — approval-gated distillation (deterministic clusters in the sidecar, LLM drafting + human approval before any write).

## Security

Local-first and token-protected. Free SAST on every PR (Semgrep + Gitleaks + Trivy), plus Dependabot and secret scanning. The vault and API token live outside this repo and are never committed.

---

*Status: v0.4 — capture, converse, compound.*
