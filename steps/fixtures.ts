import { test as base, createBdd } from 'playwright-bdd';
import { ConfirmationPage, HomePage, PurchasePage, ReservePage } from '../pages/BlazeDemoPages';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { FlightResultsPage } from '../pages/FlightResultsPage';
import { CommonPage } from '../pages/CommonPage';
import { VacationPage } from '../pages/VacationPage';
import { HeaderPage } from '../pages/HeaderPage';

type Fixtures = {
  homePage: HomePage;
  reservePage: ReservePage;
  purchasePage: PurchasePage;
  confirmationPage: ConfirmationPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  flightResultsPage: FlightResultsPage;
  commonPage: CommonPage;
  vacationPage: VacationPage;
  headerPage: HeaderPage;
};

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => use(new HomePage(page)),
  reservePage: async ({ page }, use) => use(new ReservePage(page)),
  purchasePage: async ({ page }, use) => use(new PurchasePage(page)),
  confirmationPage: async ({ page }, use) => use(new ConfirmationPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  flightResultsPage: async ({ page }, use) => use(new FlightResultsPage(page)),
  commonPage: async ({ page }, use) => use(new CommonPage(page)),
  vacationPage: async ({ page }, use) => use(new VacationPage(page)),
  headerPage: async ({ page }, use) => use(new HeaderPage(page)),
});

export const { Given, When, Then } = createBdd(test);
