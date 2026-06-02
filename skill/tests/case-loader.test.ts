import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeRetrievalScope, loadCaseSummaries, type ClientRef } from '../lib/case-loader.ts';

type CaseFixture = {
    slug: string;
    scenario: string;
    sentiment: 'positive' | 'negative';
    quotes_from_user?: string[];
    aspects?: Array<{ dimension: string; verdict: 'like' | 'dislike'; note: string }>;
    tags?: {
        style?: string[];
        mood?: string[];
        elements?: string[];
        industry?: string[];
    };
    tokens?: Record<string, unknown>;
    frontmatterOverride?: string;
};

type ClientFixture = {
    slug: string;
    type?: 'self' | 'client';
    withMeta?: boolean;
    cases?: CaseFixture[];
};

function writeMarkdownFile(path: string, frontmatter: string, body = 'body\n') {
    writeFileSync(path, `---\n${frontmatter}---\n${body}`);
}

function serializeCaseFrontmatter(clientSlug: string, fixture: CaseFixture): string {
    if (fixture.frontmatterOverride) {
        return fixture.frontmatterOverride;
    }

    const lines = [
        'schema_version: 2',
        `client: ${clientSlug}`,
        `slug: ${fixture.slug}`,
        `scenario: ${fixture.scenario}`,
        `sentiment: ${fixture.sentiment}`,
        `quotes_from_user: ${JSON.stringify(fixture.quotes_from_user ?? [])}`
    ];

    if (fixture.aspects) {
        lines.push(`aspects: ${JSON.stringify(fixture.aspects)}`);
    }

    if (fixture.tags) {
        lines.push('tags:');
        lines.push(`  style: ${JSON.stringify(fixture.tags.style ?? [])}`);
        lines.push(`  mood: ${JSON.stringify(fixture.tags.mood ?? [])}`);
        lines.push(`  elements: ${JSON.stringify(fixture.tags.elements ?? [])}`);
        lines.push(`  industry: ${JSON.stringify(fixture.tags.industry ?? [])}`);
    }

    if (fixture.tokens) {
        lines.push(`tokens: ${JSON.stringify(fixture.tokens)}`);
    }

    return `${lines.join('\n')}\n`;
}

function setupVault(clients: ClientFixture[]) {
    const vault = mkdtempSync(join(tmpdir(), 'dl-case-loader-ts-'));
    const clientsDir = join(vault, 'clients');
    mkdirSync(clientsDir);

    for (const client of clients) {
        const clientDir = join(clientsDir, client.slug);
        mkdirSync(clientDir);

        if (client.withMeta !== false) {
            writeFileSync(
                join(clientDir, 'meta.yaml'),
                `schema_version: 2\nslug: ${client.slug}\ntype: ${client.type ?? 'client'}\n`
            );
        }

        for (const entry of client.cases ?? []) {
            const subdir = entry.sentiment === 'negative' ? 'anti-library' : 'cases';
            const casesDir = join(clientDir, subdir);
            if (!existsSync(casesDir)) {
                mkdirSync(casesDir);
            }
            writeMarkdownFile(
                join(casesDir, `${entry.slug}.md`),
                serializeCaseFrontmatter(client.slug, entry)
            );
        }
    }

    return vault;
}

function sortStrings(values: string[]) {
    return [...values].sort();
}

function summarizeCases(slugs: string[]) {
    return sortStrings(slugs);
}

test('loadCaseSummaries: empty vault returns []', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-case-loader-ts-'));
    const summaries = loadCaseSummaries(vault);

    assert.deepEqual(summaries, []);
});

