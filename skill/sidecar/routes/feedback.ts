import { Router } from 'express';
import { appendFeedback, type FeedbackEntry } from '../../lib/feedback-log.js';
import { getVaultPath } from '../../lib/paths.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ParseBodyResult =
    | { ok: true; entry: FeedbackEntry }
    | { ok: false; error: 'invalid feedback payload' | 'invalid verdict' };

function parseBody(body: unknown): ParseBodyResult {
    if (
        !isRecord(body) ||
        typeof body.signal !== 'string' ||
        body.signal.trim().length === 0 ||
        typeof body.user_quote !== 'string' ||
        body.user_quote.trim().length === 0
    ) {
        return { ok: false, error: 'invalid feedback payload' };
    }

    if ('verdict' in body && body.verdict !== 'like' && body.verdict !== 'dislike') {
        return { ok: false, error: 'invalid verdict' };
    }

    const entry: FeedbackEntry = {
        signal: body.signal,
        user_quote: body.user_quote,
        ...(body.verdict === 'like' || body.verdict === 'dislike' ? { verdict: body.verdict } : {})
    };

    for (const field of ['client', 'case_slug', 'dimension', 'derived_rule'] as const) {
        if (typeof body[field] === 'string') {
            entry[field] = body[field];
        }
    }

    return { ok: true, entry };
}

export function feedbackRouter(): Router {
    const router = Router();

    router.post('/', (req, res) => {
        const bodyResult = parseBody(req.body);
        if (!bodyResult.ok) {
            res.status(400).json({ error: bodyResult.error });
            return;
        }

        appendFeedback(getVaultPath(), bodyResult.entry);
        res.status(201).json({ ok: true });
    });

    return router;
}
