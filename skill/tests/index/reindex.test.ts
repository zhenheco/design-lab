import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { closeDb, getDb } from '../../lib/index/db.ts';
import { classifyPath, fullReindex, reindexPath, removePath, selfCheckOnStartup } from '../../lib/index/reindex.ts';

function setupVault(): string {
    const vault = mkdtempSync(join(tmpdir(), 'dl-reindex-ts-'));
    mkdirSync(join(vault, 'clients'));
    mkdirSync(join(vault, 'scenario-overrides'));
    writeFileSync(join(vault, 'personal-style-guide.md'), '# Personal Style Guide\n');
    return vault;
}

function withVaultEnv<T>(vault: string, fn: () => T): T {
    const previous = process.env.DESIGN_LAB_VAULT_PATH;
    process.env.DESIGN_LAB_VAULT_PATH = vault;

    try {
        closeDb();
        return fn();
    } finally {
        closeDb();
        if (previous === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previous;
        }
    }
}

function ensureDir(path: string): void {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}

function writeCaseFile(
    vault: string,
    client: string,
    slug: string,
    sentiment: 'positive' | 'negative',
    scenario: string
): string {
    const subdir = sentiment === 'negative' ? 'anti-library' : 'cases';
    const dir = join(vault, 'clients', client, subdir);
    ensureDir(dir);
    const path = join(dir, `${slug}.md`);
    writeFileSync(
        path,
        [
            '---',
            'schema_version: 2',
            `client: ${client}`,
            `slug: ${slug}`,
            `scenario: ${scenario}`,
            `quotes_from_user: ["clear hierarchy"]`,
            'tags:',
            '  style: ["modern"]',
            '  mood: ["calm"]',
            '  elements: ["grid"]',
            '  industry: ["saas"]',
            'tokens:',
            '  emphasis: 1',
            '---',
            '',
            `# ${slug}`,
            'Body copy.',
            ''
        ].join('\n')
    );
    return path;
}

function writeClientMeta(vault: string, slug: string, type: 'self' | 'client'): string {
    const dir = join(vault, 'clients', slug);
    ensureDir(dir);
    const path = join(dir, 'meta.yaml');
    writeFileSync(
        path,
        [
            'schema_version: 2',
            `slug: ${slug}`,
            `name: ${JSON.stringify(`${slug} studio`)}`,
            `type: ${type}`,
            'created_at: "2026-05-03"',
            'notes: ""',
            'theme_color: "#112233"',
            ''
        ].join('\n')
    );
    return path;
}

function writeScenarioOverride(vault: string, scenario: string, body = 'Override content\n'): string {
    const path = join(vault, 'scenario-overrides', `${scenario}.md`);
    writeFileSync(path, body);
    return path;
}

