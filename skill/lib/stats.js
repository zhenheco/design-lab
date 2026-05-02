import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

export function computeStats(vault) {
    const totals = { positive: 0, negative: 0 };
    const byScenario = {};

    for (const sub of ['cases', 'anti-library']) {
        const dir = join(vault, sub);
        if (!existsSync(dir)) continue;
        const files = readdirSync(dir).filter(f => f.endsWith('.md'));
        for (const f of files) {
            const fm = matter(readFileSync(join(dir, f), 'utf8')).data;
            if (fm.sentiment === 'positive') totals.positive++;
            else if (fm.sentiment === 'negative') totals.negative++;
            const sc = fm.scenario || 'unknown';
            byScenario[sc] = (byScenario[sc] || 0) + 1;
        }
    }
    return { totals, byScenario };
}
