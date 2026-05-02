# Schema Migrations

每個 migration 腳本命名 `vN-to-v(N+1).sh`，必須:

1. Idempotent：重跑不破壞已 migrate 的資料
2. 接受 `<vault-path>` 參數，遞迴處理該目錄下所有有 `schema_version` 欄位的 markdown
3. 原地修改 frontmatter + 更新 `schema_version` 欄位到新值
4. 失敗回 non-zero exit code

skill 啟動時自動掃 `lib/schema.js` 的 `CURRENT_SCHEMA_VERSION` 跟 vault 最舊版本比對，差異就提示用戶執行 migration（先 git commit pre-snapshot）。

v1-to-v2: see [v1-to-v2.md](v1-to-v2.md)

詳見 spec §11：docs/superpowers/specs/2026-05-02-design-lab-v0.2-sidecar.md
