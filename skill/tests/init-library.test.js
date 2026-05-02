import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/init-library.sh', import.meta.url));

test('init-library: creates expected directory tree', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });

    assert.ok(existsSync(join(vault, 'personal-style-guide.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'landing.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'saas-ui.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'brand.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'content.md')));
    assert.ok(existsSync(join(vault, 'cases')));
    assert.ok(existsSync(join(vault, 'anti-library')));
    assert.ok(existsSync(join(vault, 'candidates')));
});

test('init-library: personal-style-guide has schema_version=1', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    const content = readFileSync(join(vault, 'personal-style-guide.md'), 'utf8');
    assert.match(content, /schema_version: 1/);
    assert.match(content, /## DO/);
    assert.match(content, /## NEVER/);
    assert.match(content, /## SOMETIMES/);
});

test('init-library: idempotent (re-run does not overwrite)', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    // 用戶手改 personal-style-guide
    const guidePath = join(vault, 'personal-style-guide.md');
    const original = readFileSync(guidePath, 'utf8');
    const modified = original + '\n## My custom rule\n';
    writeFileSync(guidePath, modified);

    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    const after = readFileSync(guidePath, 'utf8');
    assert.equal(after, modified, 'init should not overwrite user changes');
});
