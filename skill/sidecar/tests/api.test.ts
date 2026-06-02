import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { createApp, errorHandler } from '../server.ts';
import { authHeaders } from './helpers/auth-headers.ts';

process.env.DESIGN_LAB_API_TOKEN = 'test-token-for-supertest';

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

async function withEnvVars<T>(
    overrides: Record<string, string | undefined>,
    fn: () => Promise<T> | T
): Promise<T> {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        return await fn();
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
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

type CaseFixture = {
    slug: string;
    scenario: string;
    sentiment: 'positive' | 'negative';
    quotes_from_user?: string[];
};

function writeCaseMarkdown(vault: string, clientSlug: string, fixture: CaseFixture) {
    const baseDir =
        fixture.sentiment === 'negative'
            ? join(vault, 'clients', clientSlug, 'anti-library')
            : join(vault, 'clients', clientSlug, 'cases');
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(
        join(baseDir, `${fixture.slug}.md`),
        [
            '---',
            'schema_version: 2',
            `client: ${clientSlug}`,
            `slug: ${fixture.slug}`,
            `scenario: ${fixture.scenario}`,
            `sentiment: ${fixture.sentiment}`,
            `quotes_from_user: ${JSON.stringify(fixture.quotes_from_user ?? [])}`,
            '---',
            ''
        ].join('\n')
    );
}

function writeStyleGuide(vault: string, content: string) {
    writeFileSync(join(vault, 'personal-style-guide.md'), content);
}

function writeClientStyleGuide(vault: string, slug: string, content: string) {
    const clientDir = join(vault, 'clients', slug);
    mkdirSync(clientDir, { recursive: true });
    writeFileSync(join(clientDir, 'style-guide.md'), content);
}

function writeScenarioOverride(vault: string, scenario: string, content: string) {
    const overridesDir = join(vault, 'scenario-overrides');
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(join(overridesDir, `${scenario}.md`), content);
}

function seedContextBaseFixture(vault: string) {
    writeClientMeta(vault, '_personal', { type: 'self' });
    writeClientMeta(vault, 'aicycle', { type: 'client' });
    writeClientMeta(vault, 'zhenheco', { type: 'self' });

    writeStyleGuide(
        vault,
        [
            '# Personal Style Guide',
            '',
            '## NEVER',
            '- id: no-hard-black',
            '  rule: "Avoid pure black in CSS"',
            '  detector:',
            '    type: regex',
            "    pattern: '#000000'",
            '    target: css',
            ''
        ].join('\n')
    );
    writeScenarioOverride(vault, 'landing', 'Landing override content\n');

    writeCaseMarkdown(vault, '_personal', { slug: 'self-pos-1', scenario: 'landing', sentiment: 'positive' });
    writeCaseMarkdown(vault, '_personal', { slug: 'self-pos-2', scenario: 'landing', sentiment: 'positive' });
    writeCaseMarkdown(vault, '_personal', { slug: 'self-pos-3', scenario: 'brand', sentiment: 'positive' });
    writeCaseMarkdown(vault, '_personal', { slug: 'self-neg-1', scenario: 'landing', sentiment: 'negative' });
    writeCaseMarkdown(vault, 'aicycle', { slug: 'client-pos-1', scenario: 'landing', sentiment: 'positive' });
    writeCaseMarkdown(vault, 'aicycle', { slug: 'client-neg-1', scenario: 'brand', sentiment: 'negative' });
    writeCaseMarkdown(vault, 'zhenheco', { slug: 'self2-pos-1', scenario: 'brand', sentiment: 'positive' });
    writeCaseMarkdown(vault, 'zhenheco', { slug: 'self2-neg-1', scenario: 'brand', sentiment: 'negative' });
}

function seedContextLimitFixture(vault: string) {
    writeClientMeta(vault, '_personal', { type: 'self' });
    writeClientMeta(vault, 'zhenheco', { type: 'self' });

    writeStyleGuide(vault, '# Personal Style Guide\n');

    for (let index = 1; index <= 7; index += 1) {
        writeCaseMarkdown(vault, '_personal', {
            slug: `top-pos-${String(index).padStart(2, '0')}`,
            scenario: 'landing',
            sentiment: 'positive'
        });
    }

    for (let index = 1; index <= 6; index += 1) {
        writeCaseMarkdown(vault, '_personal', {
            slug: `top-neg-${String(index).padStart(2, '0')}`,
            scenario: 'landing',
            sentiment: 'negative'
        });
    }

    writeCaseMarkdown(vault, 'zhenheco', { slug: 'self2-brand-pos', scenario: 'brand', sentiment: 'positive' });
}

function summarizeResponseClients(body: { cases: Array<{ client: string }>; antiCases: Array<{ client: string }> }) {
    return Array.from(new Set([...body.cases, ...body.antiCases].map((entry) => entry.client))).sort();
}

test('GET /api/clients empty -> 200 { clients: [] }', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () => createAgent().get('/api/clients').set(authHeaders()));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { clients: [] });
});

