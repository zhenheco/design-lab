import type { Server } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import { requireHostAllowlist, requireTokenForWrites } from './middleware/auth.ts';
import { casesRouter } from './routes/cases.ts';
import { clientsRouter } from './routes/clients.ts';
import { contextRouter } from './routes/context.ts';
import { distillRouter } from './routes/distill.ts';
import { captureRouter } from './routes/capture.ts';
import { feedbackRouter } from './routes/feedback.ts';
import { scenarioOverridesRouter } from './routes/scenario-overrides.ts';
import { createErrorHandler, initSentry } from './sentry.ts';
import { clientStyleGuideRouter, styleGuideRouter } from './routes/style-guide.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

export const errorHandler: ErrorRequestHandler = createErrorHandler();

export function createApp(): Express {
    if (!process.env.DESIGN_LAB_API_TOKEN) {
        throw new Error('DESIGN_LAB_API_TOKEN must be set before createApp()');
    }

    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' });
    });
    app.use(healthLogMiddleware);
    app.use('/api', requireHostAllowlist);
    app.use('/api', requireTokenForWrites);
    app.use('/api/clients/:slug/style-guide', clientStyleGuideRouter());
    app.use('/api/clients', clientsRouter());
    app.use('/api/capture', captureRouter());
    app.use('/api/cases', casesRouter());
    app.use('/api/feedback', feedbackRouter());
    app.use('/api/style-guide', styleGuideRouter());
    app.use('/api/scenario-overrides', scenarioOverridesRouter());
    app.use('/api/context', contextRouter());
    app.use('/api/distill', distillRouter());
    // δ1 scaffold: dashboard mount placeholder
    // Dashboard handler can be mounted by the sidecar after the Astro app is built:
    // import('../dashboard/dist/server/entry.mjs').then((m) => app.use(m.handler));
    // Enable this in the later integration phase once the dashboard build is part of startup.
    app.use(errorHandler);
    return app;
}

async function mountDashboard(app: Express): Promise<void> {
    const dashboardEntry = join(__dirname, '..', 'dashboard', 'dist', 'server', 'entry.mjs');
    if (!existsSync(dashboardEntry)) {
        console.warn(
            '[sidecar] dashboard dist not found at',
            dashboardEntry,
            '— skipping mount. Run `cd skill/dashboard && npm run build` first.'
        );
        return;
    }

    const mod = await import(dashboardEntry);
    app.use(mod.handler);
    console.log('[sidecar] dashboard mounted from', dashboardEntry);
}

export async function startServer(port = 5174, host = '127.0.0.1'): Promise<Server> {
    initSentry();
    const app = createApp();
    await mountDashboard(app);
    return new Promise((resolve) => {
        const server = app.listen(port, host, () => {
            console.log(`[sidecar] listening on http://${host}:${port}`);
            resolve(server);
        });
    });
}
