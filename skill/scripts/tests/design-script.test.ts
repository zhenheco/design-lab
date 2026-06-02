import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(TEST_DIR, '..', '..');
const DESIGN_SCRIPT = join(SKILL_DIR, 'scripts', 'design.sh');

type Fixture = {
    root: string;
    home: string;
    vault: string;
};

let currentFixture: Fixture | null = null;
let extraProcesses: ChildProcess[] = [];

function createFixture(): Fixture {
    const root = mkdtempSync(join(tmpdir(), 'dl-design-test-'));
    const home = join(root, 'home');
    const vault = join(root, 'vault');
    mkdirSync(join(vault, 'clients', '_personal', 'cases'), { recursive: true });
    mkdirSync(join(vault, 'clients', '_personal', 'anti-library'), { recursive: true });
    mkdirSync(join(vault, 'clients', 'whatcanido', 'cases'), { recursive: true });
    mkdirSync(join(vault, 'clients', 'whatcanido', 'anti-library'), { recursive: true });
    mkdirSync(join(vault, 'scenario-overrides'), { recursive: true });
    mkdirSync(home, { recursive: true });

    writeFileSync(
        join(vault, 'personal-style-guide.md'),
        [
            '---',
            'schema_version: 2',
            '---',
            '# Global Guide',
            '## DO',
            '- Use calm layouts.',
            '## NEVER',
            '- id: no-halfwidth-punct-after-cjk',
            '  rule: "中文後不要半形標點"',
            '  detector:',
            '    type: regex',
            "    pattern: '[\\u4e00-\\u9fff][,.;:!?]'",
            '    target: css'
        ].join('\n')
    );
    writeFileSync(join(vault, 'clients', '_personal', 'meta.yaml'), 'slug: _personal\ntype: self\n');
    writeFileSync(join(vault, 'clients', 'whatcanido', 'meta.yaml'), 'slug: whatcanido\ntype: client\n');
    writeFileSync(join(vault, 'scenario-overrides', 'landing.md'), 'Landing override: keep hero quiet.\n');
    writeFileSync(
        join(vault, 'clients', 'whatcanido', 'cases', 'zen-hero.md'),
        [
            '---',
            'schema_version: 2',
            'slug: zen-hero',
            'client: whatcanido',
            'scenario: landing',
            'quotes_from_user:',
            '  - "禪意、米紙、印章紅"',
            'tokens:',
            '  palette:',
            '    paper: "#f7f2e8"',
            '  fonts:',
            '    heading: "Noto Serif TC"',
            'aspects:',
            '  - sentiment: like',
            '    dimension: palette',
            '    note: "米紙與墨色比例正確"',
            '---',
            ''
        ].join('\n')
    );
    writeFileSync(
        join(vault, 'clients', 'whatcanido', 'anti-library', 'cold-saas.md'),
        [
            '---',
            'schema_version: 2',
            'slug: cold-saas',
            'client: whatcanido',
            'scenario: landing',
            'quotes_from_user:',
            '  - "太冷藍科技感"',
            'aspects:',
            '  - sentiment: dislike',
            '    dimension: mood',
            '    note: "不要冷藍 SaaS 感"',
            '---',
            ''
        ].join('\n')
    );

    const fixture = { root, home, vault };
    currentFixture = fixture;
    return fixture;
}

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

async function startHealthyContextServer() {
    const port = await getEphemeralPort();
    const response = JSON.stringify({
        client: { slug: 'whatcanido', type: 'client' },
        styleGuide: 'Global DO from sidecar',
        brandStyleGuide: 'WhatCanIDo 禪意 brand guide',
        scenarioOverride: 'Landing override from sidecar',
        neverRules: [
            {
                id: 'wcid-no-pure-white-bg',
                rule: '不要純白背景',
                detector: { type: 'regex', pattern: '#fff', target: 'css' }
            },
            {
                id: 'no-halfwidth-punct-after-cjk',
                rule: '中文後不要半形標點',
                detector: { type: 'regex', pattern: '[\\u4e00-\\u9fff][,.;:!?]', target: 'css' }
            }
        ],
        cases: [
            {
                slug: 'zen-hero',
                client: 'whatcanido',
                scenario: 'landing',
                sentiment: 'positive',
                quotes_from_user: ['禪意、米紙、印章紅'],
                tags: { style: [], mood: [], elements: [], industry: [] },
                tokens: { palette: { paper: '#f7f2e8' }, fonts: { heading: 'Noto Serif TC' } },
                aspects: [{ sentiment: 'like', dimension: 'palette', note: '米紙與墨色比例正確' }]
            }
        ],
        antiCases: [
            {
                slug: 'cold-saas',
                client: 'whatcanido',
                scenario: 'landing',
                sentiment: 'negative',
                quotes_from_user: ['太冷藍科技感'],
                tags: { style: [], mood: [], elements: [], industry: [] },
                tokens: {},
                aspects: [{ sentiment: 'dislike', dimension: 'mood', note: '不要冷藍 SaaS 感' }]
            }
        ],
        retrievedFrom: ['_personal', 'whatcanido']
    });
    const child = spawn(
        process.execPath,
        [
            '-e',
            [
                "const http = require('node:http');",
                `const response = ${JSON.stringify(response)};`,
                "const server = http.createServer((req, res) => {",
                "  if (req.url && req.url.startsWith('/api/health')) {",
                "    res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({ok:true})); return;",
                "  }",
                "  if (req.url && req.url.startsWith('/api/context')) {",
                "    res.writeHead(200, {'content-type':'application/json'}); res.end(response); return;",
                "  }",
                '  res.writeHead(404); res.end();',
                '});',
                `server.listen(${port}, '127.0.0.1', () => console.log('ready'));`,
                "process.on('SIGTERM', () => server.close(() => process.exit(0)));"
            ].join('')
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    extraProcesses.push(child);

    await new Promise<void>((resolvePromise, reject) => {
        const timer = setTimeout(() => reject(new Error('fake sidecar did not start')), 5_000);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            if (String(chunk).includes('ready')) {
                clearTimeout(timer);
                resolvePromise();
            }
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error(`fake sidecar exited early with ${code}`));
        });
    });

    return { url: `http://127.0.0.1:${port}`, port };
}