function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function sleepMs(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

test('classifyPath: case positive', () => {
    const vault = setupVault();
    const absPath = join(vault, 'clients', 'acme', 'cases', 'hero-win.md');

    assert.deepEqual(classifyPath(absPath, vault), {
        kind: 'case',
        client: 'acme',
        slug: 'hero-win',
        sentiment: 'positive'
    });
});

test('classifyPath: case negative from anti-library', () => {
    const vault = setupVault();
    const absPath = join(vault, 'clients', 'acme', 'anti-library', 'hero-loss.md');

    assert.deepEqual(classifyPath(absPath, vault), {
        kind: 'case',
        client: 'acme',
        slug: 'hero-loss',
        sentiment: 'negative'
    });
});

test('classifyPath: client-meta', () => {
    const vault = setupVault();
    const absPath = join(vault, 'clients', 'acme', 'meta.yaml');

    assert.deepEqual(classifyPath(absPath, vault), {
        kind: 'client-meta',
        client: 'acme'
    });
});

test('classifyPath: style-guide', () => {
    const vault = setupVault();
    const absPath = join(vault, 'personal-style-guide.md');

    assert.deepEqual(classifyPath(absPath, vault), {
        kind: 'style-guide'
    });
});

test('classifyPath: scenario-override', () => {
    const vault = setupVault();
    const absPath = join(vault, 'scenario-overrides', 'homepage.md');

    assert.deepEqual(classifyPath(absPath, vault), {
        kind: 'scenario-override',
        scenario: 'homepage'
    });
});

test('classifyPath: .archived path returns null', () => {
    const vault = setupVault();
    const absPath = join(vault, '.archived', 'clients', 'acme', 'cases', 'old.md');

    assert.equal(classifyPath(absPath, vault), null);
});

test('classifyPath: .index path returns null', () => {
    const vault = setupVault();
    const absPath = join(vault, '.index', 'library.db');

    assert.equal(classifyPath(absPath, vault), null);
});

test('classifyPath: invalid slug returns null', () => {
    const vault = setupVault();
    const absPath = join(vault, 'clients', 'acme', 'cases', 'BAD slug.md');

    assert.equal(classifyPath(absPath, vault), null);
});

test('classifyPath: unexpected path returns null', () => {
    const vault = setupVault();
    const absPath = join(vault, 'random.md');

    assert.equal(classifyPath(absPath, vault), null);
});

test('classifyPath: nested path too deep returns null', () => {
    const vault = setupVault();
    const absPath = join(vault, 'clients', 'acme', 'cases', 'sub', 'nested.md');

    assert.equal(classifyPath(absPath, vault), null);
});

test('reindexPath: case file writes cases row', () => {
    const vault = setupVault();
    const absPath = writeCaseFile(vault, 'acme', 'hero-win', 'positive', 'landing-page');

    withVaultEnv(vault, () => {
        reindexPath(absPath);

        const row = getDb()
            .prepare<
                [string],
                {
                    client: string;
                    slug: string;
                    scenario: string;
                    sentiment: string;
                    content_hash: string;
                    frontmatter_json: string;
                    indexed_at: number;
                }
            >(
                `
                    SELECT client, slug, scenario, sentiment, content_hash, frontmatter_json, indexed_at
                    FROM cases
                    WHERE md_path = ?
                `
            )
            .get(absPath);

        assert.ok(row);
        assert.equal(row.client, 'acme');
        assert.equal(row.slug, 'hero-win');
        assert.equal(row.scenario, 'landing-page');
        assert.equal(row.sentiment, 'positive');
        assert.equal(typeof row.content_hash, 'string');
        assert.equal(typeof row.indexed_at, 'number');
        assert.deepEqual(JSON.parse(row.frontmatter_json), {
            schema_version: 2,
            client: 'acme',
            slug: 'hero-win',
            scenario: 'landing-page',
            quotes_from_user: ['clear hierarchy'],
            tags: {
                style: ['modern'],
                mood: ['calm'],
                elements: ['grid'],
                industry: ['saas']
            },
            tokens: {
                emphasis: 1
            }
        });
    });
});

test('reindexPath: case content_hash uses SHA-256 of file content', () => {
    const vault = setupVault();
    const absPath = writeCaseFile(vault, 'acme', 'hash-check', 'positive', 'landing-page');
    const expectedHash = sha256(readFileSync(absPath, 'utf8'));

    withVaultEnv(vault, () => {
        reindexPath(absPath);

        const row = getDb()
            .prepare<[string], { content_hash: string }>('SELECT content_hash FROM cases WHERE md_path = ?')
            .get(absPath);

        assert.deepEqual(row, { content_hash: expectedHash });
    });
});

test('reindexPath: same content skips row update', () => {
    const vault = setupVault();
    const absPath = writeCaseFile(vault, 'acme', 'stable-case', 'positive', 'landing-page');

    withVaultEnv(vault, () => {
        const now = mock.method(Date, 'now', (() => {
            let value = 1700000000000;
            return () => value++;
        })());

        try {
            reindexPath(absPath);
            const before = getDb()
                .prepare<[string], { content_hash: string; indexed_at: number }>(
                    'SELECT content_hash, indexed_at FROM cases WHERE md_path = ?'
                )
                .get(absPath);

            reindexPath(absPath);
            const after = getDb()
                .prepare<[string], { content_hash: string; indexed_at: number }>(
                    'SELECT content_hash, indexed_at FROM cases WHERE md_path = ?'
                )
                .get(absPath);

            assert.deepEqual(after, before);
        } finally {
            now.mock.restore();
        }
    });
});

test('reindexPath: changed content updates hash and indexed_at', () => {
    const vault = setupVault();
    const absPath = writeCaseFile(vault, 'acme', 'mutable-case', 'positive', 'landing-page');

    withVaultEnv(vault, () => {
        const now = mock.method(Date, 'now', (() => {
            let value = 1700000000000;
            return () => value++;
        })());

        try {
            reindexPath(absPath);
            const before = getDb()
                .prepare<[string], { content_hash: string; indexed_at: number }>(
                    'SELECT content_hash, indexed_at FROM cases WHERE md_path = ?'
                )
                .get(absPath);

            assert.ok(before);

            writeFileSync(absPath, `${readFileSync(absPath, 'utf8')}\nUpdated body.\n`);
            reindexPath(absPath);

            const after = getDb()
                .prepare<[string], { content_hash: string; indexed_at: number }>(
                    'SELECT content_hash, indexed_at FROM cases WHERE md_path = ?'
                )
                .get(absPath);

            assert.ok(after);
            assert.notEqual(after.content_hash, before.content_hash);
            assert.ok(after.indexed_at > before.indexed_at);
        } finally {
            now.mock.restore();
        }
    });
});

test('reindexPath: client-meta yaml writes clients row', () => {
    const vault = setupVault();
    const absPath = writeClientMeta(vault, 'acme', 'client');
    const expectedHash = sha256(readFileSync(absPath, 'utf8'));

    withVaultEnv(vault, () => {
        reindexPath(absPath);

        const row = getDb()
            .prepare<
                [string],
                { slug: string; type: string; name: string; theme_color: string; content_hash: string }
            >(
                'SELECT slug, type, name, theme_color, content_hash FROM clients WHERE slug = ?'
            )
            .get('acme');

        assert.deepEqual(row, {
            slug: 'acme',
            type: 'client',
            name: 'acme studio',
            theme_color: '#112233',
            content_hash: expectedHash
        });
    });
});

test('reindexPath: broken yaml warns and skips row', () => {
    const vault = setupVault();
    const dir = join(vault, 'clients', 'broken');
    ensureDir(dir);
    const absPath = join(dir, 'meta.yaml');
    writeFileSync(absPath, 'slug: [unclosed\n');
    const warn = mock.method(console, 'warn', () => {});

    try {
        withVaultEnv(vault, () => {
            assert.doesNotThrow(() => reindexPath(absPath));
            const row = getDb()
                .prepare<[string], { slug: string }>('SELECT slug FROM clients WHERE slug = ?')
                .get('broken');

            assert.equal(row, undefined);
        });
        assert.ok(warn.mock.calls.length >= 1);
    } finally {
        warn.mock.restore();
    }
});

test('reindexPath: style-guide writes documents row', () => {
    const vault = setupVault();
    const absPath = join(vault, 'personal-style-guide.md');

    withVaultEnv(vault, () => {
        reindexPath(absPath);

        const row = getDb()
            .prepare<[string], { kind: string; scenario: string | null }>(
                'SELECT kind, scenario FROM documents WHERE path = ?'
            )
            .get(absPath);

        assert.deepEqual(row, { kind: 'style-guide', scenario: null });
    });
});

test('reindexPath: scenario-override writes documents row', () => {
    const vault = setupVault();
    const absPath = writeScenarioOverride(vault, 'landing-page', '# landing-page\n');

    withVaultEnv(vault, () => {
        reindexPath(absPath);

        const row = getDb()
            .prepare<[string], { kind: string; scenario: string | null }>(
                'SELECT kind, scenario FROM documents WHERE path = ?'
            )
            .get(absPath);

        assert.deepEqual(row, { kind: 'scenario-override', scenario: 'landing-page' });
    });
});

test('reindexPath: unknown path is a no-op', () => {
    const vault = setupVault();
    const absPath = join(vault, 'random.md');
    writeFileSync(absPath, 'random\n');

    withVaultEnv(vault, () => {
        assert.doesNotThrow(() => reindexPath(absPath));
        const counts = getDb()
            .prepare<[], { casesCount: number; clientsCount: number; documentsCount: number }>(
                `
                    SELECT
                        (SELECT COUNT(*) FROM cases) AS casesCount,
                        (SELECT COUNT(*) FROM clients) AS clientsCount,
                        (SELECT COUNT(*) FROM documents) AS documentsCount
                `
            )
            .get();

        assert.deepEqual(counts, {
            casesCount: 0,
            clientsCount: 0,
            documentsCount: 0
        });
    });
});

test('removePath: removes cases row', () => {
    const vault = setupVault();
    const absPath = writeCaseFile(vault, 'acme', 'to-remove', 'positive', 'landing-page');

    withVaultEnv(vault, () => {
        reindexPath(absPath);
        removePath(absPath);

        const row = getDb()
            .prepare<[string], { md_path: string }>('SELECT md_path FROM cases WHERE md_path = ?')
            .get(absPath);

        assert.equal(row, undefined);
    });
});

test('removePath: removes clients row', () => {
    const vault = setupVault();
    const absPath = writeClientMeta(vault, 'acme', 'client');

    withVaultEnv(vault, () => {
        reindexPath(absPath);
        removePath(absPath);

        const row = getDb()
            .prepare<[string], { slug: string }>('SELECT slug FROM clients WHERE slug = ?')
            .get('acme');

        assert.equal(row, undefined);
    });
});

test('removePath: removes documents row', () => {
    const vault = setupVault();
    const absPath = writeScenarioOverride(vault, 'landing-page');

    withVaultEnv(vault, () => {
        reindexPath(absPath);
        removePath(absPath);

        const row = getDb()
            .prepare<[string], { path: string }>('SELECT path FROM documents WHERE path = ?')
            .get(absPath);

        assert.equal(row, undefined);
    });
});

test('removePath: unknown path is a no-op', () => {
    const vault = setupVault();
    const absPath = join(vault, 'random.md');
    writeFileSync(absPath, 'random\n');

    withVaultEnv(vault, () => {
        assert.doesNotThrow(() => removePath(absPath));
    });
});

test('fullReindex: empty vault leaves all tables empty', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-reindex-empty-ts-'));

    withVaultEnv(vault, () => {
        fullReindex();

        const counts = getDb()
            .prepare<[], { casesCount: number; clientsCount: number; documentsCount: number }>(
                `
                    SELECT
                        (SELECT COUNT(*) FROM cases) AS casesCount,
                        (SELECT COUNT(*) FROM clients) AS clientsCount,
                        (SELECT COUNT(*) FROM documents) AS documentsCount
                `
            )
            .get();

        assert.deepEqual(counts, {
            casesCount: 0,
            clientsCount: 0,
            documentsCount: 0
        });
    });
});

