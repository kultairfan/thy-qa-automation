import { test as base, createBdd } from 'playwright-bdd';
import { ConfirmationPage, HomePage, PurchasePage, ReservePage } from '../pages/BlazeDemoPages';

type Fixtures = {
  homePage: HomePage;
  reservePage: ReservePage;
  purchasePage: PurchasePage;
  confirmationPage: ConfirmationPage;
};

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => use(new HomePage(page)),
  reservePage: async ({ page }, use) => use(new ReservePage(page)),
  purchasePage: async ({ page }, use) => use(new PurchasePage(page)),
  confirmationPage: async ({ page }, use) => use(new ConfirmationPage(page)),
});

export const { Given, When, Then } = createBdd(test);
