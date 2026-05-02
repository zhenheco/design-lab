import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../server.ts';

function setupVault() {
    const vault = mkdtempSync(join(tmpdir(), 'dl-sidecar-api-ts-'));
    mkdirSync(join(vault, 'clients'), { recursive: true });
    return vault;
}

async function withVaultEnv<T>(vault: string, fn: () => Promise<T> | T): Promise<T> {
    const previousVault = process.env.DESIGN_LAB_VAULT_PATH;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.DESIGN_LAB_VAULT_PATH = vault;
    process.env.NODE_ENV = 'test';

    try {
        return await fn();
    } finally {
        if (previousVault === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previousVault;
        }

        if (previousNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previousNodeEnv;
        }
    }
}

function createAgent() {
    return request(createApp());
}

function writeClientMeta(vault: string, slug: string, overrides: Partial<{ name: string; type: 'self' | 'client'; theme_color: string; created_at: string; notes: string }> = {}) {
    const clientDir = join(vault, 'clients', slug);
    mkdirSync(clientDir, { recursive: true });
    writeFileSync(
        join(clientDir, 'meta.yaml'),
        [
            'schema_version: 2',
            `slug: ${slug}`,
            `name: ${JSON.stringify(overrides.name ?? slug)}`,
            `type: ${overrides.type ?? 'client'}`,
            `created_at: ${JSON.stringify(overrides.created_at ?? '2026-05-03T00:00:00.000Z')}`,
            `notes: ${JSON.stringify(overrides.notes ?? '')}`,
            `theme_color: ${JSON.stringify(overrides.theme_color ?? '#0F766E')}`,
            ''
        ].join('\n')
    );
}

test('GET /api/clients empty -> 200 { clients: [] }', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () => createAgent().get('/api/clients'));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { clients: [] });
});

test('POST /api/clients valid -> 201 + slug', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/clients').send({
            slug: 'acme',
            name: 'Acme',
            type: 'client',
            theme_color: '#0F766E'
        })
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.slug, 'acme');
    assert.equal(response.body.metaPath, join(vault, 'clients', 'acme', 'meta.yaml'));
    assert.ok(existsSync(join(vault, 'clients', 'acme', 'meta.yaml')));
});

test('POST /api/clients invalid theme_color -> 400', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/clients').send({
            slug: 'bad-color',
            name: 'Bad Color',
            type: 'client',
            theme_color: '#FF0000'
        })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /invalid theme_color/);
});

test('PUT /api/clients/:slug -> 200', async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');

    const response = await withVaultEnv(vault, () =>
        createAgent().put('/api/clients/acme').send({
            name: 'Acme Updated',
            notes: 'Updated notes'
        })
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { slug: 'acme' });
    assert.match(readFileSync(join(vault, 'clients', 'acme', 'meta.yaml'), 'utf8'), /Acme Updated/);
});

test('PUT /api/clients/:slug non-exist -> 404', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent().put('/api/clients/missing').send({
            name: 'Missing'
        })
    );

    assert.equal(response.status, 404);
    assert.match(response.body.error, /client not found/);
});

test('DELETE /api/clients/:slug -> 200 + archivePath', async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');

    const response = await withVaultEnv(vault, () => createAgent().delete('/api/clients/acme'));

    assert.equal(response.status, 200);
    assert.equal(response.body.slug, 'acme');
    assert.match(response.body.archivePath, /clients\/\.archived\/acme-/);
    assert.ok(existsSync(response.body.archivePath));
});

test('GET /api/cases empty -> 200 { cases: [] }', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () => createAgent().get('/api/cases'));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { cases: [] });
});

