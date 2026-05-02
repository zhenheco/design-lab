import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getClientDir, getClientMetaPath, getVaultPath, isValidSlug, assertSafePath } from './paths.ts';
import { CURRENT_SCHEMA_VERSION } from './schema.js';
import { normalizeThemeColor } from './theme-palette.ts';

export interface CreateClientInput {
    slug: string;
    name: string;
    type: 'self' | 'client';
    theme_color: string;
    notes?: string;
    created_at?: string;
}

interface ClientMetaRecord {
    schema_version: 2;
    slug: string;
    name: string;
    type: 'self' | 'client';
    created_at: string;
    notes: string;
    theme_color: string;
}

export function createClient(input: CreateClientInput): string {
    validateSlug(input.slug);
    validateName(input.slug, input.name);
    validateType(input.slug, input.type);

    const themeColor = normalizeOrThrow(input.slug, input.theme_color);
    const notes = validateOptionalString(input.slug, 'notes', input.notes) ?? '';
    const createdAt = validateOptionalString(input.slug, 'created_at', input.created_at) ?? new Date().toISOString();

    const clientsDir = join(getVaultPath(), 'clients');
    const clientDir = getClientDir(input.slug);
    const metaPath = getClientMetaPath(input.slug);
    const casesDir = join(clientDir, 'cases');
    const antiLibraryDir = join(clientDir, 'anti-library');

    assertSafePath(clientsDir);
    assertSafePath(clientDir);
    assertSafePath(metaPath);
    assertSafePath(casesDir);
    assertSafePath(antiLibraryDir);

    mkdirSync(clientsDir, { recursive: true });

    let createdClientDir = false;
    try {
        try {
            mkdirSync(clientDir, { recursive: false });
            createdClientDir = true;
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                throw new Error(`client already exists: ${input.slug}`);
            }
            throw error;
        }

        mkdirSync(casesDir, { recursive: false });
        mkdirSync(antiLibraryDir, { recursive: false });

        writeFileSync(metaPath, dumpMeta(buildMeta({
            slug: input.slug,
            name: input.name,
            type: input.type,
            theme_color: themeColor,
            notes,
            created_at: createdAt
        })), { flag: 'wx' });
    } catch (error: unknown) {
        if (createdClientDir) {
            try {
                rmSync(clientDir, { recursive: true, force: true });
            } catch {
                // Best-effort cleanup; preserve the original error.
            }
        }
        throw error;
    }

    return metaPath;
}

export function updateClient(
    slug: string,
    patch: Partial<Omit<CreateClientInput, 'slug'>>
): void {
    if (Object.prototype.hasOwnProperty.call(patch, 'slug')) {
        throw new Error(`cannot change slug: ${slug}`);
    }

    validateSlug(slug);

    const clientDir = getClientDir(slug);
    const metaPath = getClientMetaPath(slug);
    if (!existsSync(clientDir) || !existsSync(metaPath)) {
        throw new Error(`client not found: ${slug}`);
    }

    assertSafePath(clientDir);
    assertSafePath(metaPath);

    const currentMeta = readMeta(slug, metaPath);
    const nextMeta = buildMeta({
        slug,
        name: patch.name === undefined ? currentMeta.name : validateName(slug, patch.name),
        type: patch.type === undefined ? currentMeta.type : validateType(slug, patch.type),
        theme_color: patch.theme_color === undefined ? currentMeta.theme_color : normalizeOrThrow(slug, patch.theme_color),
        notes: patch.notes === undefined ? currentMeta.notes : validateOptionalString(slug, 'notes', patch.notes) ?? '',
        created_at: currentMeta.created_at
    });

    writeAtomic(metaPath, dumpMeta(nextMeta));
}

