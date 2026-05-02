import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    use: { baseURL: 'http://localhost:4322' },
    webServer: {
        command: 'npm run preview',
        port: 4322,
        timeout: 60_000
    }
});
