import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders } from './auth-headers.ts';

async function withApiToken<T>(token: string | undefined, fn: () => Promise<T> | T): Promise<T> {
    const previousToken = process.env.DESIGN_LAB_API_TOKEN;
    if (token === undefined) {
        delete process.env.DESIGN_LAB_API_TOKEN;
    } else {
        process.env.DESIGN_LAB_API_TOKEN = token;
    }

    try {
        return await fn();
    } finally {
        if (previousToken === undefined) {
            delete process.env.DESIGN_LAB_API_TOKEN;
        } else {
            process.env.DESIGN_LAB_API_TOKEN = previousToken;
        }
    }
}

test('authHeaders returns token and default Host header', async () => {
    await withApiToken('test-token', () => {
        assert.deepEqual(authHeaders(), {
            'X-Design-Lab-Token': 'test-token',
            'Host': '127.0.0.1:5174'
        });
    });
});

test('authHeaders reads X-Design-Lab-Token from DESIGN_LAB_API_TOKEN', async () => {
    await withApiToken('token-from-env', () => {
        assert.equal(authHeaders()['X-Design-Lab-Token'], 'token-from-env');
    });
});

test('authHeaders throws a clear error when DESIGN_LAB_API_TOKEN is missing', async () => {
    await withApiToken(undefined, () => {
        assert.throws(() => authHeaders(), /DESIGN_LAB_API_TOKEN must be set/);
    });
});

test('authHeaders throws when DESIGN_LAB_API_TOKEN is empty string', async () => {
    await withApiToken('', () => {
        assert.throws(() => authHeaders(), /DESIGN_LAB_API_TOKEN must be set/);
    });
});

test('authHeaders supports Host override without changing token', async () => {
    await withApiToken('override-token', () => {
        assert.deepEqual(authHeaders({ host: 'localhost:4322' }), {
            'X-Design-Lab-Token': 'override-token',
            'Host': 'localhost:4322'
        });
    });
});
