import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { Mailpit } from './helpers/mailpit';
import { DashboardPage } from './pages/dashboard.page';
import { LoginPage } from './pages/login.page';
import { VerifyPage } from './pages/verify.page';

interface Fixtures {
  user: { email: string; password: string };
  mailpit: Mailpit;
  loginPage: LoginPage;
  verifyPage: VerifyPage;
  dashboardPage: DashboardPage;
}

export const test = base.extend<Fixtures>({
  // Un usuario (email) único por test: aísla los buzones y permite correr en paralelo.
  user: async ({}, use) => {
    await use({ email: `qa-${randomUUID().slice(0, 8)}@demo.test`, password: 'Passw0rd!' });
  },
  mailpit: async ({ request }, use) => {
    await use(new Mailpit(request));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  verifyPage: async ({ page }, use) => {
    await use(new VerifyPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect };
