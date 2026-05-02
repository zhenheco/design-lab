import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('../scripts/check-schema.sh', import.meta.url).pathname;

test('check-schema: empty vault passes', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    const out = execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.match(out, /OK: schema v\d+ \(no files yet\)/);
});

test('check-schema: vault with schema_version=1 passes', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    mkdirSync(join(vault, 'cases'));
    writeFileSync(join(vault, 'cases', '0001.md'), '---\nschema_version: 1\n---\nbody');
    const out = execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.match(out, /OK: schema v1/);
});

test('check-schema: vault with schema_version=0 (older) fails with migration prompt', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-vault-'));
    mkdirSync(join(vault, 'cases'));
    writeFileSync(join(vault, 'cases', '0001.md'), '---\nschema_version: 0\n---\nbody');
    let exitCode = 0;
    let stderr = '';
    try {
        execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        exitCode = e.status;
        stderr = e.stderr.toString();
    }
    assert.equal(exitCode, 2);
    assert.match(stderr, /MIGRATION_NEEDED.*v0.*v1/);
});