export function archiveClient(slug: string): string {
    validateSlug(slug);

    const clientDir = getClientDir(slug);
    if (!existsSync(clientDir)) {
        throw new Error(`client not found: ${slug}`);
    }

    const archivedRoot = join(getVaultPath(), 'clients', '.archived');
    assertSafePath(clientDir);
    assertSafePath(archivedRoot);
    mkdirSync(archivedRoot, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let archivePath = join(archivedRoot, `${slug}-${timestamp}`);
    if (existsSync(archivePath)) {
        let counter = 1;
        do {
            archivePath = join(archivedRoot, `${slug}-${timestamp}-${counter}`);
            counter += 1;
            if (counter > 1000) {
                throw new Error(`archive path exhausted for ${slug}`);
            }
        } while (existsSync(archivePath));
    }

    assertSafePath(archivePath);
    try {
        renameSync(clientDir, archivePath);
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
            cpSync(clientDir, archivePath, { recursive: true });
            rmSync(clientDir, { recursive: true, force: true });
        } else {
            throw error;
        }
    }
    return archivePath;
}

function validateSlug(slug: string): string {
    if (!isValidSlug(slug)) {
        throw new Error(`invalid slug: ${slug}`);
    }
    return slug;
}

function validateName(slug: string, name: string): string {
    if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error(`invalid name for ${slug}`);
    }
    return name;
}

function validateType(slug: string, type: string): 'self' | 'client' {
    if (type !== 'self' && type !== 'client') {
        throw new Error(`invalid type for ${slug}: ${type}`);
    }
    return type;
}

function validateOptionalString(slug: string, field: 'notes' | 'created_at', value: string | undefined): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new Error(`invalid ${field} for ${slug}`);
    }
    return value;
}

function normalizeOrThrow(slug: string, themeColor: string): string {
    if (typeof themeColor !== 'string') {
        throw new Error(`invalid theme_color for ${slug}: ${String(themeColor)}`);
    }

    const normalized = normalizeThemeColor(themeColor);
    if (!normalized) {
        throw new Error(`invalid theme_color for ${slug}: ${themeColor}`);
    }

    return normalized;
}

function buildMeta(input: Omit<ClientMetaRecord, 'schema_version'>): ClientMetaRecord {
    return {
        schema_version: CURRENT_SCHEMA_VERSION as 2,
        slug: input.slug,
        name: input.name,
        type: input.type,
        created_at: input.created_at,
        notes: input.notes,
        theme_color: input.theme_color
    };
}

function dumpMeta(meta: ClientMetaRecord): string {
    return yaml.dump(meta, {
        schema: yaml.JSON_SCHEMA,
        lineWidth: -1
    });
}

function readMeta(slug: string, metaPath: string): ClientMetaRecord {
    let raw: unknown;
    try {
        raw = yaml.load(readFileSync(metaPath, 'utf8'), { schema: yaml.JSON_SCHEMA });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`failed to read client meta for ${slug}: ${message}`);
    }

    if (!isRecord(raw)) {
        throw new Error(`invalid client meta for ${slug}: expected object`);
    }
    if (raw.schema_version !== CURRENT_SCHEMA_VERSION) {
        throw new Error(`invalid client meta for ${slug}: unsupported schema_version ${String(raw.schema_version)}`);
    }
    if (raw.slug !== slug) {
        throw new Error(`invalid client meta for ${slug}: slug mismatch (${String(raw.slug)})`);
    }
    if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
        throw new Error(`invalid client meta for ${slug}: missing name`);
    }
    if (raw.type !== 'self' && raw.type !== 'client') {
        throw new Error(`invalid client meta for ${slug}: invalid type ${String(raw.type)}`);
    }
    if (typeof raw.created_at !== 'string' || raw.created_at.length === 0) {
        throw new Error(`invalid client meta for ${slug}: missing created_at`);
    }
    if (typeof raw.theme_color !== 'string') {
        throw new Error(`invalid client meta for ${slug}: missing theme_color`);
    }

    const normalizedThemeColor = normalizeOrThrow(slug, raw.theme_color);

    return {
        schema_version: CURRENT_SCHEMA_VERSION as 2,
        slug,
        name: raw.name,
        type: raw.type,
        created_at: raw.created_at,
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        theme_color: normalizedThemeColor
    };
}

function writeAtomic(targetPath: string, content: string): void {
    const tempPath = `${targetPath}.tmp`;
    assertSafePath(tempPath);
    writeFileSync(tempPath, content);
    renameSync(tempPath, targetPath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
