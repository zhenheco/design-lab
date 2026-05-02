import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getClientMetaPath, getVaultPath, isValidSlug } from './paths.ts';

export interface ClientMeta {
    schema_version: 2;
    slug: string;
    name: string;
    type: 'self' | 'client';
    created_at: string;
    notes: string;
    theme_color: string;
}

export function loadAllClients(vault?: string): ClientMeta[] {
    const resolvedVault = vault ?? getVaultPath();
    const clientsDir = join(resolvedVault, 'clients');
    if (!existsSync(clientsDir)) {
        return [];
    }

    const clients: ClientMeta[] = [];
    for (const entry of readdirSync(clientsDir)) {
        if (entry.startsWith('.')) {
            continue;
        }

        const clientDir = join(clientsDir, entry);
        let dirStat: ReturnType<typeof statSync>;
        try {
            dirStat = statSync(clientDir);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[client-loader] ${entry}: cannot stat (${message})`);
            continue;
        }

        if (!dirStat.isDirectory()) {
            continue;
        }

        const client = parseClientMeta(entry, resolvedVault);
        if (client) {
            clients.push(client);
        }
    }

    return clients.sort((left, right) => left.slug.localeCompare(right.slug));
}

export function loadClient(slug: string, vault?: string): ClientMeta | null {
    const resolvedVault = vault ?? getVaultPath();
    if (!isValidSlug(slug)) {
        console.warn(`[client-loader] ${slug}: invalid slug`);
        return null;
    }

    return parseClientMeta(slug, resolvedVault);
}

function parseClientMeta(slug: string, vault: string): ClientMeta | null {
    if (!isValidSlug(slug)) {
        console.warn(`[client-loader] ${slug}: invalid slug`);
        return null;
    }

    const metaPath = resolveMetaPath(slug, vault);
    if (!existsSync(metaPath)) {
        console.warn(`[client-loader] ${slug}: meta.yaml not found`);
        return null;
    }

    let raw: unknown;
    try {
        raw = yaml.load(readFileSync(metaPath, 'utf8'), { schema: yaml.JSON_SCHEMA });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[client-loader] ${slug}: meta.yaml parse failed: ${message}`);
        return null;
    }

    return validateMeta(slug, raw);
}

function resolveMetaPath(slug: string, vault: string): string {
    return vault === getVaultPath() ? getClientMetaPath(slug) : join(vault, 'clients', slug, 'meta.yaml');
}

function validateMeta(slug: string, raw: unknown): ClientMeta | null {
    if (!isRecord(raw)) {
        console.warn(`[client-loader] ${slug}: meta.yaml is not an object`);
        return null;
    }

    if (raw.schema_version !== 2) {
        console.warn(`[client-loader] ${slug}: unsupported schema_version: ${String(raw.schema_version)}`);
        return null;
    }

    if (raw.type !== 'self' && raw.type !== 'client') {
        console.warn(`[client-loader] ${slug}: invalid type: ${String(raw.type)}`);
        return null;
    }

    const requiredStringFields = ['slug', 'name', 'created_at', 'theme_color'] as const;
    for (const field of requiredStringFields) {
        if (typeof raw[field] !== 'string' || raw[field].length === 0) {
            console.warn(`[client-loader] ${slug}: missing or invalid field: ${field}`);
            return null;
        }
    }

    const metaSlug = raw.slug as string;
    const metaName = raw.name as string;
    const metaType = raw.type as 'self' | 'client';
    const metaCreatedAt = raw.created_at as string;
    const metaThemeColor = raw.theme_color as string;

    if (!isValidSlug(metaSlug)) {
        console.warn(`[client-loader] ${slug}: missing or invalid field: slug`);
        return null;
    }

    return {
        schema_version: 2,
        slug: metaSlug,
        name: metaName,
        type: metaType,
        created_at: metaCreatedAt,
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        theme_color: metaThemeColor
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