test('POST /api/clients valid -> 201 + slug', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/clients').set(authHeaders()).send({
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
        createAgent().post('/api/clients').set(authHeaders()).send({
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
        createAgent().put('/api/clients/acme').set(authHeaders()).send({
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
        createAgent().put('/api/clients/missing').set(authHeaders()).send({
            name: 'Missing'
        })
    );

    assert.equal(response.status, 404);
    assert.match(response.body.error, /client not found/);
});

test('DELETE /api/clients/:slug -> 200 + archivePath', async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');

    const response = await withVaultEnv(vault, () => createAgent().delete('/api/clients/acme').set(authHeaders()));

    assert.equal(response.status, 200);
    assert.equal(response.body.slug, 'acme');
    assert.match(response.body.archivePath, /clients\/\.archived\/acme-/);
    assert.ok(existsSync(response.body.archivePath));
});

test('GET /api/cases empty -> 200 { cases: [] }', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () => createAgent().get('/api/cases').set(authHeaders()));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { cases: [] });
});

test('POST /api/cases valid -> 201', async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');
    const fixture = join(vault, 'fixture.png');
    writeFileSync(fixture, 'png');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/cases').set(authHeaders()).send({
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
    const sourceDir = mkdtempSync(join(tmpdir(), 'dl-missing-client-'));
    const sourceImagePath = join(sourceDir, 'missing.png');
    writeFileSync(sourceImagePath, 'png');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/cases').set(authHeaders()).send({
            client: 'missing',
            slug: '0001',
            sentiment: 'positive',
            scenario: 'landing',
            quote: 'Strong hero section',
            sourceImagePath
        })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /client not registered/);
});

test('GET /api/style-guide existing -> 200 + content + contentHash', async () => {
    const vault = setupVault();
    writeFileSync(join(vault, 'personal-style-guide.md'), '# Voice\n\nKeep it sharp.\n');

    const response = await withVaultEnv(vault, () => createAgent().get('/api/style-guide').set(authHeaders()));

    assert.equal(response.status, 200);
    assert.equal(response.body.content, '# Voice\n\nKeep it sharp.\n');
    assert.match(response.body.contentHash, /^[a-f0-9]{64}$/);
});

test('POST /api/style-guide write -> 200 + new hash', async () => {
    const vault = setupVault();
    writeFileSync(join(vault, 'personal-style-guide.md'), 'old content');

    const initial = await withVaultEnv(vault, () => createAgent().get('/api/style-guide').set(authHeaders()));
    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/style-guide').set(authHeaders()).send({
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
        createAgent().post('/api/style-guide').set(authHeaders()).send({
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

    const response = await withVaultEnv(vault, () => createAgent().get('/api/scenario-overrides').set(authHeaders()));

    assert.equal(response.status, 200);
    assert.equal(response.body.overrides.length, 1);
    assert.equal(response.body.overrides[0].scenario, 'landing');
    assert.equal(response.body.overrides[0].content, 'Landing override');
    assert.match(response.body.overrides[0].contentHash, /^[a-f0-9]{64}$/);
});

test('POST /api/scenario-overrides/:scenario -> 200', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/scenario-overrides/landing').set(authHeaders()).send({
            content: 'Landing override'
        })
    );

    assert.equal(response.status, 200);
    assert.match(response.body.contentHash, /^[a-f0-9]{64}$/);
    assert.equal(readFileSync(join(vault, 'scenario-overrides', 'landing.md'), 'utf8'), 'Landing override');
});

