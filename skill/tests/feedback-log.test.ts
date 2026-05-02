import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendFeedback, readFeedback } from '../lib/feedback-log.js';

test('appendFeedback: preserves explicit client field', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-ts-'));

    appendFeedback(vault, {
        signal: 'like',
        user_quote: 'a',
        client: 'aicycle'
    });

    const records = readFeedback(vault);
    assert.equal(records.length, 1);
    assert.equal(records[0].client, 'aicycle');
});

test('appendFeedback: defaults client to _personal', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-ts-'));

    appendFeedback(vault, {
        signal: 'like',
        user_quote: 'a'
    });

    const records = readFeedback(vault);
    assert.equal(records.length, 1);
    assert.equal(records[0].client, '_personal');
});

test('appendFeedback: keeps backward-compatible optional fields', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-ts-'));

    appendFeedback(vault, {
        signal: 'like',
        user_quote: '配色不錯',
        case_slug: '0001-stripe',
        dimension: 'color'
    });

    const records = readFeedback(vault);
    assert.equal(records.length, 1);
    assert.equal(records[0].signal, 'like');
    assert.equal(records[0].user_quote, '配色不錯');
    assert.equal(records[0].case_slug, '0001-stripe');
    assert.equal(records[0].dimension, 'color');
    assert.equal(records[0].client, '_personal');
});

test('appendFeedback: appends multiple lines with client on every record', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-ts-'));

    appendFeedback(vault, { signal: 'like', user_quote: 'first' });
    appendFeedback(vault, {
        signal: 'dislike',
        user_quote: 'second',
        client: 'aicycle'
    });

    const records = readFeedback(vault);
    assert.equal(records.length, 2);
    assert.equal(records[0].client, '_personal');
    assert.equal(records[1].client, 'aicycle');
});

test('appendFeedback: defaults client to _personal when client is undefined', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-fb-ts-'));

    appendFeedback(vault, {
        signal: 'like',
        user_quote: 'a',
        client: undefined
    });

    const records = readFeedback(vault);
    assert.equal(records.length, 1);
    assert.equal(records[0].client, '_personal');
});
