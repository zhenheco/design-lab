import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/init-library.sh', import.meta.url));

test('init-library: creates v0.2 multi-client directory tree', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });

    assert.ok(existsSync(join(vault, 'personal-style-guide.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'landing.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'saas-ui.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'brand.md')));
    assert.ok(existsSync(join(vault, 'scenario-overrides', 'content.md')));
    assert.ok(existsSync(join(vault, 'candidates')));
    assert.ok(existsSync(join(vault, '.index')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'anti-library')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'meta.yaml')));

    assert.equal(existsSync(join(vault, 'cases')), false, 'root cases/ should not exist (moved to clients/_personal/cases/)');
    assert.equal(existsSync(join(vault, 'anti-library')), false, 'root anti-library/ should not exist');
});

test('init-library: personal-style-guide has schema_version=2', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    const content = readFileSync(join(vault, 'personal-style-guide.md'), 'utf8');
    assert.match(content, /schema_version: 2/);
    assert.match(content, /## DO/);
    assert.match(content, /## NEVER/);
    assert.match(content, /## SOMETIMES/);
});

test('init-library: _personal meta.yaml has v2 schema + type self + theme_color', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });

    const meta = readFileSync(join(vault, 'clients', '_personal', 'meta.yaml'), 'utf8');
    assert.match(meta, /^schema_version: 2$/m);
    assert.match(meta, /^slug: _personal$/m);
    assert.match(meta, /^type: self$/m);
    assert.match(meta, /^theme_color:\s*"#[0-9A-Fa-f]{6}"$/m);
    assert.doesNotMatch(meta, /PLACEHOLDER_/);
});

test('init-library: idempotent (re-run does not overwrite user changes)', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-init-'));
    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    // 用戶手改 personal-style-guide
    const guidePath = join(vault, 'personal-style-guide.md');
    const original = readFileSync(guidePath, 'utf8');
    const modifiedGuide = original + '\n## My custom rule\n';
    writeFileSync(guidePath, modifiedGuide);

    // 用戶手改 _personal/meta.yaml
    const metaPath = join(vault, 'clients', '_personal', 'meta.yaml');
    const originalMeta = readFileSync(metaPath, 'utf8');
    const modifiedMeta = originalMeta.replace('我的品牌（未分類）', 'My Brand (Edited)');
    writeFileSync(metaPath, modifiedMeta);

    execSync(`bash "${SCRIPT}" "${vault}"`, { encoding: 'utf8' });
    assert.equal(readFileSync(guidePath, 'utf8'), modifiedGuide, 'guide should not be overwritten');
    assert.equal(readFileSync(metaPath, 'utf8'), modifiedMeta, 'meta should not be overwritten');
});
