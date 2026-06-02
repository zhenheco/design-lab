import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { Router, type Request } from 'express';
import { loadCaseSummaries, type CaseSummary } from '../../lib/case-loader.ts';
import { loadClient, type ClientMeta } from '../../lib/client-loader.ts';
import { parseRulesFromGuide, type NeverRule } from '../../lib/lint.js';
import { getClientStyleGuidePath, getScenarioOverridePath, getStyleGuidePath, getVaultPath } from '../../lib/paths.ts';

const TOP_N_POSITIVE = 5;
export const MAX_CONTEXT_FILE_BYTES = 256 * 1024;

const CONTEXT_TRUNCATION_MARKER = '\n\n<!-- truncated: exceeds 256KB cap -->';

type ContextQuery = {
    client?: string;
    scenario?: string;
};

export interface ContextResponse {
    client: ClientMeta | null;
    styleGuide: string;
    brandStyleGuide: string;
    scenarioOverride: string;
    cases: CaseSummary[];
    antiCases: CaseSummary[];
    neverRules: NeverRule[];
    retrievedFrom: string[];
}

function readOptionalFile(path: string): string {
    let size: number;
    try {
        size = statSync(path).size;
    } catch {
        return '';
    }

    if (size <= MAX_CONTEXT_FILE_BYTES) {
        return readFileSync(path, 'utf8');
    }

    const buffer = Buffer.alloc(MAX_CONTEXT_FILE_BYTES);
    const fd = openSync(path, 'r');
    try {
        const bytesRead = readSync(fd, buffer, 0, MAX_CONTEXT_FILE_BYTES, 0);
        return `${buffer.subarray(0, bytesRead).toString('utf8')}${CONTEXT_TRUNCATION_MARKER}`;
    } finally {
        closeSync(fd);
    }
}

export function contextRouter(): Router {
    const router = Router();

    router.get('/', (req: Request<Record<string, string>, ContextResponse, unknown, ContextQuery>, res) => {
        const clientSlug = typeof req.query.client === 'string' ? req.query.client : undefined;
        const scenario = typeof req.query.scenario === 'string' ? req.query.scenario : undefined;
        const styleGuide = readOptionalFile(getStyleGuidePath());
        const scenarioOverride = scenario ? readOptionalFile(getScenarioOverridePath(scenario)) : '';
        const client = clientSlug ? loadClient(clientSlug) : null;
        const brandStyleGuide =
            clientSlug && client?.type === 'client' ? readOptionalFile(getClientStyleGuidePath(clientSlug)) : '';
        const allCases = loadCaseSummaries(getVaultPath(), { client: clientSlug, scenario });
        const cases = allCases.filter((entry) => entry.sentiment === 'positive').slice(0, TOP_N_POSITIVE);
        const antiCases = allCases.filter((entry) => entry.sentiment === 'negative');
        const neverRulesById = new Map<string, NeverRule>();
        for (const rule of parseRulesFromGuide(styleGuide)) {
            neverRulesById.set(rule.id, rule);
        }
        for (const rule of parseRulesFromGuide(brandStyleGuide)) {
            if (!neverRulesById.has(rule.id)) {
                neverRulesById.set(rule.id, rule);
            }
        }
        const neverRules = Array.from(neverRulesById.values());
        const retrievedFrom = Array.from(new Set(allCases.map((entry) => entry.client))).sort();

        res.json({
            client,
            styleGuide,
            brandStyleGuide,
            scenarioOverride,
            cases,
            antiCases,
            neverRules,
            retrievedFrom
        });
    });

    return router;
}
