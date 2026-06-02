import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../../server.ts';
import { requireHostAllowlist } from '../../middleware/auth.ts';

const TEST_TOKEN = 'middleware-test-token';

function setupVault() {
    const vault = mkdtempSync(join(tmpdir(), 'dl-sidecar-auth-ts-'));
    mkdirSync(join(vault, 'clients'), { recursive: true });
    return vault;
}

async function withTestEnv<T>(fn: () => Promise<T> | T): Promise<T> {
    const previousToken = process.env.DESIGN_LAB_API_TOKEN;
    const previousVault = process.env.DESIGN_LAB_VAULT_PATH;
    const previousNodeEnv = process.env.NODE_ENV;

    process.env.DESIGN_LAB_API_TOKEN = TEST_TOKEN;
    process.env.DESIGN_LAB_VAULT_PATH = setupVault();
    process.env.NODE_ENV = 'test';

    try {
        return await fn();
    } finally {
        if (previousToken === undefined) {
            delete process.env.DESIGN_LAB_API_TOKEN;
        } else {
            process.env.DESIGN_LAB_API_TOKEN = previousToken;
        }

        if (previousVault === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previousVault;
        }

        if (previousNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previousNodeEnv;
        }
    }
}

async function withHostAllowlist<T>(allowlist: string, fn: () => Promise<T> | T): Promise<T> {
    const previousAllowlist = process.env.DESIGN_LAB_HOST_ALLOWLIST;
    process.env.DESIGN_LAB_HOST_ALLOWLIST = allowlist;

    try {
        return await fn();
    } finally {
        if (previousAllowlist === undefined) {
            delete process.env.DESIGN_LAB_HOST_ALLOWLIST;
        } else {
            process.env.DESIGN_LAB_HOST_ALLOWLIST = previousAllowlist;
        }
    }
}

function createAgent() {
    return request(createApp());
}

test('GET /api/health without headers -> 200 { status: "ok" }', async () => {
    const response = await withTestEnv(() => createAgent().get('/api/health'));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok' });
});

test('GET /api/health with forbidden Host -> 200', async () => {
    const response = await withTestEnv(() =>
        createAgent().get('/api/health').set('Host', 'evil.com:5174')
    );

    assert.equal(response.status, 200);
});

test('GET /api/clients with allowed Host and no token -> 200', async () => {
    const response = await withTestEnv(() =>
        createAgent().get('/api/clients').set('Host', '127.0.0.1:5174')
    );

    assert.equal(response.status, 200);
});

test('GET /api/clients allows loopback Host on arbitrary ports', async () => {
    await withTestEnv(async () => {
        for (const host of ['127.0.0.1:9999', '[::1]:5174', 'localhost:12345']) {
            const response = await createAgent().get('/api/clients').set('Host', host);
            assert.equal(response.status, 200, host);
        }
    });
});

test('GET /api/clients rejects Host userinfo before loopback hostname', async () => {
    await withTestEnv(async () => {
        for (const host of ['evil.com@127.0.0.1:5174', 'user:pass@127.0.0.1:5174']) {
            const response = await createAgent().get('/api/clients').set('Host', host);
            assert.equal(response.status, 403, host);
        }
    });
});

test('GET /api/clients with forbidden Host and no token -> 403', async () => {
    const response = await withTestEnv(() =>
        createAgent().get('/api/clients').set('Host', 'evil.com:5174')
    );

    assert.equal(response.status, 403);
});

test('GET /api/clients without Host -> 403', async () => {
    let statusCode = 0;
    let body: unknown;
    let nextCalled = false;

    requireHostAllowlist(
        { headers: {} } as Parameters<typeof requireHostAllowlist>[0],
        {
            status(status: number) {
                statusCode = status;
                return this;
            },
            json(payload: unknown) {
                body = payload;
                return this;
            }
        } as Parameters<typeof requireHostAllowlist>[1],
        () => {
            nextCalled = true;
        }
    );

    assert.equal(statusCode, 403);
    assert.deepEqual(body, { error: 'forbidden host' });
    assert.equal(nextCalled, false);
});

test('POST /api/clients with allowed Host and no token -> 401', async () => {
    const response = await withTestEnv(() =>
        createAgent().post('/api/clients').set('Host', '127.0.0.1:5174').send({})
    );

    assert.equal(response.status, 401);
});

test('DELETE /api/clients/:slug with allowed Host and no token -> 401', async () => {
    const response = await withTestEnv(() =>
        createAgent().delete('/api/clients/some-slug').set('Host', '127.0.0.1:5174')
    );

    assert.equal(response.status, 401);
});

test('POST /api/clients with allowed Host and wrong token -> 401', async () => {
    const response = await withTestEnv(() =>
        createAgent()
            .post('/api/clients')
            .set('Host', '127.0.0.1:5174')
            .set('X-Design-Lab-Token', 'wrong-token')
            .send({})
    );

    assert.equal(response.status, 401);
});

test('POST /api/clients with allowed Host and correct token passes middleware', async () => {
    const response = await withTestEnv(() =>
        createAgent()
            .post('/api/clients')
            .set('Host', '127.0.0.1:5174')
            .set('X-Design-Lab-Token', TEST_TOKEN)
            .send({})
    );

    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
});

test('GET /api/clients with dashboard dev proxy Host case-insensitively and no token -> 200', async () => {
    const response = await withTestEnv(() =>
        createAgent().get('/api/clients').set('Host', 'Localhost:4322')
    );

    assert.equal(response.status, 200);
});

test('GET /api/clients honors DESIGN_LAB_HOST_ALLOWLIST override and empty fallback', async () => {
    await withTestEnv(() =>
        withHostAllowlist('custom.local:9999', async () => {
            const defaultHostResponse = await createAgent()
                .get('/api/clients')
                .set('Host', '127.0.0.1:5174');
            const customHostResponse = await createAgent()
                .get('/api/clients')
                .set('Host', 'custom.local:9999');

            assert.equal(defaultHostResponse.status, 403);
            assert.equal(customHostResponse.status, 200);
        })
    );

    await withTestEnv(() =>
        withHostAllowlist(' , ', async () => {
            const response = await createAgent()
                .get('/api/clients')
                .set('Host', '127.0.0.1:5174');

            assert.equal(response.status, 200);
        })
    );
});
