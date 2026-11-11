import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async expectLoggedInAs(email: string) {
    await expect(this.page).toHaveURL(/dashboard/);
    await expect(this.page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    await expect(this.page.getByText(`Signed in as ${email}`)).toBeVisible();
  }

  async logout() {
    await this.page.getByRole('button', { name: 'Log out' }).click();
  }
}
