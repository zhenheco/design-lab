import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { getVaultPath, isValidSlug } from '../paths.ts';
import { getDb } from './db.ts';

export type IndexedKind = 'case' | 'client-meta' | 'style-guide' | 'scenario-override';

export interface ClassifiedPath {
    kind: IndexedKind;
    scenario?: string;
    client?: string;
    slug?: string;
    sentiment?: 'positive' | 'negative';
}

type CaseFrontmatter = Record<string, unknown>;

type ClientMetaRecord = {
    slug: string;
    name: string;
    type: 'self' | 'client';
    theme_color: string;
};

type Statements = {
    selectCaseHash: Database.Statement<[string], { content_hash: string }>;
    upsertCase: Database.Statement<
        [string, string, string, string, 'positive' | 'negative', string, string, number],
        Database.RunResult
    >;
    deleteCase: Database.Statement<[string], Database.RunResult>;
    selectClientHash: Database.Statement<[string], { content_hash: string }>;
    upsertClient: Database.Statement<
        [string, string, string, 'self' | 'client', string, string, number],
        Database.RunResult
    >;
    deleteClient: Database.Statement<[string], Database.RunResult>;
    selectDocumentHash: Database.Statement<[string], { content_hash: string }>;
    upsertDocument: Database.Statement<
        [string, 'style-guide' | 'scenario-override', string | null, string, number],
        Database.RunResult
    >;
    deleteDocument: Database.Statement<[string], Database.RunResult>;
    setMeta: Database.Statement<[string, string], Database.RunResult>;
};

const statementCache = new WeakMap<Database.Database, Statements>();

export function classifyPath(absPath: string, vault?: string): ClassifiedPath | null {
    const resolvedVault = vault ?? getVaultPath();
    const relPath = relative(resolvedVault, absPath);

    if (!relPath || relPath.startsWith('..') || isAbsolute(relPath)) {
        return null;
    }

    const parts = relPath.split(sep);
    if (parts.length === 0 || parts.includes('.archived') || parts.includes('.index') || parts.includes('..')) {
        return null;
    }

    if (parts.length === 1 && parts[0] === 'personal-style-guide.md') {
        return { kind: 'style-guide' };
    }

    if (
        parts.length === 2 &&
        parts[0] === 'scenario-overrides' &&
        parts[1].endsWith('.md')
    ) {
        const scenario = parts[1].slice(0, -3);
        return scenario ? { kind: 'scenario-override', scenario } : null;
    }

    if (parts.length === 4) {
        return classifyClientFile(parts);
    }

    if (parts.length !== 3 || parts[0] !== 'clients' || !isValidSlug(parts[1])) {
        return null;
    }

    const client = parts[1];
    if (parts[2] === 'meta.yaml') {
        return { kind: 'client-meta', client };
    }

    return null;
}

function classifyClientFile(parts: string[]): ClassifiedPath | null {
    if (parts.length !== 4 || parts[0] !== 'clients' || !isValidSlug(parts[1])) {
        return null;
    }

    const client = parts[1];
    const directory = parts[2];
    if (directory !== 'cases' && directory !== 'anti-library') {
        return null;
    }
    if (!parts[3].endsWith('.md')) {
        return null;
    }

    const slug = parts[3].slice(0, -3);
    if (!isValidSlug(slug)) {
        return null;
    }

    return {
        kind: 'case',
        client,
        slug,
        sentiment: directory === 'cases' ? 'positive' : 'negative'
    };
}

export function reindexPath(absPath: string, vault?: string): void {
    const resolvedVault = vault ?? getVaultPath();
    const classified = classifyPathWithCases(absPath, resolvedVault);
    if (!classified || !existsSync(absPath)) {
        return;
    }

    switch (classified.kind) {
        case 'case':
            if (isCasePath(classified)) {
                reindexCase(absPath, classified);
            }
            return;
        case 'client-meta':
            if (isClientMetaPath(classified)) {
                reindexClientMeta(absPath, classified);
            }
            return;
        case 'style-guide':
            reindexDocument(absPath, 'style-guide', null);
            return;
        case 'scenario-override':
            reindexDocument(absPath, 'scenario-override', classified.scenario ?? null);
            return;
    }
}

export function removePath(absPath: string, vault?: string): void {
    const classified = classifyPathWithCases(absPath, vault ?? getVaultPath());
    if (!classified) {
        return;
    }

    const statements = getStatements(getDb());
    switch (classified.kind) {
        case 'case':
            statements.deleteCase.run(absPath);
            return;
        case 'client-meta':
            if (classified.client) {
                statements.deleteClient.run(classified.client);
            }
            return;
        case 'style-guide':
        case 'scenario-override':
            statements.deleteDocument.run(absPath);
            return;
    }
}

