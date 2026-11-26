import { Then } from './fixtures';
import { expect } from '@playwright/test';

// Verify that the destination <select> contains all expected cities.
Then('the destination list should contain {string}', async ({ homePage }, expectedList) => {
  // expectedList is a comma‑separated string of city names
  const expected = expectedList.split(/\s*,\s*/).filter(Boolean);
  const options = homePage.destination.locator('option');
  const count = await options.count();
  const actual: string[] = [];
  for (let i = 0; i < count; ++i) {
    const text = await options.nth(i).textContent();
    actual.push(text?.trim() ?? '');
  }
  for (const city of expected) {
    await expect(actual).toContain(city);
  }
});

// Verify which city is selected by default in the destination <select>.
Then('the default selected destination should be {string}', async ({ homePage }, expected) => {
  const selected = homePage.destination.locator('option:checked');
  await expect(selected).toHaveText(expected);
});