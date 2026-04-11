import { expect, test } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

async function loginToDemoWorkspace(page: import('@playwright/test').Page) {
  await registerApiMocks(page);
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
}

test.describe('AI Assistant', () => {
  test('opens the AI lab and streams a grounded response from the mocked copilot', async ({ page }) => {
    await loginToDemoWorkspace(page);

    await page.getByTestId('nav-AI_LAB').click();
    await expect(page.getByTestId('header').getByText('AI Assistant')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('N-Pricing Copilot ready.')).toBeVisible();

    const composer = page.getByPlaceholder('Ask about pricing, RAROC, credit risk, or specific deal IDs...');
    await composer.fill('Explain the pricing waterfall for the current deal.');
    await composer.press('Enter');

    await expect(page.getByText(/^Explain the pricing waterfall for the current deal\.$/)).toBeVisible();
    await expect(page.getByText(/Mock Gemini review:/i)).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/I analyzed "Explain the pricing waterfall for the current deal\."/i)
    ).toBeVisible();
  });
});
