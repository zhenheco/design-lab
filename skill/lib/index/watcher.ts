import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getVaultPath } from '../paths.ts';
import { classifyPath, reindexPath, removePath } from './reindex.ts';

const WATCH_ROOTS = [
    'clients',
    'personal-style-guide.md',
    'scenario-overrides'
];

let watcherInstance: FSWatcher | null = null;

export function startWatcher(vault?: string): FSWatcher {
    const resolvedVault = vault ?? getVaultPath();

    if (watcherInstance) {
        return watcherInstance;
    }

    const watcher = chokidar.watch(WATCH_ROOTS, {
        cwd: resolvedVault,
        ignored: ['**/.archived/**', '**/.index/**'],
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 50
        }
    });

    watcher.on('add', (path) => {
        const absPath = join(resolvedVault, path);
        if (!classifyPath(absPath, resolvedVault)) {
            return;
        }

        reindexPath(absPath, resolvedVault);
    });

    watcher.on('change', (path) => {
        const absPath = join(resolvedVault, path);
        if (!classifyPath(absPath, resolvedVault)) {
            return;
        }

        reindexPath(absPath, resolvedVault);
    });

    watcher.on('unlink', (path) => {
        const absPath = join(resolvedVault, path);
        if (!classifyPath(absPath, resolvedVault)) {
            return;
        }

        removePath(absPath, resolvedVault);
    });

    watcher.on('addDir', (path) => {
        scanAddedDirectory(watcher, join(resolvedVault, path), resolvedVault);
    });

    watcher.on('error', (error) => {
        console.warn(`[watcher] error: ${error}`);
    });

    watcherInstance = watcher;
    return watcher;
}

export async function stopWatcher(): Promise<void> {
    if (!watcherInstance) {
        return;
    }

    await watcherInstance.close();
    watcherInstance = null;
}

function scanAddedDirectory(watcher: FSWatcher, directoryPath: string, vault: string): void {
    if (!existsSync(directoryPath)) {
        return;
    }

    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
        if (entry.name === '.archived' || entry.name === '.index') {
            continue;
        }

        const entryPath = join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            scanAddedDirectory(watcher, entryPath, vault);
            continue;
        }

        if (!entry.isFile() || !classifyPath(entryPath, vault)) {
            continue;
        }

        watcher.add(entryPath);
        reindexPath(entryPath, vault);
    }
}
