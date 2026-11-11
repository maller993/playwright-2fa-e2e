import { Locator, Page, expect } from '@playwright/test';

export class LoginPage {
  private readonly email: Locator;
  private readonly password: Locator;
  private readonly submit: Locator;
  private readonly error: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectError(message: string | RegExp) {
    await expect(this.error).toContainText(message);
  }

  async expectVisible() {
    await expect(this.page).toHaveURL('/');
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }
}
