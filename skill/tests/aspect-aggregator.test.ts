import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseSummary } from '../lib/case-loader.ts';
import { aggregateDistill } from '../lib/distill/aspect-aggregator.ts';

function caseSummary(
    slug: string,
    aspects: CaseSummary['aspects'],
    overrides: Partial<CaseSummary> = {}
): CaseSummary {
    return {
        slug,
        client: overrides.client ?? 'whatcanido',
        scenario: overrides.scenario ?? 'landing',
        sentiment: overrides.sentiment ?? 'positive',
        quotes_from_user: overrides.quotes_from_user ?? [],
        aspects,
        tags: overrides.tags ?? { style: [], mood: [], elements: [], industry: [] },
        tokens: overrides.tokens ?? {},
        mdPath: overrides.mdPath ?? `/vault/clients/whatcanido/cases/${slug}.md`
    };
}

test('aggregateDistill groups aspect support by dimension and verdict with minSupport', () => {
    const result = aggregateDistill({
        brand: 'whatcanido',
        minSupport: 2,
        cases: [
            caseSummary('cold-hero', [{ dimension: 'color', verdict: 'dislike', note: 'Too cold.' }]),
            caseSummary('blue-card', [{ dimension: 'color', verdict: 'dislike', note: 'Blue feels distant.' }]),
            caseSummary('clean-type', [{ dimension: 'typography', verdict: 'like', note: 'Calm hierarchy.' }])
        ],
        feedback: []
    });

    assert.deepEqual(result, {
        brand: 'whatcanido',
        minSupport: 2,
        clusters: [
            {
                dimension: 'color',
                verdict: 'dislike',
                count: 2,
                caseSlugs: ['cold-hero', 'blue-card'],
                feedbackQuotes: [],
                notes: ['Too cold.', 'Blue feels distant.']
            }
        ]
    });
});