export function selfCheckOnStartup(vault?: string): void {
    const resolvedVault = vault ?? getVaultPath();
    const db = getDb();
    const row = db
        .prepare<[string], { value: string } | undefined>('SELECT value FROM index_meta WHERE key = ?')
        .get('last_full_rebuild_at');

    if (!row) {
        fullReindex(resolvedVault);
        return;
    }

    const sinceMs = Number(row.value);
    if (Number.isNaN(sinceMs)) {
        fullReindex(resolvedVault);
        return;
    }

    scanNewer(resolvedVault, sinceMs);
}

export function fullReindex(vault?: string): void {
    const resolvedVault = vault ?? getVaultPath();
    const db = getDb();
    const statements = getStatements(db);

    const rebuild = db.transaction(() => {
        db.exec(`
            DELETE FROM cases;
            DELETE FROM clients;
            DELETE FROM documents;
        `);

        if (existsSync(resolvedVault)) {
            walkVault(resolvedVault, (path) => {
                reindexPath(path, resolvedVault);
            });
        }

        statements.setMeta.run('last_full_rebuild_at', String(Date.now()));
    });

    rebuild();
}

function classifyPathWithCases(absPath: string, vault: string): ClassifiedPath | null {
    return classifyPath(absPath, vault);
}

function isCasePath(
    classified: ClassifiedPath
): classified is ClassifiedPath & {
    kind: 'case';
    client: string;
    slug: string;
    sentiment: 'positive' | 'negative';
} {
    return (
        classified.kind === 'case' &&
        typeof classified.client === 'string' &&
        typeof classified.slug === 'string' &&
        (classified.sentiment === 'positive' || classified.sentiment === 'negative')
    );
}

function isClientMetaPath(
    classified: ClassifiedPath
): classified is ClassifiedPath & {
    kind: 'client-meta';
    client: string;
} {
    return classified.kind === 'client-meta' && typeof classified.client === 'string';
}

function reindexCase(
    absPath: string,
    classified: ClassifiedPath & {
        kind: 'case';
        client: string;
        slug: string;
        sentiment: 'positive' | 'negative';
    }
): void {
    let rawContent: string;
    let frontmatterData: CaseFrontmatter;

    try {
        rawContent = readFileSync(absPath, 'utf8');
        const parsed = matter(rawContent);
        frontmatterData = toRecord(parsed.data);
    } catch (error: unknown) {
        warnSkip(absPath, 'case parse failed', error);
        return;
    }

    const hash = hashContent(rawContent);
    const statements = getStatements(getDb());
    const existing = statements.selectCaseHash.get(absPath);
    if (existing?.content_hash === hash) {
        return;
    }

    const scenario = toOptionalString(frontmatterData.scenario) ?? '';
    statements.upsertCase.run(
        absPath,
        classified.client,
        classified.slug,
        scenario,
        classified.sentiment,
        hash,
        JSON.stringify(frontmatterData),
        Date.now()
    );
}

function reindexClientMeta(
    absPath: string,
    classified: ClassifiedPath & {
        kind: 'client-meta';
        client: string;
    }
): void {
    let rawContent: string;
    let meta: ClientMetaRecord | null;

    try {
        rawContent = readFileSync(absPath, 'utf8');
        const parsed = yaml.load(rawContent, { schema: yaml.JSON_SCHEMA });
        meta = validateClientMeta(classified.client, parsed);
    } catch (error: unknown) {
        warnSkip(absPath, 'client meta parse failed', error);
        return;
    }

    if (!meta) {
        console.warn(`[reindex] skip ${absPath}: invalid client meta`);
        return;
    }

    const hash = hashContent(rawContent);
    const statements = getStatements(getDb());
    const existing = statements.selectClientHash.get(meta.slug);
    if (existing?.content_hash === hash) {
        return;
    }

    statements.upsertClient.run(
        meta.slug,
        absPath,
        meta.name,
        meta.type,
        meta.theme_color,
        hash,
        Date.now()
    );
}

function reindexDocument(
    absPath: string,
    kind: 'style-guide' | 'scenario-override',
    scenario: string | null
): void {
    let rawContent: string;
    try {
        rawContent = readFileSync(absPath, 'utf8');
    } catch (error: unknown) {
        warnSkip(absPath, 'document read failed', error);
        return;
    }

    const hash = hashContent(rawContent);
    const statements = getStatements(getDb());
    const existing = statements.selectDocumentHash.get(absPath);
    if (existing?.content_hash === hash) {
        return;
    }

    statements.upsertDocument.run(absPath, kind, scenario, hash, Date.now());
}

