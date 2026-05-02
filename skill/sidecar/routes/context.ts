import { Router, type Request } from 'express';
import { loadClient, type ClientMeta } from '../../lib/client-loader.ts';

type ContextQuery = {
    client?: string;
    scenario?: string;
};

interface ContextResponse {
    client: ClientMeta | null;
    styleGuide: string;
    scenarioOverride: string;
    cases: [];
    antiCases: [];
    neverRules: [];
    retrievedFrom: [];
}

export function contextRouter(): Router {
    const router = Router();

    router.get('/', (req: Request<Record<string, string>, ContextResponse, unknown, ContextQuery>, res) => {
        const clientSlug = typeof req.query.client === 'string' ? req.query.client : undefined;
        const client = clientSlug ? loadClient(clientSlug) : null;

        res.json({
            client,
            styleGuide: '',
            scenarioOverride: '',
            cases: [],
            antiCases: [],
            neverRules: [],
            retrievedFrom: []
        });
    });

    return router;
}
