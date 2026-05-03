import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    symlinkSync,
    unlinkSync,
    writeFileSync
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { mock, test } from 'node:test';
import type { FSWatcher } from 'chokidar';
import { closeDb, getDb } from '../../lib/index/db.ts';
import { startWatcher, stopWatcher } from '../../lib/index/watcher.ts';

function setupVault(): string {
    const vault = mkdtempSync(join(tmpdir(), 'dl-watcher-ts-'));
    mkdirSync(join(vault, 'clients'));
    mkdirSync(join(vault, 'scenario-overrides'));
    writeFileSync(join(vault, 'personal-style-guide.md'), '# Personal Style Guide\n');
    return vault;
}

async function withVaultEnv<T>(vault: string, fn: () => Promise<T>): Promise<T> {
    const previous = process.env.DESIGN_LAB_VAULT_PATH;
    process.env.DESIGN_LAB_VAULT_PATH = vault;

    try {
        await stopWatcher();
        closeDb();
        return await fn();
    } finally {
        await stopWatcher();
        closeDb();
        if (previous === undefined) {
            delete process.env.DESIGN_LAB_VAULT_PATH;
        } else {
            process.env.DESIGN_LAB_VAULT_PATH = previous;
        }
    }
}

async function waitFor(predicate: () => boolean, timeout = 2000): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeout) {
        if (predicate()) {
            return;
        }

        await delay(25);
    }

    throw new Error(`Timed out after ${timeout}ms`);
}

async function waitForReady(watcher: FSWatcher): Promise<void> {
    await new Promise<void>((resolve) => {
        watcher.once('ready', resolve);
    });
    await delay(50);
}

function ensureDir(path: string): void {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}

function writeClientMeta(
    vault: string,
    client: string,
    options?: {
        name?: string;
        type?: 'self' | 'client';
        themeColor?: string;
    }
): string {
    const dir = join(vault, 'clients', client);
    ensureDir(dir);
    const path = join(dir, 'meta.yaml');
    writeFileSync(
        path,
        [
            'schema_version: 2',
            `slug: ${client}`,
            `name: ${JSON.stringify(options?.name ?? `${client} studio`)}`,
            `type: ${options?.type ?? 'client'}`,
            'created_at: "2026-05-03"',
            'notes: ""',
            `theme_color: ${JSON.stringify(options?.themeColor ?? '#112233')}`,
            ''
        ].join('\n')
    );
    return path;
}

function writeCaseFile(
    vault: string,
    client: string,
    slug: string,
    sentiment: 'positive' | 'negative',
    scenario = 'landing-page',
    body = 'Body copy.\n'
): string {
    writeClientMeta(vault, client);

    const directory = sentiment === 'negative' ? 'anti-library' : 'cases';
    const dir = join(vault, 'clients', client, directory);
    ensureDir(dir);

    const path = join(dir, `${slug}.md`);
    writeFileSync(
        path,
        [
            '---',
            'schema_version: 2',
            `client: ${client}`,
            `slug: ${slug}`,
            `scenario: ${scenario}`,
            `quotes_from_user: ["clear hierarchy"]`,
            'tags:',
            '  style: ["modern"]',
            '  mood: ["calm"]',
            '  elements: ["grid"]',
            '  industry: ["saas"]',
            'tokens:',
            '  emphasis: 1',
            '---',
            '',
            `# ${slug}`,
            body.trimEnd(),
            ''
        ].join('\n')
    );

    return path;
}

function writeScenarioOverride(vault: string, scenario: string, content: string): string {
    const path = join(vault, 'scenario-overrides', `${scenario}.md`);
    writeFileSync(path, content);
    return path;
}

function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function getCaseRow(path: string): { content_hash: string } | undefined {
    return getDb()
        .prepare<[string], { content_hash: string }>('SELECT content_hash FROM cases WHERE md_path = ?')
        .get(path);
}

function getClientRow(slug: string): { name: string; type: string; content_hash: string } | undefined {
    return getDb()
        .prepare<[string], { name: string; type: string; content_hash: string }>(
            'SELECT name, type, content_hash FROM clients WHERE slug = ?'
        )
        .get(slug);
}

