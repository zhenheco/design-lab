import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
    addCaseInputSchema,
    buildAddCaseRequest,
    buildCaptureUrlRequest,
    buildDistillTasteRequest,
    buildEditStyleGuideRequest,
    buildAddFeedbackRequest,
    addFeedbackInputSchema,
    captureUrlInputSchema,
    distillTasteInputSchema
} from '../mcp/tools.ts';

test('MCP add_case mapper posts the full case body with sourceImagePath as a path string', () => {
    const aspects = [
        { dimension: 'typography', verdict: 'like' as const, note: 'x' },
        { dimension: 'color', verdict: 'dislike' as const, note: '太冷' }
    ];
    const args = z.object(addCaseInputSchema).parse({
        client: 'whatcanido',
        slug: 'hero-contrast',
        sentiment: 'positive',
        scenario: 'landing',
        quote: '留白乾淨，重點明確',
        sourceImagePath: '~/Desktop/reference.png',
        tokens: { palette: ['ink', 'rice-paper'] },
        aspects
    });
    const request = buildAddCaseRequest(args);

    assert.deepEqual(request, {
        method: 'POST',
        path: '/api/cases',
        body: {
            client: 'whatcanido',
            slug: 'hero-contrast',
            sentiment: 'positive',
            scenario: 'landing',
            quote: '留白乾淨，重點明確',
            sourceImagePath: '~/Desktop/reference.png',
            tokens: { palette: ['ink', 'rice-paper'] },
            aspects
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
    const aspects = [
        { dimension: 'typography', verdict: 'like' as const, note: 'x' },
        { dimension: 'color', verdict: 'dislike' as const, note: '太冷' }
    ];
    const args = z.object(captureUrlInputSchema).parse({
        url: 'https://example.com',
        client: 'whatcanido',
        scenario: 'landing',
        quote: 'Hero typography is focused and calm.',
        sentiment: 'positive',
        slug: 'example-home',
        aspects
    });
    const request = buildCaptureUrlRequest(args);

    assert.deepEqual(request, {
        method: 'POST',
        path: '/api/capture/url',
        body: {
            url: 'https://example.com',
            client: 'whatcanido',
            scenario: 'landing',
            quote: 'Hero typography is focused and calm.',
            sentiment: 'positive',
            slug: 'example-home',
            aspects
        }
    });
});

test('MCP distill_taste mapper gets brand clusters with optional minSupport', () => {
    const args = z.object(distillTasteInputSchema).parse({
        brand: 'whatcanido',
        minSupport: 3
    });
    const request = buildDistillTasteRequest(args);

    assert.deepEqual(request, {
        method: 'GET',
        path: '/api/distill/whatcanido',
        query: { minSupport: '3' }
    });
});

test('MCP distill_taste mapper leaves minSupport undefined when omitted', () => {
    const args = z.object(distillTasteInputSchema).parse({
        brand: 'whatcanido'
    });
    const request = buildDistillTasteRequest(args);

    assert.deepEqual(request, {
        method: 'GET',
        path: '/api/distill/whatcanido',
        query: { minSupport: undefined }
    });
});

test('MCP add_feedback mapper posts explicit verdict when provided', () => {
    const args = z.object(addFeedbackInputSchema).parse({
        signal: 'I like it',
        user_quote: 'Keep this direction.',
        client: 'whatcanido',
        dimension: 'color',
        verdict: 'like'
    });
    const request = buildAddFeedbackRequest(args);

    assert.deepEqual(request, {
        method: 'POST',
        path: '/api/feedback',
        body: {
            signal: 'I like it',
            user_quote: 'Keep this direction.',
            client: 'whatcanido',
            case_slug: undefined,
            dimension: 'color',
            derived_rule: undefined,
            verdict: 'like'
        }
    });
});
