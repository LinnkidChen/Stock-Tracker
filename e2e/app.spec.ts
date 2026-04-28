import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('renders the not found page and supports back navigation', async ({
    page
  }) => {
    await page.goto('/e2e-missing-start');

    await expect(
      page.getByRole('heading', { name: "Something's missing" })
    ).toBeVisible();
    await expect(
      page.getByText('Sorry, the page you are looking for')
    ).toBeVisible();

    await page.goto('/e2e-missing-second');
    await page.getByRole('button', { name: 'Go back' }).click();

    await expect(page).toHaveURL(/\/e2e-missing-start$/);
  });
});
