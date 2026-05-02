import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

/**
 * 讀 vault cases/ 下所有 markdown，回傳 frontmatter 摘要陣列。
 * @param {string} vault
 * @param {object} opts - { scenario?: string }
 * @returns {Array<{ slug, scenario, sentiment, quotes_from_user, tags, tokens, mdPath }>}
 */
export function loadCaseSummaries(vault, opts = {}) {
    const casesDir = join(vault, 'cases');
    if (!existsSync(casesDir)) return [];

    const files = readdirSync(casesDir).filter(f => f.endsWith('.md'));
    const out = [];
    for (const f of files) {
        const mdPath = join(casesDir, f);
        const raw = readFileSync(mdPath, 'utf8');
        const fm = matter(raw).data;
        if (opts.scenario && fm.scenario !== opts.scenario) continue;
        out.push({
            slug: fm.slug,
            scenario: fm.scenario,
            sentiment: fm.sentiment,
            quotes_from_user: fm.quotes_from_user || [],
            tags: fm.tags || {},
            tokens: fm.tokens || {},
            mdPath
        });
    }
    return out;
}
