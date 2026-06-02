import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
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
};

let currentFixture: Fixture | null = null;

function createFixture(): Fixture {
    const root = mkdtempSync(join(tmpdir(), 'dl-daemon-test-'));
    const home = join(root, 'home');
    const vault = join(root, 'vault');
    const stateDir = join(home, '.claude', 'state', 'design-lab');
    mkdirSync(join(vault, 'clients'), { recursive: true });
    mkdirSync(home, { recursive: true });

    const fixture = {
        root,
        home,
        vault,
        stateDir,
        tokenFile: join(stateDir, 'api-token')
    };
    currentFixture = fixture;
    return fixture;
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
