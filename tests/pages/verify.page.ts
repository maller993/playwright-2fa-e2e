import { Locator, Page, expect } from '@playwright/test';

export class VerifyPage {
  private readonly code: Locator;
  private readonly verify: Locator;
  private readonly resendButton: Locator;
  private readonly error: Locator;
  private readonly status: Locator;

  constructor(private readonly page: Page) {
    this.code = page.getByLabel('Verification code');
    this.verify = page.getByRole('button', { name: 'Verify' });
    this.resendButton = page.getByRole('button', { name: 'Resend code' });
    this.error = page.getByRole('alert');
    this.status = page.getByRole('status');
  }

  async expectVisibleFor(email: string) {
    await expect(this.page).toHaveURL(/verify/);
    await expect(this.page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  }

  async submitCode(code: string) {
    await this.code.fill(code);
    await this.verify.click();
  }

  async resend() {
    await this.resendButton.click();
    await expect(this.status).toHaveText('New code sent.');
  }

  async expectError(message: string | RegExp) {
    await expect(this.error).toContainText(message);
  }
}
