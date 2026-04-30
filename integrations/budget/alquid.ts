import {
  ok,
  type BudgetSourceAdapter,
  type BudgetAssumption,
  type AdapterHealth,
  type AdapterResult,
} from '../types';

/**
 * ALQUID adapter — STUB (Ola 9 Bloque C).
 *
 * ALQUID es el módulo de presupuestación + FTP de NFQ. La integración
 * real será siempre un consumidor read-only (N-Pricing nunca escribe a
 * ALQUID).
 *
 * Implementación real:
 *   - HTTP GET ${baseUrl}/api/budget/assumptions?period=...
 *   - OAuth2 client_credentials con scope `budget:read`.
 *   - Cache server-side (5-30 min) — los supuestos cambian sólo cuando
 *     Finanzas cierra una iteración del bottom-up.
 *
 * Fallback aceptable cuando ALQUID no expone API: importar CSV
 * mensualmente vía endpoint dedicado (queda fuera del adapter; es un
 * proceso operativo).
 */

export interface AlquidConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Path de la API. Default `/api/budget/assumptions`. */
  assumptionsPath?: string;
  /** Token endpoint. Default `${baseUrl}/oauth/token`. */
  tokenUrl?: string;
  /** Timeout HTTP en ms (default 10_000). */
  httpTimeoutMs?: number;
}

export class AlquidBudgetSourceAdapter implements BudgetSourceAdapter {
  readonly kind = 'budget' as const;
  readonly name = 'alquid';

  private readonly config: AlquidConfig;

  constructor(config: AlquidConfig) {
    this.config = config;
    if (!config.baseUrl || !config.clientId || !config.clientSecret) {
      throw new Error('AlquidBudgetSourceAdapter requires baseUrl + clientId + clientSecret');
    }
  }

  async health(): Promise<AdapterHealth> {
    // Real impl: HEAD ${baseUrl}/api/health → 200
    return {
      ok: false,
      message: `stub adapter — pending real HTTP impl against ${this.config.baseUrl}`,
      checkedAt: new Date().toISOString(),
    };
  }

  async fetchAssumptions(_period: string): Promise<AdapterResult<BudgetAssumption[]>> {
    // Real impl: GET ${baseUrl}${assumptionsPath}?period=${period} con
    // bearer token. ALQUID devuelve un array de assumptions (segmento
    // × producto × currency) que mapean directamente a BudgetAssumption.
    return ok([]);
  }
}
