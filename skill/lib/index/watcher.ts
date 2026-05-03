import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
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
        followSymlinks: false,
        awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 50
        }
    });

    watcher.on('add', (path) => {
        const absPath = join(resolvedVault, path);
        if (shouldSkipSymlinkPath(absPath)) {
            return;
        }
        if (!classifyPath(absPath, resolvedVault)) {
            return;
        }

        reindexPath(absPath, resolvedVault);
    });

    watcher.on('change', (path) => {
        const absPath = join(resolvedVault, path);
        if (shouldSkipSymlinkPath(absPath)) {
            return;
        }
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

    if (shouldSkipSymlinkPath(directoryPath)) {
        return;
    }

    let entries: string[];
    try {
        entries = readdirSync(directoryPath);
    } catch (error: unknown) {
        console.warn(`[watcher] skip ${directoryPath}: cannot list directory (${String(error)})`);
        return;
    }

    for (const entry of entries) {
        if (entry === '.archived' || entry === '.index') {
            continue;
        }

        const entryPath = join(directoryPath, entry);
        let stats: ReturnType<typeof lstatSync>;
        try {
            stats = lstatSync(entryPath);
        } catch (error: unknown) {
            console.warn(`[watcher] skip ${entryPath}: cannot stat path (${String(error)})`);
            continue;
        }

        if (stats.isSymbolicLink()) {
            console.warn(`[watcher] skip ${entryPath}: symlink (vault must be self-contained)`);
            continue;
        }

        if (stats.isDirectory()) {
            scanAddedDirectory(watcher, entryPath, vault);
            continue;
        }

        if (!stats.isFile() || !classifyPath(entryPath, vault)) {
            continue;
        }

        watcher.add(entryPath);
        reindexPath(entryPath, vault);
    }
}

function shouldSkipSymlinkPath(absPath: string): boolean {
    let stats: ReturnType<typeof lstatSync>;
    try {
        stats = lstatSync(absPath);
    } catch (error: unknown) {
        console.warn(`[watcher] skip ${absPath}: cannot stat path (${String(error)})`);
        return true;
    }

    if (!stats.isSymbolicLink()) {
        return false;
    }

    console.warn(`[watcher] skip ${absPath}: symlink (vault must be self-contained)`);
    return true;
}
