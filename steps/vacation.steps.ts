import { When, Then } from './fixtures';

When('I click the destination of the week link', async ({ vacationPage }) => {
  await vacationPage.clickDestinationLink();
});

Then('I should see an image of the destination', async ({ vacationPage }) => {
  await vacationPage.verifyDestinationImageVisible();
});