function getDocumentRow(
    path: string
): { kind: string; scenario: string | null; content_hash: string } | undefined {
    return getDb()
        .prepare<[string], { kind: string; scenario: string | null; content_hash: string }>(
            'SELECT kind, scenario, content_hash FROM documents WHERE path = ?'
        )
        .get(path);
}

function getTotalIndexedRows(): number {
    const db = getDb();
    const casesCount = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM cases').get()?.count ?? 0;
    const clientsCount = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM clients').get()?.count ?? 0;
    const documentsCount =
        db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM documents').get()?.count ?? 0;

    return casesCount + clientsCount + documentsCount;
}

test('watcher: add case reindexes cases row', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const casePath = writeCaseFile(vault, 'acme', 'hero-win', 'positive');

        await waitFor(() => Boolean(getCaseRow(casePath)), 3000);

        assert.ok(getCaseRow(casePath));
    });
});

test('watcher: change case updates content_hash', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();
    const casePath = writeCaseFile(vault, 'acme', 'hero-win', 'positive', 'landing-page', 'Version 1.\n');

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        writeFileSync(
            casePath,
            [
                '---',
                'schema_version: 2',
                'client: acme',
                'slug: hero-win',
                'scenario: landing-page',
                'quotes_from_user: ["clear hierarchy"]',
                'tags:',
                '  style: ["modern"]',
                '  mood: ["calm"]',
                '  elements: ["grid"]',
                '  industry: ["saas"]',
                'tokens:',
                '  emphasis: 1',
                '---',
                '',
                '# hero-win',
                'Version 2.',
                ''
            ].join('\n')
        );

        const expectedHash = sha256(
            [
                '---',
                'schema_version: 2',
                'client: acme',
                'slug: hero-win',
                'scenario: landing-page',
                'quotes_from_user: ["clear hierarchy"]',
                'tags:',
                '  style: ["modern"]',
                '  mood: ["calm"]',
                '  elements: ["grid"]',
                '  industry: ["saas"]',
                'tokens:',
                '  emphasis: 1',
                '---',
                '',
                '# hero-win',
                'Version 2.',
                ''
            ].join('\n')
        );

        await waitFor(() => getCaseRow(casePath)?.content_hash === expectedHash, 3000);

        assert.equal(getCaseRow(casePath)?.content_hash, expectedHash);
    });
});

test('watcher: unlink case removes cases row', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const casePath = writeCaseFile(vault, 'acme', 'hero-win', 'positive');
        await waitFor(() => Boolean(getCaseRow(casePath)), 3000);

        unlinkSync(casePath);
        await waitFor(() => !getCaseRow(casePath), 3000);

        assert.equal(getCaseRow(casePath), undefined);
    });
});

test('watcher: add client meta indexes clients row', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const metaPath = writeClientMeta(vault, 'acme');

        await waitFor(() => Boolean(getClientRow('acme')), 3000);

        assert.equal(existsSync(metaPath), true);
        assert.equal(getClientRow('acme')?.name, 'acme studio');
        assert.equal(getClientRow('acme')?.type, 'client');
        assert.equal(typeof getClientRow('acme')?.content_hash, 'string');
    });
});

test('watcher: change client meta updates row', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();
    const metaPath = writeClientMeta(vault, 'acme', { name: 'Acme One' });

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        writeClientMeta(vault, 'acme', { name: 'Acme Two', themeColor: '#445566' });
        const expectedHash = sha256(
            [
                'schema_version: 2',
                'slug: acme',
                'name: "Acme Two"',
                'type: client',
                'created_at: "2026-05-03"',
                'notes: ""',
                'theme_color: "#445566"',
                ''
            ].join('\n')
        );

        await waitFor(() => getClientRow('acme')?.content_hash === expectedHash, 3000);

        assert.equal(getClientRow('acme')?.name, 'Acme Two');
        assert.equal(getClientRow('acme')?.content_hash, expectedHash);
        assert.equal(existsSync(metaPath), true);
    });
});

