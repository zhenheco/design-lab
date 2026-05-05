const SIDECAR_URL = import.meta.env.SSR ? (process.env.SIDECAR_URL || 'http://127.0.0.1:5174') : '';
const RELOAD_FLAG = 'design-lab-reloaded';

export interface ClientMeta {
    schema_version: 2;
    slug: string;
    name: string;
    type: 'self' | 'client';
    created_at: string;
    notes: string;
    theme_color: string;
}

export interface CaseSummary {
    slug: string;
    client: string;
    scenario: string;
    sentiment: 'positive' | 'negative';
    quotes_from_user: string[];
    tags: { style: string[]; mood: string[]; elements: string[]; industry: string[] };
    tokens: Record<string, unknown>;
    mdPath: string;
}

export interface StyleGuideDoc {
    content: string;
    contentHash: string;
}

type CasesQuery = {
    client?: string;
    scenario?: string;
    sentiment?: 'positive' | 'negative';
};

export async function authFetch(input: string | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const token = readToken();
    if (token) {
        headers.set('X-Design-Lab-Token', token);
    }

    const res = await fetch(input, { ...init, headers });
    if (res.ok && typeof window !== 'undefined') {
        sessionStorage.removeItem(RELOAD_FLAG);
    }
    if (res.status === 401 && typeof window !== 'undefined') {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
            sessionStorage.setItem(RELOAD_FLAG, '1');
            window.location.reload();
        }
    }

    return res;
}

function readToken(): string | null {
    if (typeof window === 'undefined') {
        const token = process.env.DESIGN_LAB_API_TOKEN;
        return token && token.length > 0 ? token : null;
    }

    const meta = document.querySelector('meta[name="design-lab-token"]');
    const token = meta?.getAttribute('content') ?? '';
    return token.length > 0 ? token : null;
}

export async function fetchClients(): Promise<ClientMeta[]> {
    const res = await authFetch(`${SIDECAR_URL}/api/clients`);
    if (!res.ok) {
        throw new Error(`fetch clients failed: ${res.status}`);
    }

    const data = (await res.json()) as { clients?: ClientMeta[] };
    return Array.isArray(data.clients) ? data.clients : [];
}

async function readApiError(res: Response): Promise<string> {
    const payload = await res.json().catch(() => ({ error: 'unknown' })) as { error?: string };
    return payload.error || `HTTP ${res.status}`;
}

export async function createClient(input: {
    slug: string;
    name: string;
    type: 'self' | 'client';
    theme_color: string;
    notes?: string;
}): Promise<{ slug: string; metaPath: string }> {
    const res = await authFetch(`${SIDECAR_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });

    if (!res.ok) {
        throw new Error(await readApiError(res));
    }

    return res.json() as Promise<{ slug: string; metaPath: string }>;
}

export async function updateClient(
    slug: string,
    patch: {
        name?: string;
        type?: 'self' | 'client';
        theme_color?: string;
        notes?: string;
    }
): Promise<{ slug: string }> {
    const res = await authFetch(`${SIDECAR_URL}/api/clients/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
    });

    if (!res.ok) {
        throw new Error(await readApiError(res));
    }

    return res.json() as Promise<{ slug: string }>;
}

export async function archiveClient(slug: string): Promise<{ slug: string; archivePath: string }> {
    const res = await authFetch(`${SIDECAR_URL}/api/clients/${encodeURIComponent(slug)}`, { method: 'DELETE' });

    if (!res.ok) {
        throw new Error(await readApiError(res));
    }

    return res.json() as Promise<{ slug: string; archivePath: string }>;
}

export async function fetchCases(opts?: CasesQuery): Promise<CaseSummary[]> {
    const params = new URLSearchParams();
    if (opts?.client) {
        params.set('client', opts.client);
    }
    if (opts?.scenario) {
        params.set('scenario', opts.scenario);
    }
    if (opts?.sentiment) {
        params.set('sentiment', opts.sentiment);
    }

    const query = params.toString();
    const url = `${SIDECAR_URL}/api/cases${query ? `?${query}` : ''}`;
    const res = await authFetch(url);
    if (!res.ok) {
        throw new Error(`fetch cases failed: ${res.status}`);
    }

    const data = (await res.json()) as { cases?: CaseSummary[] };
    return Array.isArray(data.cases) ? data.cases : [];
}

export async function fetchStyleGuide(): Promise<StyleGuideDoc> {
    const res = await authFetch(`${SIDECAR_URL}/api/style-guide`);
    if (!res.ok) {
        throw new Error(`fetch style-guide failed: ${res.status}`);
    }

    return res.json() as Promise<StyleGuideDoc>;
}

export async function saveStyleGuide(content: string, expectedHash: string): Promise<{ contentHash: string }> {
    const res = await authFetch('/api/style-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, expectedHash })
    });

    if (res.status === 409) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        const error = new Error(payload.error || 'hash conflict') as Error & { code?: string };
        error.code = 'CONFLICT';
        throw error;
    }

    if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<{ contentHash: string }>;
}

export function computeStatsFromCases(cases: CaseSummary[]) {
    const totals = { positive: 0, negative: 0 };
    const byClient: Record<string, number> = {};
    const byScenario: Record<string, number> = {};

    for (const item of cases) {
        if (item.sentiment === 'positive') {
            totals.positive++;
        } else if (item.sentiment === 'negative') {
            totals.negative++;
        }

        byClient[item.client] = (byClient[item.client] ?? 0) + 1;
        const scenario = item.scenario || 'unknown';
        byScenario[scenario] = (byScenario[scenario] ?? 0) + 1;
    }

    return { totals, byClient, byScenario };
}
