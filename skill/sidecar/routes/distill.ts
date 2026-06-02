import { existsSync, readFileSync } from 'node:fs';
import { Router, type Request } from 'express';
import { aggregateDistill, type DistillResult } from '../../lib/distill/aspect-aggregator.ts';
import { loadCaseSummaries } from '../../lib/case-loader.ts';
import { readFeedback } from '../../lib/feedback-log.js';
import { parseRulesFromGuide } from '../../lib/lint.js';
import { getClientStyleGuidePath, getStyleGuidePath, getVaultPath, isValidSlug } from '../../lib/paths.ts';

type DistillParams = {
    brand: string;
};

type DistillQuery = {
    minSupport?: string;
};

function parseMinSupport(value: unknown): number {
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
        return 2;
    }

    return Number(value);
}

function readOptionalFile(path: string): string {
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function existingNeverRuleIdsForBrand(brand: string): string[] {
    const ids = new Set<string>();
    for (const guide of [readOptionalFile(getStyleGuidePath()), readOptionalFile(getClientStyleGuidePath(brand))]) {
        for (const rule of parseRulesFromGuide(guide)) {
            ids.add(rule.id);
        }
    }
    return Array.from(ids);
}

export function distillRouter(): Router {
    const router = Router();

    router.get('/:brand', (req: Request<DistillParams, DistillResult | { error: string }, unknown, DistillQuery>, res) => {
        const { brand } = req.params;
        try {
            if (!isValidSlug(brand)) {
                res.status(400).json({ error: 'invalid brand slug' });
                return;
            }
        } catch {
            res.status(400).json({ error: 'invalid brand slug' });
            return;
        }

        const minSupport = parseMinSupport(req.query.minSupport);
        const vault = getVaultPath();
        const cases = loadCaseSummaries(vault, { client: brand });
        const feedback = readFeedback(vault).filter((entry) => entry.client === brand || entry.client === '_personal');
        const existingNeverRuleIds = existingNeverRuleIdsForBrand(brand);

        res.json(aggregateDistill({ brand, cases, feedback, minSupport, existingNeverRuleIds }));
    });

    return router;
}
