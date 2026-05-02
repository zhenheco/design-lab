import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeCase } from '../lib/case-writer.js';
import matter from 'gray-matter';

test('writeCase: writes positive case with frontmatter + assets dir', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cw-'));
    const slug = 'test-stripe';
    const result = writeCase(vault, {
        slug,
        sentiment: 'positive',
        scenario: 'landing',
        quote: '配色乾淨',
        sourceImagePath: '/tmp/fixture.png',
        tokens: {
            palette: { primary: '#635BFF', bg: '#FFFFFF' },
            typography: { heading: 'Inter 600' }
        }
    });

    assert.equal(result.casePath, join(vault, 'cases', `${slug}.md`));
    assert.ok(existsSync(result.casePath));

    const md = readFileSync(result.casePath, 'utf8');
    const fm = matter(md);
    assert.equal(fm.data.schema_version, 1);
    assert.equal(fm.data.slug, slug);
    assert.equal(fm.data.sentiment, 'positive');
    assert.equal(fm.data.scenario, 'landing');
    assert.deepEqual(fm.data.quotes_from_user, ['配色乾淨']);
    assert.equal(fm.data.tokens.palette.primary, '#635BFF');
});

test('writeCase: negative sentiment goes to anti-library', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cw-'));
    const result = writeCase(vault, {
        slug: 'too-flat',
        sentiment: 'negative',
        scenario: 'brand',
        quote: '太扁太無聊',
        sourceImagePath: '/tmp/fixture.png',
        tokens: { palette: {} }
    });
    assert.equal(result.casePath, join(vault, 'anti-library', 'too-flat.md'));
    assert.ok(existsSync(result.casePath));
});

test('writeCase: rejects duplicate slug', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cw-'));
    writeCase(vault, { slug: 'same', sentiment: 'positive', scenario: 'landing', quote: 'a', sourceImagePath: '/tmp/x.png', tokens: {} });
    assert.throws(
        () => writeCase(vault, { slug: 'same', sentiment: 'positive', scenario: 'landing', quote: 'b', sourceImagePath: '/tmp/x.png', tokens: {} }),
        /already exists/
    );
});
