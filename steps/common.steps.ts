import { expect } from '@playwright/test';
import { Given, Then } from './fixtures';

Given('I open the Turkish Airlines home page', async ({ homePage }) => {
  await homePage.open('tr-tr');
});

Given('I open the Turkish Airlines home page in {string}', async ({ homePage }, localePath: string) => {
  await homePage.open(localePath);
});

Then('the page URL should contain {string}', async ({ page }, part: string) => {
  await expect(page).toHaveURL(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

Then('the page language should be {string}', async ({ page }, lang: string) => {
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
});