test('POST /api/cases valid -> 201', async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');
    const fixture = join(vault, 'fixture.png');
    writeFileSync(fixture, 'png');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/cases').send({
            client: 'acme',
            slug: '0001',
            sentiment: 'positive',
            scenario: 'landing',
            quote: 'Strong hero section',
            sourceImagePath: fixture,
            tokens: { palette: 'warm' }
        })
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.casePath, join(vault, 'clients', 'acme', 'cases', '0001.md'));
    assert.equal(response.body.assetsDir, join(vault, 'clients', 'acme', 'cases', '0001'));
    assert.ok(existsSync(response.body.casePath));
});

test('POST /api/cases missing client -> 400', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/cases').send({
            client: 'missing',
            slug: '0001',
            sentiment: 'positive',
            scenario: 'landing',
            quote: 'Strong hero section',
            sourceImagePath: '/tmp/missing.png'
        })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /client not registered/);
});

test('GET /api/style-guide existing -> 200 + content + contentHash', async () => {
    const vault = setupVault();
    writeFileSync(join(vault, 'personal-style-guide.md'), '# Voice\n\nKeep it sharp.\n');

    const response = await withVaultEnv(vault, () => createAgent().get('/api/style-guide'));

    assert.equal(response.status, 200);
    assert.equal(response.body.content, '# Voice\n\nKeep it sharp.\n');
    assert.match(response.body.contentHash, /^[a-f0-9]{64}$/);
});

test('POST /api/style-guide write -> 200 + new hash', async () => {
    const vault = setupVault();
    writeFileSync(join(vault, 'personal-style-guide.md'), 'old content');

    const initial = await withVaultEnv(vault, () => createAgent().get('/api/style-guide'));
    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/style-guide').send({
            content: 'new content',
            expectedHash: initial.body.contentHash
        })
    );

    assert.equal(response.status, 200);
    assert.match(response.body.contentHash, /^[a-f0-9]{64}$/);
    assert.notEqual(response.body.contentHash, initial.body.contentHash);
    assert.equal(readFileSync(join(vault, 'personal-style-guide.md'), 'utf8'), 'new content');
});

test('POST /api/style-guide hash conflict -> 409', async () => {
    const vault = setupVault();
    writeFileSync(join(vault, 'personal-style-guide.md'), 'current content');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/style-guide').send({
            content: 'new content',
            expectedHash: 'stale-hash'
        })
    );

    assert.equal(response.status, 409);
    assert.match(response.body.error, /hash conflict/);
});

test('GET /api/scenario-overrides -> 200 + array', async () => {
    const vault = setupVault();
    const overridesDir = join(vault, 'scenario-overrides');
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(join(overridesDir, 'landing.md'), 'Landing override');

    const response = await withVaultEnv(vault, () => createAgent().get('/api/scenario-overrides'));

    assert.equal(response.status, 200);
    assert.equal(response.body.overrides.length, 1);
    assert.equal(response.body.overrides[0].scenario, 'landing');
    assert.equal(response.body.overrides[0].content, 'Landing override');
    assert.match(response.body.overrides[0].contentHash, /^[a-f0-9]{64}$/);
});

test('POST /api/scenario-overrides/:scenario -> 200', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/scenario-overrides/landing').send({
            content: 'Landing override'
        })
    );

    assert.equal(response.status, 200);
    assert.match(response.body.contentHash, /^[a-f0-9]{64}$/);
    assert.equal(readFileSync(join(vault, 'scenario-overrides', 'landing.md'), 'utf8'), 'Landing override');
});

test('GET /api/context -> 200 + stub keys', async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');

    const response = await withVaultEnv(vault, () => createAgent().get('/api/context').query({ client: 'acme', scenario: 'landing' }));

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), [
        'antiCases',
        'cases',
        'client',
        'neverRules',
        'retrievedFrom',
        'scenarioOverride',
        'styleGuide'
    ]);
    assert.equal(response.body.client.slug, 'acme');
    assert.deepEqual(response.body.cases, []);
    assert.deepEqual(response.body.antiCases, []);
    assert.deepEqual(response.body.neverRules, []);
    assert.deepEqual(response.body.retrievedFrom, []);
});
