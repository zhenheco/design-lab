import matter from 'gray-matter';
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

/**
 * 寫 case markdown + 資產目錄。
 * @param {string} vault - vault path（design-library 根）
 * @param {object} c - case data
 * @returns {{ casePath: string, assetsDir: string }}
 */
export function writeCase(vault, c) {
    const { slug, sentiment, scenario, quote, sourceImagePath, tokens } = c;
    if (!slug || !sentiment || !scenario) throw new Error('missing required fields');

    const subdir = sentiment === 'positive' ? 'cases' : 'anti-library';
    const targetDir = join(vault, subdir);
    mkdirSync(targetDir, { recursive: true });

    const casePath = join(targetDir, `${slug}.md`);
    if (existsSync(casePath)) {
        throw new Error(`case already exists: ${casePath}`);
    }

    const assetsDir = join(targetDir, slug);
    mkdirSync(assetsDir, { recursive: true });

    // copy snapshot
    const snapshotName = 'snapshot' + extname(sourceImagePath);
    const snapshotTarget = join(assetsDir, snapshotName);
    if (existsSync(sourceImagePath)) {
        copyFileSync(sourceImagePath, snapshotTarget);
    }

    const frontmatter = {
        schema_version: 1,
        slug,
        captured_at: new Date().toISOString(),
        source: { type: 'upload', via: '/design-collect' },
        scenario,
        sentiment,
        quotes_from_user: [quote],
        tokens: tokens || {},
        tags: { style: [], mood: [], elements: [], industry: [] },
        related: [],
        lint_skip: []
    };

    const body = `\n## 為什麼${sentiment === 'positive' ? '喜歡' : '不喜歡'}\n\n${quote}\n\n## 截圖\n\n![[${slug}/${snapshotName}]]\n\n## 解構觀察\n\n（事後在 Obsidian 補）\n`;

    writeFileSync(casePath, matter.stringify(body, frontmatter));
    return { casePath, assetsDir };
}
