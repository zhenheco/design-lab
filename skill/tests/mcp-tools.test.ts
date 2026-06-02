import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAddCaseRequest, buildCaptureUrlRequest, buildEditStyleGuideRequest } from '../mcp/tools.ts';

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

test('MCP edit_style_guide mapper targets brand style guide when brand is provided', () => {
    const request = buildEditStyleGuideRequest({
        brand: 'whatcanido',
        content: '# WhatCanIDo Style Guide',
        expectedHash: 'hash-before-edit'
    });

    assert.deepEqual(request, {
        method: 'POST',
        path: '/api/clients/whatcanido/style-guide',
        body: {
            content: '# WhatCanIDo Style Guide',
            expectedHash: 'hash-before-edit'
        }
    });
});

test('MCP edit_style_guide mapper targets global style guide when brand is omitted', () => {
    const request = buildEditStyleGuideRequest({
        content: '# Personal Style Guide',
        expectedHash: 'global-hash-before-edit'
    });

    assert.deepEqual(request, {
        method: 'POST',
        path: '/api/style-guide',
        body: {
            content: '# Personal Style Guide',
            expectedHash: 'global-hash-before-edit'
        }
    });
});

test('MCP capture_url mapper posts URL capture requests to the sidecar', () => {
    const request = buildCaptureUrlRequest({
        url: 'https://example.com',
        client: 'whatcanido',
        scenario: 'landing',
        quote: 'Hero typography is focused and calm.',
        sentiment: 'positive',
        slug: 'example-home'
    });

    assert.deepEqual(request, {
        method: 'POST',
        path: '/api/capture/url',
        body: {
            url: 'https://example.com',
            client: 'whatcanido',
            scenario: 'landing',
            quote: 'Hero typography is focused and calm.',
            sentiment: 'positive',
            slug: 'example-home'
        }
    });
});
