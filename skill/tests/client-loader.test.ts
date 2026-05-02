import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllClients, loadClient, type ClientMeta } from '../lib/client-loader.ts';

function setupVault() {
    const vault = mkdtempSync(join(tmpdir(), 'dl-client-loader-ts-'));
    mkdirSync(join(vault, 'clients'));
    return vault;
}

function writeMeta(vault: string, slug: string, content: string) {
    const clientDir = join(vault, 'clients', slug);
    mkdirSync(clientDir);
    writeFileSync(join(clientDir, 'meta.yaml'), content);
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

function buildMetaYaml(overrides: Partial<ClientMeta> = {}): string {
    const meta: ClientMeta = {
        schema_version: 2,
        slug: overrides.slug ?? '_personal',
        name: overrides.name ?? 'Personal Studio',
        type: overrides.type ?? 'self',
        created_at: overrides.created_at ?? '2026-05-03',
        notes: overrides.notes ?? '',
        theme_color: overrides.theme_color ?? '#1F2937'
    };

    return [
        `schema_version: ${meta.schema_version}`,
        `slug: ${meta.slug}`,
        `name: ${JSON.stringify(meta.name)}`,
        `type: ${meta.type}`,
        `created_at: ${JSON.stringify(meta.created_at)}`,
        `notes: ${JSON.stringify(meta.notes)}`,
        `theme_color: ${JSON.stringify(meta.theme_color)}`,
        ''
    ].join('\n');
}

test('loadAllClients: empty vault returns []', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-client-loader-ts-'));

    const clients = withVaultEnv(vault, () => loadAllClients());

    assert.deepEqual(clients, []);
});

test('loadAllClients: clients dir exists but no clients returns []', () => {
    const vault = setupVault();

    const clients = withVaultEnv(vault, () => loadAllClients());

    assert.deepEqual(clients, []);
});

test('loadAllClients: single self client returns parsed ClientMeta', () => {
    const vault = setupVault();
    writeMeta(
        vault,
        '_personal',
        buildMetaYaml({
            slug: '_personal',
            name: 'Personal Studio',
            type: 'self'
        })
    );

    const clients = withVaultEnv(vault, () => loadAllClients());

    assert.deepEqual(clients, [
        {
            schema_version: 2,
            slug: '_personal',
            name: 'Personal Studio',
            type: 'self',
            created_at: '2026-05-03',
            notes: '',
            theme_color: '#1F2937'
        }
    ]);
    assert.equal(clients[0].type, 'self');
});

test('loadAllClients: multiple clients sorted by slug', () => {
    const vault = setupVault();
    writeMeta(vault, 'bravo', buildMetaYaml({ slug: 'bravo', name: 'Bravo', type: 'client' }));
    writeMeta(vault, 'alpha', buildMetaYaml({ slug: 'alpha', name: 'Alpha', type: 'client' }));
    writeMeta(vault, 'charlie', buildMetaYaml({ slug: 'charlie', name: 'Charlie', type: 'client' }));

    const clients = withVaultEnv(vault, () => loadAllClients());

    assert.deepEqual(
        clients.map((client) => client.slug),
        ['alpha', 'bravo', 'charlie']
    );
});

test('loadClient: hit returns matching client', () => {
    const vault = setupVault();
    writeMeta(vault, 'aicycle', buildMetaYaml({ slug: 'aicycle', name: 'Aicycle', type: 'client' }));
    writeMeta(vault, '_personal', buildMetaYaml({ slug: '_personal', name: 'Personal Studio', type: 'self' }));

    const client = withVaultEnv(vault, () => loadClient('aicycle'));

    assert.ok(client);
    assert.equal(client.slug, 'aicycle');
});

test('loadClient: miss returns null', () => {
    const vault = setupVault();
    writeMeta(vault, 'aicycle', buildMetaYaml({ slug: 'aicycle', name: 'Aicycle', type: 'client' }));

    const client = withVaultEnv(vault, () => loadClient('nonexistent'));

    assert.equal(client, null);
});

test('loadClient: special characters in quoted name are preserved', () => {
    const vault = setupVault();
    writeMeta(vault, 'aicycle', buildMetaYaml({ slug: 'aicycle', name: 'AICycle: 循環經濟', type: 'client' }));

    const client = withVaultEnv(vault, () => loadClient('aicycle'));

    assert.ok(client);
    assert.equal(client.name, 'AICycle: 循環經濟');
});

test('loadAllClients: broken YAML is skipped and warns', () => {
    const vault = setupVault();
    writeMeta(vault, 'broken-yaml', 'slug: [unclosed\n');
    const warn = mock.method(console, 'warn', () => {});

    try {
        const clients = withVaultEnv(vault, () => loadAllClients());

        assert.deepEqual(clients, []);
        assert.ok(warn.mock.calls.length >= 1);
        assert.ok(
            warn.mock.calls.some((call) => {
                const message = String(call.arguments[0]);
                return message.includes('broken-yaml') && message.includes('meta.yaml');
            })
        );
    } finally {
        warn.mock.restore();
    }
});