test('watcher: unlink client meta removes clients row', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const metaPath = writeClientMeta(vault, 'acme');
        await waitFor(() => Boolean(getClientRow('acme')), 3000);

        unlinkSync(metaPath);
        await waitFor(() => !getClientRow('acme'), 3000);

        assert.equal(getClientRow('acme'), undefined);
    });
});

test('watcher: style-guide change updates documents row', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();
    const styleGuidePath = join(vault, 'personal-style-guide.md');
    const updatedContent = '# Personal Style Guide\n\nUse harder contrast.\n';

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        writeFileSync(styleGuidePath, updatedContent);
        const expectedHash = sha256(updatedContent);

        await waitFor(() => getDocumentRow(styleGuidePath)?.content_hash === expectedHash, 3000);

        assert.deepEqual(getDocumentRow(styleGuidePath), {
            kind: 'style-guide',
            scenario: null,
            content_hash: expectedHash
        });
    });
});

test('watcher: add scenario override indexes documents row', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const path = writeScenarioOverride(vault, 'hero-banner', '# Override\n');
        const expectedHash = sha256('# Override\n');

        await waitFor(() => getDocumentRow(path)?.content_hash === expectedHash, 3000);

        assert.deepEqual(getDocumentRow(path), {
            kind: 'scenario-override',
            scenario: 'hero-banner',
            content_hash: expectedHash
        });
    });
});

test('watcher: archived paths are ignored', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();
    const archivedPath = join(vault, 'clients', 'acme', '.archived', 'cases', 'ghost.md');

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        ensureDir(join(vault, 'clients', 'acme', '.archived', 'cases'));
        writeFileSync(archivedPath, '# Archived\n');

        await delay(500);

        assert.equal(getTotalIndexedRows(), 0);
    });
});

test('watcher: index files are ignored', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();
    const ignoredDbPath = join(vault, '.index', 'ignored.db');

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        ensureDir(join(vault, '.index'));
        writeFileSync(ignoredDbPath, 'not a real sqlite db');

        await delay(500);

        assert.equal(getTotalIndexedRows(), 0);
    });
});

test('watcher: burst writes settle on final content once stable', { concurrency: false, timeout: 12000 }, async () => {
    const vault = setupVault();
    const casePath = writeCaseFile(vault, 'acme', 'hero-burst', 'positive', 'landing-page', 'Initial.\n');

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        let changeEvents = 0;
        watcher.on('all', (eventName, changedPath) => {
            if (eventName === 'change' && changedPath === 'clients/acme/cases/hero-burst.md') {
                changeEvents += 1;
            }
        });

        const versions = ['Burst 1.', 'Burst 2.', 'Burst 3.', 'Burst 4.', 'Burst 5.'];
        for (const version of versions) {
            writeCaseFile(vault, 'acme', 'hero-burst', 'positive', 'landing-page', `${version}\n`);
            await delay(100);
        }

        const finalContent = [
            '---',
            'schema_version: 2',
            'client: acme',
            'slug: hero-burst',
            'scenario: landing-page',
            'quotes_from_user: ["clear hierarchy"]',
            'tags:',
            '  style: ["modern"]',
            '  mood: ["calm"]',
            '  elements: ["grid"]',
            '  industry: ["saas"]',
            'tokens:',
            '  emphasis: 1',
            '---',
            '',
            '# hero-burst',
            'Burst 5.',
            ''
        ].join('\n');
        const expectedHash = sha256(finalContent);

        await waitFor(() => getCaseRow(casePath)?.content_hash === expectedHash, 4000);

        assert.equal(getCaseRow(casePath)?.content_hash, expectedHash);
        assert.equal(changeEvents, 1);
    });
});

test('watcher: stopWatcher prevents later events', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);
        await stopWatcher();

        const casePath = writeCaseFile(vault, 'acme', 'after-stop', 'positive');
        await delay(500);

        assert.equal(getCaseRow(casePath), undefined);
    });
});

