import { loadCaseSummaries } from './case-loader.ts';
import { getVaultPath } from './paths.ts';

export function computeStats(vault) {
    const resolvedVault = vault ?? getVaultPath();
    const all = loadCaseSummaries(resolvedVault);
    const totals = { positive: 0, negative: 0 };
    const byScenario = {};
    const byClient = {};

    for (const c of all) {
        if (c.sentiment === 'positive') totals.positive++;
        else if (c.sentiment === 'negative') totals.negative++;

        const sc = c.scenario || 'unknown';
        byScenario[sc] = (byScenario[sc] || 0) + 1;

        const cl = c.client || 'unknown';
        byClient[cl] = (byClient[cl] || 0) + 1;
    }

    return { totals, byScenario, byClient };
}