test('loadCaseSummaries: single self client returns cases and anti-library', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [
                {
                    slug: '0001',
                    scenario: 'landing',
                    sentiment: 'positive',
                    quotes_from_user: ['乾淨']
                },
                {
                    slug: '0002',
                    scenario: 'brand',
                    sentiment: 'negative',
                    quotes_from_user: ['太花']
                }
            ]
        }
    ]);

    const summaries = loadCaseSummaries(vault);

    assert.equal(summaries.length, 2);
    assert.deepEqual(
        summarizeCases(summaries.map((entry) => `${entry.slug}:${entry.sentiment}:${entry.client}`)),
        ['0001:positive:_personal', '0002:negative:_personal']
    );
    assert.ok(summaries.every((entry) => entry.client === '_personal'));
    assert.ok(summaries.every((entry) => entry.mdPath.startsWith(vault)));
});

test('loadCaseSummaries: client filter uses target plus all self clients', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [{ slug: '0001', scenario: 'landing', sentiment: 'positive' }]
        },
        {
            slug: 'aicycle',
            type: 'client',
            cases: [{ slug: 'a-001', scenario: 'landing', sentiment: 'positive' }]
        },
        {
            slug: 'zhenheco',
            type: 'self',
            cases: [{ slug: 'z-001', scenario: 'brand', sentiment: 'positive' }]
        }
    ]);

    const externalScope = loadCaseSummaries(vault, { client: 'aicycle' });
    const selfScope = loadCaseSummaries(vault, { client: '_personal' });

    assert.deepEqual(
        summarizeCases(externalScope.map((entry) => entry.slug)),
        ['0001', 'a-001', 'z-001']
    );
    assert.deepEqual(
        summarizeCases(selfScope.map((entry) => entry.slug)),
        ['0001', 'z-001']
    );
});

test('loadCaseSummaries: no target client returns all clients in union', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [{ slug: '0001', scenario: 'landing', sentiment: 'positive' }]
        },
        {
            slug: 'aicycle',
            type: 'client',
            cases: [{ slug: 'a-001', scenario: 'landing', sentiment: 'positive' }]
        },
        {
            slug: 'zhenheco',
            type: 'self',
            cases: [{ slug: 'z-001', scenario: 'brand', sentiment: 'positive' }]
        }
    ]);

    const summaries = loadCaseSummaries(vault);

    assert.equal(summaries.length, 3);
    assert.deepEqual(
        summarizeCases(summaries.map((entry) => entry.slug)),
        ['0001', 'a-001', 'z-001']
    );
});

test('loadCaseSummaries: scenario filter narrows results', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [
                { slug: '0001', scenario: 'landing', sentiment: 'positive' },
                { slug: '0002', scenario: 'saas-ui', sentiment: 'positive' }
            ]
        }
    ]);

    const summaries = loadCaseSummaries(vault, { scenario: 'landing' });

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].slug, '0001');
});

test('loadCaseSummaries: sentiment filter matches cases vs anti-library', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [
                { slug: '0001', scenario: 'landing', sentiment: 'positive' },
                { slug: '0099', scenario: 'brand', sentiment: 'negative' }
            ]
        }
    ]);

    const negativeOnly = loadCaseSummaries(vault, { sentiment: 'negative' });
    const positiveOnly = loadCaseSummaries(vault, { sentiment: 'positive' });

    assert.equal(negativeOnly.length, 1);
    assert.equal(negativeOnly[0].slug, '0099');
    assert.equal(negativeOnly[0].sentiment, 'negative');
    assert.equal(positiveOnly.length, 1);
    assert.equal(positiveOnly[0].slug, '0001');
    assert.equal(positiveOnly[0].sentiment, 'positive');
});

test('loadCaseSummaries: parses aspectual feedback and defaults legacy cases to []', () => {
    const aspects = [
        { dimension: 'typography', verdict: 'like' as const, note: 'x' },
        { dimension: 'color', verdict: 'dislike' as const, note: '太冷' }
    ];
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [
                { slug: 'aspectual', scenario: 'landing', sentiment: 'positive', aspects },
                { slug: 'legacy', scenario: 'landing', sentiment: 'positive' }
            ]
        }
    ]);

    const summaries = loadCaseSummaries(vault);
    const bySlug = new Map(summaries.map((entry) => [entry.slug, entry]));

    assert.deepEqual(bySlug.get('aspectual')?.aspects, aspects);
    assert.deepEqual(bySlug.get('legacy')?.aspects, []);
});