test('loadAllClients: invalid type enum is skipped and warns', () => {
    const vault = setupVault();
    writeMeta(
        vault,
        'partner-brand',
        [
            'schema_version: 2',
            'slug: partner-brand',
            'name: Partner Brand',
            'type: partner',
            'created_at: 2026-05-03',
            'notes: ""',
            'theme_color: "#1F2937"',
            ''
        ].join('\n')
    );
    const warn = mock.method(console, 'warn', () => {});

    try {
        const clients = withVaultEnv(vault, () => loadAllClients());

        assert.deepEqual(clients, []);
        assert.ok(warn.mock.calls.length >= 1);
        assert.match(String(warn.mock.calls[0].arguments[0]), /\[client-loader\]/);
        assert.match(String(warn.mock.calls[0].arguments[0]), /partner-brand/);
        assert.match(String(warn.mock.calls[0].arguments[0]), /invalid type/);
    } finally {
        warn.mock.restore();
    }
});

test('loadAllClients: missing required field is skipped and warns', () => {
    const vault = setupVault();
    writeMeta(
        vault,
        'missing-name',
        ['schema_version: 2', 'slug: missing-name', 'type: client', 'created_at: 2026-05-03', 'notes: ""', 'theme_color: "#1F2937"', ''].join('\n')
    );
    const warn = mock.method(console, 'warn', () => {});

    try {
        const clients = withVaultEnv(vault, () => loadAllClients());

        assert.deepEqual(clients, []);
        assert.ok(warn.mock.calls.length >= 1);
        assert.match(String(warn.mock.calls[0].arguments[0]), /missing-name/);
        assert.match(String(warn.mock.calls[0].arguments[0]), /missing or invalid field/);
    } finally {
        warn.mock.restore();
    }
});

test('loadAllClients: broken symlink is skipped and warns', () => {
    const vault = setupVault();
    writeMeta(vault, '_personal', buildMetaYaml({ slug: '_personal', name: 'Personal Studio', type: 'self' }));
    symlinkSync('/nonexistent', join(vault, 'clients', 'broken-symlink'), 'dir');
    const warn = mock.method(console, 'warn', () => {});

    try {
        const clients = withVaultEnv(vault, () => loadAllClients());

        assert.deepEqual(
            clients.map((client) => client.slug),
            ['_personal']
        );
        assert.ok(
            warn.mock.calls.some((call) => {
                const message = String(call.arguments[0]);
                return message.includes('cannot stat') && message.includes('broken-symlink');
            })
        );
    } finally {
        warn.mock.restore();
    }
});

test('loadAllClients: good and bad clients can coexist', () => {
    const vault = setupVault();
    writeMeta(vault, 'aicycle', buildMetaYaml({ slug: 'aicycle', name: 'Aicycle', type: 'client' }));
    writeMeta(vault, 'broken-yaml', 'slug: [unclosed\n');
    const warn = mock.method(console, 'warn', () => {});

    try {
        const clients = withVaultEnv(vault, () => loadAllClients());

        assert.deepEqual(
            clients.map((client) => client.slug),
            ['aicycle']
        );
        assert.equal(warn.mock.calls.length, 1);
    } finally {
        warn.mock.restore();
    }
});

test('loadClient: broken YAML returns null and warns', () => {
    const vault = setupVault();
    writeMeta(vault, 'broken-yaml', 'slug: [unclosed\n');
    const warn = mock.method(console, 'warn', () => {});

    try {
        const client = withVaultEnv(vault, () => loadClient('broken-yaml'));

        assert.equal(client, null);
        assert.equal(warn.mock.calls.length, 1);
        assert.match(String(warn.mock.calls[0].arguments[0]), /broken-yaml/);
        assert.match(String(warn.mock.calls[0].arguments[0]), /meta\.yaml/);
    } finally {
        warn.mock.restore();
    }
});

test('directory slug mismatch is skipped and warns', () => {
    const vault = setupVault();
    writeMeta(vault, 'aicycle', buildMetaYaml({ slug: 'zhenheco', name: 'Aicycle', type: 'client' }));
    const warn = mock.method(console, 'warn', () => {});

    try {
        const clients = withVaultEnv(vault, () => loadAllClients());
        const client = withVaultEnv(vault, () => loadClient('aicycle'));

        assert.deepEqual(clients, []);
        assert.equal(client, null);
        assert.ok(
            warn.mock.calls.some((call) => String(call.arguments[0]).includes('does not match meta.yaml slug'))
        );
    } finally {
        warn.mock.restore();
    }
});

test('loadAllClients: unsupported schema_version is skipped and warns', () => {
    const vault = setupVault();
    writeMeta(
        vault,
        'legacy-client',
        [
            'schema_version: 1',
            'slug: legacy-client',
            'name: Legacy Client',
            'type: client',
            'created_at: 2026-05-03',
            'notes: ""',
            'theme_color: "#1F2937"',
            ''
        ].join('\n')
    );
    const warn = mock.method(console, 'warn', () => {});

    try {
        const clients = withVaultEnv(vault, () => loadAllClients());

        assert.deepEqual(clients, []);
        assert.equal(warn.mock.calls.length, 1);
        assert.match(String(warn.mock.calls[0].arguments[0]), /unsupported schema/);
    } finally {
        warn.mock.restore();
    }
});