test('fullReindex: multi-client vault populates all table counts', () => {
    const vault = setupVault();
    writeClientMeta(vault, '_personal', 'self');
    writeClientMeta(vault, 'acme', 'client');
    writeCaseFile(vault, '_personal', 'home-win', 'positive', 'landing-page');
    writeCaseFile(vault, 'acme', 'brand-loss', 'negative', 'brand-refresh');
    writeScenarioOverride(vault, 'landing-page');

    withVaultEnv(vault, () => {
        fullReindex();

        const counts = getDb()
            .prepare<[], { casesCount: number; clientsCount: number; documentsCount: number }>(
                `
                    SELECT
                        (SELECT COUNT(*) FROM cases) AS casesCount,
                        (SELECT COUNT(*) FROM clients) AS clientsCount,
                        (SELECT COUNT(*) FROM documents) AS documentsCount
                `
            )
            .get();

        assert.deepEqual(counts, {
            casesCount: 2,
            clientsCount: 2,
            documentsCount: 2
        });
    });
});

test('fullReindex: running twice is idempotent', () => {
    const vault = setupVault();
    writeClientMeta(vault, '_personal', 'self');
    writeClientMeta(vault, 'acme', 'client');
    writeCaseFile(vault, '_personal', 'home-win', 'positive', 'landing-page');
    writeCaseFile(vault, 'acme', 'brand-loss', 'negative', 'brand-refresh');
    writeScenarioOverride(vault, 'landing-page');

    withVaultEnv(vault, () => {
        const now = mock.method(Date, 'now', () => 1700000000000);

        try {
            fullReindex();
            const firstCases = getDb()
                .prepare<
                    [],
                    {
                        client: string;
                        slug: string;
                        scenario: string;
                        sentiment: string;
                        content_hash: string;
                        indexed_at: number;
                    }
                >(
                    `
                        SELECT client, slug, scenario, sentiment, content_hash, indexed_at
                        FROM cases
                        ORDER BY client, slug
                    `
                )
                .all();
            const firstClients = getDb()
                .prepare<[], { slug: string; type: string; content_hash: string; indexed_at: number }>(
                    'SELECT slug, type, content_hash, indexed_at FROM clients ORDER BY slug'
                )
                .all();
            const firstDocs = getDb()
                .prepare<[], { path: string; kind: string; scenario: string | null; content_hash: string; indexed_at: number }>(
                    'SELECT path, kind, scenario, content_hash, indexed_at FROM documents ORDER BY path'
                )
                .all();

            fullReindex();
            const secondCases = getDb()
                .prepare<
                    [],
                    {
                        client: string;
                        slug: string;
                        scenario: string;
                        sentiment: string;
                        content_hash: string;
                        indexed_at: number;
                    }
                >(
                    `
                        SELECT client, slug, scenario, sentiment, content_hash, indexed_at
                        FROM cases
                        ORDER BY client, slug
                    `
                )
                .all();
            const secondClients = getDb()
                .prepare<[], { slug: string; type: string; content_hash: string; indexed_at: number }>(
                    'SELECT slug, type, content_hash, indexed_at FROM clients ORDER BY slug'
                )
                .all();
            const secondDocs = getDb()
                .prepare<[], { path: string; kind: string; scenario: string | null; content_hash: string; indexed_at: number }>(
                    'SELECT path, kind, scenario, content_hash, indexed_at FROM documents ORDER BY path'
                )
                .all();

            assert.deepEqual(secondCases, firstCases);
            assert.deepEqual(secondClients, firstClients);
            assert.deepEqual(secondDocs, firstDocs);
        } finally {
            now.mock.restore();
        }
    });
});

