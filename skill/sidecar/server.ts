import { createServer, type Server } from 'node:http';
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import { casesRouter } from './routes/cases.ts';
import { clientsRouter } from './routes/clients.ts';
import { contextRouter } from './routes/context.ts';
import { scenarioOverridesRouter } from './routes/scenario-overrides.ts';
import { styleGuideRouter } from './routes/style-guide.ts';

const healthLogMiddleware: RequestHandler = (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
        next();
        return;
    }

    const startedAt = Date.now();
    res.on('finish', () => {
        console.log(`[sidecar] ${req.method} ${req.path} ${Date.now() - startedAt}ms`);
    });
    next();
};

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ error: message });
};

export function createApp(): Express {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(healthLogMiddleware);
    app.use('/api/clients', clientsRouter());
    app.use('/api/cases', casesRouter());
    app.use('/api/style-guide', styleGuideRouter());
    app.use('/api/scenario-overrides', scenarioOverridesRouter());
    app.use('/api/context', contextRouter());
    app.use(errorHandler);
    return app;
}

export function startServer(port = 5174, host = '127.0.0.1'): Server {
    const app = createApp();
    const server = createServer(app);
    server.listen(port, host, () => {
        console.log(`[sidecar] listening on http://${host}:${port}`);
    });
    return server;
}
