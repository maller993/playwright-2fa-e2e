import { request } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

// Falla rápido y con un mensaje claro si el buzón no está levantado,
// en lugar de dejar que cada test falle con un timeout confuso.
export default async function globalSetup() {
  const ctx = await request.newContext();
  try {
    const res = await ctx.get(`${MAILPIT_URL}/api/v1/info`);
    if (!res.ok()) throw new Error(`respondió ${res.status()}`);
  } catch (error) {
    throw new Error(
      `Mailpit no responde en ${MAILPIT_URL} (${(error as Error).message}).\n` +
        `¿Lo levantaste? Ejecutá: npm run mail:up`
    );
  } finally {
    await ctx.dispose();
  }
}
