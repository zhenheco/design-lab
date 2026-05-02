import matter from 'gray-matter';
import { writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import {
    getClientDir,
    getCasePath,
    getAntiCasePath,
    isValidSlug,
    assertSafePath
} from './paths.ts';

export interface WriteCaseInput {
    client: string;
    slug: string;
    sentiment: 'positive' | 'negative';
    scenario: 'landing' | 'saas-ui' | 'brand' | 'content';
    quote: string;
    sourceImagePath: string;
    tokens?: Record<string, unknown>;
}

export interface WriteCaseResult {
    casePath: string;
    assetsDir: string;
}

export function writeCase(input: WriteCaseInput): WriteCaseResult {
    if (!isValidSlug(input.client)) {
        throw new Error(`invalid client slug: ${input.client}`);
    }
    if (!isValidSlug(input.slug)) {
        throw new Error(`invalid slug: ${input.slug}`);
    }

    const clientDir = getClientDir(input.client);
    if (!existsSync(clientDir)) {
        throw new Error(`client not registered: ${input.client}`);
    }

    const positivePath = getCasePath(input.client, input.slug);
    const negativePath = getAntiCasePath(input.client, input.slug);
    const casePath = input.sentiment === 'positive' ? positivePath : negativePath;
    const conflictingPath = existsSync(positivePath)
        ? positivePath
        : existsSync(negativePath)
          ? negativePath
          : null;

    if (conflictingPath) {
        throw new Error(`case already exists: ${conflictingPath}`);
    }

    assertSafePath(casePath);
    const resolvedClientDir = resolve(clientDir);
    const resolvedCasePath = resolve(casePath);
    const clientDirPrefix = `${resolvedClientDir}${sep}`;
    if (resolvedCasePath !== resolvedClientDir && !resolvedCasePath.startsWith(clientDirPrefix)) {
        throw new Error(`case path escaped client dir: ${casePath}`);
    }

    const targetDir = input.sentiment === 'positive' ? join(clientDir, 'cases') : join(clientDir, 'anti-library');
    mkdirSync(targetDir, { recursive: true });

    const assetsDir = join(targetDir, input.slug);
    assertSafePath(assetsDir);
    mkdirSync(assetsDir, { recursive: true });

    const snapshotName = `snapshot${extname(input.sourceImagePath)}`;
    const snapshotPath = join(assetsDir, snapshotName);
    let snapshotMarkdown = '';
    let canSnapshot = false;
    try {
        canSnapshot = existsSync(input.sourceImagePath) && statSync(input.sourceImagePath).isFile();
    } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
            throw err;
        }
    }

    if (canSnapshot) {
        copyFileSync(input.sourceImagePath, snapshotPath);
        snapshotMarkdown = `## 截圖\n\n![[${input.slug}/${snapshotName}]]\n\n`;
    }

    const frontmatter = {
        schema_version: 2,
        client: input.client,
        slug: input.slug,
        captured_at: new Date().toISOString(),
        source: { type: 'upload', via: '/design-collect' },
        scenario: input.scenario,
        sentiment: input.sentiment,
        quotes_from_user: [input.quote],
        tokens: input.tokens ?? {},
        tags: { style: [], mood: [], elements: [], industry: [] },
        related: [],
        lint_skip: []
    };

    const body = `\n## 為什麼${input.sentiment === 'positive' ? '喜歡' : '不喜歡'}\n\n${input.quote}\n\n${snapshotMarkdown}## 解構觀察\n\n（事後在 Obsidian 補）\n`;

    try {
        writeFileSync(casePath, matter.stringify(body, frontmatter), { flag: 'wx' });
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
            throw new Error(`case already exists: ${casePath}`);
        }
        throw err;
    }

    return { casePath, assetsDir };
}
