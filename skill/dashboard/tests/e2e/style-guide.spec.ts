import { expect, test } from '@playwright/test';

test.describe('Style Guide', () => {
    test('loads and shows content', async ({ page }) => {
        await page.goto('/style-guide', { waitUntil: 'networkidle' });
        await expect(page.getByRole('heading', { name: 'Personal Style Guide' })).toBeVisible();

        const textarea = page.locator('textarea');
        await expect(textarea).toBeVisible();

        const value = await textarea.inputValue();
        expect(value.length).toBeGreaterThan(0);
    });

    test('save button disabled when no changes', async ({ page }) => {
        await page.goto('/style-guide', { waitUntil: 'networkidle' });
        // small delay for React island hydration
        await page.waitForTimeout(500);
        const saveButton = page.getByRole('button', { name: 'Save' });
        await expect(saveButton).toBeDisabled();
    });

    test('edit + save updates hash', async ({ page }) => {
        await page.goto('/style-guide', { waitUntil: 'networkidle' });
        // small delay for React island hydration
        await page.waitForTimeout(500);

        const textarea = page.locator('textarea');
        await textarea.fill('# Modified style guide\n\n## DO\n- test');

        const saveButton = page.getByRole('button', { name: 'Save' });
        await expect(saveButton).toBeEnabled();

        await Promise.all([
            page.waitForResponse((res) => res.url().endsWith('/api/style-guide') && res.request().method() === 'POST' && res.status() === 200),
            saveButton.click()
        ]);

        await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 5000 });
    });

    test('hash conflict shows reload prompt', async ({ page, request }) => {
        await page.goto('/style-guide', { waitUntil: 'networkidle' });
        // small delay for React island hydration
        await page.waitForTimeout(500);

        // 1. user edits in browser (dirty)
        const textarea = page.locator('textarea');
        await textarea.fill('# Browser edit\n\n## DO\n- mine');

        // 2. external write via API (changes the vault hash)
        const current = await request.get('/api/style-guide');
        const currentBody = await current.json();
        await request.post('/api/style-guide', {
            data: { content: '# External overwrite\n', expectedHash: currentBody.contentHash }
        });

        // 3. user clicks Save → 409 conflict UI shows
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText(/Conflict detected/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: /Reload latest/i })).toBeVisible();
    });
});
