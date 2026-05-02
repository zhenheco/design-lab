import { expect, test } from '@playwright/test';

test.describe('Case grid', () => {
    test('displays cases for client', async ({ page }) => {
        await page.goto('/clients/_personal');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('filters by scenario', async ({ page }) => {
        await page.goto('/clients/_personal');
        const select = page.locator('select').first();
        await select.selectOption('landing');
        await page.getByRole('button', { name: 'Apply' }).click();
        await expect(page).toHaveURL(/scenario=landing/);
    });

    test('filters by sentiment', async ({ page }) => {
        await page.goto('/clients/_personal?sentiment=positive');
        await expect(page).toHaveURL(/sentiment=positive/);
    });

    test('reset filter goes back to all', async ({ page }) => {
        await page.goto('/clients/_personal?scenario=landing');
        await page.getByRole('button', { name: 'Reset' }).click();
        await expect(page).toHaveURL('/clients/_personal');
    });
});
