import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { writeCase, type WriteCaseInput } from '../lib/case-writer.ts';

void mock;

function setupVault(clients: string[]) {
    const vault = mkdtempSync(join(tmpdir(), 'dl-case-writer-ts-'));
    const clientsDir = join(vault, 'clients');
    mkdirSync(clientsDir);

    for (const slug of clients) {
        const clientDir = join(clientsDir, slug);
        mkdirSync(clientDir);
        writeFileSync(
            join(clientDir, 'meta.yaml'),
            `schema_version: 2\nslug: ${slug}\ntype: client\n`
        );
    }

    return vault;
}

function withFixtureImage(vault: string) {
    const path = join(vault, 'fixture.png');
    writeFileSync(path, 'not-a-real-png');
    return path;
}

function readFrontmatter(casePath: string) {
    return matter(readFileSync(casePath, 'utf8')).data as Record<string, unknown>;
}

function readBody(casePath: string) {
    return matter(readFileSync(casePath, 'utf8')).content;
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

function makeInput(overrides: Partial<WriteCaseInput> = {}): WriteCaseInput {
    return {
        client: '_personal',
        slug: '0001',
        sentiment: 'positive',
        scenario: 'landing',
        quote: '乾淨清楚',
        sourceImagePath: '/nonexistent.png',
        tokens: { palette: 'warm' },
        ...overrides
    };
}

test('positive case -> cases/', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        const fixture = withFixtureImage(vault);
        const result = writeCase(makeInput({ sourceImagePath: fixture }));
        const casePath = join(vault, 'clients', '_personal', 'cases', '0001.md');

        assert.equal(result.casePath, casePath);
        assert.ok(existsSync(casePath));

        const frontmatter = readFrontmatter(casePath);
        assert.equal(frontmatter.schema_version, 2);
        assert.equal(frontmatter.client, '_personal');
        assert.equal(frontmatter.slug, '0001');
        assert.equal(frontmatter.scenario, 'landing');
        assert.equal(frontmatter.sentiment, 'positive');
        assert.deepEqual(frontmatter.quotes_from_user, ['乾淨清楚']);
        assert.deepEqual(frontmatter.tokens, { palette: 'warm' });
    });
});

test('negative case -> anti-library/', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        writeCase(
            makeInput({
                slug: '0099',
                sentiment: 'negative'
            })
        );

        assert.ok(existsSync(join(vault, 'clients', '_personal', 'anti-library', '0099.md')));
    });
});

test('duplicate slug in same sentiment rejects', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        writeCase(makeInput({ slug: 'same' }));

        assert.throws(() => writeCase(makeInput({ slug: 'same' })), /already exists/);
    });
});

test('existing case file rejects with already exists error', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        const casePath = join(vault, 'clients', '_personal', 'cases', 'same.md');
        mkdirSync(join(vault, 'clients', '_personal', 'cases'), { recursive: true });
        writeFileSync(casePath, 'preexisting');

        assert.throws(() => writeCase(makeInput({ slug: 'same' })), /already exists/);
    });
});

test('cross-folder duplicate slug rejects', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        writeCase(makeInput({ slug: 'same', sentiment: 'positive' }));

        assert.throws(
            () => writeCase(makeInput({ slug: 'same', sentiment: 'negative' })),
            /already exists/
        );
    });
});

test('different clients can use the same slug', () => {
    const vault = setupVault(['aicycle', 'zhenheco']);

    withVaultEnv(vault, () => {
        writeCase(
            makeInput({
                client: 'aicycle',
                slug: '0001'
            })
        );
        writeCase(
            makeInput({
                client: 'zhenheco',
                slug: '0001'
            })
        );

        assert.ok(existsSync(join(vault, 'clients', 'aicycle', 'cases', '0001.md')));
        assert.ok(existsSync(join(vault, 'clients', 'zhenheco', 'cases', '0001.md')));
    });
});

test('invalid client slug throws', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        assert.throws(
            () => writeCase(makeInput({ client: '../etc' })),
            /invalid client slug: \.\.\/etc/
        );
        assert.throws(
            () => writeCase(makeInput({ client: 'BAD slug' })),
            /invalid client slug: BAD slug/
        );
    });
});

