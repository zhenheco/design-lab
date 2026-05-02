#!/usr/bin/env bash
# Usage: lint.sh <css-file-or-html-file> <style-guide.md>
# Output: JSON to stdout: { violations: [...], fixedCss: "...", fixes: [...] }
set -euo pipefail

INPUT="${1:?usage: $0 <input-file> <style-guide.md>}"
GUIDE="${2:?usage: $0 <input-file> <style-guide.md>}"
[ -f "$INPUT" ] || { echo "input not found: $INPUT" >&2; exit 1; }
[ -f "$GUIDE" ] || { echo "guide not found: $GUIDE" >&2; exit 1; }

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node --input-type=module -e "
import { readFileSync } from 'fs';
import { lintCss, parseRulesFromGuide } from '$SKILL_DIR/lib/lint.js';
const css = readFileSync('$INPUT', 'utf8');
const guide = readFileSync('$GUIDE', 'utf8');
const rules = parseRulesFromGuide(guide);
const result = lintCss(css, rules, { autoFix: false });
console.log(JSON.stringify(result, null, 2));
"