test('fullReindex: skips .archived and .index trees', () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme', 'client');
    writeCaseFile(vault, 'acme', 'kept', 'positive', 'landing-page');
    const archivedCase = join(vault, '.archived', 'clients', 'ghost', 'cases');
    ensureDir(archivedCase);
    writeFileSync(
        join(archivedCase, 'skip-me.md'),
        ['---', 'client: ghost', 'slug: skip-me', 'scenario: archive', '---', 'archived', ''].join('\n')
    );
    const indexDir = join(vault, '.index');
    ensureDir(indexDir);
    writeFileSync(join(indexDir, 'notes.md'), 'ignore me\n');

    withVaultEnv(vault, () => {
        fullReindex();

        const count = getDb()
            .prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM cases')
            .get();

        assert.deepEqual(count, { count: 1 });
    });
});

test('fullReindex: stores last_full_rebuild_at in index_meta as ms epoch', () => {
    const vault = setupVault();

    withVaultEnv(vault, () => {
        const now = mock.method(Date, 'now', () => 1700000000123);

        try {
            fullReindex();

            const row = getDb()
                .prepare<[string], { value: string }>('SELECT value FROM index_meta WHERE key = ?')
                .get('last_full_rebuild_at');

            assert.deepEqual(row, { value: '1700000000123' });
        } finally {
            now.mock.restore();
        }
    });
});

