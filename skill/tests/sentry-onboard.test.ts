import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildSentryOptions,
    createErrorHandler,
    scrubSentryEvent,
    scrubSentryTransaction
} from '../sidecar/sentry.ts';

test('sidecar declares and wires the Node Sentry SDK', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
    };
    const server = readFileSync(resolve(process.cwd(), 'skill/sidecar/server.ts'), 'utf8');

    assert.ok(pkg.dependencies?.['@sentry/node']);
    assert.match(server, new RegExp(String.raw`from ['"]\./sentry\.ts['"]`));
    assert.match(server, new RegExp(String.raw`initSentry\(`));
    assert.match(server, new RegExp(String.raw`createErrorHandler\(`));
});

test('sidecar launchers load the Sentry DSN before spawning the runtime', () => {
    const ensureSidecar = readFileSync(resolve(process.cwd(), 'skill/scripts/ensure-sidecar.sh'), 'utf8');
    const sidecarDaemon = readFileSync(resolve(process.cwd(), 'skill/scripts/sidecar-daemon.sh'), 'utf8');

    for (const launcher of [ensureSidecar, sidecarDaemon]) {
        assert.match(launcher, /source "\$SKILL_DIR\/scripts\/sentry-env\.sh"/);
        assert.match(launcher, /load_sentry_dsn/);
    }
});

test('buildSentryOptions uses env-driven low-PII defaults', () => {
    assert.equal(buildSentryOptions({}), undefined);

    const options = buildSentryOptions({
        SENTRY_DSN: 'https://public@example.invalid/44',
        SENTRY_ENVIRONMENT: 'production',
        SENTRY_RELEASE: 'design-lab@abc123',
        SENTRY_TRACES_SAMPLE_RATE: '0.05'
    });

    assert.equal(options?.dsn, 'https://public@example.invalid/44');
    assert.equal(options?.environment, 'production');
    assert.equal(options?.release, 'design-lab@abc123');
    assert.equal(options?.tracesSampleRate, 0.05);
    assert.equal(options?.sendDefaultPii, false);
    assert.equal(options?.beforeSend, scrubSentryEvent);
    assert.equal(options?.beforeSendTransaction, scrubSentryTransaction);
});

test('scrubSentryEvent removes request, user, extra, and breadcrumb PII', () => {
    const scrubbed = scrubSentryEvent({
        request: {
            url: 'http://127.0.0.1:5174/api/context?token=secret#frag',
            query_string: 'token=secret',
            cookies: 'sid=secret',
            data: { apiToken: 'secret' },
            headers: {
                authorization: 'Bearer secret',
                cookie: 'sid=secret',
                accept: 'application/json',
                'x-forwarded-for': '203.0.113.42'
            }
        },
        user: {
            id: 'local-user',
            email: 'person@example.test',
            ip_address: '203.0.113.42'
        },
        extra: {
            vaultPath: '/Users/example/design-library',
            apiToken: 'secret'
        },
        breadcrumbs: [
            {
                category: 'sidecar',
                message: 'Authorization: Bearer secret',
                data: { token: 'secret', route: '/api/context' }
            }
        ]
    });

    assert.equal(scrubbed.request?.url, 'http://127.0.0.1:5174/api/context');
    assert.equal(scrubbed.request?.query_string, undefined);
    assert.equal(scrubbed.request?.cookies, undefined);
    assert.equal(scrubbed.request?.data, undefined);
    assert.deepEqual(scrubbed.request?.headers, { accept: 'application/json' });
    assert.deepEqual(scrubbed.user, { id: 'local-user' });
    assert.deepEqual(scrubbed.extra, { vaultPath: '/Users/example/design-library' });
    assert.equal(scrubbed.breadcrumbs, undefined);
});

test('createErrorHandler captures unhandled sidecar 500s without changing the response', async () => {
    const captured: unknown[] = [];
    const handler = createErrorHandler(async (error) => {
        captured.push(error);
    });
    const error = new Error('route exploded');
    const response: { statusCode?: number; body?: unknown } = {};
    const res = {
        status(code: number) {
            response.statusCode = code;
            return this;
        },
        json(body: unknown) {
            response.body = body;
            return this;
        }
    };

    handler(error, { method: 'GET', path: '/api/context' } as never, res as never, (() => undefined) as never);
    await Promise.resolve();

    assert.deepEqual(captured, [error]);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: 'internal server error' });
});

test('createErrorHandler does not capture client parse errors', async () => {
    const captured: unknown[] = [];
    const handler = createErrorHandler(async (error) => {
        captured.push(error);
    });
    const error = Object.assign(new SyntaxError('bad json'), { body: '{' });
    const response: { statusCode?: number; body?: unknown } = {};
    const res = {
        status(code: number) {
            response.statusCode = code;
            return this;
        },
        json(body: unknown) {
            response.body = body;
            return this;
        }
    };

    handler(error, { method: 'POST', path: '/api/capture' } as never, res as never, (() => undefined) as never);
    await Promise.resolve();

    assert.deepEqual(captured, []);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'invalid JSON' });
});
