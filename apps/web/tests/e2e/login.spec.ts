import { test, expect } from '@playwright/test';

test('login page has title and login form', async ({ page }) => {
  await page.goto('/login');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Podelyx/);

  // Expect an email input to be visible — actual placeholder in LoginPage.tsx
  const emailInput = page.getByPlaceholder('especialista@clinica.cl');
  await expect(emailInput).toBeVisible();

  // Expect a password input to be visible
  const passwordInput = page.getByPlaceholder('••••••••');
  await expect(passwordInput).toBeVisible();

  // Button says "Ingresar" when not in TOTP mode
  const loginButton = page.getByRole('button', { name: /Ingresar/i });
  await expect(loginButton).toBeVisible();
});
