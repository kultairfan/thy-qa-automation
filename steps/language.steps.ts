import { expect } from '@playwright/test';
import { When, Then } from './fixtures';

When('I change the site language to {string}', async ({ homePage }, language: string) => {
  await homePage.changeLanguage(language);
});

Then('the language selector should show {string}', async ({ homePage }, text: string) => {
  await expect(homePage.languageButton).toHaveText(text);
});
