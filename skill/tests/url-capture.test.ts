import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CaptureUrlError, captureUrl, isPrivateOrLoopbackHost } from '../lib/capture/url-capture.ts';

async function serveHtml(html: string): Promise<{ url: string; close: () => Promise<void> }> {
    const server = createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === 'object');

    return {
        url: `http://127.0.0.1:${address.port}/fixture`,
        close: () => closeServer(server)
    };
}

async function closeServer(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

test('captureUrl screenshots a local HTML fixture and extracts computed design tokens', { timeout: 30_000 }, async () => {
    const fixture = await serveHtml(`<!doctype html>
        <html>
            <head>
                <title>Rice Paper Fixture</title>
                <style>
                    body {
                        margin: 0;
                        background: rgb(247, 243, 234);
                        color: rgb(31, 41, 55);
                        font-family: Georgia, serif;
                        font-size: 18px;
                    }
                    h1 {
                        color: rgb(125, 88, 45);
                        font-family: Arial, sans-serif;
                        font-size: 42px;
                    }
                    button {
                        background: rgb(31, 41, 55);
                        color: rgb(255, 255, 255);
                        font-size: 16px;
                    }
                </style>
            </head>
            <body>
                <main>
                    <h1>Capture Fixture</h1>
                    <p>Stable local page for design-token capture.</p>
                    <button>Act</button>
                </main>
            </body>
        </html>`);
    const outDir = await mkdtemp(join(tmpdir(), 'design-lab-url-capture-'));

    try {
        const result = await captureUrl(fixture.url, { outDir, allowPrivate: true });
        const imageStat = await stat(result.imagePath);

        assert.equal(result.title, 'Rice Paper Fixture');
        assert.equal(result.imagePath.endsWith('.png'), true);
        assert.equal(imageStat.isFile(), true);
        assert.ok(imageStat.size > 0);

        assert.ok(Array.isArray(result.tokens.palette));
        assert.ok(result.tokens.palette.length > 0);
        const fonts = result.tokens.fonts;
        assert.ok(fonts && typeof fonts === 'object' && !Array.isArray(fonts));
        assert.ok('body' in fonts);
        assert.ok('heading' in fonts);
    } finally {
        await fixture.close();
    }
});

test('isPrivateOrLoopbackHost identifies localhost and private address literals', () => {
    for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '169.254.1.1', '::1']) {
        assert.equal(isPrivateOrLoopbackHost(host), true, `${host} should be private or loopback`);
    }

    for (const host of ['example.com', '8.8.8.8', '172.32.0.1']) {
        assert.equal(isPrivateOrLoopbackHost(host), false, `${host} should be public`);
    }
});

test('captureUrl blocks private hosts by default and allows them when explicitly enabled', { timeout: 30_000 }, async () => {
    const fixture = await serveHtml(`<!doctype html>
        <html>
            <head><title>Private Fixture</title></head>
            <body><h1>Private Fixture</h1></body>
        </html>`);

    try {
        await assert.rejects(
            () => captureUrl(fixture.url),
            (error: unknown) =>
                error instanceof CaptureUrlError &&
                error.code === 'invalid_url' &&
                error.message === 'private/loopback host not allowed'
        );

        const result = await captureUrl(fixture.url, { allowPrivate: true });
        assert.equal(result.title, 'Private Fixture');
    } finally {
        await fixture.close();
    }
});
