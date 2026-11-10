import { Then } from './fixtures';

Then('each row should display {string}', async ({ flightResultsPage }, detail: string) => {
  await flightResultsPage.verifyColumnDisplayed(detail);
});
