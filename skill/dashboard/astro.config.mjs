import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    output: 'server',
    adapter: node({ mode: 'middleware' }),
    integrations: [react()],
    vite: {
        plugins: [tailwindcss()]
    },
    server: { port: 4322 }
});