test('watcher: symlink file added is skipped', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const outsideRoot = mkdtempSync(join(tmpdir(), 'dl-watcher-outside-file-'));
        const outsideCasePath = join(outsideRoot, 'hero-symlink.md');
        writeFileSync(
            outsideCasePath,
            [
                '---',
                'schema_version: 2',
                'client: acme',
                'slug: hero-symlink',
                'scenario: landing-page',
                'quotes_from_user: ["clear hierarchy"]',
                'tags:',
                '  style: ["modern"]',
                '  mood: ["calm"]',
                '  elements: ["grid"]',
                '  industry: ["saas"]',
                'tokens:',
                '  emphasis: 1',
                '---',
                '',
                '# hero-symlink',
                'Outside content.',
                ''
            ].join('\n')
        );

        const linkedCasePath = join(vault, 'clients', 'acme', 'cases', 'hero-symlink.md');
        ensureDir(join(vault, 'clients', 'acme', 'cases'));
        symlinkSync(outsideCasePath, linkedCasePath);

        const warn = mock.method(console, 'warn', () => {});
        try {
            watcher.emit('add', 'clients/acme/cases/hero-symlink.md');

            assert.equal(getCaseRow(linkedCasePath), undefined);
            assert.equal(getTotalIndexedRows(), 0);
            assert.ok(warn.mock.calls.some((call) => String(call.arguments[0]).includes('symlink')));
        } finally {
            warn.mock.restore();
        }
    });
});

test('watcher: symlink dir is not traversed', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();
    writeClientMeta(vault, 'acme');

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const outsideRoot = mkdtempSync(join(tmpdir(), 'dl-watcher-outside-dir-'));
        const outsideCasesDir = join(outsideRoot, 'cases');
        mkdirSync(outsideCasesDir);
        const outsideCasePath = join(outsideCasesDir, 'hero-linked.md');
        writeFileSync(
            outsideCasePath,
            [
                '---',
                'schema_version: 2',
                'client: acme',
                'slug: hero-linked',
                'scenario: landing-page',
                'quotes_from_user: ["clear hierarchy"]',
                'tags:',
                '  style: ["modern"]',
                '  mood: ["calm"]',
                '  elements: ["grid"]',
                '  industry: ["saas"]',
                'tokens:',
                '  emphasis: 1',
                '---',
                '',
                '# hero-linked',
                'Outside directory content.',
                ''
            ].join('\n')
        );

        ensureDir(join(vault, 'clients', 'acme'));
        const linkedCasesDir = join(vault, 'clients', 'acme', 'cases');
        symlinkSync(outsideCasesDir, linkedCasesDir);

        const warn = mock.method(console, 'warn', () => {});
        try {
            watcher.emit('addDir', 'clients/acme/cases');

            assert.equal((watcher as FSWatcher & { options?: { followSymlinks?: boolean } }).options?.followSymlinks, false);
            assert.equal(getCaseRow(join(linkedCasesDir, 'hero-linked.md')), undefined);
            assert.equal(getTotalIndexedRows(), 0);
            assert.ok(warn.mock.calls.some((call) => String(call.arguments[0]).includes('symlink')));
        } finally {
            warn.mock.restore();
        }
    });
});

test('watcher: scanAddedDirectory survives readdir error', { concurrency: false, timeout: 10000 }, async () => {
    const vault = setupVault();

    await withVaultEnv(vault, async () => {
        const watcher = startWatcher(vault);
        await waitForReady(watcher);

        const targetDir = join(vault, 'clients', 'acme', 'cases');
        ensureDir(targetDir);

        const originalExistsSync = fs.existsSync;
        const originalReaddirSync = fs.readdirSync;
        const existsMock = mock.method(
            fs,
            'existsSync',
            (path: fs.PathLike) => path === targetDir || originalExistsSync(path)
        );
        const readdirMock = mock.method(fs, 'readdirSync', ((path: fs.PathLike) => {
            if (path === targetDir) {
                const error = new Error(`ENOENT: no such file or directory, scandir '${targetDir}'`) as NodeJS.ErrnoException;
                error.code = 'ENOENT';
                throw error;
            }

            return originalReaddirSync(path);
        }) as typeof fs.readdirSync);
        syncBuiltinESMExports();

        try {
            assert.doesNotThrow(() => watcher.emit('addDir', 'clients/acme/cases'));
        } finally {
            existsMock.mock.restore();
            readdirMock.mock.restore();
            syncBuiltinESMExports();
        }
    });
});
