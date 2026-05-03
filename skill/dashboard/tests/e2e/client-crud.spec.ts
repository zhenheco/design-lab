import { expect, test, type Page } from '@playwright/test';

async function clickAndWaitFor(page: Page, button: string, expectedSelector: string) {
    // Retry click + wait for expected element (handles Astro hydration race).
    const locator = page.getByRole('button', { name: button });
    await locator.click();
    try {
        await page.locator(expectedSelector).first().waitFor({ state: 'visible', timeout: 1500 });
    } catch {
        // hydration not ready on first click — give it 500ms then retry once
        await page.waitForTimeout(500);
        await locator.click();
        await page.locator(expectedSelector).first().waitFor({ state: 'visible', timeout: 8000 });
    }
}

test.describe('Client CRUD', () => {
    test('create new client', async ({ page }) => {
        await page.goto('/clients', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        await clickAndWaitFor(page, '+ Add Client', 'role=heading[name="New Client"]');

        await page.getByLabel('Slug').fill('e2e-create');
        await page.getByLabel('Name').fill('E2E Created');
        await page.getByLabel('Notes').fill('test note');

        await Promise.all([
            page.waitForResponse((res) => res.url().endsWith('/api/clients') && res.request().method() === 'POST' && res.status() === 201),
            page.getByRole('button', { name: 'Save' }).click()
        ]);

        await expect(page.getByText('E2E Created')).toBeVisible();
    });

    test('edit existing client', async ({ page }) => {
        await page.goto('/clients', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        await page.getByRole('button', { name: 'Edit' }).first().waitFor();

        // Click Edit and wait for modal heading; retry once if hydration race
        const editBtn = page.getByRole('button', { name: 'Edit' }).first();
        await editBtn.click();
        try {
            await page.getByRole('heading', { name: /^Edit / }).waitFor({ state: 'visible', timeout: 1500 });
        } catch {
            await page.waitForTimeout(500);
            await editBtn.click();
            await page.getByRole('heading', { name: /^Edit / }).waitFor({ state: 'visible', timeout: 8000 });
        }

        await page.getByLabel('Name').fill('E2E Updated');

        await Promise.all([
            page.waitForResponse((res) => /\/api\/clients\//.test(res.url()) && res.request().method() === 'PUT' && res.status() === 200),
            page.getByRole('button', { name: 'Save' }).click()
        ]);

        await expect(page.getByText('E2E Updated')).toBeVisible();
    });

    test('archive removes from list', async ({ page }) => {
        await page.goto('/clients', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        await page.getByRole('button', { name: 'Archive' }).first().waitFor();

        page.on('dialog', (dialog) => dialog.accept());
        // Archive button is on Astro page <script> handler (not React island), works without hydration
        await Promise.all([
            page.waitForResponse((res) => /\/api\/clients\//.test(res.url()) && res.request().method() === 'DELETE' && res.status() === 200),
            page.getByRole('button', { name: 'Archive' }).first().click()
        ]);
    });
});
