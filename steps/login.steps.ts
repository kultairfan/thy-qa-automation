import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I open the BlazeDemo login page', async ({ loginPage }) => {
  await loginPage.open();
});

When('I fill the login email with {string}', async ({ loginPage }, email: string) => {
  await loginPage.fillEmail(email);
});

When('I fill the login password with {string}', async ({ loginPage }, password: string) => {
  await loginPage.fillPassword(password);
});

When('I click the {string} button', async ({ loginPage }, buttonName: string) => {
  await loginPage.clickButton(buttonName);
});

Then('I should see an error message {string}', async ({ loginPage }, message: string) => {
  await expect(loginPage.errorMessage).toContainText(message);
});
