import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { chromium, type Browser } from 'playwright';

export type CaptureUrlResult = {
    imagePath: string;
    tokens: Record<string, unknown>;
    title: string;
};

export class CaptureUrlError extends Error {
    constructor(
        message: string,
        readonly code: 'invalid_url' | 'navigation_failed'
    ) {
        super(message);
        this.name = 'CaptureUrlError';
    }
}

function parseIpv4Octets(hostname: string): number[] | null {
    const parts = hostname.split('.');
    if (parts.length !== 4) {
        return null;
    }

    const octets = parts.map((part) => {
        if (!/^\d+$/.test(part)) {
            return Number.NaN;
        }
        return Number(part);
    });

    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return null;
    }

    return octets;
}

function firstIpv6Hextet(hostname: string): number | null {
    const [first] = hostname.split(':', 1);
    if (!first) {
        return null;
    }

    const parsed = Number.parseInt(first, 16);
    return Number.isNaN(parsed) ? null : parsed;
}

export function isPrivateOrLoopbackHost(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
        return true;
    }

    if (isIP(normalized) === 4) {
        const octets = parseIpv4Octets(normalized);
        if (!octets) {
            return false;
        }

        const [first, second] = octets;
        return (
            first === 0 ||
            first === 10 ||
            first === 127 ||
            (first === 169 && second === 254) ||
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && second === 168)
        );
    }

    if (isIP(normalized) === 6) {
        if (normalized === '::' || normalized === '::1') {
            return true;
        }

        const first = firstIpv6Hextet(normalized);
        return first !== null && ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80);
    }

    return false;
}

function parseHttpUrl(url: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new CaptureUrlError('capture URL must be a valid URL', 'invalid_url');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new CaptureUrlError('capture URL must use http or https', 'invalid_url');
    }

    return parsed;
}

function slugPart(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);

    return slug || 'page';
}

function imageFileName(url: URL): string {
    const hash = createHash('sha256').update(url.toString()).digest('hex').slice(0, 12);
    const pathPart = slugPart(basename(url.pathname) || url.hostname);
    return `design-lab-capture-${pathPart}-${hash}.png`;
}

function normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

export async function captureUrl(url: string, opts: { outDir?: string } = {}): Promise<CaptureUrlResult> {
    const parsedUrl = parseHttpUrl(url);
    const outDir = opts.outDir ?? tmpdir();
    await mkdir(outDir, { recursive: true });

    const imagePath = join(outDir, imageFileName(parsedUrl));
    let browser: Browser | undefined;

    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
        await page.goto(parsedUrl.toString(), { waitUntil: 'networkidle', timeout: 20_000 });
        const title = await page.title();

        const tokens = await page.evaluate(() => {
            const selectors = ['body', 'main', 'section', 'article', 'h1', 'h2', 'h3', 'p', 'a', 'button', 'input', 'textarea', 'select'];
            const palette = new Set<string>();
            const fontSizes: Record<string, string> = {};
            const fonts: { body?: string; heading?: string } = {};
            const transparent = new Set(['rgba(0, 0, 0, 0)', 'transparent']);

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (!element) {
                    continue;
                }

                const style = window.getComputedStyle(element);
                for (const color of [style.backgroundColor, style.color, style.borderColor]) {
                    if (color && !transparent.has(color)) {
                        palette.add(color);
                    }
                }

                fontSizes[selector] = style.fontSize;
                if (selector === 'body') {
                    fonts.body = style.fontFamily;
                }
                if (selector === 'h1' || (!fonts.heading && selector === 'h2')) {
                    fonts.heading = style.fontFamily;
                }
            }

            return {
                palette: Array.from(palette),
                fonts,
                fontSizes,
                title: document.title
            };
        });

        await page.screenshot({ path: imagePath, fullPage: true, type: 'png' });

        return {
            imagePath,
            tokens,
            title
        };
    } catch (error) {
        if (error instanceof CaptureUrlError) {
            throw error;
        }

        const normalized = normalizeError(error);
        throw new CaptureUrlError(`failed to capture URL: ${normalized.message}`, 'navigation_failed');
    } finally {
        await browser?.close();
    }
}
