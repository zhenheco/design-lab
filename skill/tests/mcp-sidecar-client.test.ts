import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { callSidecar } from '../mcp/sidecar-client.ts';

async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
    const server = createServer(handler);
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
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

async function withEnv<T>(overrides: Record<string, string>, run: () => Promise<T>): Promise<T> {
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

test('MCP sidecar client sends write token and rereads it once after a 401', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'dl-mcp-token-'));
    const tokenPath = join(temp, 'api-token');
    writeFileSync(tokenPath, 'stale-token\n');
    const seenTokens: Array<string | undefined> = [];
    const logLines: string[] = [];

    const server = await listen((req, res) => {
        seenTokens.push(req.headers['x-design-lab-token'] as string | undefined);

        if (seenTokens.length === 1) {
            writeFileSync(tokenPath, 'fresh-token\n');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'token expired' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
    });

    try {
        const logMock = mock.method(console, 'log', (...args: unknown[]) => {
            logLines.push(args.map(String).join(' '));
        });
        const errorMock = mock.method(console, 'error', (...args: unknown[]) => {
            logLines.push(args.map(String).join(' '));
        });

        let result;
        try {
            result = await withEnv(
                {
                    DESIGN_LAB_SIDECAR_URL: server.url,
                    DESIGN_LAB_TOKEN_PATH: tokenPath
                },
                () => callSidecar({ method: 'POST', path: '/api/cases', body: { slug: 'one' } })
            );
        } finally {
            logMock.mock.restore();
            errorMock.mock.restore();
        }

        assert.deepEqual(result, { status: 200, json: { ok: true } });
        assert.deepEqual(seenTokens, ['stale-token', 'fresh-token']);
        assert.equal(logLines.some((line) => /stale-token|fresh-token/.test(line)), false);
    } finally {
        await server.close();
    }
});

test('MCP sidecar client builds Host header from DESIGN_LAB_SIDECAR_URL', async () => {
    let seenHost: string | undefined;
    const fetchMock = mock.method(globalThis, 'fetch', async (_url: RequestInfo | URL, init?: RequestInit) => {
        seenHost = (init?.headers as Record<string, string> | undefined)?.Host;
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    });

    try {
        const result = await withEnv(
            {
                DESIGN_LAB_SIDECAR_URL: 'http://127.0.0.1:9999'
            },
            () => callSidecar({ method: 'GET', path: '/api/context' })
        );

        assert.deepEqual(result, { status: 200, json: { ok: true } });
        assert.equal(seenHost, '127.0.0.1:9999');
    } finally {
        fetchMock.mock.restore();
    }
});
