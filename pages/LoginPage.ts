import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(readonly page: Page) {
    this.emailInput = page.getByLabel('E-Mail Address');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }

  async open() {
    await this.page.goto('/login');
    await expect(this.loginButton).toBeVisible();
  }
}
