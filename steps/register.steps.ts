import { Given, When } from './fixtures';

Given('I open the BlazeDemo register page', async ({ registerPage }) => {
  await registerPage.open();
});

When('I fill the register field {string} with {string}', async ({ registerPage }, field: string, value: string) => {
  await registerPage.field(field).fill(value);
});
