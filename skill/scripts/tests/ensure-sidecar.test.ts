import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer as createNetServer } from 'node:net';
import {
    chmodSync,
    existsSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(TEST_DIR, '..', '..');
const ENSURE_SCRIPT = join(SKILL_DIR, 'scripts', 'ensure-sidecar.sh');

type Fixture = {
    root: string;
    home: string;
    vault: string;
    port: number;
    stateDir: string;
    pidFile: string;
    tokenFile: string;
    lockDir: string;
};

let currentFixture: Fixture | null = null;
let extraProcesses: ChildProcess[] = [];

async function getEphemeralPort(): Promise<number> {
    const server = createNetServer();
    await new Promise<void>((resolvePromise, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolvePromise());
    });

    const address = server.address();
    assert(address && typeof address === 'object');
    const port = address.port;

    await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolvePromise();
        });
    });

    return port;
}

async function createFixture(): Promise<Fixture> {
    const root = mkdtempSync(join(tmpdir(), 'dl-ensure-test-'));
    const home = join(root, 'home');
    const vault = join(root, 'vault');
    const port = await getEphemeralPort();
    const stateDir = join(home, '.claude', 'state', 'design-lab');
    mkdirSync(join(vault, 'clients'), { recursive: true });
    mkdirSync(home, { recursive: true });

    const fixture = {
        root,
        home,
        vault,
        port,
        stateDir,
        pidFile: join(stateDir, 'sidecar.pid'),
        tokenFile: join(stateDir, 'api-token'),
        lockDir: join(stateDir, 'spawn.lock')
    };
    currentFixture = fixture;
    return fixture;
}

function runEnsure(fixture: Fixture, timeout = 15_000) {
    return spawnSync('bash', [ENSURE_SCRIPT], {
        cwd: resolve(SKILL_DIR, '..'),
        env: {
            ...process.env,
            HOME: fixture.home,
            DESIGN_LAB_VAULT_PATH: fixture.vault,
            DESIGN_LAB_SIDECAR_PORT: String(fixture.port),
            TMPDIR: fixture.root
        },
        encoding: 'utf8',
        timeout
    });
}

function spawnEnsure(fixture: Fixture): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolvePromise) => {
        const child = spawn('bash', [ENSURE_SCRIPT], {
            cwd: resolve(SKILL_DIR, '..'),
            env: {
                ...process.env,
                HOME: fixture.home,
                DESIGN_LAB_VAULT_PATH: fixture.vault,
                DESIGN_LAB_SIDECAR_PORT: String(fixture.port),
                TMPDIR: fixture.root
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
    });
}

function healthUrl(fixture: Fixture): string {
    return `http://127.0.0.1:${fixture.port}/api/health`;
}

async function waitForHealth(fixture: Fixture, timeoutMs = 10_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(healthUrl(fixture));
            if (response.ok) {
                return true;
            }
        } catch {
            // keep polling
        }
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
    return false;
}

function readPid(fixture: Fixture): number | null {
    if (!existsSync(fixture.pidFile)) {
        return null;
    }
    const value = readFileSync(fixture.pidFile, 'utf8').trim();
    return value ? Number(value) : null;
}

async function killPid(pid: number | null) {
    if (!pid || !Number.isInteger(pid)) {
        return;
    }

    try {
        process.kill(pid, 'SIGTERM');
    } catch {
        return;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
            process.kill(pid, 0);
        } catch {
            return;
        }
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }

    try {
        process.kill(pid, 'SIGKILL');
    } catch {
        // already gone
    }
}

async function startDummyPortOwner(port: number): Promise<ChildProcess> {
    const child = spawn(
        process.execPath,
        [
            '-e',
            [
                "const http = require('node:http');",
                "const server = http.createServer((_req, res) => { res.writeHead(503); res.end('dummy'); });",
                `server.listen(${port}, '127.0.0.1', () => console.log('ready'));`,
                "process.on('SIGTERM', () => server.close(() => process.exit(0)));"
            ].join('')
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    extraProcesses.push(child);

    await new Promise<void>((resolvePromise, reject) => {
        const timer = setTimeout(() => reject(new Error('dummy listener did not start')), 5_000);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            if (String(chunk).includes('ready')) {
                clearTimeout(timer);
                resolvePromise();
            }
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error(`dummy listener exited early with ${code}`));
        });
    });

    return child;
}

