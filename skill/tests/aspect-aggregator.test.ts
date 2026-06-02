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
        existingNeverRuleIds: [],
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

test('aggregateDistill lets explicit feedback verdict override signal keywords', () => {
    const result = aggregateDistill({
        brand: 'whatcanido',
        minSupport: 1,
        cases: [],
        feedback: [
            feedback({ dimension: 'color', verdict: 'dislike', signal: 'I like it', user_quote: 'x' })
        ]
    });

    assert.deepEqual(result.clusters, [
        {
            dimension: 'color',
            verdict: 'dislike',
            count: 1,
            caseSlugs: [],
            feedbackQuotes: ['x'],
            notes: ['x']
        }
    ]);
});

test('aggregateDistill keeps keyword fallback when feedback verdict is omitted', () => {
    const result = aggregateDistill({
        brand: 'whatcanido',
        minSupport: 1,
        cases: [],
        feedback: [
            feedback({ dimension: 'color', signal: 'dislike cold palette', user_quote: '不要冷藍' })
        ]
    });

    assert.deepEqual(result.clusters, [
        {
            dimension: 'color',
            verdict: 'dislike',
            count: 1,
            caseSlugs: [],
            feedbackQuotes: ['不要冷藍'],
            notes: ['不要冷藍']
        }
    ]);
});

test('aggregateDistill defaults minSupport to 2 and sorts clusters deterministically', () => {
    const result = aggregateDistill({
        brand: 'whatcanido',
        cases: [
            caseSummary('color-bad-1', [{ dimension: 'color', verdict: 'dislike', note: 'Cold.' }]),
            caseSummary('color-bad-2', [{ dimension: 'color', verdict: 'dislike', note: 'Blue.' }]),
            caseSummary('type-bad-1', [{ dimension: 'typography', verdict: 'dislike', note: 'Loud.' }]),
            caseSummary('type-bad-2', [{ dimension: 'typography', verdict: 'dislike', note: 'Heavy.' }]),
            caseSummary('motion-good-1', [{ dimension: 'motion', verdict: 'like', note: 'Subtle.' }])
        ],
        feedback: [
            feedback({ dimension: 'spacing', signal: 'positive', user_quote: 'Airy rhythm' }),
            feedback({ dimension: 'spacing', signal: 'good', user_quote: 'Breathing room' }),
            feedback({ dimension: 'color', signal: 'avoid', user_quote: 'No icy cyan' })
        ]
    });

    assert.equal(result.minSupport, 2);
    assert.deepEqual(
        result.clusters.map((cluster) => `${cluster.dimension}:${cluster.verdict}:${cluster.count}`),
        [
            'color:dislike:3',
            'spacing:like:2',
            'typography:dislike:2'
        ]
    );
});

test('aggregateDistill returns empty clusters for a brand with no aspects or feedback', () => {
    const result = aggregateDistill({
        brand: 'legacybrand',
        cases: [
            caseSummary('legacy-case', [])
        ],
        feedback: []
    });

    assert.deepEqual(result, {
        brand: 'legacybrand',
        minSupport: 2,
        clusters: [],
        existingNeverRuleIds: []
    });
});

test('aggregateDistill returns de-duplicated existing NEVER rule IDs in input order', () => {
    const withIds = aggregateDistill({
        brand: 'whatcanido',
        cases: [],
        feedback: [],
        existingNeverRuleIds: ['a', 'b', 'a']
    });
    const withoutIds = aggregateDistill({
        brand: 'whatcanido',
        cases: [],
        feedback: []
    });

    assert.deepEqual(withIds.existingNeverRuleIds, ['a', 'b']);
    assert.deepEqual(withoutIds.existingNeverRuleIds, []);
});
