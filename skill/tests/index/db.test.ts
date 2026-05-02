import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, getDb } from '../../lib/index/db.ts';

const SCHEMA_VERSION = '2';

function withTempVault<T>(run: (vault: string) => T): T {
    const vault = mkdtempSync(join(tmpdir(), 'dl-index-db-ts-'));
    const previous = process.env.DESIGN_LAB_VAULT_PATH;
    process.env.DESIGN_LAB_VAULT_PATH = vault;

    try {
        closeDb();
        return run(vault);
    } finally {
        closeDb();
        if (previous === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previous;
        }
    }
}

function getLibraryDbPath(vault: string): string {
    return join(vault, '.index', 'library.db');
}

test('getDb: auto-creates vault/.index/library.db', () => {
    withTempVault((vault) => {
        const dbPath = getLibraryDbPath(vault);
        assert.equal(existsSync(dbPath), false);

        getDb();

        assert.equal(existsSync(dbPath), true);
    });
});

test('getDb: initializes cases, clients, documents, and index_meta tables', () => {
    withTempVault(() => {
        const db = getDb();
        const rows = db
            .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as Array<{ name: string }>;
        const tableNames = new Set(rows.map((row) => row.name));

        assert.equal(tableNames.has('cases'), true);
        assert.equal(tableNames.has('clients'), true);
        assert.equal(tableNames.has('documents'), true);
        assert.equal(tableNames.has('index_meta'), true);
    });
});

test('getDb: creates required indexes', () => {
    withTempVault(() => {
        const db = getDb();
        const rows = db
            .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")
            .all() as Array<{ name: string }>;
        const indexNames = new Set(rows.map((row) => row.name));

        assert.equal(indexNames.has('idx_cases_client'), true);
        assert.equal(indexNames.has('idx_cases_scenario'), true);
        assert.equal(indexNames.has('idx_cases_sentiment'), true);
        assert.equal(indexNames.has('idx_clients_type'), true);
        assert.equal(indexNames.has('idx_documents_kind'), true);
        assert.equal(indexNames.has('idx_documents_scenario'), true);
    });
});

test('getDb: enables WAL journal mode', () => {
    withTempVault(() => {
        const db = getDb();

        assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    });
});

test('getDb: enables foreign key enforcement', () => {
    withTempVault(() => {
        const db = getDb();

        assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    });
});

test('getDb: reopening is idempotent and preserves existing rows', () => {
    withTempVault(() => {
        const db = getDb();
        db.prepare('INSERT INTO index_meta (key, value) VALUES (?, ?)').run('custom_key', 'kept');

        closeDb();

        const reopened = getDb();
        const row = reopened
            .prepare<[string], { value: string }>('SELECT value FROM index_meta WHERE key = ?')
            .get('custom_key');

        assert.deepEqual(row, { value: 'kept' });
    });
});

test('closeDb: allows reopening the same database with persisted case rows', () => {
    withTempVault(() => {
        const db = getDb();
        db.prepare(
            `
                INSERT INTO cases (
                    md_path,
                    client,
                    slug,
                    scenario,
                    sentiment,
                    content_hash,
                    frontmatter_json,
                    indexed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
        ).run(
            '/tmp/cases/aicycle/homepage-win.md',
            'aicycle',
            'homepage-win',
            'landing-page',
            'positive',
            'hash-1',
            '{"client":"aicycle"}',
            1700000000000
        );

        closeDb();

        const reopened = getDb();
        const row = reopened
            .prepare<[string], { md_path: string }>('SELECT md_path FROM cases WHERE slug = ?')
            .get('homepage-win');

        assert.deepEqual(row, { md_path: '/tmp/cases/aicycle/homepage-win.md' });
    });
});

test('getDb: returns the same singleton instance until closeDb is called', () => {
    withTempVault(() => {
        const first = getDb();
        const second = getDb();

        assert.strictEqual(first, second);
    });
});

test('getDb: stores schema_version in index_meta', () => {
    withTempVault(() => {
        const db = getDb();
        const row = db
            .prepare<[string], { value: string }>('SELECT value FROM index_meta WHERE key = ?')
            .get('schema_version');

        assert.deepEqual(row, { value: SCHEMA_VERSION });
    });
});

test('cases: sentiment CHECK constraint rejects invalid values', () => {
    withTempVault(() => {
        const db = getDb();

        assert.throws(
            () =>
                db.prepare(
                    `
                        INSERT INTO cases (
                            md_path,
                            client,
                            slug,
                            scenario,
                            sentiment,
                            content_hash,
                            frontmatter_json,
                            indexed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `
                ).run(
                    '/tmp/cases/aicycle/neutral.md',
                    'aicycle',
                    'neutral',
                    'landing-page',
                    'neutral',
                    'hash-2',
                    '{"client":"aicycle"}',
                    1700000000001
                ),
            /CHECK constraint failed/
        );
    });
});

test('cases: UNIQUE(client, slug) rejects duplicates', () => {
    withTempVault(() => {
        const db = getDb();
        const insertCase = db.prepare(
            `
                INSERT INTO cases (
                    md_path,
                    client,
                    slug,
                    scenario,
                    sentiment,
                    content_hash,
                    frontmatter_json,
                    indexed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
        );

        insertCase.run(
            '/tmp/cases/aicycle/dup-1.md',
            'aicycle',
            'duplicate-slug',
            'landing-page',
            'positive',
            'hash-3',
            '{"client":"aicycle"}',
            1700000000002
        );

        assert.throws(
            () =>
                insertCase.run(
                    '/tmp/cases/aicycle/dup-2.md',
                    'aicycle',
                    'duplicate-slug',
                    'landing-page',
                    'negative',
                    'hash-4',
                    '{"client":"aicycle"}',
                    1700000000003
                ),
            /UNIQUE constraint failed/
        );
    });
});
