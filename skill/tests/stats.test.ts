import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeStats } from '../lib/stats.js';

type CaseFixture = {
    slug: string;
    scenario: string;
    sentiment: 'positive' | 'negative';
};

type ClientFixture = {
    slug: string;
    type?: 'self' | 'client';
    cases: CaseFixture[];
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
            'quotes_from_user: []',
            '---',
            ''
        ].join('\n')
    );
}

function setupVaultWithClients(clients: ClientFixture[]) {
    const vault = mkdtempSync(join(tmpdir(), 'dl-stats-ts-'));
    const clientsDir = join(vault, 'clients');
    mkdirSync(clientsDir, { recursive: true });

    for (const client of clients) {
        const clientDir = join(clientsDir, client.slug);
        mkdirSync(clientDir, { recursive: true });
        writeFileSync(
            join(clientDir, 'meta.yaml'),
            `schema_version: 2\nslug: ${client.slug}\ntype: ${client.type ?? 'client'}\n`
        );

        for (const entry of client.cases) {
            writeCaseMarkdown(vault, client.slug, entry);
        }
    }

    return vault;
}

function withVaultEnv<T>(vault: string, run: () => T): T {
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

test('computeStats: empty vault returns zeroed totals and empty buckets', () => {
    const vault = setupVaultWithClients([]);

    const stats = computeStats(vault);

    assert.deepEqual(stats.totals, { positive: 0, negative: 0 });
    assert.deepEqual(stats.byClient, {});
    assert.deepEqual(stats.byScenario, {});
});

test('computeStats: single client aggregates byClient and byScenario', () => {
    const vault = setupVaultWithClients([
        {
            slug: '_personal',
            type: 'self',
            cases: [
                { slug: 'landing-a', scenario: 'landing', sentiment: 'positive' },
                { slug: 'landing-b', scenario: 'landing', sentiment: 'positive' },
                { slug: 'brand-a', scenario: 'brand', sentiment: 'negative' }
            ]
        }
    ]);

    const stats = computeStats(vault);

    assert.deepEqual(stats.totals, { positive: 2, negative: 1 });
    assert.equal(stats.byClient._personal, 3);
    assert.equal(stats.byScenario.landing, 2);
    assert.equal(stats.byScenario.brand, 1);
});

test('computeStats: multi-client vault returns counts for each client', () => {
    const vault = setupVaultWithClients([
        {
            slug: '_personal',
            type: 'self',
            cases: [{ slug: 'p-1', scenario: 'landing', sentiment: 'positive' }]
        },
        {
            slug: 'aicycle',
            cases: [
                { slug: 'a-1', scenario: 'landing', sentiment: 'positive' },
                { slug: 'a-2', scenario: 'brand', sentiment: 'negative' }
            ]
        },
        {
            slug: 'zhenheco',
            cases: [{ slug: 'z-1', scenario: 'brand', sentiment: 'positive' }]
        }
    ]);

    const stats = computeStats(vault);

    assert.equal(stats.byClient._personal, 1);
    assert.equal(stats.byClient.aicycle, 2);
    assert.equal(stats.byClient.zhenheco, 1);
    assert.equal(stats.byScenario.landing, 2);
    assert.equal(stats.byScenario.brand, 2);
});

test('computeStats: byClient counts both positive and negative cases', () => {
    const vault = setupVaultWithClients([
        {
            slug: 'aicycle',
            cases: [
                { slug: 'a-1', scenario: 'landing', sentiment: 'positive' },
                { slug: 'a-2', scenario: 'landing', sentiment: 'positive' },
                { slug: 'a-3', scenario: 'brand', sentiment: 'negative' }
            ]
        }
    ]);

    const stats = computeStats(vault);

    assert.equal(stats.byClient.aicycle, 3);
    assert.deepEqual(stats.totals, { positive: 2, negative: 1 });
});

test('computeStats: reads DESIGN_LAB_VAULT_PATH when vault arg is omitted', () => {
    const vault = setupVaultWithClients([
        {
            slug: '_personal',
            type: 'self',
            cases: [{ slug: 'p-1', scenario: 'landing', sentiment: 'positive' }]
        }
    ]);

    const stats = withVaultEnv(vault, () => computeStats());

    assert.deepEqual(stats.totals, { positive: 1, negative: 0 });
    assert.equal(stats.byClient._personal, 1);
    assert.equal(stats.byScenario.landing, 1);
});
