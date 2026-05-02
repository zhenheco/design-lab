---
schema_version: 2
version: 1
updated: 2026-05-02
distilled_from_cases: 0
distilled_anti_cases: 0
---

# Avy 設計法則 v1

# 這是初始空白模板。隨著你 /design-collect 累積個案，
# 跑 /design-distill（v0.3 後）會自動 distill 成具體規則。
# v0.1 階段請手動編輯本檔。

## DO（你偏好的）

（待累積，例：配色 60-30-10、字型 Inter 700+...）

## NEVER（你絕對不要的）

（待累積，例如要寫機械可判的 NEVER 規則：）
- id: example-no-pure-black
  rule: "不要純黑 #000000"
  detector:
    type: regex
    pattern: '#000(?![0-9a-fA-F])|#000000|rgb\(0,\s*0,\s*0\)'
    target: css

## SOMETIMES（context-dependent）

（待累積，例：暗色模式視場景而定）