test('invalid case slug throws', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        assert.throws(
            () => writeCase(makeInput({ slug: 'has spaces' })),
            /invalid slug: has spaces/
        );
        assert.throws(() => writeCase(makeInput({ slug: '..' })), /invalid slug: \.\./);
    });
});

test('missing client dir throws', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        assert.throws(
            () => writeCase(makeInput({ client: 'notreg' })),
            /client not registered: notreg/
        );
    });
});

test('source image exists -> snapshot copy', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        const fixture = withFixtureImage(vault);
        const casePath = join(vault, 'clients', '_personal', 'cases', 'snap.md');
        writeCase(
            makeInput({
                slug: 'snap',
                sourceImagePath: fixture
            })
        );

        assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases', 'snap', 'snapshot.png')));
        const body = readBody(casePath);
        assert.match(body, /## 截圖/);
        assert.match(body, /!\[\[snap\/snapshot\.png\]\]/);
    });
});

test('source image missing -> no copy and no throw', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        const result = writeCase(
            makeInput({
                slug: 'nosnap',
                sourceImagePath: '/nonexistent.png'
            })
        );

        assert.ok(existsSync(result.casePath));
        assert.equal(
            existsSync(join(vault, 'clients', '_personal', 'cases', 'nosnap', 'snapshot.png')),
            false
        );
        const body = readBody(result.casePath);
        assert.doesNotMatch(body, /## 截圖/);
        assert.doesNotMatch(body, /!\[\[/);
    });
});

test('source image directory -> no copy and no snapshot block', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        const sourceDir = join(vault, 'source-dir');
        mkdirSync(sourceDir);

        const result = writeCase(
            makeInput({
                slug: 'dirsnap',
                sourceImagePath: sourceDir
            })
        );

        assert.ok(existsSync(result.casePath));
        assert.equal(
            existsSync(join(vault, 'clients', '_personal', 'cases', 'dirsnap', 'snapshot')),
            false
        );
        const body = readBody(result.casePath);
        assert.doesNotMatch(body, /## 截圖/);
        assert.doesNotMatch(body, /!\[\[/);
    });
});

test('writes only within selected client subtree', () => {
    const vault = setupVault(['clienta', 'clientb']);

    withVaultEnv(vault, () => {
        const result = writeCase(
            makeInput({
                client: 'clientb',
                slug: 'scoped'
            })
        );

        assert.match(result.casePath, /clients\/clientb\//);
        assert.ok(existsSync(join(vault, 'clients', 'clientb', 'cases', 'scoped.md')));
        assert.equal(existsSync(join(vault, 'clients', 'clienta', 'cases', 'scoped.md')), false);
    });
});

test('tokens default to empty object', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        writeCase(
            makeInput({
                slug: 'notokens',
                tokens: undefined
            })
        );

        const frontmatter = readFrontmatter(
            join(vault, 'clients', '_personal', 'cases', 'notokens.md')
        );
        assert.deepEqual(frontmatter.tokens, {});
    });
});

test('frontmatter includes aspectual feedback when provided', () => {
    const vault = setupVault(['_personal']);
    const aspects = [
        { dimension: 'typography', verdict: 'like' as const, note: 'x' },
        { dimension: 'color', verdict: 'dislike' as const, note: '太冷' }
    ];

    withVaultEnv(vault, () => {
        writeCase(
            makeInput({
                slug: 'aspectual',
                aspects
            })
        );

        const frontmatter = readFrontmatter(
            join(vault, 'clients', '_personal', 'cases', 'aspectual.md')
        );
        assert.deepEqual(frontmatter.aspects, aspects);
    });
});

test('frontmatter includes full schema fields', () => {
    const vault = setupVault(['_personal']);

    withVaultEnv(vault, () => {
        writeCase(makeInput({ slug: 'full-schema' }));

        const frontmatter = readFrontmatter(
            join(vault, 'clients', '_personal', 'cases', 'full-schema.md')
        );
        assert.deepEqual(frontmatter.tags, {
            style: [],
            mood: [],
            elements: [],
            industry: []
        });
        assert.deepEqual(frontmatter.related, []);
        assert.deepEqual(frontmatter.lint_skip, []);
        assert.deepEqual(frontmatter.source, {
            type: 'upload',
            via: '/design-collect'
        });
        assert.equal(typeof frontmatter.captured_at, 'string');
        assert.ok(!Number.isNaN(Date.parse(String(frontmatter.captured_at))));
    });
});
