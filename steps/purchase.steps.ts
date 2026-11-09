import { expect } from '@playwright/test';
import { When, Then } from './fixtures';

When('I choose flight number {int} from the list', async ({ reservePage }, position: number) => {
  await reservePage.chooseFlight(position - 1);
});

Then('the purchase summary should show {string}', async ({ purchasePage }, text: string) => {
  await expect(purchasePage.summary).toContainText(text);
});

When('I fill the {string} field with {string}', async ({ purchasePage }, field: string, value: string) => {
  await purchasePage.field(field).fill(value);
});

When('I purchase the flight', async ({ purchasePage }) => {
  await purchasePage.purchase();
});

Then('the confirmation should show {string} as {string}', async ({ confirmationPage }, label: string, value: string) => {
  await expect(confirmationPage.row(label)).toContainText(value);
});

Then('the confirmation should show a booking {string}', async ({ confirmationPage }, label: string) => {
  await expect(confirmationPage.row(label)).toContainText(/\d+/);
});
