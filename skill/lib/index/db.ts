import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getIndexDbPath } from '../paths.ts';
import { CURRENT_SCHEMA_VERSION } from '../schema.js';

let dbInstance: Database.Database | null = null;
let dbPath: string | null = null;

export function getDb(): Database.Database {
    const nextPath = getIndexDbPath();

    if (dbInstance && dbPath === nextPath) {
        return dbInstance;
    }

    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        dbPath = null;
    }

    const directory = dirname(nextPath);
    if (!existsSync(directory)) {
        mkdirSync(directory, { recursive: true });
    }

    const db = new Database(nextPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    initSchema(db);

    dbInstance = db;
    dbPath = nextPath;
    return db;
}

export function closeDb(): void {
    if (!dbInstance) {
        return;
    }

    dbInstance.close();
    dbInstance = null;
    dbPath = null;
}

export function initSchema(db: Database.Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS cases (
            md_path TEXT PRIMARY KEY,
            client TEXT NOT NULL,
            slug TEXT NOT NULL,
            scenario TEXT NOT NULL,
            sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative')),
            content_hash TEXT NOT NULL,
            frontmatter_json TEXT NOT NULL,
            indexed_at INTEGER NOT NULL,
            UNIQUE(client, slug)
        );
        CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client);
        CREATE INDEX IF NOT EXISTS idx_cases_scenario ON cases(scenario);
        CREATE INDEX IF NOT EXISTS idx_cases_sentiment ON cases(sentiment);

        CREATE TABLE IF NOT EXISTS clients (
            slug TEXT PRIMARY KEY,
            meta_path TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('self', 'client')),
            theme_color TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            indexed_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);

        CREATE TABLE IF NOT EXISTS documents (
            path TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('style-guide', 'scenario-override')),
            scenario TEXT,
            content_hash TEXT NOT NULL,
            indexed_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents(kind);
        CREATE INDEX IF NOT EXISTS idx_documents_scenario ON documents(scenario);

        CREATE TABLE IF NOT EXISTS index_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    db.prepare('INSERT OR IGNORE INTO index_meta (key, value) VALUES (?, ?)').run(
        'schema_version',
        String(CURRENT_SCHEMA_VERSION)
    );
}
