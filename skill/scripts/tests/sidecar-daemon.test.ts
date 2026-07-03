import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(TEST_DIR, '..', '..');
const DAEMON_SCRIPT = join(SKILL_DIR, 'scripts', 'sidecar-daemon.sh');

type Fixture = {
    root: string;
    home: string;
    vault: string;
    stateDir: string;
    tokenFile: string;
    binDir: string;
    capturedEnvFile: string;
};

let currentFixture: Fixture | null = null;

function createFixture(): Fixture {
    const root = mkdtempSync(join(tmpdir(), 'dl-daemon-test-'));
    const home = join(root, 'home');
    const vault = join(root, 'vault');
    const stateDir = join(home, '.claude', 'state', 'design-lab');
    const binDir = join(root, 'bin');
    mkdirSync(join(vault, 'clients'), { recursive: true });
    mkdirSync(binDir, { recursive: true });
    mkdirSync(home, { recursive: true });

    const fixture = {
        root,
        home,
        vault,
        stateDir,
        tokenFile: join(stateDir, 'api-token'),
        binDir,
        capturedEnvFile: join(root, 'captured-env')
    };
    currentFixture = fixture;
    return fixture;
}

function writeExecutable(path: string, contents: string) {
    writeFileSync(path, contents);
    chmodSync(path, 0o755);
}

function installFakeNode(fixture: Fixture) {
    writeExecutable(join(fixture.binDir, 'node'), `#!/usr/bin/env bash
set -euo pipefail
{
  printf 'SENTRY_DSN=%s\\n' "\${SENTRY_DSN:-}"
  printf 'DESIGN_LAB_API_TOKEN=%s\\n' "\${DESIGN_LAB_API_TOKEN:-}"
  printf 'DESIGN_LAB_VAULT_PATH=%s\\n' "\${DESIGN_LAB_VAULT_PATH:-}"
} > "$CAPTURED_ENV_FILE"
`);
}

function installFakeOp(fixture: Fixture, dsn = 'https://public@example.invalid/44') {
    writeExecutable(join(fixture.binDir, 'op'), `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "read" ] && [ "\${2:-}" = "op://Dev/Sentry DSN design-lab-sidecar/credential" ]; then
  printf '%s\\n' "${dsn}"
  exit 0
fi
exit 2
`);
}

function runEnsureToken(fixture: Fixture) {
    return spawnSync('bash', [DAEMON_SCRIPT, '--ensure-token-only'], {
        cwd: resolve(SKILL_DIR, '..'),
        env: {
            ...process.env,
            HOME: fixture.home,
            DESIGN_LAB_VAULT_PATH: fixture.vault
        },
        encoding: 'utf8',
        timeout: 5_000
    });
}

function runDaemon(fixture: Fixture, extraEnv: Record<string, string> = {}) {
    return spawnSync('bash', [DAEMON_SCRIPT], {
        cwd: resolve(SKILL_DIR, '..'),
        env: {
            ...process.env,
            HOME: fixture.home,
            DESIGN_LAB_VAULT_PATH: fixture.vault,
            PATH: `${fixture.binDir}:${process.env.PATH ?? ''}`,
            CAPTURED_ENV_FILE: fixture.capturedEnvFile,
            SENTRY_OP_READ_TIMEOUT_SECONDS: '5',
            ...extraEnv
        },
        encoding: 'utf8',
        timeout: 5_000
    });
}

afterEach(() => {
    if (currentFixture) {
        rmSync(currentFixture.root, { recursive: true, force: true });
        currentFixture = null;
    }
});

test('ensure-token: creates a missing token file with 0600 permissions', () => {
    const fixture = createFixture();

    const result = runEnsureToken(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(fixture.tokenFile), 'token file should exist');
    assert.match(readFileSync(fixture.tokenFile, 'utf8').trim(), /^[a-f0-9]{64}$/);
    assert.equal((statSync(fixture.tokenFile).mode & 0o777).toString(8), '600');
});

test('ensure-token: reuses an existing non-empty token without rotation', () => {
    const fixture = createFixture();
    mkdirSync(fixture.stateDir, { recursive: true });
    writeFileSync(fixture.tokenFile, 'stable-token\n', { mode: 0o600 });

    const result = runEnsureToken(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(fixture.tokenFile, 'utf8'), 'stable-token\n');
    assert.equal((statSync(fixture.tokenFile).mode & 0o777).toString(8), '600');
});

test('sidecar-daemon loads Sentry DSN from 1Password when no explicit DSN is set', () => {
    const fixture = createFixture();
    installFakeNode(fixture);
    installFakeOp(fixture);

    const result = runDaemon(fixture, { SENTRY_DSN: '' });

    assert.equal(result.status, 0, result.stderr);
    const capturedEnv = readFileSync(fixture.capturedEnvFile, 'utf8');
    assert.match(capturedEnv, /^SENTRY_DSN=https:\/\/public@example\.invalid\/44$/m);
    assert.match(capturedEnv, /^DESIGN_LAB_API_TOKEN=[a-f0-9]{64}$/m);
    assert.match(capturedEnv, new RegExp(`^DESIGN_LAB_VAULT_PATH=${fixture.vault}$`, 'm'));
});

test('sidecar-daemon preserves an explicitly provided Sentry DSN', () => {
    const fixture = createFixture();
    installFakeNode(fixture);
    installFakeOp(fixture, 'https://public@example.invalid/from-op');

    const result = runDaemon(fixture, {
        SENTRY_DSN: 'https://public@example.invalid/manual'
    });

    assert.equal(result.status, 0, result.stderr);
    const capturedEnv = readFileSync(fixture.capturedEnvFile, 'utf8');
    assert.match(capturedEnv, /^SENTRY_DSN=https:\/\/public@example\.invalid\/manual$/m);
});
