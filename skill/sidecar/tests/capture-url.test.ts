import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import request from 'supertest';
import { createApp } from '../server.ts';
import { authHeaders } from './helpers/auth-headers.ts';

async function serveHtml(html: string): Promise<{ url: string; close: () => Promise<void> }> {
    const server = createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === 'object');

    return {
        url: `http://127.0.0.1:${address.port}/fixture`,
        close: () => closeServer(server)
    };
}

async function closeServer(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

function setupVault(): string {
    const vault = mkdtempSync(join(tmpdir(), 'dl-sidecar-capture-url-'));
    mkdirSync(join(vault, 'clients', 'whatcanido'), { recursive: true });
    writeFileSync(
        join(vault, 'clients', 'whatcanido', 'meta.yaml'),
        [
            'schema_version: 2',
            'slug: whatcanido',
            'name: "WhatCanIDo"',
            'type: client',
            'created_at: "2026-06-01T00:00:00.000Z"',
            'notes: ""',
            'theme_color: "#0F766E"',
            ''
        ].join('\n')
    );
    return vault;
}

async function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        return await fn();
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test('POST /api/capture/url captures a fixture URL and writes a design case with snapshot tokens', { timeout: 30_000 }, async () => {
    const vault = setupVault();
    const fixture = await serveHtml(`<!doctype html>
        <html>
            <head>
                <title>Rice Paper Landing</title>
                <style>
                    body {
                        margin: 0;
                        background: rgb(247, 243, 234);
                        color: rgb(31, 41, 55);
                        font-family: Georgia, serif;
                    }
                    h1 {
                        color: rgb(125, 88, 45);
                        font-family: Arial, sans-serif;
                        font-size: 44px;
                    }
                    a {
                        color: rgb(15, 118, 110);
                    }
                </style>
            </head>
            <body>
                <main>
                    <h1>Rice Paper Landing</h1>
                    <a href="/next">Continue</a>
                </main>
            </body>
        </html>`);

    try {
        const response = await withEnv(
            {
                DESIGN_LAB_VAULT_PATH: vault,
                DESIGN_LAB_API_TOKEN: 'test-token-for-capture-url',
                NODE_ENV: 'test'
            },
            () =>
                request(createApp()).post('/api/capture/url').set(authHeaders()).send({
                    url: fixture.url,
                    client: 'whatcanido',
                    scenario: 'landing',
                    quote: 'The landing page keeps the paper tone and typography consistent.'
                })
        );

        assert.equal(response.status, 201);
        assert.equal(response.body.slug, 'rice-paper-landing');
        assert.ok(response.body.casePath.endsWith('/clients/whatcanido/cases/rice-paper-landing.md'));
        assert.ok(existsSync(response.body.casePath));
        assert.ok(existsSync(join(response.body.assetsDir, 'snapshot.png')));
        assert.ok(Array.isArray(response.body.tokens.palette));
        assert.ok(response.body.tokens.palette.length > 0);

        const caseFile = matter(readFileSync(response.body.casePath, 'utf8'));
        assert.equal(caseFile.data.scenario, 'landing');
        assert.deepEqual(caseFile.data.quotes_from_user, [
            'The landing page keeps the paper tone and typography consistent.'
        ]);
        assert.ok(Array.isArray(caseFile.data.tokens.palette));
        assert.ok(caseFile.data.tokens.palette.length > 0);
    } finally {
        await fixture.close();
    }
});

test('POST /api/capture/url without token returns 401', async () => {
    const vault = setupVault();

    const response = await withEnv(
        {
            DESIGN_LAB_VAULT_PATH: vault,
            DESIGN_LAB_API_TOKEN: 'test-token-for-capture-url',
            NODE_ENV: 'test'
        },
        () =>
            request(createApp()).post('/api/capture/url').set('Host', '127.0.0.1:5174').send({
                url: 'http://127.0.0.1/example',
                client: 'whatcanido',
                scenario: 'landing',
                quote: 'No token should be rejected before capture.'
            })
    );

    assert.equal(response.status, 401);
});

test('POST /api/capture/url rejects non-http URLs before capture', async () => {
    const vault = setupVault();

    const response = await withEnv(
        {
            DESIGN_LAB_VAULT_PATH: vault,
            DESIGN_LAB_API_TOKEN: 'test-token-for-capture-url',
            NODE_ENV: 'test'
        },
        () =>
            request(createApp()).post('/api/capture/url').set(authHeaders()).send({
                url: 'file:///etc/passwd',
                client: 'whatcanido',
                scenario: 'landing',
                quote: 'Local files are not capture sources.'
            })
    );

    assert.equal(response.status, 400);
});

test('POST /api/capture/url returns 404 for an unknown client before capture', async () => {
    const vault = setupVault();

    const response = await withEnv(
        {
            DESIGN_LAB_VAULT_PATH: vault,
            DESIGN_LAB_API_TOKEN: 'test-token-for-capture-url',
            NODE_ENV: 'test'
        },
        () =>
            request(createApp()).post('/api/capture/url').set(authHeaders()).send({
                url: 'http://127.0.0.1/example',
                client: 'missing-client',
                scenario: 'landing',
                quote: 'Unknown client should not trigger capture.'
            })
    );

    assert.equal(response.status, 404);
});

test('POST /api/capture/url rejects invalid scenario before writing a case', { timeout: 30_000 }, async () => {
    const vault = setupVault();
    const fixture = await serveHtml(`<!doctype html>
        <html>
            <head><title>Invalid Scenario Fixture</title></head>
            <body><h1>Invalid Scenario Fixture</h1></body>
        </html>`);

    try {
        const response = await withEnv(
            {
                DESIGN_LAB_VAULT_PATH: vault,
                DESIGN_LAB_API_TOKEN: 'test-token-for-capture-url',
                NODE_ENV: 'test'
            },
            () =>
                request(createApp()).post('/api/capture/url').set(authHeaders()).send({
                    url: fixture.url,
                    client: 'whatcanido',
                    scenario: 'print',
                    quote: 'Invalid scenario should not write.'
                })
        );

        assert.equal(response.status, 400);
    } finally {
        await fixture.close();
    }
});
