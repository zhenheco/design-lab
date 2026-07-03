import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(TEST_DIR, '..', '..');
const SENTRY_ENV_SCRIPT = join(SKILL_DIR, 'scripts', 'sentry-env.sh');

let currentRoot: string | null = null;

function createFixture() {
    const root = mkdtempSync(join(tmpdir(), 'dl-sentry-env-test-'));
    const binDir = join(root, 'bin');
    mkdirSync(binDir, { recursive: true });
    currentRoot = root;
    return { root, binDir };
}

afterEach(() => {
    if (currentRoot) {
        rmSync(currentRoot, { recursive: true, force: true });
        currentRoot = null;
    }
});

test('load_sentry_dsn fails open when 1Password CLI hangs', () => {
    const fixture = createFixture();
    const opPath = join(fixture.binDir, 'op');
    writeFileSync(opPath, '#!/usr/bin/env bash\nsleep 5\n', { mode: 0o755 });
    chmodSync(opPath, 0o755);

    const startedAt = Date.now();
    const result = spawnSync('bash', ['-c', 'source "$1"; load_sentry_dsn', 'bash', SENTRY_ENV_SCRIPT], {
        env: {
            ...process.env,
            PATH: `${fixture.binDir}:${process.env.PATH || ''}`,
            SENTRY_DSN: ''
        },
        encoding: 'utf8',
        timeout: 2_000
    });
    const elapsed = Date.now() - startedAt;

    assert.equal(result.status, 0, result.stderr);
    assert.ok(elapsed < 1_500, `expected load_sentry_dsn to fail open quickly, got ${elapsed}ms`);
});
