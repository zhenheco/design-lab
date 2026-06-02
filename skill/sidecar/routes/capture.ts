import { existsSync } from 'node:fs';
import { Router } from 'express';
import { CaptureUrlError, captureUrl } from '../../lib/capture/url-capture.ts';
import { writeCase } from '../../lib/case-writer.ts';
import { loadClient } from '../../lib/client-loader.ts';
import type { Aspect } from '../../lib/case-loader.ts';
import { getAntiCasePath, getCasePath } from '../../lib/paths.ts';
import { isAllowedSourceImagePath } from './source-image-allowlist.ts';

type Scenario = 'landing' | 'saas-ui' | 'brand' | 'content';
type Sentiment = 'positive' | 'negative';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAspectArray(value: unknown): value is Aspect[] {
    return (
        Array.isArray(value) &&
        value.every(
            (item) =>
                isRecord(item) &&
                typeof item.dimension === 'string' &&
                (item.verdict === 'like' || item.verdict === 'dislike') &&
                typeof item.note === 'string'
        )
    );
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

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function shouldAllowPrivateCapture(): boolean {
    return process.env.DESIGN_LAB_CAPTURE_ALLOW_PRIVATE === '1';
}

export function captureRouter(): Router {
    const router = Router();

    router.post('/url', async (req, res, next) => {
        if (!isRecord(req.body)) {
            res.status(400).json({ error: 'invalid capture payload' });
            return;
        }

        const { url, client, quote, scenario } = req.body;
        if (typeof url !== 'string' || typeof client !== 'string' || typeof quote !== 'string') {
            res.status(400).json({ error: 'invalid capture payload' });
            return;
        }

        if (!isHttpUrl(url)) {
            res.status(400).json({ error: 'url must use http or https' });
            return;
        }

        if (scenario !== 'landing' && scenario !== 'saas-ui' && scenario !== 'brand' && scenario !== 'content') {
            res.status(400).json({ error: 'invalid scenario' });
            return;
        }

        if (
            'sentiment' in req.body &&
            req.body.sentiment !== undefined &&
            req.body.sentiment !== 'positive' &&
            req.body.sentiment !== 'negative'
        ) {
            res.status(400).json({ error: 'invalid sentiment' });
            return;
        }

        let aspects: Aspect[] | undefined;
        if ('aspects' in req.body) {
            if (!isAspectArray(req.body.aspects)) {
                res.status(400).json({ error: 'invalid aspects' });
                return;
            }
            aspects = req.body.aspects;
        }

        if (!loadClient(client)) {
            res.status(404).json({ error: `client not registered: ${client}` });
            return;
        }

        try {
            const capture = await captureUrl(url, { allowPrivate: shouldAllowPrivateCapture() });
            if (!isAllowedSourceImagePath(capture.imagePath)) {
                throw new Error(`captured image path not allowed: ${capture.imagePath}`);
            }

            const slug = dedupeSlug(
                client,
                typeof req.body.slug === 'string' ? slugify(req.body.slug) : slugify(titleOrHost(capture.title, url))
            );
            const result = writeCase({
                client,
                slug,
                sentiment: (typeof req.body.sentiment === 'string' ? req.body.sentiment : 'positive') as Sentiment,
                scenario: scenario as Scenario,
                quote,
                sourceImagePath: capture.imagePath,
                tokens: capture.tokens,
                aspects
            });

            res.status(201).json({
                ...result,
                slug,
                tokens: capture.tokens
            });
        } catch (error) {
            if (error instanceof CaptureUrlError && error.code === 'invalid_url') {
                res.status(400).json({ error: error.message });
                return;
            }

            next(error);
        }
    });

    return router;
}
