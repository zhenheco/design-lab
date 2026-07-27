#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$REPO_DIR/skill"
SKILL_DST="$HOME/.claude/skills/design-lab"

if [ ! -d "$SKILL_SRC" ]; then
    echo "ERROR: $SKILL_SRC not found"
    exit 1
fi

mkdir -p "$(dirname "$SKILL_DST")"

# 移除舊 symlink/dir
if [ -L "$SKILL_DST" ]; then
    rm "$SKILL_DST"
elif [ -d "$SKILL_DST" ]; then
    echo "ERROR: $SKILL_DST exists as real dir; refuse to overwrite. Move or rm manually first."
    exit 1
fi

ln -s "$SKILL_SRC" "$SKILL_DST"
echo "Deployed: $SKILL_DST -> $SKILL_SRC"
ls -la "$SKILL_DST"
