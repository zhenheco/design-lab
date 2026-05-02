#!/usr/bin/env bash
# Usage: distill.sh
# v0.1 STUB: 自動 distill 在 v0.3 才上。
set -euo pipefail

VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"

cat <<MSG

[design-lab v0.1] /design-distill 在 v0.3 自動化。

目前請手動編輯：
  $VAULT/personal-style-guide.md

直接編輯 DO / NEVER / SOMETIMES 三段。NEVER 規則記得遵守 spec §3.2 的格式才能被 lint 引擎讀到：

- id: <unique-id>
  rule: "說明"
  detector:
    type: regex
    pattern: '<regex>'
    target: css

跑 /design-stats 看你 library 累積進度。
MSG
