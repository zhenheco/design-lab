import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { createClient, updateClient, archiveClient } from '../lib/client-writer.ts';
import { CURRENT_SCHEMA_VERSION } from '../lib/schema.js';
import { THEME_COLOR_PALETTE } from '../lib/theme-palette.ts';

function setupVault() {
    const vault = mkdtempSync(join(tmpdir(), 'dl-client-writer-ts-'));
    mkdirSync(join(vault, 'clients'));
    return vault;
}

function withVaultEnv<T>(vault: string, fn: () => T): T {
    const previous = process.env.DESIGN_LAB_VAULT_PATH;
    process.env.DESIGN_LAB_VAULT_PATH = vault;

    try {
        return fn();
    } finally {
        if (previous === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previous;
        }
    }
}

function readMeta(vault: string, slug: string) {
    const metaPath = join(vault, 'clients', slug, 'meta.yaml');
    return yaml.load(readFileSync(metaPath, 'utf8'), { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>;
}

function assertIsoTimestamp(value: unknown) {
    assert.equal(typeof value, 'string');
    if (typeof value !== 'string') {
        assert.fail('expected ISO timestamp string');
    }
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(!Number.isNaN(Date.parse(value)));
}

test('createClient: happy path (self)', () => {
    const vault = setupVault();

    const metaPath = withVaultEnv(vault, () =>
        createClient({
            slug: '_personal',
            name: 'Personal Studio',
            type: 'self',
            theme_color: '#1F2937'
        })
    );

    assert.equal(metaPath, join(vault, 'clients', '_personal', 'meta.yaml'));
    assert.ok(existsSync(metaPath));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'anti-library')));
    assert.deepEqual(readdirSync(join(vault, 'clients', '_personal', 'cases')), []);
    assert.deepEqual(readdirSync(join(vault, 'clients', '_personal', 'anti-library')), []);

    const meta = readMeta(vault, '_personal');
    assert.deepEqual(meta, {
        schema_version: 2,
        slug: '_personal',
        name: 'Personal Studio',
        type: 'self',
        created_at: meta.created_at,
        notes: '',
        theme_color: '#1F2937'
    });
    assertIsoTimestamp(meta.created_at);
});

test('createClient: happy path (client)', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    const meta = readMeta(vault, 'aicycle');
    assert.equal(meta.type, 'client');
});

test('createClient: duplicate slug throws', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    assert.throws(
        () =>
            withVaultEnv(vault, () =>
                createClient({
                    slug: 'aicycle',
                    name: 'Aicycle Again',
                    type: 'client',
                    theme_color: '#0F766E'
                })
            ),
        /already exists/
    );
});

test('createClient: invalid slug throws', () => {
    const vault = setupVault();

    assert.throws(
        () =>
            withVaultEnv(vault, () =>
                createClient({
                    slug: 'BAD slug',
                    name: 'Bad',
                    type: 'client',
                    theme_color: '#0F766E'
                })
            ),
        /invalid slug/
    );
});

test('createClient: path-traversal-style slug throws', () => {
    const vault = setupVault();

    assert.throws(
        () =>
            withVaultEnv(vault, () =>
                createClient({
                    slug: '../etc/passwd',
                    name: 'Bad',
                    type: 'client',
                    theme_color: '#0F766E'
                })
            ),
        /invalid slug/
    );
});

test('createClient: invalid theme_color throws', () => {
    const vault = setupVault();

    assert.throws(
        () =>
            withVaultEnv(vault, () =>
                createClient({
                    slug: 'aicycle',
                    name: 'Aicycle',
                    type: 'client',
                    theme_color: '#FF0000'
                })
            ),
        /invalid theme_color/
    );
});

test('createClient: theme_color is normalized case-insensitively', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: '_personal',
            name: 'Personal Studio',
            type: 'self',
            theme_color: '#1f2937'
        })
    );

    const meta = readMeta(vault, '_personal');
    assert.equal(meta.theme_color, '#1F2937');
});

test('createClient: invalid type throws', () => {
    const vault = setupVault();

    assert.throws(
        () =>
            withVaultEnv(vault, () =>
                createClient({
                    slug: 'partner-brand',
                    name: 'Partner Brand',
                    type: 'partner' as 'self' | 'client',
                    theme_color: '#0F766E'
                })
            ),
        /invalid type/
    );
});

test('createClient: notes default to empty string', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    const meta = readMeta(vault, 'aicycle');
    assert.equal(meta.notes, '');
});

test('createClient: created_at is auto-generated when omitted', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    const meta = readMeta(vault, 'aicycle');
    assertIsoTimestamp(meta.created_at);
});

test('createClient: created_at can be explicitly overridden', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E',
            created_at: '2026-01-01'
        })
    );

    const meta = readMeta(vault, 'aicycle');
    assert.equal(meta.created_at, '2026-01-01');
});

test('createClient: writes current schema version', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    const meta = readMeta(vault, 'aicycle');
    assert.equal(meta.schema_version, CURRENT_SCHEMA_VERSION);
});