async function startHealthyHealthServer(port: number): Promise<ChildProcess> {
    const child = spawn(
        process.execPath,
        [
            '-e',
            [
                "const http = require('node:http');",
                "const server = http.createServer((req, res) => {",
                "  if (req.url && req.url.startsWith('/api/health')) {",
                "    res.writeHead(200, {'content-type':'application/json'});",
                "    res.end(JSON.stringify({ok:true}));",
                "    return;",
                "  }",
                "  res.writeHead(404); res.end();",
                '});',
                `server.listen(${port}, '127.0.0.1', () => console.log('ready'));`,
                "process.on('SIGTERM', () => server.close(() => process.exit(0)));"
            ].join('')
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    extraProcesses.push(child);

    await new Promise<void>((resolvePromise, reject) => {
        const timer = setTimeout(() => reject(new Error('healthy health server did not start')), 5_000);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            if (String(chunk).includes('ready')) {
                clearTimeout(timer);
                resolvePromise();
            }
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error(`healthy health server exited early with ${code}`));
        });
    });

    return child;
}

function fileHash(path: string): string {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

afterEach(async () => {
    if (currentFixture) {
        await killPid(readPid(currentFixture));
    }

    for (const child of extraProcesses) {
        if (child.pid) {
            await killPid(child.pid);
        }
    }
    extraProcesses = [];

    if (currentFixture) {
        rmSync(currentFixture.root, { recursive: true, force: true });
        currentFixture = null;
    }
});

test('fresh: spawns sidecar, writes 0600 token, and passes health', async () => {
    const fixture = await createFixture();

    const result = runEnsure(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(readPid(fixture), 'PID file should contain a sidecar PID');
    assert.ok(existsSync(fixture.tokenFile), 'token file should exist');
    assert.match(readFileSync(fixture.tokenFile, 'utf8').trim(), /^[a-f0-9]{64}$/);
    assert.equal((statSync(fixture.tokenFile).mode & 0o777).toString(8), '600');
    assert.equal(await waitForHealth(fixture), true);
});

test('already-running: healthy PID exits quickly without respawn', async () => {
    const fixture = await createFixture();
    const first = runEnsure(fixture);
    assert.equal(first.status, 0, first.stderr);
    const firstPid = readPid(fixture);

    const startedAt = Date.now();
    const second = runEnsure(fixture);
    const elapsed = Date.now() - startedAt;

    assert.equal(second.status, 0, second.stderr);
    assert.equal(readPid(fixture), firstPid);
    assert.ok(elapsed < 1_000, `expected <1s, got ${elapsed}ms`);
});

test('already-running: healthy sidecar without PID exits without rotating token', async () => {
    const fixture = await createFixture();
    mkdirSync(fixture.stateDir, { recursive: true });
    writeFileSync(fixture.tokenFile, 'daemon-held-token\n', { mode: 0o600 });
    await startHealthyHealthServer(fixture.port);
    const tokenHashBefore = fileHash(fixture.tokenFile);

    const result = runEnsure(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fileHash(fixture.tokenFile), tokenHashBefore);
    assert.equal(readFileSync(fixture.tokenFile, 'utf8'), 'daemon-held-token\n');
    assert.equal(existsSync(fixture.pidFile), false, 'healthy sidecar without PID should not be respawned');
});

test('stale-pid: removes dead PID and spawns a new sidecar', async () => {
    const fixture = await createFixture();
    mkdirSync(fixture.stateDir, { recursive: true });
    writeFileSync(fixture.pidFile, '999999');

    const result = runEnsure(fixture);

    assert.equal(result.status, 0, result.stderr);
    const pid = readPid(fixture);
    assert.ok(pid);
    assert.notEqual(pid, 999999);
});

test('stale-lock-recovery: removes dead holder lock and spawns sidecar', async () => {
    const fixture = await createFixture();
    mkdirSync(fixture.lockDir, { recursive: true });
    writeFileSync(join(fixture.lockDir, 'holder'), '999999');

    const result = runEnsure(fixture);

    assert.equal(result.status, 0, result.stderr);
    const pid = readPid(fixture);
    assert.ok(pid);
    assert.notEqual(pid, 999999);
});

test('port-conflict: exits non-zero with a clear stderr message', async () => {
    const fixture = await createFixture();
    await startDummyPortOwner(fixture.port);

    const result = runEnsure(fixture, 15_000);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ensure-sidecar: (sidecar process exited before health check|spawn timeout).*design-lab-sidecar\.log/s);
});

test('concurrent-race: two callers converge on one healthy sidecar', async () => {
    const fixture = await createFixture();

    const [first, second] = await Promise.all([spawnEnsure(fixture), spawnEnsure(fixture)]);

    assert.equal(first.code, 0, first.stderr);
    assert.equal(second.code, 0, second.stderr);
    assert.ok(readPid(fixture), 'PID file should contain the single sidecar PID');
    assert.equal(await waitForHealth(fixture), true);
});
