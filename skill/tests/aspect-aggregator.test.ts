import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseSummary } from '../lib/case-loader.ts';
import type { FeedbackEntry } from '../lib/feedback-log.js';
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

function feedback(entry: Partial<FeedbackEntry> & Pick<FeedbackEntry, 'signal' | 'user_quote'>): FeedbackEntry {
    return entry;
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

test('aggregateDistill counts feedback with dimension and verdict-like signal', () => {
    const result = aggregateDistill({
        brand: 'whatcanido',
        minSupport: 2,
        cases: [
            caseSummary('cold-hero', [{ dimension: 'color', verdict: 'dislike', note: 'Too cold.' }])
        ],
        feedback: [
            feedback({ dimension: 'color', signal: 'dislike', user_quote: '太冷' }),
            feedback({ dimension: 'color', signal: 'negative palette', user_quote: '不要冷藍' }),
            feedback({ signal: 'dislike', user_quote: 'missing dimension' }),
            feedback({ dimension: 'color', signal: 'unclear', user_quote: 'ambiguous signal' })
        ]
    });

    assert.deepEqual(result.clusters, [
        {
            dimension: 'color',
            verdict: 'dislike',
            count: 3,
            caseSlugs: ['cold-hero'],
            feedbackQuotes: ['太冷', '不要冷藍'],
            notes: ['Too cold.', '太冷', '不要冷藍']
        }
    ]);
});
