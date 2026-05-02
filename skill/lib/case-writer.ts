import matter from 'gray-matter';
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
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

    const targetDir = input.sentiment === 'positive' ? join(clientDir, 'cases') : join(clientDir, 'anti-library');
    mkdirSync(targetDir, { recursive: true });

    const assetsDir = join(targetDir, input.slug);
    assertSafePath(assetsDir);
    mkdirSync(assetsDir, { recursive: true });

    const snapshotName = `snapshot${extname(input.sourceImagePath)}`;
    const snapshotPath = join(assetsDir, snapshotName);
    if (existsSync(input.sourceImagePath)) {
        copyFileSync(input.sourceImagePath, snapshotPath);
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

    const body = `\n## 為什麼${input.sentiment === 'positive' ? '喜歡' : '不喜歡'}\n\n${input.quote}\n\n## 截圖\n\n![[${input.slug}/${snapshotName}]]\n\n## 解構觀察\n\n（事後在 Obsidian 補）\n`;

    writeFileSync(casePath, matter.stringify(body, frontmatter));

    return { casePath, assetsDir };
}
