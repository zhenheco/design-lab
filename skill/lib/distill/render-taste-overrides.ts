import type { FeedbackEntry } from '../feedback-log.js';
import { verdictFromSignal, type FeedbackVerdict } from './verdict.ts';

interface TasteStats {
    processed: number;
    like: number;
    dislike: number;
    distilled: number;
}

export interface RenderTasteOverridesResult {
    markdown: string;
    stats: TasteStats;
}

function classify(entry: FeedbackEntry): FeedbackVerdict | null {
    if (entry.verdict === 'like' || entry.verdict === 'dislike') {
        return entry.verdict;
    }
    return verdictFromSignal(entry.signal);
}

function appendUnique(lines: string[], seen: Set<string>, line: string): void {
    if (seen.has(line)) {
        return;
    }
    seen.add(line);
    lines.push(line);
}

export function renderTasteOverrides(feedback: FeedbackEntry[]): RenderTasteOverridesResult {
    const neverLines: string[] = [];
    const styleLines: string[] = [];
    const seenNever = new Set<string>();
    const seenStyle = new Set<string>();
    let like = 0;
    let dislike = 0;

    for (const entry of feedback) {
        const dimension = typeof entry.dimension === 'string' ? entry.dimension.trim() : '';
        const ruleSource = typeof entry.derived_rule === 'string' && entry.derived_rule.trim()
            ? entry.derived_rule
            : entry.user_quote;
        const rule = typeof ruleSource === 'string' ? ruleSource.trim() : '';
        const verdict = classify(entry);

        if (!dimension || !rule || !verdict) {
            continue;
        }

        const line = `- ${dimension}: ${rule}`;
        if (verdict === 'dislike') {
            dislike += 1;
            appendUnique(neverLines, seenNever, line);
        } else {
            like += 1;
            appendUnique(styleLines, seenStyle, line);
        }
    }

    const distilled = neverLines.length + styleLines.length;
    const markdown = `# taste-skill Overrides

Generated from feedback-log.jsonl.
processed_records: ${feedback.length}
like_records: ${like}
dislike_records: ${dislike}
distilled_rules: ${distilled}
Note: machine layer only; human-approved style-guide edits go through MCP edit_style_guide.

## NEVER candidates (from dislikes)
${neverLines.join('\n')}

## Style notes (from likes)
${styleLines.join('\n')}
`;

    return {
        markdown,
        stats: {
            processed: feedback.length,
            like,
            dislike,
            distilled
        }
    };
}
