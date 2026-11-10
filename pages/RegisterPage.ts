import { expect, type Locator, type Page } from '@playwright/test';

export class RegisterPage {
  readonly registerButton: Locator;

  constructor(readonly page: Page) {
    this.registerButton = page.getByRole('button', { name: 'Register' });
  }

  async open() {
    await this.page.goto('/register');
    await expect(this.registerButton).toBeVisible();
  }

  field(name: string): Locator {
    const safe = name.replace(/"/g, '\\"');
    return this.page
      .getByLabel(name, { exact: false })
      .or(this.page.locator(`[name="${safe}" i]`))
      .or(this.page.locator(`[id="${safe}" i]`))
      .first();
  }
}
