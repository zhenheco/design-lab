# Handoff

## State
design-lab v0.1 MVP shipped: tag `v0.1.0`, 12 commits on `main`, 24/24 tests pass, deployed to `~/.claude/skills/design-lab` (symlink → `/Volumes/500G/Claude Code Projects/Design skill/skill/`). Vault `~/Documents/CC Cli/design-library/` **not yet initialized** — that's the user's first dogfood step. Spec/plan/handoff in `docs/superpowers/`. Memory written: `~/.claude/skills/auto-skill/knowledge-base/nodejs-esm-testing-quirks.md` + `experience/skill-codex-agent.md` + `experience/skill-gemini-agent.md`.

## Next
1. Dogfood: `bash ~/.claude/skills/design-lab/scripts/init-library.sh "$HOME/Documents/CC Cli/design-library"` → edit `personal-style-guide.md` NEVER section → collect 5+ cases via `scripts/collect.sh` → try `/design`.
2. Run GitHub research that failed earlier — use `gemini-rotate.sh -m gemini-2.5-flash` (not pro, capacity-exhausted), prompt at `/tmp/gemini-design-system-research.txt` if still there.
3. Patch `~/.claude/skills/gemini-agent/scripts/gemini-rotate.sh` to distinguish `MODEL_CAPACITY_EXHAUSTED` (server) vs `QUOTA_EXHAUSTED` (account) — see `experience/skill-gemini-agent.md` for fix spec.

## Context
- Codex dispatch prompt MUST include "STRICT SEQUENTIAL — no parallel commands touching file locks (git config, etc)" or it'll race itself. Phase A failed exactly this way.
- Plan/test bugs found mid-build: `new URL(...).pathname` url-encodes the space in repo path — always use `fileURLToPath()`. ESM can't `require()`. Node 25 `--test` won't take a directory, must glob `"*.test.js"`.
- v0.2/0.3 brainstorm should wait until user has dogfooded ~6 weeks with 30+ cases — don't open scope speculatively.
- Read `docs/superpowers/HANDOFF.md` for full context map; this file is just the pointer.
