import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../sidecar/server.ts';
import { callSidecar } from '../mcp/sidecar-client.ts';
import { buildGetContextRequest } from '../mcp/tools.ts';

async function withEnv<T>(
    overrides: Record<string, string>,
    run: () => Promise<T> | T
): Promise<T> {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        process.env[key] = value;
    }

    try {
        return await run();
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

function setupVault(): string {
    const vault = mkdtempSync(join(tmpdir(), 'dl-mcp-context-'));
    mkdirSync(join(vault, 'clients'), { recursive: true });
    return vault;
}

function writeClientMeta(vault: string, slug: string, type: 'self' | 'client') {
    const clientDir = join(vault, 'clients', slug);
    mkdirSync(clientDir, { recursive: true });
    writeFileSync(
        join(clientDir, 'meta.yaml'),
        [
            'schema_version: 2',
            `slug: ${slug}`,
            `name: ${JSON.stringify(slug)}`,
            `type: ${type}`,
            'created_at: "2026-05-03T00:00:00.000Z"',
            'notes: ""',
            'theme_color: "#0F766E"',
            ''
        ].join('\n')
    );
}

function writeCaseMarkdown(
    vault: string,
    client: string,
    slug: string,
    scenario: string,
    sentiment: 'positive' | 'negative'
) {
    const dir = sentiment === 'positive'
        ? join(vault, 'clients', client, 'cases')
        : join(vault, 'clients', client, 'anti-library');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, `${slug}.md`),
        [
            '---',
            'schema_version: 2',
            `client: ${client}`,
            `slug: ${slug}`,
            `scenario: ${scenario}`,
            `sentiment: ${sentiment}`,
            `quotes_from_user: ${JSON.stringify([`${slug} quote`])}`,
            '---',
            ''
        ].join('\n')
    );
}

async function listenSidecar() {
    const app = createApp();
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
        const running = app.listen(0, '127.0.0.1', () => resolve(running));
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        })
    };
}

test('MCP get_context mapper and sidecar client fetch the real sidecar context payload', async () => {
    const vault = setupVault();
    const tokenPath = join(mkdtempSync(join(tmpdir(), 'dl-mcp-context-token-')), 'api-token');
    writeFileSync(tokenPath, 'integration-token\n');
    writeClientMeta(vault, '_personal', 'self');
    writeClientMeta(vault, 'whatcanido', 'client');
    writeFileSync(
        join(vault, 'personal-style-guide.md'),
        [
            '# Personal Style Guide',
            '',
            '## NEVER',
            '- id: no-hard-black',
            '  rule: "Avoid pure black"',
            '  detector:',
            '    type: regex',
            "    pattern: '#000000'",
            '    target: css',
            ''
        ].join('\n')
    );
    writeFileSync(join(vault, 'clients', 'whatcanido', 'style-guide.md'), '# WhatCanIDo Style Guide\n');
    mkdirSync(join(vault, 'scenario-overrides'), { recursive: true });
    writeFileSync(join(vault, 'scenario-overrides', 'landing.md'), 'Landing override\n');
    writeCaseMarkdown(vault, '_personal', 'self-pos', 'landing', 'positive');
    writeCaseMarkdown(vault, 'whatcanido', 'brand-pos', 'landing', 'positive');
    writeCaseMarkdown(vault, '_personal', 'self-neg', 'landing', 'negative');

    await withEnv(
        {
            DESIGN_LAB_API_TOKEN: 'integration-token',
            DESIGN_LAB_TOKEN_PATH: tokenPath,
            DESIGN_LAB_VAULT_PATH: vault,
            NODE_ENV: 'test'
        },
        async () => {
            const sidecar = await listenSidecar();
            try {
                const sidecarHost = new URL(sidecar.url).host;
                const response = await withEnv(
                    {
                        DESIGN_LAB_HOST_ALLOWLIST: sidecarHost,
                        DESIGN_LAB_SIDECAR_URL: sidecar.url
                    },
                    () => callSidecar(buildGetContextRequest({ client: 'whatcanido', scenario: 'landing' }))
                );

                assert.equal(response.status, 200);
                assert.ok(response.json && typeof response.json === 'object' && !Array.isArray(response.json));
                const payload = response.json as Record<string, unknown>;
                assert.deepEqual(Object.keys(payload).sort(), [
                    'antiCases',
                    'brandStyleGuide',
                    'cases',
                    'client',
                    'neverRules',
                    'retrievedFrom',
                    'scenarioOverride',
                    'styleGuide'
                ]);
                assert.equal(payload.brandStyleGuide, '# WhatCanIDo Style Guide\n');
                assert.equal(payload.scenarioOverride, 'Landing override\n');
                assert.ok(Array.isArray(payload.neverRules));
                assert.ok(Array.isArray(payload.cases));
                assert.ok(Array.isArray(payload.antiCases));
                assert.deepEqual(payload.retrievedFrom, ['_personal', 'whatcanido']);
            } finally {
                await sidecar.close();
            }
        }
    );
});
