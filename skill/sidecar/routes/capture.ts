import { existsSync } from 'node:fs';
import { Router } from 'express';
import { captureUrl } from '../../lib/capture/url-capture.ts';
import { writeCase } from '../../lib/case-writer.ts';
import { loadClient } from '../../lib/client-loader.ts';
import { getAntiCasePath, getCasePath } from '../../lib/paths.ts';

type Scenario = 'landing' | 'saas-ui' | 'brand' | 'content';
type Sentiment = 'positive' | 'negative';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    return slug || 'captured-url';
}

function isTaken(client: string, slug: string): boolean {
    return existsSync(getCasePath(client, slug)) || existsSync(getAntiCasePath(client, slug));
}

function dedupeSlug(client: string, baseSlug: string): string {
    let slug = baseSlug;
    let index = 2;
    while (isTaken(client, slug)) {
        const suffix = `-${index}`;
        slug = `${baseSlug.slice(0, 64 - suffix.length)}${suffix}`;
        index += 1;
    }
    return slug;
}

function titleOrHost(title: string, url: string): string {
    if (title.trim()) {
        return title;
    }
    return new URL(url).hostname;
}

export function captureRouter(): Router {
    const router = Router();

    router.post('/url', async (req, res, next) => {
        if (!isRecord(req.body)) {
            res.status(400).json({ error: 'invalid capture payload' });
            return;
        }

        const { url, client, quote } = req.body;
        if (typeof url !== 'string' || typeof client !== 'string' || typeof quote !== 'string') {
            res.status(400).json({ error: 'invalid capture payload' });
            return;
        }

        if (!loadClient(client)) {
            res.status(404).json({ error: `client not registered: ${client}` });
            return;
        }

        try {
            const capture = await captureUrl(url);
            const slug = dedupeSlug(
                client,
                typeof req.body.slug === 'string' ? slugify(req.body.slug) : slugify(titleOrHost(capture.title, url))
            );
            const result = writeCase({
                client,
                slug,
                sentiment: (typeof req.body.sentiment === 'string' ? req.body.sentiment : 'positive') as Sentiment,
                scenario: req.body.scenario as Scenario,
                quote,
                sourceImagePath: capture.imagePath,
                tokens: capture.tokens
            });

            res.status(201).json({
                ...result,
                slug,
                tokens: capture.tokens
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
