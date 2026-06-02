import { existsSync, readFileSync } from 'node:fs';
import { Router, type Request } from 'express';
import { loadCaseSummaries, type CaseSummary } from '../../lib/case-loader.ts';
import { loadClient, type ClientMeta } from '../../lib/client-loader.ts';
import { parseRulesFromGuide, type NeverRule } from '../../lib/lint.js';
import { getClientStyleGuidePath, getScenarioOverridePath, getStyleGuidePath, getVaultPath } from '../../lib/paths.ts';

const TOP_N_POSITIVE = 5;

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
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
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