function validateClientMeta(clientSlug: string, raw: unknown): ClientMetaRecord | null {
    if (!isRecord(raw)) {
        return null;
    }
    if (raw.schema_version !== 2) {
        return null;
    }
    if (raw.type !== 'self' && raw.type !== 'client') {
        return null;
    }
    if (typeof raw.slug !== 'string' || !isValidSlug(raw.slug) || raw.slug !== clientSlug) {
        return null;
    }
    if (typeof raw.name !== 'string' || raw.name.length === 0) {
        return null;
    }
    if (typeof raw.created_at !== 'string' || raw.created_at.length === 0) {
        return null;
    }
    if (typeof raw.theme_color !== 'string' || raw.theme_color.length === 0) {
        return null;
    }

    return {
        slug: raw.slug,
        name: raw.name,
        type: raw.type,
        theme_color: raw.theme_color
    };
}

function scanNewer(vault: string, sinceMs: number): void {
    if (!existsSync(vault)) {
        return;
    }

    // Startup self-check only backfills files newer than the last full rebuild.
    // It intentionally does not sweep deleted files; watcher unlink events own that cleanup path.
    walkVault(vault, (path) => {
        let stats: ReturnType<typeof statSync>;
        try {
            stats = statSync(path);
        } catch (error: unknown) {
            warnSkip(path, 'cannot stat path', error);
            return;
        }

        if (stats.mtimeMs > sinceMs) {
            reindexPath(path, vault);
        }
    });
}

function walkVault(root: string, onFile: (path: string) => void): void {
    let entries: string[];
    try {
        entries = readdirSync(root);
    } catch (error: unknown) {
        warnSkip(root, 'cannot list directory', error);
        return;
    }

    for (const entry of entries) {
        if (entry === '.archived' || entry === '.index') {
            continue;
        }

        const entryPath = join(root, entry);
        // lstatSync does not follow symlinks. We deliberately skip symlinks
        // (both file and dir variants) — the vault is meant to be self-contained,
        // and following symlinks risks cycles (vault → vault), unbounded fan-out
        // (symlink → /), or accidentally indexing files outside the vault root.
        let stats: ReturnType<typeof lstatSync>;
        try {
            stats = lstatSync(entryPath);
        } catch (error: unknown) {
            warnSkip(entryPath, 'cannot stat path', error);
            continue;
        }

        if (stats.isSymbolicLink()) {
            console.warn(`[reindex] skip ${entryPath}: symlink (vault must be self-contained)`);
            continue;
        }

        if (stats.isDirectory()) {
            walkVault(entryPath, onFile);
            continue;
        }

        if (stats.isFile()) {
            onFile(entryPath);
        }
    }
}

function getStatements(db: Database.Database): Statements {
    const cached = statementCache.get(db);
    if (cached) {
        return cached;
    }

    const statements: Statements = {
        selectCaseHash: db.prepare<[string], { content_hash: string }>(
            'SELECT content_hash FROM cases WHERE md_path = ?'
        ),
        upsertCase: db.prepare<
            [string, string, string, string, 'positive' | 'negative', string, string, number],
            Database.RunResult
        >(
            `
                INSERT OR REPLACE INTO cases (
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
        ),
        deleteCase: db.prepare<[string], Database.RunResult>('DELETE FROM cases WHERE md_path = ?'),
        selectClientHash: db.prepare<[string], { content_hash: string }>(
            'SELECT content_hash FROM clients WHERE slug = ?'
        ),
        upsertClient: db.prepare<
            [string, string, string, 'self' | 'client', string, string, number],
            Database.RunResult
        >(
            `
                INSERT OR REPLACE INTO clients (
                    slug,
                    meta_path,
                    name,
                    type,
                    theme_color,
                    content_hash,
                    indexed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `
        ),
        deleteClient: db.prepare<[string], Database.RunResult>('DELETE FROM clients WHERE slug = ?'),
        selectDocumentHash: db.prepare<[string], { content_hash: string }>(
            'SELECT content_hash FROM documents WHERE path = ?'
        ),
        upsertDocument: db.prepare<
            [string, 'style-guide' | 'scenario-override', string | null, string, number],
            Database.RunResult
        >(
            `
                INSERT OR REPLACE INTO documents (
                    path,
                    kind,
                    scenario,
                    content_hash,
                    indexed_at
                ) VALUES (?, ?, ?, ?, ?)
            `
        ),
        deleteDocument: db.prepare<[string], Database.RunResult>('DELETE FROM documents WHERE path = ?'),
        setMeta: db.prepare<[string, string], Database.RunResult>(
            'INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)'
        )
    };

    statementCache.set(db, statements);
    return statements;
}

function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function toRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return undefined;
}

function warnSkip(path: string, reason: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[reindex] skip ${path}: ${reason}${message ? ` (${message})` : ''}`);
}
