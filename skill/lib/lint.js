import matter from 'gray-matter';

/**
 * 對 css 字串跑 NEVER lint 規則。
 * @param {string} css - CSS source
 * @param {Array} rules - NEVER rules with regex detectors
 * @param {object} opts - { autoFix: bool, lintSkip: string[] }
 * @returns {{ violations: Array, fixedCss: string, fixes: Array }}
 */
export function lintCss(css, rules, opts = {}) {
    const { autoFix = false, lintSkip = [] } = opts;
    const violations = [];
    const fixes = [];
    let fixedCss = css;

    for (const rule of rules) {
        if (lintSkip.includes(rule.id)) continue;
        if (rule.detector.type !== 'regex') continue;
        if (rule.detector.target !== 'css') continue;

        const re = new RegExp(rule.detector.pattern, 'g');
        const matches = [...fixedCss.matchAll(re)];

        if (matches.length === 0) continue;

        for (const m of matches) {
            violations.push({
                ruleId: rule.id,
                rule: rule.rule,
                match: m[0],
                index: m.index
            });
        }

        if (autoFix && rule.autoFix) {
            const before = fixedCss;
            fixedCss = fixedCss.replace(rule.autoFix.replace, rule.autoFix.with);
            if (before !== fixedCss) {
                fixes.push({
                    ruleId: rule.id,
                    note: `replaced ${rule.autoFix.replace} with ${rule.autoFix.with}`
                });
            }
        }
    }

    return { violations, fixedCss, fixes };
}

/**
 * 從 personal-style-guide.md 抽出 NEVER 規則陣列。
 * NEVER section 用簡化 YAML-ish 格式（不是嚴格 YAML）：
 *   - id: <id>
 *     rule: "..."
 *     detector:
 *       type: regex
 *       pattern: '...'
 *       target: css
 */
export function parseRulesFromGuide(markdown) {
    const { content } = matter(markdown);
    const rules = [];

    // 找 ## NEVER section
    const neverMatch = content.match(/##\s+NEVER[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/);
    if (!neverMatch) return rules;

    const neverBlock = neverMatch[1];
    // split by "- id:"
    const ruleBlocks = neverBlock.split(/\n(?=- id:)/);
    for (const block of ruleBlocks) {
        if (!block.trim().startsWith('- id:')) continue;
        const idMatch = block.match(/- id:\s*([^\n]+)/);
        const ruleMatch = block.match(/rule:\s*"([^"]+)"/);
        const patternMatch = block.match(/pattern:\s*'([^']+)'/);
        const targetMatch = block.match(/target:\s*(\w+)/);
        if (idMatch && patternMatch) {
            rules.push({
                id: idMatch[1].trim(),
                rule: ruleMatch ? ruleMatch[1] : '',
                detector: {
                    type: 'regex',
                    pattern: patternMatch[1],
                    target: targetMatch ? targetMatch[1] : 'css'
                }
            });
        }
    }
    return rules;
}
