import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I open the BlazeDemo login page', async ({ loginPage }) => {
  await loginPage.open();
});

When('I fill the email with {string}', async ({ loginPage }, email: string) => {
  await loginPage.emailInput.fill(email);
});

When('I fill the password with {string}', async ({ loginPage }, password: string) => {
  await loginPage.passwordInput.fill(password);
});

When('I click the {string} button', async ({ page }, name: string) => {
  await page.getByRole('button', { name }).click();
});

Then('I should see the error message {string}', async ({ page }, message: string) => {
  await expect(page.getByText(message)).toBeVisible();
});
