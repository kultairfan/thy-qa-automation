import { type Locator, type Page } from '@playwright/test';

export class HeaderPage {
  constructor(readonly page: Page) {}

  link(name: string): Locator {
    return this.page.getByRole('link', { name });
  }

  async clickLink(name: string) {
    await this.link(name).click();
  }
}