function markSidecarPidHealthy(fixture: Fixture) {
    const stateDir = join(fixture.home, '.claude', 'state', 'design-lab');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'sidecar.pid'), `${process.pid}\n`);
}

function runDesign(fixture: Fixture, args: string[], env: Record<string, string>) {
    return spawnSync('bash', [DESIGN_SCRIPT, ...args], {
        cwd: resolve(SKILL_DIR, '..'),
        env: {
            ...process.env,
            HOME: fixture.home,
            DESIGN_LAB_VAULT_PATH: fixture.vault,
            ...env
        },
        encoding: 'utf8',
        timeout: 15_000
    });
}

afterEach(async () => {
    for (const child of extraProcesses) {
        if (child.pid) {
            try {
                process.kill(child.pid, 'SIGTERM');
            } catch {
                // already gone
            }
        }
    }
    extraProcesses = [];

    if (currentFixture) {
        rmSync(currentFixture.root, { recursive: true, force: true });
        currentFixture = null;
    }
});

test('design.sh renders merged sidecar context scoped to client and scenario', async () => {
    const fixture = createFixture();
    const sidecar = await startHealthyContextServer();
    markSidecarPidHealthy(fixture);

    const result = runDesign(fixture, ['做一個 landing hero', 'whatcanido', 'landing'], {
        DESIGN_LAB_SIDECAR_PORT: String(sidecar.port),
        DESIGN_LAB_SIDECAR_URL: sidecar.url
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /client=whatcanido scenario=landing/);
    assert.match(result.stdout, /=== 全域 self-brand 法則 ===/);
    assert.match(result.stdout, /Global DO from sidecar/);
    assert.match(result.stdout, /=== whatcanido 品牌法則 ===/);
    assert.match(result.stdout, /WhatCanIDo 禪意 brand guide/);
    assert.match(result.stdout, /wcid-no-pure-white-bg/);
    assert.match(result.stdout, /no-halfwidth-punct-after-cjk/);
    assert.match(result.stdout, /like: palette - 米紙與墨色比例正確/);
    assert.match(result.stdout, /dislike: mood - 不要冷藍 SaaS 感/);
    assert.match(result.stdout, /retrievedFrom: \["_personal","whatcanido"\]/);
    assert.match(result.stdout, /case_count: 1/);
});

test('design.sh falls back to no-merge memory when context fetch fails', async () => {
    const fixture = createFixture();
    const sidecar = await startHealthyContextServer();
    markSidecarPidHealthy(fixture);

    const result = runDesign(fixture, ['做一個 landing hero', 'whatcanido', 'landing'], {
        DESIGN_LAB_SIDECAR_PORT: String(sidecar.port),
        DESIGN_LAB_SIDECAR_URL: 'http://127.0.0.1:1'
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /sidecar 不可用，降級 no-merge 記憶/);
    assert.match(result.stdout, /=== personal-style-guide\.md ===/);
    assert.match(result.stdout, /=== cases\/ frontmatter summary ===/);
    assert.match(result.stdout, /zen-hero/);
    assert.match(result.stdout, /=== INSTRUCTIONS to Claude ===/);
});

test('design.sh fallback prints instructions when personal guide is missing', async () => {
    const fixture = createFixture();
    const sidecar = await startHealthyContextServer();
    markSidecarPidHealthy(fixture);
    rmSync(join(fixture.vault, 'personal-style-guide.md'), { force: true });

    const result = runDesign(fixture, ['做一個 landing hero', 'whatcanido', 'landing'], {
        DESIGN_LAB_SIDECAR_PORT: String(sidecar.port),
        DESIGN_LAB_SIDECAR_URL: 'http://127.0.0.1:1'
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /sidecar 不可用，降級 no-merge 記憶/);
    assert.match(result.stdout, /=== personal-style-guide\.md ===/);
    assert.match(result.stdout, /\(no personal-style-guide\.md/);
    assert.match(result.stdout, /=== INSTRUCTIONS to Claude ===/);
});
