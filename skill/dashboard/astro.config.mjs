import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TOKEN_FILE = join(homedir(), '.claude/state/design-lab/api-token');

function loadDevToken() {
    try {
        const token = readFileSync(TOKEN_FILE, 'utf-8').trim();
        return token.length > 0 ? token : null;
    } catch {
        return null;
    }
}

const devToken = loadDevToken();
if (devToken && !process.env.DESIGN_LAB_API_TOKEN) {
    process.env.DESIGN_LAB_API_TOKEN = devToken;
}

export default defineConfig({
    output: 'server',
    adapter: node({ mode: 'middleware' }),
    integrations: [react()],
    vite: {
        plugins: [tailwindcss()],
        server: {
            proxy: {
                '/api': {
                    target: 'http://127.0.0.1:5174',
                    changeOrigin: true,
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq) => {
                            const token = process.env.DESIGN_LAB_API_TOKEN;
                            if (token && !proxyReq.getHeader('x-design-lab-token')) {
                                proxyReq.setHeader('X-Design-Lab-Token', token);
                            }
                        });
                    }
                }
            }
        }
    },
    server: { port: 4322 }
});