test('selfCheckOnStartup: no index_meta triggers fullReindex', () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme', 'client');
    writeCaseFile(vault, 'acme', 'hero-win', 'positive', 'landing-page');
    writeScenarioOverride(vault, 'landing-page');

    withVaultEnv(vault, () => {
        selfCheckOnStartup();

        const counts = getDb()
            .prepare<[], { casesCount: number; clientsCount: number; documentsCount: number }>(
                `
                    SELECT
                        (SELECT COUNT(*) FROM cases) AS casesCount,
                        (SELECT COUNT(*) FROM clients) AS clientsCount,
                        (SELECT COUNT(*) FROM documents) AS documentsCount
                `
            )
            .get();
        const meta = getDb()
            .prepare<[string], { value: string }>('SELECT value FROM index_meta WHERE key = ?')
            .get('last_full_rebuild_at');

        assert.deepEqual(counts, {
            casesCount: 1,
            clientsCount: 1,
            documentsCount: 2
        });
        assert.ok(meta);
    });
});

test('selfCheckOnStartup: index_meta exists reindexes only newer files', () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme', 'client');
    const existingCasePath = writeCaseFile(vault, 'acme', 'baseline-win', 'positive', 'landing-page');

    withVaultEnv(vault, () => {
        fullReindex();

        const before = getDb()
            .prepare<[string], { indexed_at: number }>('SELECT indexed_at FROM cases WHERE md_path = ?')
            .get(existingCasePath);

        assert.ok(before);

        sleepMs(50);
        const newCasePath = writeCaseFile(vault, 'acme', 'fresh-win', 'positive', 'landing-page');

        selfCheckOnStartup();

        const existingAfter = getDb()
            .prepare<[string], { indexed_at: number }>('SELECT indexed_at FROM cases WHERE md_path = ?')
            .get(existingCasePath);
        const newCase = getDb()
            .prepare<[string], { indexed_at: number }>('SELECT indexed_at FROM cases WHERE md_path = ?')
            .get(newCasePath);

        assert.deepEqual(existingAfter, before);
        assert.ok(newCase);
        assert.ok(newCase.indexed_at >= before.indexed_at);
    });
});

