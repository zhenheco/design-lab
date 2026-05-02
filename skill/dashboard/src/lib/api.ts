const SIDECAR_URL = import.meta.env.SSR ? (process.env.SIDECAR_URL || 'http://127.0.0.1:5174') : '';

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

type CasesQuery = {
    client?: string;
    scenario?: string;
    sentiment?: 'positive' | 'negative';
};

export async function fetchClients(): Promise<ClientMeta[]> {
    const res = await fetch(`${SIDECAR_URL}/api/clients`);
    if (!res.ok) {
        throw new Error(`fetch clients failed: ${res.status}`);
    }

    const data = (await res.json()) as { clients?: ClientMeta[] };
    return Array.isArray(data.clients) ? data.clients : [];
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
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`fetch cases failed: ${res.status}`);
    }

    const data = (await res.json()) as { cases?: CaseSummary[] };
    return Array.isArray(data.cases) ? data.cases : [];
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
