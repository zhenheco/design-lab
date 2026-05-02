# v1 to v2 Migration

## What this migration does

This migration upgrades a v1 flat vault into the v2 multi-client layout by creating `clients/_personal/`, moving root-level `cases/` and `anti-library/` markdown files into that client, rewriting migrated case frontmatter to `schema_version: 2` plus `client: _personal`, and creating `_personal/meta.yaml`.

## How to run

```bash
bash skill/scripts/migrate-v1-to-v2.sh <vault-path>
```

## Side effects

- Creates a sibling backup directory next to the vault before changing anything, named like `<vault>.v1-backup-YYYYMMDD-HHMMSS`.
- Rewrites only the frontmatter section of migrated markdown files to set `schema_version: 2` and `client: _personal`.
- Builds the new `clients/_personal/cases/` and `clients/_personal/anti-library/` directories and moves root-level markdown files into them.
- Creates `clients/_personal/meta.yaml` from the client metadata template if it does not already exist.

## Rollback

If you want to undo the migration completely, remove the migrated vault and rename the sibling backup back to the original vault name. You can also inspect the backup and manually copy specific files back if you only want a partial rollback.

## Idempotency

The script is safe to run a second time. If `clients/_personal/meta.yaml` already exists and there are no root-level markdown files left in `cases/` or `anti-library/`, it exits with a skip message and does not create another backup.
