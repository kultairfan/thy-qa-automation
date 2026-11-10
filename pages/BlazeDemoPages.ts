import { expect, type Locator, type Page } from '@playwright/test';

/** blazedemo.com - public demo flight booking site built for test automation. */

export class HomePage {
  readonly departure: Locator;
  readonly destination: Locator;
  readonly findFlights: Locator;

  constructor(readonly page: Page) {
    this.departure = page.locator('select[name="fromPort"]');
    this.destination = page.locator('select[name="toPort"]');
    this.findFlights = page.getByRole('button', { name: 'Find Flights' });
  }

  async open() {
    await this.page.goto('/');
    await expect(this.findFlights).toBeVisible();
  }

  async search(from: string, to: string) {
    await this.departure.selectOption(from);
    await this.destination.selectOption(to);
    await this.findFlights.click();
  }
}

export class ReservePage {
  readonly heading: Locator;
  readonly rows: Locator;
  readonly chooseButtons: Locator;

  constructor(readonly page: Page) {
    this.heading = page.locator('h3');
    this.rows = page.locator('table tbody tr');
    this.chooseButtons = page.getByRole('button', { name: 'Choose This Flight' });
  }

  async chooseFlight(index: number) {
    await this.chooseButtons.nth(index).click();
  }
}

export class PurchasePage {
  readonly summary: Locator;

  constructor(readonly page: Page) {
    this.summary = page.locator('.container').filter({ hasText: 'Total Cost' }).first();
  }

  // Purchase form fields have fixed ids. Any other form (login, register, ...) is found by its label, name or id,
  // so the step "I fill the {string} field with {string}" works on every form of the site.
  field(name: string): Locator {
    const ids: Record<string, string> = {
      name: 'inputName',
      address: 'address',
      city: 'city',
      state: 'state',
      'zip code': 'zipCode',
      'name on card': 'nameOnCard',
    };
    const id = ids[name.toLowerCase()];
    if (id) return this.page.locator(`#${id}`);
    const safe = name.replace(/"/g, '\\"');
    return this.page
      .getByLabel(name, { exact: false })
      .or(this.page.locator(`[name="${safe}" i]`))
      .or(this.page.locator(`[id="${safe}" i]`))
      .first();
  }

  async purchase() {
    await this.page.getByRole('button', { name: 'Purchase Flight' }).click();
  }
}

export class ConfirmationPage {
  readonly heading: Locator;

  constructor(readonly page: Page) {
    this.heading = page.locator('h1');
  }

  row(label: string): Locator {
    return this.page.locator('table tr').filter({ has: this.page.locator('td', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) });
  }
}
