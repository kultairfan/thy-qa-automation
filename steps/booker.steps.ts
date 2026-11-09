import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import type { BookerField, TripType } from '../pages/HomePage';

When('I select the {string} trip type', async ({ homePage }, type: string) => {
  await homePage.selectTripType(type as TripType);
});

When('I type {string} into the {string} field', async ({ homePage }, text: string, field: string) => {
  await homePage.typeIntoField(field as BookerField, text);
});

Then('the airport suggestions should include {string}', async ({ homePage }, text: string) => {
  await expect(homePage.suggestionList).toBeVisible();
  await expect(homePage.suggestions.filter({ hasText: text }).first()).toBeVisible();
});

Then('the flight search form should be visible', async ({ homePage }) => {
  await expect(homePage.originInput).toBeVisible();
  await expect(homePage.destinationInput).toBeVisible();
  await expect(homePage.dateToggle).toBeVisible();
});

Then('the {string} field label should be {string}', async ({ homePage }, field: string, label: string) => {
  await expect(homePage.field(field as BookerField)).toHaveAttribute('aria-label', label);
});
