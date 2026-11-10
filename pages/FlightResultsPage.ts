import { expect, type Locator, type Page } from '@playwright/test';

export class FlightResultsPage {
  readonly rows: Locator;

  constructor(readonly page: Page) {
    this.rows = page.locator('table tbody tr');
  }

  async verifyColumnDisplayed(columnName: string) {
    const count = await this.rows.count();
    expect(count).toBeGreaterThan(0);

    const columnIndexMap: Record<string, number> = {
      'flight number': 1,
      'airline': 2,
      'departure time': 3,
      'arrival time': 4,
      'price': 5,
    };

    const index = columnIndexMap[columnName.toLowerCase()];
    if (index === undefined) {
      throw new Error(`Unknown column: ${columnName}`);
    }

    for (let i = 0; i < count; i++) {
      const cell = this.rows.nth(i).locator('td').nth(index);
      await expect(cell).toHaveText(/\S+/);
    }
  }
}
