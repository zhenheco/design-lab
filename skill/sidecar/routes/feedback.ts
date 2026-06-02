import { Router } from 'express';
import { appendFeedback } from '../../lib/feedback-log.js';
import { getVaultPath } from '../../lib/paths.ts';

export function feedbackRouter(): Router {
    const router = Router();

    router.post('/', (req, res) => {
        appendFeedback(getVaultPath(), req.body);
        res.status(201).json({ ok: true });
    });

    return router;
}
