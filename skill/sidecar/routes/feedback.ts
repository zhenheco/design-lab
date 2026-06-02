import { Router } from 'express';
import { appendFeedback, type FeedbackEntry } from '../../lib/feedback-log.js';
import { getVaultPath } from '../../lib/paths.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(body: unknown): FeedbackEntry | null {
    if (
        !isRecord(body) ||
        typeof body.signal !== 'string' ||
        body.signal.trim().length === 0 ||
        typeof body.user_quote !== 'string' ||
        body.user_quote.trim().length === 0
    ) {
        return null;
    }

    const entry: FeedbackEntry = {
        signal: body.signal,
        user_quote: body.user_quote
    };

    for (const field of ['client', 'case_slug', 'dimension', 'derived_rule'] as const) {
        if (typeof body[field] === 'string') {
            entry[field] = body[field];
        }
    }

    return entry;
}

export function feedbackRouter(): Router {
    const router = Router();

    router.post('/', (req, res) => {
        const body = parseBody(req.body);
        if (!body) {
            res.status(400).json({ error: 'invalid feedback payload' });
            return;
        }

        appendFeedback(getVaultPath(), body);
        res.status(201).json({ ok: true });
    });

    return router;
}
