import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendFeedback, readFeedback } from '../lib/feedback-log.js';

test('appendFeedback: writes JSONL line with required fields', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-'));
    appendFeedback(vault, {
        signal: 'like',
        user_quote: '配色不錯',
        case_slug: '0001-stripe',
        dimension: 'color'
    });
    const logPath = join(vault, 'feedback-log.jsonl');
    assert.ok(existsSync(logPath));
    const content = readFileSync(logPath, 'utf8');
    assert.match(content, /"signal":"like"/);
    assert.match(content, /"user_quote":"配色不錯"/);
});

test('appendFeedback: appends multiple lines', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-'));
    appendFeedback(vault, { signal: 'like', user_quote: 'a' });
    appendFeedback(vault, { signal: 'dislike', user_quote: 'b' });
    const all = readFeedback(vault);
    assert.equal(all.length, 2);
    assert.equal(all[0].signal, 'like');
    assert.equal(all[1].signal, 'dislike');
});

test('readFeedback: returns empty array if no log', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-'));
    const all = readFeedback(vault);
    assert.equal(all.length, 0);
});