test('updateClient: patch name updates only name', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: '_personal',
            name: 'Personal Studio',
            type: 'self',
            theme_color: '#1F2937',
            notes: 'Original notes',
            created_at: '2026-01-01'
        })
    );

    withVaultEnv(vault, () => updateClient('_personal', { name: 'New Name' }));

    const meta = readMeta(vault, '_personal');
    assert.deepEqual(meta, {
        schema_version: 2,
        slug: '_personal',
        name: 'New Name',
        type: 'self',
        created_at: '2026-01-01',
        notes: 'Original notes',
        theme_color: '#1F2937'
    });
});

test('updateClient: patch theme_color validates palette', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    withVaultEnv(vault, () => updateClient('aicycle', { theme_color: '#1e40af' }));
    assert.equal(readMeta(vault, 'aicycle').theme_color, '#1E40AF');

    assert.throws(
        () => withVaultEnv(vault, () => updateClient('aicycle', { theme_color: '#FF0000' })),
        /invalid theme_color/
    );
});

test('updateClient: patch type can switch between self and client', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: '_personal',
            name: 'Personal Studio',
            type: 'self',
            theme_color: '#1F2937'
        })
    );

    withVaultEnv(vault, () => updateClient('_personal', { type: 'client' }));
    assert.equal(readMeta(vault, '_personal').type, 'client');

    withVaultEnv(vault, () => updateClient('_personal', { type: 'self' }));
    assert.equal(readMeta(vault, '_personal').type, 'self');
});

test('updateClient: patch notes updates notes', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    withVaultEnv(vault, () => updateClient('aicycle', { notes: 'Updated notes' }));

    const meta = readMeta(vault, 'aicycle');
    assert.equal(meta.notes, 'Updated notes');
});

test('updateClient: notes preserve YAML directive-like content', () => {
    const vault = setupVault();
    const notes = 'version: 1.0\n%TAG !foo!';

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    withVaultEnv(vault, () => updateClient('aicycle', { notes }));

    const meta = readMeta(vault, 'aicycle');
    assert.equal(meta.notes, notes);
});

test('updateClient: slug patch is rejected', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: '_personal',
            name: 'Personal Studio',
            type: 'self',
            theme_color: '#1F2937'
        })
    );

    assert.throws(
        () => withVaultEnv(vault, () => updateClient('_personal', { slug: 'foo' } as any)),
        /cannot change slug/
    );
});

test('updateClient: missing client throws', () => {
    const vault = setupVault();

    assert.throws(
        () => withVaultEnv(vault, () => updateClient('nonexistent', { name: 'New Name' })),
        /client not found/
    );
});

test('updateClient: created_at is preserved after patch', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E',
            created_at: '2026-01-01'
        })
    );

    withVaultEnv(vault, () => updateClient('aicycle', { name: 'Aicycle 2', notes: 'Updated' }));

    const meta = readMeta(vault, 'aicycle');
    assert.equal(meta.created_at, '2026-01-01');
});

test('archiveClient: happy path moves full client directory', () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );
    writeFileSync(join(vault, 'clients', 'aicycle', 'cases', 'landing.md'), 'case');
    writeFileSync(join(vault, 'clients', 'aicycle', 'anti-library', 'bad.md'), 'anti');

    const archivedPath = withVaultEnv(vault, () => archiveClient('aicycle'));

    assert.equal(typeof archivedPath, 'string');
    assert.ok(!existsSync(join(vault, 'clients', 'aicycle')));
    assert.match(archivedPath, /clients\/\.archived\/aicycle-/);
    assert.ok(existsSync(archivedPath));
    assert.ok(existsSync(join(archivedPath, 'meta.yaml')));
    assert.ok(existsSync(join(archivedPath, 'cases')));
    assert.ok(existsSync(join(archivedPath, 'anti-library')));
    assert.ok(existsSync(join(archivedPath, 'cases', 'landing.md')));
    assert.ok(existsSync(join(archivedPath, 'anti-library', 'bad.md')));
});

test('archiveClient: missing client throws', () => {
    const vault = setupVault();

    assert.throws(
        () => withVaultEnv(vault, () => archiveClient('nonexistent')),
        /client not found/
    );
});

test('archiveClient: same slug can be archived multiple times without conflict', async () => {
    const vault = setupVault();

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle',
            type: 'client',
            theme_color: '#0F766E'
        })
    );
    const firstArchivePath = withVaultEnv(vault, () => archiveClient('aicycle'));

    await new Promise((resolve) => setTimeout(resolve, 5));

    withVaultEnv(vault, () =>
        createClient({
            slug: 'aicycle',
            name: 'Aicycle Reloaded',
            type: 'client',
            theme_color: '#1E40AF'
        })
    );
    const secondArchivePath = withVaultEnv(vault, () => archiveClient('aicycle'));

    assert.notEqual(firstArchivePath, secondArchivePath);
    assert.ok(existsSync(firstArchivePath));
    assert.ok(existsSync(secondArchivePath));
});

test('theme-palette: THEME_COLOR_PALETTE has 12 colors', () => {
    assert.equal(THEME_COLOR_PALETTE.length, 12);
});

test('theme-palette: first color is #1F2937', () => {
    assert.equal(THEME_COLOR_PALETTE[0], '#1F2937');
});
