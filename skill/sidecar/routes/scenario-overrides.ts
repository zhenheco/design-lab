import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Router, type Request } from 'express';
import { getScenarioOverridePath, getVaultPath, isValidSlug } from '../../lib/paths.ts';

interface ScenarioOverrideBody {
    content: string;
    expectedHash?: string;
}

function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(req: Request<Record<string, string>, unknown, unknown>): ScenarioOverrideBody | null {
    if (!isRecord(req.body) || typeof req.body.content !== 'string') {
        return null;
    }

    if ('expectedHash' in req.body && typeof req.body.expectedHash !== 'string') {
        return null;
    }

    return {
        content: req.body.content,
        expectedHash: typeof req.body.expectedHash === 'string' ? req.body.expectedHash : undefined
    };
}

export function scenarioOverridesRouter(): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const overridesDir = dirname(getScenarioOverridePath('placeholder'));
        if (!existsSync(overridesDir)) {
            res.json({ overrides: [] });
            return;
        }

        const overrides = readdirSync(overridesDir)
            .filter((entry) => entry.endsWith('.md'))
            .sort()
            .map((entry) => {
                const scenario = entry.slice(0, -3);
                const content = readFileSync(getScenarioOverridePath(scenario), 'utf8');
                return {
                    scenario,
                    content,
                    contentHash: hashContent(content)
                };
            });

        res.json({ overrides });
    });

    router.post('/:scenario', (req, res) => {
        const body = parseBody(req);
        if (!body) {
            res.status(400).json({ error: 'invalid scenario override payload' });
            return;
        }

        const { scenario } = req.params;
        if (!isValidSlug(scenario)) {
            res.status(400).json({ error: `invalid scenario: ${scenario}` });
            return;
        }

        const overridePath = getScenarioOverridePath(scenario);
        const currentContent = existsSync(overridePath) ? readFileSync(overridePath, 'utf8') : null;
        const currentHash = currentContent === null ? null : hashContent(currentContent);

        // 既有 override → expectedHash 必傳防 lost-update
        if (currentHash !== null && body.expectedHash === undefined) {
            res.status(400).json({ error: 'expectedHash required when scenario override exists' });
            return;
        }
        if (body.expectedHash !== undefined && body.expectedHash !== currentHash) {
            res.status(409).json({ error: 'scenario override hash conflict' });
            return;
        }

        mkdirSync(dirname(overridePath), { recursive: true });
        writeFileSync(overridePath, body.content);
        res.json({ contentHash: hashContent(body.content) });
    });

    return router;
}
