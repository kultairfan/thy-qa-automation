import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I open the BlazeDemo home page', async ({ homePage }) => {
  await homePage.open();
});

When('I search flights from {string} to {string}', async ({ homePage }, from: string, to: string) => {
  await homePage.search(from, to);
});

Then('I should see the heading {string}', async ({ page }, text: string) => {
  await expect(page.getByRole('heading', { name: text })).toBeVisible();
});

Then('I should see at least {int} flight(s)', async ({ reservePage }, min: number) => {
  await expect(reservePage.rows.first()).toBeVisible();
  expect(await reservePage.rows.count()).toBeGreaterThanOrEqual(min);
});

Then('every flight should have a {string} button', async ({ reservePage }, label: string) => {
  const rows = await reservePage.rows.count();
  await expect(reservePage.page.getByRole('button', { name: label })).toHaveCount(rows);
});

Then('the page title should be {string}', async ({ page }, title: string) => {
  await expect(page).toHaveTitle(title);
});
