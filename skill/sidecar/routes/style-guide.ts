import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Router, type Request } from 'express';
import { getStyleGuidePath } from '../../lib/paths.ts';

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
