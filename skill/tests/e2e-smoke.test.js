import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';
const SKILL_DIR = fileURLToPath(new URL('..', import.meta.url));

function runScript(script, args = '', env = {}) {
    return execSync(`bash "${SKILL_DIR}/scripts/${script}" ${args}`, {
        encoding: 'utf8',
        env: { ...process.env, ...env }
    });
}

test('E2E: init → schema check → stats on empty vault', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    runScript('init-library.sh', `"${vault}"`);
    assert.ok(existsSync(join(vault, 'personal-style-guide.md')));

    const checkOut = runScript('check-schema.sh', `"${vault}"`);
    assert.match(checkOut, /OK: schema v2/);

    const statsOut = runScript('stats.sh', '', { DESIGN_LAB_VAULT_PATH: vault });
    assert.match(statsOut, /Total cases: 0/);
});

test('E2E: write fake case via case-writer → stats reflects it', async () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    runScript('init-library.sh', `"${vault}"`);

    // Inject a fake case using case-writer
    const fakeImg = join(vault, 'fake.png');
    writeFileSync(fakeImg, 'fake-png-bytes');

    const { writeCase } = await import(join(SKILL_DIR, 'lib/case-writer.js'));
    writeCase(vault, {
        slug: 'test-stripe',
        sentiment: 'positive',
        scenario: 'landing',
        quote: '測試',
        sourceImagePath: fakeImg,
        tokens: { palette: { primary: '#635BFF' } }
    });

    const statsOut = runScript('stats.sh', '', { DESIGN_LAB_VAULT_PATH: vault });
    assert.match(statsOut, /Total cases: 1 positive/);
    assert.match(statsOut, /landing: 1/);
});

test('E2E: distill stub prints help text', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    runScript('init-library.sh', `"${vault}"`);
    const out = runScript('distill.sh', '', { DESIGN_LAB_VAULT_PATH: vault });
    assert.match(out, /v0\.3 自動化/);
    assert.match(out, /personal-style-guide\.md/);
});
