#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN="${DESIGN_LAB_INSTALL_DRY_RUN:-0}"

if [ -t 1 ]; then
    BOLD="$(printf '\033[1m')"
    GREEN="$(printf '\033[32m')"
    BLUE="$(printf '\033[34m')"
    YELLOW="$(printf '\033[33m')"
    RED="$(printf '\033[31m')"
    RESET="$(printf '\033[0m')"
else
    BOLD=""
    GREEN=""
    BLUE=""
    YELLOW=""
    RED=""
    RESET=""
fi

info() {
    printf '%s==>%s %s\n' "$BLUE" "$RESET" "$*"
}

ok() {
    printf '%sOK%s %s\n' "$GREEN" "$RESET" "$*"
}

warn() {
    printf '%sWARN%s %s\n' "$YELLOW" "$RESET" "$*"
}

fail() {
    printf '%sERROR%s %s\n' "$RED" "$RESET" "$*" >&2
    exit 1
}

print_command() {
    printf '    $'
    for arg in "$@"; do
        printf ' %q' "$arg"
    done
    printf '\n'
}

run_in_dir() {
    local dir="$1"
    shift

    printf '    $ cd %q &&' "$dir"
    for arg in "$@"; do
        printf ' %q' "$arg"
    done
    printf '\n'

    if [ "$DRY_RUN" = "1" ]; then
        return 0
    fi

    (cd "$dir" && "$@")
}

run_cmd() {
    print_command "$@"

    if [ "$DRY_RUN" = "1" ]; then
        return 0
    fi

    "$@"
}

require_command() {
    local name="$1"
    if ! command -v "$name" >/dev/null 2>&1; then
        fail "$name not found. Install Node.js 20 or newer, then rerun: bash install.sh"
    fi
}

node_major_version() {
    node -v | sed -E 's/^v([0-9]+).*/\1/'
}

info "Preflight"
require_command node
NODE_MAJOR="$(node_major_version)"
if [ "$NODE_MAJOR" -lt 20 ]; then
    fail "Node.js 20 or newer is required. Current version: $(node -v)"
fi
require_command npm
ok "Node $(node -v) and npm $(npm -v) detected"

if [ "$DRY_RUN" = "1" ]; then
    warn "Dry run enabled with DESIGN_LAB_INSTALL_DRY_RUN=1; install commands will be printed but not executed."
fi

info "Installing root npm dependencies"
run_in_dir "$REPO_DIR" npm install

info "Installing and building dashboard"
run_in_dir "$REPO_DIR/skill/dashboard" npm install
run_in_dir "$REPO_DIR/skill/dashboard" npm run build

info "Installing skill symlink"
run_in_dir "$REPO_DIR" bash deploy.sh

VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
info "Preparing design library vault"
printf '    Vault: %s\n' "$VAULT"
printf '    Override with DESIGN_LAB_VAULT_PATH=/path/to/design-library\n'
if [ -d "$VAULT" ]; then
    ok "Vault already exists; skipping init"
else
    run_cmd bash "$REPO_DIR/skill/scripts/init-library.sh" "$VAULT"
fi

info "Configuring sidecar"
if [ "$(uname)" = "Darwin" ]; then
    run_cmd bash "$REPO_DIR/skill/scripts/launchd-install.sh"
else
    warn "launchd is macOS-only; no daemon was installed on this platform."
    printf '    /design will cold-spawn the sidecar on first use through ensure-sidecar.sh.\n'
    printf '    Manual foreground command:\n'
    printf '    $ cd %q && node --import tsx -e %q\n' "$REPO_DIR" "import {startServer} from '$REPO_DIR/skill/sidecar/server.ts'; startServer(5174,'127.0.0.1')"
    printf '    Manual background example:\n'
    printf '    $ cd %q && nohup node --import tsx -e %q > designlab-sidecar.log 2>&1 &\n' "$REPO_DIR" "import {startServer} from '$REPO_DIR/skill/sidecar/server.ts'; startServer(5174,'127.0.0.1')"
fi

info "Optional capture_url setup"
printf '    To enable screenshot capture, run:\n'
print_command npx playwright install chromium

info "MCP registration"
printf '    Stdio entry: %s\n' "$REPO_DIR/skill/mcp/start.sh"
printf '    Claude example:\n'
print_command claude mcp add design-lab -- bash "$REPO_DIR/skill/mcp/start.sh"
printf '    Other agents: add the same stdio command to the agent MCP configuration.\n'

if [ "$DRY_RUN" = "1" ]; then
    printf '\n%sDesign Lab dry run complete.%s\n' "$BOLD" "$RESET"
else
    printf '\n%sDesign Lab installed successfully.%s\n' "$BOLD" "$RESET"
fi
printf '    Health check: curl -s http://127.0.0.1:5174/api/health\n'
printf '    Usage: /design "<task>" <brand> <scenario>\n'
printf '    Docs: README.md\n'
