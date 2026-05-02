import { Router, type Request } from 'express';
import { loadAllClients } from '../../lib/client-loader.ts';
import { archiveClient, createClient, updateClient } from '../../lib/client-writer.ts';

interface ClientCreateBody {
    slug?: string;
    name?: string;
    type?: 'self' | 'client';
    theme_color?: string;
    notes?: string;
    created_at?: string;
}

interface ClientUpdateBody {
    name?: string;
    type?: 'self' | 'client';
    theme_color?: string;
    notes?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCreateBody(req: Request<Record<string, string>, unknown, unknown>): ClientCreateBody | null {
    if (!isRecord(req.body)) {
        return null;
    }

    return {
        slug: typeof req.body.slug === 'string' ? req.body.slug : undefined,
        name: typeof req.body.name === 'string' ? req.body.name : undefined,
        type: req.body.type === 'self' || req.body.type === 'client' ? req.body.type : undefined,
        theme_color: typeof req.body.theme_color === 'string' ? req.body.theme_color : undefined,
        notes: typeof req.body.notes === 'string' ? req.body.notes : undefined,
        created_at: typeof req.body.created_at === 'string' ? req.body.created_at : undefined
    };
}

function readUpdateBody(req: Request<Record<string, string>, unknown, unknown>): ClientUpdateBody | null {
    if (!isRecord(req.body)) {
        return null;
    }

    const body: ClientUpdateBody = {};
    if ('name' in req.body) {
        if (typeof req.body.name !== 'string') {
            return null;
        }
        body.name = req.body.name;
    }
    if ('type' in req.body) {
        if (req.body.type !== 'self' && req.body.type !== 'client') {
            return null;
        }
        body.type = req.body.type;
    }
    if ('theme_color' in req.body) {
        if (typeof req.body.theme_color !== 'string') {
            return null;
        }
        body.theme_color = req.body.theme_color;
    }
    if ('notes' in req.body) {
        if (typeof req.body.notes !== 'string') {
            return null;
        }
        body.notes = req.body.notes;
    }

    return body;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function clientsRouter(): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        res.json({ clients: loadAllClients() });
    });

    router.post('/', (req, res) => {
        const body = readCreateBody(req);
        if (!body?.slug || !body.name || !body.type || !body.theme_color) {
            res.status(400).json({ error: 'invalid client payload' });
            return;
        }

        try {
            const metaPath = createClient({
                slug: body.slug,
                name: body.name,
                type: body.type,
                theme_color: body.theme_color,
                notes: body.notes,
                created_at: body.created_at
            });
            res.status(201).json({ slug: body.slug, metaPath });
        } catch (error: unknown) {
            res.status(400).json({ error: getErrorMessage(error) });
        }
    });

    router.put('/:slug', (req, res) => {
        const body = readUpdateBody(req);
        if (!body) {
            res.status(400).json({ error: 'invalid client payload' });
            return;
        }

        try {
            updateClient(req.params.slug, body);
            res.json({ slug: req.params.slug });
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            res.status(message.includes('client not found') ? 404 : 400).json({ error: message });
        }
    });

    router.delete('/:slug', (req, res) => {
        try {
            const archivePath = archiveClient(req.params.slug);
            res.json({ slug: req.params.slug, archivePath });
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            res.status(message.includes('client not found') ? 404 : 400).json({ error: message });
        }
    });

    return router;
}
