import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer } from '../sidecar/server.ts';

const SKILL_DIR = fileURLToPath(new URL('..', import.meta.url));
const DASHBOARD_ENTRY = fileURLToPath(new URL('../dashboard/dist/server/entry.mjs', import.meta.url));
const SKIP_IF_NO_DASHBOARD_DIST = existsSync(DASHBOARD_ENTRY)
    ? false
    : 'run cd skill/dashboard && npm run build';

function initVault(vault) {
    execSync(`bash "${join(SKILL_DIR, 'scripts/init-library.sh')}" "${vault}"`, {
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
    });
}

async function closeServer(server) {
    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function withSidecar(run) {
    const vault = mkdtempSync(join(tmpdir(), 'dl-dashboard-e2e-'));
    const previousVault = process.env.DESIGN_LAB_VAULT_PATH;
    const previousToken = process.env.DESIGN_LAB_API_TOKEN;
    let server;

    try {
        initVault(vault);
        process.env.DESIGN_LAB_VAULT_PATH = vault;
        process.env.DESIGN_LAB_API_TOKEN = 'dashboard-e2e-token';

        server = await startServer(0, '127.0.0.1');
        const address = server.address();
        assert.ok(address && typeof address === 'object', 'server should listen on a TCP address');

        await run(`http://127.0.0.1:${address.port}`);
    } finally {
        if (server) {
            await closeServer(server);
        }

        if (previousVault === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previousVault;
        }

        if (previousToken === undefined) {
            delete process.env.DESIGN_LAB_API_TOKEN;
        } else {
            process.env.DESIGN_LAB_API_TOKEN = previousToken;
        }

        rmSync(vault, { recursive: true, force: true });
    }
}

test('dashboard E2E: GET / renders overview HTML', { skip: SKIP_IF_NO_DASHBOARD_DIST }, async () => {
    await withSidecar(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/`);
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') ?? '', /text\/html/);
        assert.match(body, /<title>Design Lab/);
        assert.match(body, /Design Lab/);
    });
});

test('dashboard E2E: GET /api/health returns ok JSON', { skip: SKIP_IF_NO_DASHBOARD_DIST }, async () => {
    await withSidecar(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/health`);

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok' });
    });
});
