import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(TEST_DIR, '..', '..');
const DRIFT_SCRIPT = join(SKILL_DIR, 'scripts', 'session-start-design-lab-drift-check.sh');

type Fixture = {
    root: string;
    vault: string;
    stateDir: string;
};

let currentFixture: Fixture | null = null;

function createFixture(): Fixture {
    const root = mkdtempSync(join(tmpdir(), 'dl-drift-test-'));
    const vault = join(root, 'vault');
    const stateDir = join(root, 'state');
    mkdirSync(vault, { recursive: true });
    mkdirSync(join(stateDir, 'design-lab'), { recursive: true });
    currentFixture = { root, vault, stateDir };
    return currentFixture;
}

function writeFeedback(vault: string, count: number): void {
    const lines = Array.from({ length: count }, (_, index) => JSON.stringify({
        signal: 'positive',
        dimension: 'layout',
        user_quote: `quote ${index}`
    }));
    writeFileSync(join(vault, 'feedback-log.jsonl'), `${lines.join('\n')}\n`);
}

function writeTaste(vault: string, processed: number): void {
    writeFileSync(join(vault, 'taste-overrides.md'), `# taste-skill Overrides

processed_records: ${processed}
`);
}

function writeStatus(stateDir: string, payload: object): void {
    writeFileSync(join(stateDir, 'design-lab/distill-status.json'), `${JSON.stringify(payload)}\n`);
}

function runDriftCheck(fixture: Fixture) {
    return spawnSync('bash', [DRIFT_SCRIPT], {
        env: {
            ...process.env,
            DESIGN_LAB_VAULT_PATH: fixture.vault,
            DESIGN_LAB_STATE_DIR: fixture.stateDir
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

test('distill drift check prints nothing when feedback, taste overrides, and status are healthy', () => {
    const fixture = createFixture();
    writeFeedback(fixture.vault, 2);
    writeTaste(fixture.vault, 2);
    writeStatus(fixture.stateDir, {
        ok: true,
        last_run_iso: new Date().toISOString(),
        records_in: 2,
        records_out: 2,
        drift: 0
    });

    const result = runDriftCheck(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
});

test('distill drift check warns when feedback-log count and processed_records differ', () => {
    const fixture = createFixture();
    writeFeedback(fixture.vault, 3);
    writeTaste(fixture.vault, 2);
    writeStatus(fixture.stateDir, {
        ok: true,
        last_run_iso: new Date().toISOString(),
        records_in: 2,
        records_out: 2,
        drift: 0
    });

    const result = runDriftCheck(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^⚠️ design-lab distill drift: /);
    assert.match(result.stdout, /feedback-log=3 processed_records=2/);
});

test('distill drift check warns for failed or stale status', () => {
    const fixture = createFixture();
    writeFeedback(fixture.vault, 1);
    writeTaste(fixture.vault, 1);
    writeStatus(fixture.stateDir, {
        ok: false,
        last_run_iso: '2026-01-01T00:00:00.000Z',
        error: 'write failed'
    });

    const result = runDriftCheck(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^⚠️ design-lab distill drift: /);
    assert.match(result.stdout, /status.ok=false/);
    assert.match(result.stdout, /last_run>26h/);
});
