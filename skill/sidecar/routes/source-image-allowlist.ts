import { homedir, tmpdir } from 'node:os';
import { resolve as resolvePath, sep } from 'node:path';

function getSourceAllowlist(): string[] {
    const home = process.env.HOME ?? homedir();
    const configured =
        process.env.DESIGN_LAB_SOURCE_ALLOWLIST
        ?? `${tmpdir()}:${home}/Pictures/Screenshots:${home}/Downloads`;

    return configured
        .split(':')
        .map((prefix) => prefix.trim())
        .filter((prefix) => prefix.length > 0)
        .map((prefix) => resolvePath(prefix));
}

function pathHasTraversal(path: string): boolean {
    return path.split(/[\\/]+/).includes('..');
}

export function isAllowedSourceImagePath(path: string): boolean {
    if (pathHasTraversal(path)) {
        return false;
    }

    const resolved = resolvePath(path);
    return getSourceAllowlist().some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}${sep}`));
}
