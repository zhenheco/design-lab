import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAddCaseRequest } from '../mcp/tools.ts';

test('MCP add_case mapper posts the full case body with sourceImagePath as a path string', () => {
    const request = buildAddCaseRequest({
        client: 'whatcanido',
        slug: 'hero-contrast',
        sentiment: 'positive',
        scenario: 'landing',
        quote: '留白乾淨，重點明確',
        sourceImagePath: '/Users/avyhsu/Desktop/reference.png',
        tokens: { palette: ['ink', 'rice-paper'] }
    });

    assert.deepEqual(request, {
        method: 'POST',
        path: '/api/cases',
        body: {
            client: 'whatcanido',
            slug: 'hero-contrast',
            sentiment: 'positive',
            scenario: 'landing',
            quote: '留白乾淨，重點明確',
            sourceImagePath: '/Users/avyhsu/Desktop/reference.png',
            tokens: { palette: ['ink', 'rice-paper'] }
        }
    });
});
