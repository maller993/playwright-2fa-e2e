import { APIRequestContext, expect } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface MessageSummary {
  ID: string;
  Subject: string;
  Created: string;
}

export interface Mail {
  subject: string;
  text: string;
}

/**
 * Cliente mínimo de la API de Mailpit.
 * Cada test usa un email único, así que se buscan los mensajes por destinatario
 * en lugar de vaciar el buzón: los tests pueden correr en paralelo sin pisarse.
 */
export class Mailpit {
  constructor(private readonly request: APIRequestContext) {}

  private async summariesTo(address: string): Promise<MessageSummary[]> {
    const res = await this.request.get(`${MAILPIT_URL}/api/v1/search`, {
      params: { query: `to:${address}` },
    });
    expect(res.ok(), 'la búsqueda en Mailpit debería responder 2xx').toBeTruthy();
    const body = await res.json();
    const messages: MessageSummary[] = body.messages ?? [];
    // Más nuevo primero.
    return messages.sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
  }

  /** Espera (con polling, sin sleeps fijos) a que lleguen `nth` emails y devuelve el más reciente. */
  async waitForMail(address: string, nth = 1): Promise<Mail> {
    await expect
      .poll(async () => (await this.summariesTo(address)).length, {
        message: `esperando el email #${nth} para ${address}`,
        timeout: 10_000,
        intervals: [250, 500, 1000],
      })
      .toBeGreaterThanOrEqual(nth);

    const [latest] = await this.summariesTo(address);
    const res = await this.request.get(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
    expect(res.ok(), 'el detalle del mensaje debería responder 2xx').toBeTruthy();
    const detail = await res.json();
    return { subject: latest.Subject, text: detail.Text ?? '' };
  }

  /** Devuelve el código de 6 dígitos del email más reciente. */
  async waitForCode(address: string, nth = 1): Promise<string> {
    const { text } = await this.waitForMail(address, nth);
    const match = text.match(/\b(\d{6})\b/);
    if (!match) throw new Error(`No se encontró un código de 6 dígitos en el email:\n${text}`);
    return match[1];
  }

  /**
   * Verifica que NO llegó ningún email.
   * Probar una ausencia obliga a esperar un tiempo acotado: es la única espera fija
   * de la suite, y está acá, aislada y documentada.
   */
  async expectNoMail(address: string, waitMs = 2_000): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    expect(await this.summariesTo(address)).toHaveLength(0);
  }
}
