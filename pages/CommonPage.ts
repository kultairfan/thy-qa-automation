import { expect, type Page } from '@playwright/test';

export class CommonPage {
  constructor(readonly page: Page) {}

  async verifyTextVisible(text: string) {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
