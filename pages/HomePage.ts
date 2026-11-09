import { expect, type Locator, type Page } from '@playwright/test';

export type BookerField = 'origin' | 'destination';
export type TripType = 'round-trip' | 'one-way';

/**
 * turkishairlines.com home page: flight booker + language selector.
 * Selectors were taken from the live site (Nov 2026). Prefer ids / roles,
 * because CSS-module class names (hm__..._xxxx) change on every deploy.
 */
export class HomePage {
  readonly page: Page;
  readonly originInput: Locator;
  readonly destinationInput: Locator;
  readonly suggestionList: Locator;
  readonly suggestions: Locator;
  readonly dateToggle: Locator;
  readonly languageButton: Locator;
  readonly applyLanguageButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.originInput = page.locator('#fromPort');
    this.destinationInput = page.locator('#toPort');
    this.suggestionList = page.locator('#bookerInputList');
    this.suggestions = this.suggestionList.getByRole('option');
    this.dateToggle = page.getByTestId('booker-date-toggle');
    this.languageButton = page.locator('#languageCountry');
    this.applyLanguageButton = page.locator('#changePreferences');
  }

  async open(localePath = 'tr-tr') {
    await this.page.goto(`/${localePath}/`, { waitUntil: 'domcontentloaded' });
    await this.dismissCookieBanner();
    await expect(this.originInput, 'Flight booker did not load. The site may be blocking automated browsers.').toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Closes the cookie banner if it shows up. Prefers rejecting optional cookies.
   * If the banner is not found the test simply continues.
   */
  async dismissCookieBanner() {
    const candidates = [
      this.page.getByRole('button', { name: /tümünü reddet|reddet|reject all|reject/i }),
      this.page.getByRole('button', { name: /yalnızca gerekli|sadece gerekli|only necessary|necessary only/i }),
    ];
    for (const button of candidates) {
      const visible = await button
        .first()
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (visible) {
        await button.first().click();
        return;
      }
    }
  }

  field(name: BookerField): Locator {
    return name === 'origin' ? this.originInput : this.destinationInput;
  }

  async selectTripType(type: TripType) {
    await this.page.locator(`#${type}`).click();
  }

  async typeIntoField(name: BookerField, text: string) {
    const input = this.field(name);
    await input.click();
    await input.fill('');
    // Type like a user so the autocomplete is triggered.
    await input.pressSequentially(text, { delay: 120 });
  }

  async changeLanguage(language: string) {
    await this.languageButton.click();
    // Second dropdown in the preferences panel is the language picker (first one is country).
    await this.page.locator('[class*="LangCountryDropdown_dropdownToggle"]').nth(1).click();
    await this.page.getByRole('button', { name: language, exact: true }).first().click();
    await this.applyLanguageButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }
}
