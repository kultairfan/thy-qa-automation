import { expect, type Locator, type Page } from '@playwright/test';

export class VacationPage {
  readonly destinationLink: Locator;
  readonly destinationImage: Locator;

  constructor(readonly page: Page) {
    this.destinationLink = page.getByRole('link', { name: /destination of the week/i });
    this.destinationImage = page.locator('img').first();
  }

  async clickDestinationLink() {
    await this.destinationLink.click();
  }

  async verifyDestinationImageVisible() {
    await expect(this.destinationImage).toBeVisible();
  }
}
