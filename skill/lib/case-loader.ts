import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import matter from 'gray-matter';

export type Aspect = {
    dimension: string;
    verdict: 'like' | 'dislike';
    note: string;
};

export interface CaseSummary {
    slug: string;
    client: string;
    scenario: string;
    sentiment: 'positive' | 'negative';
    quotes_from_user: string[];
    aspects: Aspect[];
    tags: { style: string[]; mood: string[]; elements: string[]; industry: string[] };
    tokens: Record<string, unknown>;
    mdPath: string;
}

export interface ClientRef {
    slug: string;
    type: 'self' | 'client';
}

type LoaderOptions = {
    client?: string;
    scenario?: string;
    sentiment?: 'positive' | 'negative';
};

type MetaParseResult = {
    slug?: string;
    type?: 'self' | 'client';
};

const EMPTY_TAGS: CaseSummary['tags'] = {
    style: [],
    mood: [],
    elements: [],
    industry: []
};

function parseMinimalYaml(content: string): MetaParseResult {
    const result: MetaParseResult = {};

    for (const line of content.split('\n')) {
        const match = line.match(/^(slug|type):\s*(.+?)\s*$/);
        if (!match) {
            continue;
        }

        const [, key, rawValue] = match;
        const isQuoted =
            (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
            (rawValue.startsWith("'") && rawValue.endsWith("'"));
        const value = isQuoted
            ? rawValue.slice(1, -1)
            : (() => {
                  const commentIdx = rawValue.indexOf('#');
                  return (commentIdx >= 0 ? rawValue.slice(0, commentIdx) : rawValue).trim();
              })();
        if (key === 'slug') {
            result.slug = value;
        }
        if (key === 'type' && (value === 'self' || value === 'client')) {
            result.type = value;
        }
    }

    return result;
}

function readClientMeta(clientDir: string, entryName: string): ClientRef | null {
    const metaPath = join(clientDir, 'meta.yaml');
    if (!existsSync(metaPath)) {
        console.warn(`[case-loader] skip client '${entryName}': missing meta.yaml`);
        return null;
    }

    const parsed = parseMinimalYaml(readFileSync(metaPath, 'utf8'));
    if (!parsed.slug || !parsed.type) {
        console.warn(`[case-loader] skip client '${entryName}': meta.yaml missing slug or type`);
        return null;
    }

    return {
        slug: parsed.slug,
        type: parsed.type
    };
}

function loadAllClientRefs(vault: string): ClientRef[] {
    const clientsDir = join(vault, 'clients');
    if (!existsSync(clientsDir)) {
        return [];
    }

    const refs: ClientRef[] = [];
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
            console.warn(`[case-loader] skip client '${entry}': cannot stat (${message})`);
            continue;
        }
        if (!dirStat.isDirectory()) {
            continue;
        }

        const clientRef = readClientMeta(clientDir, entry);
        if (clientRef) {
            refs.push(clientRef);
        }
    }

    return refs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
}

function normalizeTags(value: unknown): CaseSummary['tags'] {
    if (!isRecord(value)) {
        return { ...EMPTY_TAGS };
    }

    return {
        style: toStringArray(value.style),
        mood: toStringArray(value.mood),
        elements: toStringArray(value.elements),
        industry: toStringArray(value.industry)
    };
}

function normalizeTokens(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function normalizeAspects(value: unknown): Aspect[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is Aspect => {
        return (
            isRecord(item) &&
            typeof item.dimension === 'string' &&
            (item.verdict === 'like' || item.verdict === 'dislike') &&
            typeof item.note === 'string'
        );
    });
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

function parseCaseSummary(mdPath: string, clientSlug: string, sentiment: 'positive' | 'negative'): CaseSummary | null {
    try {
        const frontmatter = matter(readFileSync(mdPath, 'utf8')).data as Record<string, unknown>;
        const fileSlug = basename(mdPath, '.md');
        const parsedSlug = toOptionalString(frontmatter.slug);
        return {
            slug: typeof frontmatter.slug === 'number' ? fileSlug : (parsedSlug ?? fileSlug),
            client: toOptionalString(frontmatter.client) ?? clientSlug,
            scenario: toOptionalString(frontmatter.scenario) ?? '',
            sentiment,
            quotes_from_user: toStringArray(frontmatter.quotes_from_user),
            aspects: normalizeAspects(frontmatter.aspects),
            tags: normalizeTags(frontmatter.tags),
            tokens: normalizeTokens(frontmatter.tokens),
            mdPath
        };
    } catch {
        console.warn(`[case-loader] skip ${mdPath}: parse error`);
        return null;
    }
}

export function computeRetrievalScope(
    targetClient: string | undefined,
    allClients: ClientRef[]
): string[] {
    if (!targetClient) {
        return Array.from(new Set(allClients.map((client) => client.slug)));
    }

    const selfSlugs = allClients
        .filter((client) => client.type === 'self')
        .map((client) => client.slug);

    return Array.from(new Set([targetClient, ...selfSlugs]));
}

export function loadCaseSummaries(vault: string, opts: LoaderOptions = {}): CaseSummary[] {
    const clientsDir = join(vault, 'clients');
    if (!existsSync(clientsDir)) {
        return [];
    }

    const allClients = loadAllClientRefs(vault);
    const validClientSlugs = new Set(allClients.map((client) => client.slug));
    const scope = computeRetrievalScope(opts.client, allClients);
    const subdirs: Array<{ name: 'cases' | 'anti-library'; sentiment: 'positive' | 'negative' }> =
        opts.sentiment === 'positive'
            ? [{ name: 'cases', sentiment: 'positive' }]
            : opts.sentiment === 'negative'
              ? [{ name: 'anti-library', sentiment: 'negative' }]
              : [
                    { name: 'cases', sentiment: 'positive' },
                    { name: 'anti-library', sentiment: 'negative' }
                ];

    const summaries: CaseSummary[] = [];
    for (const clientSlug of scope) {
        if (!validClientSlugs.has(clientSlug)) {
            continue;
        }

        const clientDir = join(clientsDir, clientSlug);
        if (!existsSync(clientDir)) {
            continue;
        }

        for (const subdir of subdirs) {
            const casesDir = join(clientDir, subdir.name);
            if (!existsSync(casesDir)) {
                continue;
            }

            for (const entry of readdirSync(casesDir)) {
                if (!entry.endsWith('.md')) {
                    continue;
                }

                const mdPath = join(casesDir, entry);
                const summary = parseCaseSummary(mdPath, clientSlug, subdir.sentiment);
                if (!summary) {
                    continue;
                }
                if (opts.scenario && summary.scenario !== opts.scenario) {
                    continue;
                }
                summaries.push(summary);
            }
        }
    }

    return summaries;
}
