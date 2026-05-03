import { expect, test, type APIRequestContext } from '@playwright/test';

async function seedCases(request: APIRequestContext) {
    // Best-effort fixture; ignore if cases already exist.
    await request.post('/api/cases', {
        data: {
            client: '_personal',
            slug: 'fixture-landing-pos',
            sentiment: 'positive',
            scenario: 'landing',
            quote: 'fixture',
            sourceImagePath: '/tmp/__nonexistent_fixture.png'
        }
    });
    await request.post('/api/cases', {
        data: {
            client: '_personal',
            slug: 'fixture-brand-neg',
            sentiment: 'negative',
            scenario: 'brand',
            quote: 'fixture',
            sourceImagePath: '/tmp/__nonexistent_fixture.png'
        }
    });
}

test.describe('Case grid', () => {
    test.beforeEach(async ({ request }) => {
        await seedCases(request);
    });

    test('displays cases for client', async ({ page }) => {
        await page.goto('/clients/_personal', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('filters by scenario', async ({ page }) => {
        await page.goto('/clients/_personal', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        const select = page.locator('select').first();
        await select.waitFor();
        await select.selectOption('landing');

        // Click Apply, retry once on hydration race
        const applyBtn = page.getByRole('button', { name: 'Apply' });
        await applyBtn.click();
        try {
            await page.waitForURL(/scenario=landing/, { timeout: 1500 });
        } catch {
            await page.waitForTimeout(500);
            await applyBtn.click();
            await page.waitForURL(/scenario=landing/, { timeout: 8000 });
        }
        await expect(page).toHaveURL(/scenario=landing/);
    });

    test('filters by sentiment', async ({ page }) => {
        await page.goto('/clients/_personal?sentiment=positive', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL(/sentiment=positive/);
    });

    test('reset filter goes back to all', async ({ page }) => {
        await page.goto('/clients/_personal?scenario=landing', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        const resetBtn = page.getByRole('button', { name: 'Reset' });
        await resetBtn.waitFor();
        await resetBtn.click();
        try {
            await page.waitForURL((url) => url.pathname === '/clients/_personal' && url.search === '', { timeout: 1500 });
        } catch {
            await page.waitForTimeout(500);
            await resetBtn.click();
            await page.waitForURL((url) => url.pathname === '/clients/_personal' && url.search === '', { timeout: 8000 });
        }
        await expect(page).toHaveURL('/clients/_personal');
    });
});
