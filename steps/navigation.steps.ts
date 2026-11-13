import { When } from './fixtures';

When('I click the {string} link', async ({ headerPage }, linkText: string) => {
  await headerPage.clickLink(linkText);
});