test('GET /api/context without query -> 200 + full union payload', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);

    const response = await withVaultEnv(vault, () => createAgent().get('/api/context').set(authHeaders()));

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), [
        'antiCases',
        'brandStyleGuide',
        'cases',
        'client',
        'neverRules',
        'retrievedFrom',
        'scenarioOverride',
        'styleGuide'
    ]);
    assert.equal(response.body.client, null);
    assert.equal(response.body.brandStyleGuide, '');
    assert.equal(response.body.scenarioOverride, '');
    assert.deepEqual(
        response.body.neverRules.map((rule: { id: string }) => rule.id),
        ['no-hard-black']
    );
    assert.deepEqual(response.body.retrievedFrom, ['_personal', 'aicycle', 'zhenheco']);
    assert.deepEqual(summarizeResponseClients(response.body), ['_personal', 'aicycle', 'zhenheco']);
});

test('GET /api/context?client=aicycle -> target client meta + self union scope', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: 'aicycle' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.client.slug, 'aicycle');
    assert.equal(response.body.brandStyleGuide, '');
    assert.deepEqual(response.body.retrievedFrom, ['_personal', 'aicycle', 'zhenheco']);
    assert.deepEqual(summarizeResponseClients(response.body), ['_personal', 'aicycle', 'zhenheco']);
});

test('GET /api/context?client=_personal -> self clients only', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: '_personal' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.client.slug, '_personal');
    assert.deepEqual(response.body.retrievedFrom, ['_personal', 'zhenheco']);
    assert.deepEqual(summarizeResponseClients(response.body), ['_personal', 'zhenheco']);
});

test('GET /api/context?client=ghost -> unknown client returns null + self union fallback', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: 'ghost' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.client, null);
    assert.equal(response.body.brandStyleGuide, '');
    assert.deepEqual(response.body.retrievedFrom, ['_personal', 'zhenheco']);
    assert.deepEqual(summarizeResponseClients(response.body), ['_personal', 'zhenheco']);
});

test('GET /api/context?client=whatcanido -> includes per-brand brandStyleGuide and global styleGuide', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);
    writeClientMeta(vault, 'whatcanido', { type: 'client' });
    const globalStyleGuide = '# Personal Style Guide\n\nGlobal design baseline.\n';
    const brandStyleGuide = '# WhatCanIDo Style Guide\n\nBrand-specific rhythm.\n';
    writeStyleGuide(vault, globalStyleGuide);
    writeClientStyleGuide(vault, 'whatcanido', brandStyleGuide);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: 'whatcanido' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.styleGuide, globalStyleGuide);
    assert.equal(response.body.brandStyleGuide, brandStyleGuide);
});

test('GET /api/context?client=whatcanido -> merges global and per-brand NEVER rules with global priority', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);
    writeClientMeta(vault, 'whatcanido', { type: 'client' });
    writeStyleGuide(
        vault,
        [
            '# Personal Style Guide',
            '',
            '## NEVER',
            '- id: global-a',
            '  rule: "Global rule A"',
            '  detector:',
            '    type: regex',
            "    pattern: 'global-a-pattern'",
            '    target: css',
            '- id: shared-id',
            '  rule: "Global shared rule"',
            '  detector:',
            '    type: regex',
            "    pattern: 'global-shared-pattern'",
            '    target: css',
            ''
        ].join('\n')
    );
    writeClientStyleGuide(
        vault,
        'whatcanido',
        [
            '# WhatCanIDo Style Guide',
            '',
            '## NEVER',
            '- id: brand-b',
            '  rule: "Brand rule B"',
            '  detector:',
            '    type: regex',
            "    pattern: 'brand-b-pattern'",
            '    target: css',
            '- id: shared-id',
            '  rule: "Brand shared rule should not override"',
            '  detector:',
            '    type: regex',
            "    pattern: 'brand-shared-pattern'",
            '    target: css',
            ''
        ].join('\n')
    );

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: 'whatcanido' })
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.neverRules.map((rule: { id: string }) => rule.id).sort(),
        ['brand-b', 'global-a', 'shared-id']
    );
    assert.deepEqual(
        response.body.neverRules.find((rule: { id: string }) => rule.id === 'shared-id'),
        {
            id: 'shared-id',
            rule: 'Global shared rule',
            detector: {
                type: 'regex',
                pattern: 'global-shared-pattern',
                target: 'css'
            }
        }
    );
});

test('GET /api/context?client=whatcanido -> returns brand-only NEVER rules when global guide has none', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);
    writeClientMeta(vault, 'whatcanido', { type: 'client' });
    writeStyleGuide(vault, '# Personal Style Guide\n\nGlobal baseline without rules.\n');
    writeClientStyleGuide(
        vault,
        'whatcanido',
        [
            '# WhatCanIDo Style Guide',
            '',
            '## NEVER',
            '- id: brand-only',
            '  rule: "Brand-only rule"',
            '  detector:',
            '    type: regex',
            "    pattern: 'brand-only-pattern'",
            '    target: css',
            ''
        ].join('\n')
    );

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: 'whatcanido' })
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.neverRules, [
        {
            id: 'brand-only',
            rule: 'Brand-only rule',
            detector: {
                type: 'regex',
                pattern: 'brand-only-pattern',
                target: 'css'
            }
        }
    ]);
});

