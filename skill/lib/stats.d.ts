export interface StatsTotals {
    positive: number;
    negative: number;
}

export interface StatsResult {
    totals: StatsTotals;
    byScenario: Record<string, number>;
    byClient: Record<string, number>;
}

export function computeStats(vault?: string): StatsResult;