test('loadCaseSummaries: missing meta.yaml warns and skips that client', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [{ slug: '0001', scenario: 'landing', sentiment: 'positive' }]
        },
        {
            slug: 'broken',
            withMeta: false,
            cases: [{ slug: 'b-001', scenario: 'landing', sentiment: 'positive' }]
        }
    ]);
    const warn = mock.method(console, 'warn', () => {});

    try {
        const summaries = loadCaseSummaries(vault);

        assert.deepEqual(
            summarizeCases(summaries.map((entry) => entry.slug)),
            ['0001']
        );
        assert.ok(warn.mock.calls.length >= 1);
        assert.match(String(warn.mock.calls[0].arguments[0]), /\[case-loader\]/);
        assert.match(String(warn.mock.calls[0].arguments[0]), /broken/);
        assert.match(String(warn.mock.calls[0].arguments[0]), /meta\.yaml/);
    } finally {
        warn.mock.restore();
    }
});

test('computeRetrievalScope: supports full union, self union, dedupe, and unknown target', () => {
    const clients: ClientRef[] = [
        { slug: '_personal', type: 'self' },
        { slug: 'aicycle', type: 'client' },
        { slug: 'zhenheco', type: 'self' }
    ];

    assert.deepEqual(
        sortStrings(computeRetrievalScope(undefined, clients)),
        ['_personal', 'aicycle', 'zhenheco']
    );
    assert.deepEqual(
        sortStrings(computeRetrievalScope('aicycle', clients)),
        ['_personal', 'aicycle', 'zhenheco']
    );
    assert.deepEqual(
        sortStrings(computeRetrievalScope('_personal', clients)),
        ['_personal', 'zhenheco']
    );
    assert.deepEqual(
        sortStrings(computeRetrievalScope('unknown-client', clients)),
        ['_personal', 'unknown-client', 'zhenheco']
    );
    assert.equal(
        computeRetrievalScope('_personal', clients).filter((slug) => slug === '_personal').length,
        1
    );
});

test('loadCaseSummaries: broken symlink in clients is warned and skipped', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [{ slug: '0001', scenario: 'landing', sentiment: 'positive' }]
        }
    ]);
    const clientsDir = join(vault, 'clients');
    symlinkSync('/nonexistent/path', join(clientsDir, 'broken-symlink'), 'dir');
    const warn = mock.method(console, 'warn', () => {});

    try {
        const summaries = loadCaseSummaries(vault);

        assert.deepEqual(
            summarizeCases(summaries.map((entry) => entry.slug)),
            ['0001']
        );
        assert.ok(warn.mock.calls.length >= 1);
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

test('loadCaseSummaries: meta.yaml inline comments preserve client type parsing', () => {
    const vault = setupVault([
        {
            slug: '_personal',
            type: 'self',
            cases: [{ slug: '0001', scenario: 'landing', sentiment: 'positive' }]
        },
        {
            slug: 'aicycle',
            withMeta: false,
            cases: [{ slug: 'a-001', scenario: 'landing', sentiment: 'positive' }]
        }
    ]);
    const aicycleDir = join(vault, 'clients', 'aicycle');
    writeFileSync(
        join(aicycleDir, 'meta.yaml'),
        [
            'schema_version: 2',
            'slug: aicycle # this is the brand',
            'type: client # external client',
            'notes: ""',
            'theme_color: "#1F2937"',
            ''
        ].join('\n')
    );

    const summaries = loadCaseSummaries(vault, { client: 'aicycle' });

    assert.deepEqual(
        summarizeCases(summaries.map((entry) => `${entry.slug}:${entry.client}`)),
        ['0001:_personal', 'a-001:aicycle']
    );
});