test('GET /api/context per-brand style guide stays scoped to the requested client', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);
    writeClientMeta(vault, 'whatcanido', { type: 'client' });
    writeClientMeta(vault, 'anotherbrand', { type: 'client' });
    writeClientStyleGuide(vault, 'whatcanido', '# WhatCanIDo Style Guide\n\nOnly whatcanido.\n');
    writeClientStyleGuide(vault, 'anotherbrand', '# Another Brand Style Guide\n\nOnly another brand.\n');
    writeClientStyleGuide(vault, '_personal', '# Personal Client Trap\n\nMust not be returned.\n');

    const whatcanido = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: 'whatcanido' })
    );
    const personal = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: '_personal' })
    );
    const noClient = await withVaultEnv(vault, () => createAgent().get('/api/context').set(authHeaders()));

    assert.equal(whatcanido.status, 200);
    assert.equal(whatcanido.body.brandStyleGuide, '# WhatCanIDo Style Guide\n\nOnly whatcanido.\n');
    assert.doesNotMatch(whatcanido.body.brandStyleGuide, /Another Brand|Personal Client Trap/);
    assert.equal(personal.status, 200);
    assert.equal(personal.body.brandStyleGuide, '');
    assert.equal(noClient.status, 200);
    assert.equal(noClient.body.brandStyleGuide, '');
});

test('GET /api/context client+scenario -> scenario filter + override + never rules', async () => {
    const vault = setupVault();
    seedContextBaseFixture(vault);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: 'aicycle', scenario: 'landing' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.scenarioOverride, 'Landing override content\n');
    assert.ok(response.body.styleGuide.includes('## NEVER'));
    assert.equal(response.body.neverRules.length, 1);
    assert.deepEqual(response.body.neverRules[0], {
        id: 'no-hard-black',
        rule: 'Avoid pure black in CSS',
        detector: {
            type: 'regex',
            pattern: '#000000',
            target: 'css'
        }
    });
    assert.ok(response.body.cases.every((entry: { scenario: string; sentiment: string }) => entry.scenario === 'landing' && entry.sentiment === 'positive'));
    assert.ok(response.body.antiCases.every((entry: { scenario: string; sentiment: string }) => entry.scenario === 'landing' && entry.sentiment === 'negative'));
});

test('GET /api/context positive cases are limited to top 5', async () => {
    const vault = setupVault();
    seedContextLimitFixture(vault);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: '_personal', scenario: 'landing' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.cases.length, 5);
    assert.ok(response.body.cases.every((entry: { client: string; scenario: string; sentiment: string }) => entry.client === '_personal' && entry.scenario === 'landing' && entry.sentiment === 'positive'));
});

test('GET /api/context antiCases are not limited and missing override falls back to empty string', async () => {
    const vault = setupVault();
    seedContextLimitFixture(vault);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: '_personal', scenario: 'nonexistent' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.scenarioOverride, '');
    assert.equal(response.body.cases.length, 0);
    assert.equal(response.body.antiCases.length, 0);
});

test('GET /api/context antiCases return all negatives in scope', async () => {
    const vault = setupVault();
    seedContextLimitFixture(vault);

    const response = await withVaultEnv(vault, () =>
        createAgent().get('/api/context').set(authHeaders()).query({ client: '_personal', scenario: 'landing' })
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.antiCases.length, 6);
    assert.ok(response.body.antiCases.every((entry: { client: string; scenario: string; sentiment: string }) => entry.client === '_personal' && entry.scenario === 'landing' && entry.sentiment === 'negative'));
});

// === Destructive QA regressions ===

test('POST /api/clients invalid JSON -> 400 (not 500)', async () => {
    const vault = setupVault();

    const response = await withVaultEnv(vault, () =>
        createAgent()
            .post('/api/clients')
            .set(authHeaders())
            .set('Content-Type', 'application/json')
            .send('{not-json')
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /invalid JSON/i);
});

