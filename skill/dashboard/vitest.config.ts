import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/components/**/*.test.tsx', 'tests/components/**/*.test.ts'],
        css: false
    }
});
