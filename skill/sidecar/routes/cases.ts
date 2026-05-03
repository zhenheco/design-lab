import { homedir, tmpdir } from 'node:os';
import { resolve as resolvePath, sep } from 'node:path';
import { Router, type Request } from 'express';
import { loadCaseSummaries, type CaseSummary } from '../../lib/case-loader.ts';
import { getVaultPath } from '../../lib/paths.ts';
import { writeCase, type WriteCaseInput } from '../../lib/case-writer.ts';

function getSourceAllowlist(): string[] {
    const home = process.env.HOME ?? homedir();
    const configured =
        process.env.DESIGN_LAB_SOURCE_ALLOWLIST
        ?? `${tmpdir()}:${home}/Pictures/Screenshots:${home}/Downloads`;

    return configured
        .split(':')
        .map((prefix) => prefix.trim())
        .filter((prefix) => prefix.length > 0)
        .map((prefix) => resolvePath(prefix));
}

function pathHasTraversal(path: string): boolean {
    return path.split(/[\\/]+/).includes('..');
}

function isAllowedSourceImagePath(path: string): boolean {
    if (pathHasTraversal(path)) {
        return false;
    }

    const resolved = resolvePath(path);
    return getSourceAllowlist().some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}${sep}`));
}

type CasesQuery = {
    client?: string;
    scenario?: string;
    sentiment?: 'positive' | 'negative';
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCasesQuery(req: Request<Record<string, string>, unknown, unknown, CasesQuery>): CasesQuery | null {
    const { client, scenario, sentiment } = req.query;
    if (sentiment !== undefined && sentiment !== 'positive' && sentiment !== 'negative') {
        return null;
    }

    return { client, scenario, sentiment };
}

function parseWriteCaseBody(req: Request<Record<string, string>, unknown, unknown>): WriteCaseInput | null {
    if (!isRecord(req.body)) {
        return null;
    }

    if (
        typeof req.body.client !== 'string' ||
        typeof req.body.slug !== 'string' ||
        (req.body.sentiment !== 'positive' && req.body.sentiment !== 'negative') ||
        (req.body.scenario !== 'landing' &&
            req.body.scenario !== 'saas-ui' &&
            req.body.scenario !== 'brand' &&
            req.body.scenario !== 'content') ||
        typeof req.body.quote !== 'string' ||
        typeof req.body.sourceImagePath !== 'string'
    ) {
        return null;
    }

    let tokens: Record<string, unknown> | undefined;
    if ('tokens' in req.body) {
        if (!isRecord(req.body.tokens)) {
            return null;
        }
        tokens = req.body.tokens;
    }

    return {
        client: req.body.client,
        slug: req.body.slug,
        sentiment: req.body.sentiment,
        scenario: req.body.scenario,
        quote: req.body.quote,
        sourceImagePath: req.body.sourceImagePath,
        tokens
    };
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function casesRouter(): Router {
    const router = Router();

    router.get('/', (req: Request<Record<string, string>, unknown, unknown, CasesQuery>, res) => {
        const query = parseCasesQuery(req);
        if (!query) {
            res.status(400).json({ error: 'invalid cases query' });
            return;
        }

        const cases = loadCaseSummaries(getVaultPath(), query);
        res.json({ cases });
    });

    router.post('/', (req, res) => {
        const body = parseWriteCaseBody(req);
        if (!body) {
            res.status(400).json({ error: 'invalid case payload' });
            return;
        }

        if (!isAllowedSourceImagePath(body.sourceImagePath)) {
            res.status(400).json({ error: `sourceImagePath not allowed: ${body.sourceImagePath}` });
            return;
        }

        try {
            const result = writeCase(body);
            res.status(201).json(result);
        } catch (error: unknown) {
            res.status(400).json({ error: getErrorMessage(error) });
        }
    });

    return router;
}