test('errorHandler: 500 returns generic message, not internal detail', async () => {
    const error = new Error('vault path /Users/foo/secret leaked');
    const app = express();
    app.get('/boom', () => {
        throw error;
    });
    app.use(errorHandler);

    const consoleError = mock.method(console, 'error', () => {});
    try {
        const response = await request(app).get('/boom');

        assert.equal(response.status, 500);
        assert.deepEqual(response.body, { error: 'internal server error' });
        assert.doesNotMatch(JSON.stringify(response.body), /leaked|secret|Users\/foo/i);
        assert.ok(
            consoleError.mock.calls.some(
                (call) => String(call.arguments[0]).includes('[sidecar] 500:') && call.arguments[1] === error
            )
        );
    } finally {
        consoleError.mock.restore();
    }
});

test('POST /api/style-guide payload too large -> 413 (not 500)', async () => {
    const vault = setupVault();
    writeFileSync(join(vault, 'personal-style-guide.md'), 'old');

    const response = await withVaultEnv(vault, () =>
        createAgent()
            .post('/api/style-guide')
            .set(authHeaders())
            .set('Content-Type', 'application/json')
            .send({ content: 'x'.repeat(1_100_000), expectedHash: 'whatever' })
    );

    assert.equal(response.status, 413);
    assert.match(response.body.error, /too large/i);
});

test('POST /api/style-guide existing file without expectedHash -> 400 (no silent overwrite)', async () => {
    const vault = setupVault();
    writeFileSync(join(vault, 'personal-style-guide.md'), 'protected content');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/style-guide').set(authHeaders()).send({ content: 'replacement' })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /expectedHash required/i);
    // verify file NOT changed
    assert.equal(readFileSync(join(vault, 'personal-style-guide.md'), 'utf8'), 'protected content');
});

test('POST /api/scenario-overrides existing file without expectedHash -> 400 (no silent overwrite)', async () => {
    const vault = setupVault();
    const overridesDir = join(vault, 'scenario-overrides');
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(join(overridesDir, 'landing.md'), 'protected override');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/scenario-overrides/landing').set(authHeaders()).send({ content: 'replacement' })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /expectedHash required/i);
    assert.equal(readFileSync(join(overridesDir, 'landing.md'), 'utf8'), 'protected override');
});

test('POST /api/cases sourceImagePath in /etc/ -> 400 (system path forbidden)', async () => {
    const vault = setupVault();
    mkdirSync(join(vault, 'clients', '_personal'), { recursive: true });
    writeFileSync(join(vault, 'clients', '_personal', 'meta.yaml'),
        'schema_version: 2\nslug: _personal\nname: Personal\ntype: self\ncreated_at: "2026-05-03"\nnotes: ""\ntheme_color: "#1F2937"\n');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/cases').set(authHeaders()).send({
            client: '_personal',
            slug: 'attack',
            sentiment: 'positive',
            scenario: 'landing',
            quote: 'try',
            sourceImagePath: '/etc/passwd'
        })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /sourceImagePath/i);
    // verify no file was written
    assert.equal(existsSync(join(vault, 'clients', '_personal', 'cases', 'attack', 'snapshot')), false);
});

test('POST /api/cases sourceImagePath in TMPDIR -> 201 (allowlist default)', async () => {
    const vault = setupVault();
    writeClientMeta(vault, '_personal', { type: 'self' });
    const sourceDir = mkdtempSync(join(tmpdir(), 'dl-source-allow-'));
    const sourceImagePath = join(sourceDir, 'allowed.png');
    writeFileSync(sourceImagePath, 'png');

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/cases').set(authHeaders()).send({
            client: '_personal',
            slug: 'tmp-allowed',
            sentiment: 'positive',
            scenario: 'landing',
            quote: 'allowed',
            sourceImagePath
        })
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.casePath, join(vault, 'clients', '_personal', 'cases', 'tmp-allowed.md'));
});

test('POST /api/cases sourceImagePath in ~/.ssh -> 400', async () => {
    const vault = setupVault();
    const fakeHomesRoot = join(process.cwd(), '.tmp-test-homes');
    mkdirSync(fakeHomesRoot, { recursive: true });
    const fakeHome = mkdtempSync(join(fakeHomesRoot, 'home-'));
    writeClientMeta(vault, '_personal', { type: 'self' });
    mkdirSync(join(fakeHome, '.ssh'), { recursive: true });
    const sourceImagePath = join(fakeHome, '.ssh', 'id_rsa');
    writeFileSync(sourceImagePath, 'secret');

    const response = await withEnvVars({ HOME: fakeHome }, () =>
        withVaultEnv(vault, () =>
            createAgent().post('/api/cases').set(authHeaders()).send({
                client: '_personal',
                slug: 'home-ssh-reject',
                sentiment: 'positive',
                scenario: 'landing',
                quote: 'reject',
                sourceImagePath
            })
        )
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /sourceImagePath/i);
});

