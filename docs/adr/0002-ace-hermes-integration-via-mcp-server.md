# ace hermes integrates with Design Lab via an MCP server wrapping the sidecar

**Status:** accepted (2026-06-02)

The daily design loop is a conversation with **ace hermes** (local Hermes Agent v0.14). ace hermes reaches Design Lab through a thin **MCP server that wraps the sidecar** (`localhost:5174`, carrying the API token), exposing tools such as `get_context`, `list_clients`, `add_case`, `add_feedback`, `edit_style_guide`. Both retrieval (read) and capture (write) flow through these tools.

## Why

- ace hermes natively supports MCP (`hermes mcp add` / `hermes mcp serve`); MCP tools are the idiomatic way to give it structured, stateful capabilities.
- The loop needs **both read and write**: read `Context` before designing, and write `Cases` when the user shares a design they like in chat (capture adapter #3, "對話中丟圖給 Hermes"). MCP tools model read+write cleanly; a prompt-injection-only skill does not.
- The sidecar is already an authenticated HTTP API, so the MCP wrapper is thin and reuses the existing contract and token lifecycle.

## Considered options

- **Port the open-design `design-memory-bridge` skill into ace hermes** — rejected as the primary path: it only injects read context into a prompt; capture/write would need a separate mechanism, and it is less structured.
- **Pipe Design Lab into ace hermes's native memory subsystem** — rejected: couples two memory models and dissolves the Vault as the single source of truth.

## Consequences

- A new thin MCP server must be built and registered with `hermes mcp add`; it reads the API token **per request** (never caches at startup) and forwards `X-Design-Lab-Token` to `:5174`, honouring 401-reload-once.
- **`add_case` takes an absolute file path, not image bytes/base64** — large images over stdio JSON-RPC would blow `maxBuffer`. This mirrors the existing `/api/cases` contract. Vision token extraction is done by the conversing agent (ace hermes), not the sidecar or MCP server.
- **Sidecar lifecycle shifts from cold-spawn-per-`/design` to a launchd-managed always-on daemon**, because both the MCP server and ace hermes are long-lived. This removes the concurrent-spawn race on `:5174` + the api-token file and the "who kills the sidecar" ambiguity. `ensure-sidecar.sh`'s atomic lock stays as a fallback.
- A dedicated ace hermes `designer` profile (persona/SOP, when to capture, how to ask sentiment/scenario) is **optional** and deferred; the MCP tools work from any profile.
- open-design keeps its own Bridge consumer unchanged (read-only); both consume the same `/api/context`. A build-time contract test (Phase 1) guards the shared shape; runtime stays fail-soft.
