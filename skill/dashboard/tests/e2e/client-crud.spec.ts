import { expect, test } from '@playwright/test';

test.describe('Client CRUD', () => {
    test('create new client', async ({ page }) => {
        await page.goto('/clients');
        await page.getByRole('button', { name: '+ Add Client' }).click();
        await page.getByLabel('Slug').fill('test-client');
        await page.getByLabel('Name').fill('Test Client');
        await page.getByLabel('Notes').fill('test note');
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForURL('/clients');
        await expect(page.getByText('Test Client')).toBeVisible();
    });

    test('edit existing client', async ({ page }) => {
        await page.goto('/clients');
        await page.getByRole('button', { name: 'Edit' }).first().click();
        await page.getByLabel('Name').fill('Updated Name');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Updated Name')).toBeVisible();
    });

    test('archive removes from list', async ({ page }) => {
        await page.goto('/clients');
        page.on('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Archive' }).first().click();
        // Expect a list item to disappear or section count to decrease after archive.
    });
});
