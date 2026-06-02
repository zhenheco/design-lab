import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';

const DEFAULT_HOST_ALLOWLIST = ['127.0.0.1:5174', 'localhost:5174', 'localhost:4322'].map((host) =>
    host.toLowerCase()
);
let cachedHostAllowlistEnv: string | undefined;
let cachedHostAllowlist: string[] | undefined;

function getHostAllowlist(): string[] {
    const env = process.env.DESIGN_LAB_HOST_ALLOWLIST;
    if (!env) {
        return DEFAULT_HOST_ALLOWLIST;
    }
    if (cachedHostAllowlistEnv === env && cachedHostAllowlist) {
        return cachedHostAllowlist;
    }

    const allowlist = env
        .split(',')
        .map((host) => host.trim())
        .map((host) => host.toLowerCase())
        .filter((host) => host.length > 0);

    cachedHostAllowlistEnv = env;
    cachedHostAllowlist = allowlist.length > 0 ? allowlist : DEFAULT_HOST_ALLOWLIST;
    return cachedHostAllowlist;
}

function hasHostAllowlistOverride(): boolean {
    const env = process.env.DESIGN_LAB_HOST_ALLOWLIST;
    return env !== undefined && env.trim().length > 0;
}

function isLoopbackHost(host: string): boolean {
    try {
        const hostname = new URL(`http://${host}`).hostname.toLowerCase().replace(/^\[|\]$/g, '');
        return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
    } catch {
        return false;
    }
}

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) {
        return false;
    }

    return timingSafeEqual(bufA, bufB);
}

export const requireHostAllowlist: RequestHandler = (req, res, next) => {
    const host = req.headers.host?.toLowerCase();
    const allowlist = getHostAllowlist();
    const allowedByHost = host && (allowlist.includes(host) || (!hasHostAllowlistOverride() && isLoopbackHost(host)));
    if (!allowedByHost) {
        res.status(403).json({ error: 'forbidden host' });
        return;
    }

    next();
};

export const requireToken: RequestHandler = (req, res, next) => {
    const expected = process.env.DESIGN_LAB_API_TOKEN;
    if (!expected) {
        res.status(500).json({ error: 'server token misconfigured' });
        return;
    }

    const provided = req.headers['x-design-lab-token'];
    if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }

    next();
};

export function isWriteMethod(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export const requireTokenForWrites: RequestHandler = (req, res, next) => {
    if (!isWriteMethod(req.method)) {
        next();
        return;
    }

    requireToken(req, res, next);
};
