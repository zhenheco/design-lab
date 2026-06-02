#!/usr/bin/env bash
# Launcher for the design-lab MCP stdio server (used by `hermes mcp add`).
# cd to repo root first so `node --import tsx` resolves node_modules/tsx
# regardless of the spawning agent's cwd.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"
exec node --import tsx "$REPO_ROOT/skill/mcp/server.ts"
