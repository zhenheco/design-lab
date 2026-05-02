#!/usr/bin/env bash
# Usage: stats.sh
set -euo pipefail
VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -d "$VAULT" ] || { echo "vault not found: $VAULT" >&2; exit 1; }

node --input-type=module -e "
import { computeStats } from '$SKILL_DIR/lib/stats.js';
const s = computeStats('$VAULT');
console.log('=== Avy Design Library Stats (v0.1 basic) ===');
console.log('Total cases:', s.totals.positive, 'positive /', s.totals.negative, 'negative');
console.log('');
console.log('By scenario:');
for (const [sc, n] of Object.entries(s.byScenario)) {
    console.log('  ' + sc + ': ' + n);
}
"
