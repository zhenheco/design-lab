import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FeedbackEntry } from '../lib/feedback-log.js';
import { renderTasteOverrides } from '../lib/distill/render-taste-overrides.ts';
import { verdictFromSignal } from '../lib/distill/verdict.ts';

function feedback(entry: Partial<FeedbackEntry> & Pick<FeedbackEntry, 'signal' | 'user_quote'>): FeedbackEntry {
    return entry;
}

test('verdictFromSignal classifies legacy feedback signals through the shared distill helper', () => {
    assert.equal(verdictFromSignal('complain: avoid cold blue'), 'dislike');
    assert.equal(verdictFromSignal('negative visual result'), 'dislike');
    assert.equal(verdictFromSignal('user prefers warmer type'), 'like');
    assert.equal(verdictFromSignal('GOOD spacing'), 'like');
    assert.equal(verdictFromSignal('needs more context'), null);
});

test('renderTasteOverrides emits the exact machine-layer markdown sections and counts all feedback records', () => {
    const rendered = renderTasteOverrides([
        feedback({
            dimension: 'color',
            verdict: 'dislike',
            signal: 'manual',
            user_quote: 'too cold',
            derived_rule: 'Avoid icy blue palettes.'
        }),
        feedback({
            dimension: 'typography',
            verdict: 'like',
            signal: 'manual',
            user_quote: 'nice hierarchy',
            derived_rule: 'Use calm editorial hierarchy.'
        }),
        feedback({
            dimension: 'layout',
            signal: 'complain: bad grid',
            user_quote: 'grid feels template',
            derived_rule: 'Avoid template-like card grids.'
        }),
        feedback({
            dimension: 'motion',
            signal: 'prefer subtle reveal',
            user_quote: 'subtle reveal works'
        }),
        feedback({
            dimension: 'ignored',
            signal: 'unclear',
            user_quote: 'maybe'
        })
    ]);

    assert.deepEqual(rendered.stats, {
        processed: 5,
        like: 2,
        dislike: 2,
        distilled: 4
    });

    assert.equal(rendered.markdown, `# taste-skill Overrides

Generated from feedback-log.jsonl.
processed_records: 5
like_records: 2
dislike_records: 2
distilled_rules: 4
Note: machine layer only; human-approved style-guide edits go through MCP edit_style_guide.

## NEVER candidates (from dislikes)
- color: Avoid icy blue palettes.
- layout: Avoid template-like card grids.

## Style notes (from likes)
- typography: Use calm editorial hierarchy.
- motion: subtle reveal works
`);
});

test('renderTasteOverrides de-duplicates identical output lines while preserving first-seen order', () => {
    const rendered = renderTasteOverrides([
        feedback({ dimension: 'color', verdict: 'dislike', signal: 'manual', user_quote: 'cold', derived_rule: 'Avoid icy blue.' }),
        feedback({ dimension: 'color', verdict: 'dislike', signal: 'manual', user_quote: 'cold again', derived_rule: 'Avoid icy blue.' }),
        feedback({ dimension: 'color', verdict: 'dislike', signal: 'manual', user_quote: 'flat', derived_rule: 'Avoid flat cyan.' }),
        feedback({ dimension: 'color', verdict: 'like', signal: 'manual', user_quote: 'warm', derived_rule: 'Use warm neutrals.' }),
        feedback({ dimension: 'color', verdict: 'like', signal: 'manual', user_quote: 'warm again', derived_rule: 'Use warm neutrals.' })
    ]);

    assert.deepEqual(rendered.stats, {
        processed: 5,
        like: 2,
        dislike: 3,
        distilled: 3
    });
    assert.match(rendered.markdown, /## NEVER candidates \(from dislikes\)\n- color: Avoid icy blue\.\n- color: Avoid flat cyan\./);
    assert.match(rendered.markdown, /## Style notes \(from likes\)\n- color: Use warm neutrals\./);
});

test('renderTasteOverrides skips records without dimension or classifiable verdict but still counts them as processed', () => {
    const rendered = renderTasteOverrides([
        feedback({ verdict: 'like', signal: 'manual', user_quote: 'missing dimension', derived_rule: 'No dimension.' }),
        feedback({ dimension: 'spacing', signal: 'neutral observation', user_quote: 'not actionable' }),
        feedback({ dimension: 'spacing', signal: 'positive rhythm', user_quote: 'airy' })
    ]);

    assert.deepEqual(rendered.stats, {
        processed: 3,
        like: 1,
        dislike: 0,
        distilled: 1
    });
    assert.match(rendered.markdown, /processed_records: 3/);
    assert.match(rendered.markdown, /## Style notes \(from likes\)\n- spacing: airy/);
});
