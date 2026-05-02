import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

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
                    changeOrigin: true
                }
            }
        }
    },
    server: { port: 4322 }
});
