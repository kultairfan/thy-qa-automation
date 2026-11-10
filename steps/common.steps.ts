import { Then } from './fixtures';

Then('I should see the text {string}', async ({ commonPage }, text: string) => {
  await commonPage.verifyTextVisible(text);
});