test('selfCheckOnStartup: no newer files is a no-op', () => {
    const vault = setupVault();
    const casePath = writeCaseFile(vault, 'acme', 'stable-win', 'positive', 'landing-page');

    withVaultEnv(vault, () => {
        fullReindex();

        const before = getDb()
            .prepare<[string], { indexed_at: number }>('SELECT indexed_at FROM cases WHERE md_path = ?')
            .get(casePath);

        assert.ok(before);

        selfCheckOnStartup();

        const after = getDb()
            .prepare<[string], { indexed_at: number }>('SELECT indexed_at FROM cases WHERE md_path = ?')
            .get(casePath);

        assert.deepEqual(after, before);
    });
});

test('selfCheckOnStartup: removed files are not swept during startup check', () => {
    const vault = setupVault();
    const casePath = writeCaseFile(vault, 'acme', 'removed-later', 'positive', 'landing-page');

    withVaultEnv(vault, () => {
        fullReindex();

        const before = getDb()
            .prepare<[string], { md_path: string; indexed_at: number }>(
                'SELECT md_path, indexed_at FROM cases WHERE md_path = ?'
            )
            .get(casePath);

        assert.ok(before);
        unlinkSync(casePath);

        selfCheckOnStartup();

        const after = getDb()
            .prepare<[string], { md_path: string; indexed_at: number }>(
                'SELECT md_path, indexed_at FROM cases WHERE md_path = ?'
            )
            .get(casePath);

        assert.deepEqual(after, before);
    });
});
