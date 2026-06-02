import type { CaseSummary } from '../case-loader.ts';
import type { FeedbackEntry } from '../feedback-log.js';

export interface DistillCluster {
    dimension: string;
    verdict: 'like' | 'dislike';
    count: number;
    caseSlugs: string[];
    feedbackQuotes: string[];
    notes: string[];
}

export interface DistillResult {
    brand: string;
    minSupport: number;
    clusters: DistillCluster[];
}

export interface AggregateInput {
    brand: string;
    cases: CaseSummary[];
    feedback: FeedbackEntry[];
    minSupport?: number;
}

type ClusterDraft = {
    dimension: string;
    verdict: 'like' | 'dislike';
    caseSlugs: string[];
    feedbackQuotes: string[];
    notes: string[];
};

function pushUnique(items: string[], value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) {
        return items;
    }

    return [...items, trimmed];
}

function getOrCreateCluster(
    clusters: Map<string, ClusterDraft>,
    dimension: string,
    verdict: 'like' | 'dislike'
): ClusterDraft {
    const key = `${dimension}::${verdict}`;
    const existing = clusters.get(key);
    if (existing) {
        return existing;
    }

    const created = { dimension, verdict, caseSlugs: [], feedbackQuotes: [], notes: [] };
    clusters.set(key, created);
    return created;
}

export function aggregateDistill(input: AggregateInput): DistillResult {
    const minSupport = input.minSupport ?? 2;
    const drafts = new Map<string, ClusterDraft>();

    for (const designCase of input.cases) {
        for (const aspect of designCase.aspects) {
            const cluster = getOrCreateCluster(drafts, aspect.dimension, aspect.verdict);
            cluster.caseSlugs = pushUnique(cluster.caseSlugs, designCase.slug);
            cluster.notes = pushUnique(cluster.notes, aspect.note);
        }
    }

    const clusters = Array.from(drafts.values())
        .map((cluster): DistillCluster => ({
            ...cluster,
            count: cluster.caseSlugs.length + cluster.feedbackQuotes.length
        }))
        .filter((cluster) => cluster.count >= minSupport)
        .sort((left, right) => {
            if (left.count !== right.count) {
                return right.count - left.count;
            }
            if (left.dimension !== right.dimension) {
                return left.dimension.localeCompare(right.dimension);
            }
            return left.verdict.localeCompare(right.verdict);
        });

    return {
        brand: input.brand,
        minSupport,
        clusters
    };
}
