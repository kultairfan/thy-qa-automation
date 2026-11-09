import { test as base, createBdd } from 'playwright-bdd';
import { HomePage } from '../pages/HomePage';

type Fixtures = {
  homePage: HomePage;
};

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
});

export const { Given, When, Then } = createBdd(test);
