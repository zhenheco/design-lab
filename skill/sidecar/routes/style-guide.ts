import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Router, type Request } from 'express';
import { loadClient } from '../../lib/client-loader.ts';
import { getClientStyleGuidePath, getStyleGuidePath } from '../../lib/paths.ts';

interface StyleGuideBody {
    content: string;
    expectedHash?: string;
}

function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(req: Request<Record<string, string>, unknown, unknown>): StyleGuideBody | null {
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

export function styleGuideRouter(): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const styleGuidePath = getStyleGuidePath();
        if (!existsSync(styleGuidePath)) {
            res.status(404).json({ error: 'style guide not found' });
            return;
        }

        const content = readFileSync(styleGuidePath, 'utf8');
        res.json({ content, contentHash: hashContent(content) });
    });

    router.post('/', (req, res) => {
        const body = parseBody(req);
        if (!body) {
            res.status(400).json({ error: 'invalid style guide payload' });
            return;
        }

        const styleGuidePath = getStyleGuidePath();
        const currentContent = existsSync(styleGuidePath) ? readFileSync(styleGuidePath, 'utf8') : null;
        const currentHash = currentContent === null ? null : hashContent(currentContent);

        // 既有 style-guide → expectedHash 必傳防 lost-update
        if (currentHash !== null && body.expectedHash === undefined) {
            res.status(400).json({ error: 'expectedHash required when style guide exists' });
            return;
        }
        if (body.expectedHash !== undefined && body.expectedHash !== currentHash) {
            res.status(409).json({ error: 'style guide hash conflict' });
            return;
        }

        mkdirSync(dirname(styleGuidePath), { recursive: true });
        writeFileSync(styleGuidePath, body.content);
        res.json({ contentHash: hashContent(body.content) });
    });

    return router;
}

export function clientStyleGuideRouter(): Router {
    const router = Router({ mergeParams: true });

    router.post('/', (req: Request<{ slug: string }, unknown, unknown>, res) => {
        const body = parseBody(req);
        if (!body) {
            res.status(400).json({ error: 'invalid style guide payload' });
            return;
        }

        let styleGuidePath: string;
        try {
            styleGuidePath = getClientStyleGuidePath(req.params.slug);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            res.status(400).json({ error: message });
            return;
        }

        if (!loadClient(req.params.slug)) {
            res.status(404).json({ error: 'client not found' });
            return;
        }

        const currentContent = existsSync(styleGuidePath) ? readFileSync(styleGuidePath, 'utf8') : null;
        const currentHash = currentContent === null ? null : hashContent(currentContent);

        if (currentHash !== null && body.expectedHash === undefined) {
            res.status(400).json({ error: 'expectedHash required when style guide exists' });
            return;
        }
        if (body.expectedHash !== undefined && body.expectedHash !== currentHash) {
            res.status(409).json({ error: 'style guide hash conflict' });
            return;
        }

        mkdirSync(dirname(styleGuidePath), { recursive: true });
        writeFileSync(styleGuidePath, body.content);
        res.json({ contentHash: hashContent(body.content) });
    });

    return router;
}
