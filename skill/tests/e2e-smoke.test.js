import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';
const SKILL_DIR = fileURLToPath(new URL('..', import.meta.url));

function runScript(script, args = '', env = {}) {
    return execSync(`bash "${SKILL_DIR}/scripts/${script}" ${args}`, {
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...env }
    });
}

function runScriptFailure(script, args = '', env = {}) {
    try {
        runScript(script, args, env);
    } catch (error) {
        return error;
    }
    throw new Error(`${script} unexpectedly succeeded`);
}

function withVaultEnv(vault, run) {
    const previous = process.env.DESIGN_LAB_VAULT_PATH;
    process.env.DESIGN_LAB_VAULT_PATH = vault;
    try {
        return run();
    } finally {
        if (previous === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previous;
        }
    }
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

    const { writeCase } = await import(join(SKILL_DIR, 'lib/case-writer.ts'));
    withVaultEnv(vault, () => {
        writeCase({
            client: '_personal',
            slug: 'test-stripe',
            sentiment: 'positive',
            scenario: 'landing',
            quote: '測試',
            sourceImagePath: fakeImg,
            tokens: { palette: { primary: '#635BFF' } }
        });
    });

    const statsOut = runScript('stats.sh', '', { DESIGN_LAB_VAULT_PATH: vault });
    assert.match(statsOut, /Total cases: 1 positive/);
    assert.match(statsOut, /landing: 1/);
});

test('E2E: distill regenerates taste-overrides from feedback-log and writes healthy status', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    const stateDir = mkdtempSync(join(tmpdir(), 'dl-state-'));
    runScript('init-library.sh', `"${vault}"`);

    const styleGuidePath = join(vault, 'personal-style-guide.md');
    const styleGuideBefore = readFileSync(styleGuidePath, 'utf8');
    writeFileSync(join(vault, 'feedback-log.jsonl'), [
        JSON.stringify({ signal: 'manual', verdict: 'dislike', dimension: 'color', user_quote: 'too cold', derived_rule: 'Avoid icy palettes.' }),
        JSON.stringify({ signal: 'manual', verdict: 'like', dimension: 'typography', user_quote: 'nice hierarchy', derived_rule: 'Use calm hierarchy.' }),
        JSON.stringify({ signal: 'avoid layout', dimension: 'layout', user_quote: 'template grid' })
    ].join('\n') + '\n');

    runScript('distill.sh', '', {
        DESIGN_LAB_VAULT_PATH: vault,
        DESIGN_LAB_STATE_DIR: stateDir
    });

    const taste = readFileSync(join(vault, 'taste-overrides.md'), 'utf8');
    assert.match(taste, /processed_records: 3/);
    assert.match(taste, /like_records: 1/);
    assert.match(taste, /dislike_records: 2/);
    assert.match(taste, /- color: Avoid icy palettes\./);
    assert.match(taste, /- layout: template grid/);
    assert.match(taste, /- typography: Use calm hierarchy\./);
    assert.equal(readFileSync(styleGuidePath, 'utf8'), styleGuideBefore);

    const status = JSON.parse(readFileSync(join(stateDir, 'design-lab/distill-status.json'), 'utf8'));
    assert.equal(status.ok, true);
    assert.equal(status.records_in, 3);
    assert.equal(status.records_out, 3);
    assert.equal(status.drift, 0);
    assert.match(status.last_run_iso, /^\d{4}-\d{2}-\d{2}T/);
});

test('E2E: distill write failure exits nonzero, writes status, and attempts notification', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-e2e-'));
    const stateDir = mkdtempSync(join(tmpdir(), 'dl-state-'));
    const binDir = mkdtempSync(join(tmpdir(), 'dl-bin-'));
    const notifyLog = join(stateDir, 'notify.log');
    runScript('init-library.sh', `"${vault}"`);
    writeFileSync(join(vault, 'feedback-log.jsonl'), `${JSON.stringify({
        signal: 'negative',
        dimension: 'color',
        user_quote: 'too cold'
    })}\n`);
    writeFileSync(join(binDir, 'osascript'), `#!/usr/bin/env bash\necho "$@" >> "${notifyLog}"\nexit 0\n`);
    chmodSync(join(binDir, 'osascript'), 0o755);
    chmodSync(vault, 0o500);

    try {
        const error = runScriptFailure('distill.sh', '', {
            DESIGN_LAB_VAULT_PATH: vault,
            DESIGN_LAB_STATE_DIR: stateDir,
            PATH: `${binDir}:${process.env.PATH}`
        });

        assert.notEqual(error.status, 0);
        assert.match(String(error.stderr), /ERROR/);
        const status = JSON.parse(readFileSync(join(stateDir, 'design-lab/distill-status.json'), 'utf8'));
        assert.equal(status.ok, false);
        assert.match(status.error, /taste-overrides|EACCES|permission/i);
        assert.match(readFileSync(notifyLog, 'utf8'), /design-lab distill failed/);
    } finally {
        chmodSync(vault, 0o700);
    }
});