test('POST /api/cases sourceImagePath traversal from screenshots -> 400', async () => {
    const vault = setupVault();
    const fakeHomesRoot = join(process.cwd(), '.tmp-test-homes');
    mkdirSync(fakeHomesRoot, { recursive: true });
    const fakeHome = mkdtempSync(join(fakeHomesRoot, 'home-'));
    writeClientMeta(vault, '_personal', { type: 'self' });
    mkdirSync(join(fakeHome, '.ssh'), { recursive: true });
    mkdirSync(join(fakeHome, 'Pictures', 'Screenshots'), { recursive: true });
    writeFileSync(join(fakeHome, '.ssh', 'id_rsa'), 'secret');

    const response = await withEnvVars({ HOME: fakeHome }, () =>
        withVaultEnv(vault, () =>
            createAgent().post('/api/cases').set(authHeaders()).send({
                client: '_personal',
                slug: 'traversal-reject',
                sentiment: 'positive',
                scenario: 'landing',
                quote: 'reject',
                sourceImagePath: join(fakeHome, 'Pictures', 'Screenshots', '..', '..', '.ssh', 'id_rsa')
            })
        )
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /sourceImagePath/i);
});

test('POST /api/cases sourceImagePath allowlist env override rejects default tmpdir path', async () => {
    const vault = setupVault();
    writeClientMeta(vault, '_personal', { type: 'self' });
    const sourceDir = mkdtempSync(join(tmpdir(), 'dl-source-default-reject-'));
    const sourceImagePath = join(sourceDir, 'default.png');
    writeFileSync(sourceImagePath, 'png');

    const response = await withEnvVars({ DESIGN_LAB_SOURCE_ALLOWLIST: '/tmp/custom' }, () =>
        withVaultEnv(vault, () =>
            createAgent().post('/api/cases').set(authHeaders()).send({
                client: '_personal',
                slug: 'override-default-reject',
                sentiment: 'positive',
                scenario: 'landing',
                quote: 'reject',
                sourceImagePath
            })
        )
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /sourceImagePath/i);
});

test('POST /api/cases sourceImagePath allowlist env override allows configured prefix', async () => {
    const vault = setupVault();
    const allowedRoot = mkdtempSync(join(tmpdir(), 'dl-source-custom-'));
    writeClientMeta(vault, '_personal', { type: 'self' });
    const sourceImagePath = join(allowedRoot, 'custom.png');
    writeFileSync(sourceImagePath, 'png');

    const response = await withEnvVars({ DESIGN_LAB_SOURCE_ALLOWLIST: allowedRoot }, () =>
        withVaultEnv(vault, () =>
            createAgent().post('/api/cases').set(authHeaders()).send({
                client: '_personal',
                slug: 'override-allowed',
                sentiment: 'positive',
                scenario: 'landing',
                quote: 'allowed',
                sourceImagePath
            })
        )
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.casePath, join(vault, 'clients', '_personal', 'cases', 'override-allowed.md'));
});

test('PUT /api/clients/:slug with slug field -> 400 (cannot change slug, no silent ignore)', async () => {
    const vault = setupVault();
    mkdirSync(join(vault, 'clients', 'aicycle'), { recursive: true });
    writeFileSync(join(vault, 'clients', 'aicycle', 'meta.yaml'),
        'schema_version: 2\nslug: aicycle\nname: Aicycle\ntype: client\ncreated_at: "2026-05-03"\nnotes: ""\ntheme_color: "#1F2937"\n');

    const response = await withVaultEnv(vault, () =>
        createAgent().put('/api/clients/aicycle').set(authHeaders()).send({ slug: 'hacked', name: 'still updates?' })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /cannot change slug/i);
});

test('POST /api/clients oversized slug (>64 chars) -> 400', async () => {
    const vault = setupVault();
    const longSlug = 'a'.repeat(100);

    const response = await withVaultEnv(vault, () =>
        createAgent().post('/api/clients').set(authHeaders()).send({
            slug: longSlug,
            name: 'X',
            type: 'client',
            theme_color: '#1F2937'
        })
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /invalid slug/i);
});
