import * as Sentry from '@sentry/node';
import type { ErrorRequestHandler } from 'express';

type SentryInitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;

export type SentryEnv = {
    SENTRY_DSN?: string;
    SENTRY_ENVIRONMENT?: string;
    SENTRY_RELEASE?: string;
    SENTRY_TRACES_SAMPLE_RATE?: string;
    NODE_ENV?: string;
};

type ScrubbableEvent = {
    request?: {
        url?: unknown;
        query_string?: unknown;
        cookies?: unknown;
        data?: unknown;
        headers?: Record<string, unknown>;
        [key: string]: unknown;
    };
    user?: Record<string, unknown>;
    extra?: Record<string, unknown>;
    contexts?: Record<string, unknown>;
    breadcrumbs?: Array<Record<string, unknown>>;
    [key: string]: unknown;
};

type SidecarErrorContext = {
    method?: string;
    path?: string;
};

type CaptureSidecarException = (
    error: unknown,
    context?: SidecarErrorContext
) => string | undefined | void | Promise<string | undefined | void>;

const sensitiveKeyPattern = /(authorization|cookie|token|secret|password|passwd|api[-_]?key|dsn|session)/i;
const sensitiveHeaderKeys = new Set(['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip']);

let sentryInitialized = false;

export function buildSentryOptions(env: SentryEnv = process.env): SentryInitOptions | undefined {
    const dsn = env.SENTRY_DSN?.trim();
    if (!dsn) {
        return undefined;
    }

    return {
        dsn,
        environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? 'development',
        release: env.SENTRY_RELEASE,
        tracesSampleRate: parseTraceSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
        sendDefaultPii: false,
        beforeSend: scrubSentryEvent as NonNullable<SentryInitOptions['beforeSend']>,
        beforeSendTransaction: scrubSentryTransaction as NonNullable<SentryInitOptions['beforeSendTransaction']>
    };
}

export function initSentry(env: SentryEnv = process.env): boolean {
    if (sentryInitialized) {
        return true;
    }

    const options = buildSentryOptions(env);
    if (!options) {
        return false;
    }

    Sentry.init(options);
    sentryInitialized = true;
    return true;
}

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
    const scrubbed: ScrubbableEvent = { ...event };

    if (event.request) {
        const request = { ...event.request };
        if (request.url) {
            request.url = stripUrlSecrets(String(request.url));
        }
        delete request.query_string;
        delete request.cookies;
        delete request.data;
        request.headers = scrubHeaders(request.headers);
        scrubbed.request = request;
    }

    if (event.user) {
        scrubbed.user = typeof event.user.id === 'string' ? { id: event.user.id } : undefined;
    }

    scrubbed.extra = scrubRecord(event.extra);
    scrubbed.contexts = scrubRecord(event.contexts);

    const breadcrumbs = event.breadcrumbs
        ?.filter((breadcrumb) => !breadcrumbHasSecrets(breadcrumb))
        .map((breadcrumb) => scrubRecord(breadcrumb))
        .filter((breadcrumb): breadcrumb is Record<string, unknown> => Boolean(breadcrumb));
    scrubbed.breadcrumbs = breadcrumbs?.length ? breadcrumbs : undefined;

    return scrubbed as T;
}

export function scrubSentryTransaction<T extends ScrubbableEvent>(event: T): T {
    return scrubSentryEvent(event);
}

export function captureSidecarException(
    error: unknown,
    context: SidecarErrorContext = {}
): string | undefined {
    let eventId: string | undefined;
    Sentry.withScope((scope) => {
        scope.setTag('component', 'design-lab-sidecar');
        scope.setContext('sidecar', context);
        eventId = Sentry.captureException(error);
    });
    return eventId;
}

export function createErrorHandler(
    capture: CaptureSidecarException = captureSidecarException
): ErrorRequestHandler {
    return (error, req, res, _next) => {
        if (error instanceof SyntaxError && 'body' in (error as object)) {
            res.status(400).json({ error: 'invalid JSON' });
            return;
        }

        const errType = (error as { type?: string }).type;
        const errStatus = (error as { status?: number; statusCode?: number }).status
            ?? (error as { status?: number; statusCode?: number }).statusCode;
        if (errType === 'entity.too.large' || errStatus === 413) {
            res.status(413).json({ error: 'payload too large' });
            return;
        }

        void Promise.resolve(capture(error, { method: req.method, path: req.path })).catch((captureError) => {
            console.error('[sidecar] sentry capture failed:', captureError);
        });
        console.error('[sidecar] 500:', error);
        res.status(500).json({ error: 'internal server error' });
    };
}

function parseTraceSampleRate(value: string | undefined): number {
    if (value === undefined || value.trim() === '') {
        return 0.1;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.1;
}

function stripUrlSecrets(value: string): string {
    try {
        const url = new URL(value);
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return value.split(/[?#]/, 1)[0] ?? value;
    }
}

function scrubHeaders(headers: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!headers) {
        return undefined;
    }

    const kept = Object.fromEntries(
        Object.entries(headers).filter(([key]) => {
            const normalized = key.toLowerCase();
            return !sensitiveKeyPattern.test(normalized) && !sensitiveHeaderKeys.has(normalized);
        })
    );

    return Object.keys(kept).length ? kept : undefined;
}

function scrubRecord(record: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!record) {
        return undefined;
    }

    const kept = Object.fromEntries(
        Object.entries(record)
            .filter(([key, value]) => !sensitiveKeyPattern.test(key) && !valueHasSecret(value))
            .map(([key, value]) => [key, scrubValue(value)])
    );

    return Object.keys(kept).length ? kept : undefined;
}

function scrubValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(scrubValue).filter((item) => item !== undefined);
    }
    if (value && typeof value === 'object') {
        return scrubRecord(value as Record<string, unknown>);
    }
    return value;
}

function breadcrumbHasSecrets(breadcrumb: Record<string, unknown>): boolean {
    return Object.entries(breadcrumb).some(([key, value]) => (
        sensitiveKeyPattern.test(key)
        || valueHasSecret(value)
        || (typeof value === 'string' && sensitiveKeyPattern.test(value))
    ));
}

function valueHasSecret(value: unknown): boolean {
    if (typeof value === 'string') {
        return sensitiveKeyPattern.test(value) || looksLikeLocalFilesystemPath(value);
    }
    if (Array.isArray(value)) {
        return value.some(valueHasSecret);
    }
    if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).some(([key, nested]) => (
            sensitiveKeyPattern.test(key) || valueHasSecret(nested)
        ));
    }
    return false;
}

function looksLikeLocalFilesystemPath(value: string): boolean {
    const trimmed = value.trim();
    return /^\/(?:Users|Volumes|private|var|tmp|home)\//.test(trimmed)
        || /^[A-Za-z]:[\\/]/.test(trimmed);
}
