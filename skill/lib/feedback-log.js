import { appendFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_NAME = 'feedback-log.jsonl';

/**
 * 寫 1 行 JSONL 到 vault/feedback-log.jsonl
 * @param {string} vault
 * @param {object} entry - { signal, user_quote, case_slug?, dimension?, derived_rule? }
 */
export function appendFeedback(vault, entry) {
    const logPath = join(vault, LOG_NAME);
    const record = {
        occurred_at: new Date().toISOString(),
        ...entry
    };
    appendFileSync(logPath, JSON.stringify(record) + '\n');
}

export function readFeedback(vault) {
    const logPath = join(vault, LOG_NAME);
    if (!existsSync(logPath)) return [];
    const text = readFileSync(logPath, 'utf8');
    return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
}
