import {
  fail,
  ok,
  type AdmissionAdapter,
  type AdmissionContext,
  type AdmissionDecisionPush,
  type AdmissionReconciliationItem,
  type AdapterHealth,
  type AdapterResult,
} from '../types';

/**
 * PUZZLE adapter — STUB (Ola 9 Bloque A).
 *
 * PUZZLE es el sistema de admisión de riesgos de Banca March. La
 * implementación real necesita:
 *   - Endpoint base + credenciales OAuth client_credentials (o lo que IT
 *     BM defina). El workshop S10 del plan Ola 9 cierra estas specs.
 *   - HTTP layer con retry exponencial + circuit breaker (probar la
 *     librería `p-retry` ya en deps + envolver en try/catch que mapea
 *     a AdapterError códigos `unreachable` / `auth` / `rate_limited`).
 *   - File-drop overnight: SFTP / S3 según contrato. El método
 *     `pullReconciliation` hoy devuelve `not_found` (stub explicit) —
 *     la implementación real parsea el fichero diario de decisiones
 *     bookadas vs lo que enviamos.
 *
 * Este archivo existe para que (a) el resto del sistema compile, (b)
 * los tests integration registren un adapter concreto y (c) el code
 * review del workshop con BM tenga la superficie pública estable
 * antes de tocar HTTP.
 */

export interface PuzzleConfig {
  /** Base URL del endpoint PUZZLE (e.g. https://puzzle.bancamarch.es). */
  baseUrl: string;
  /** OAuth client id provisto por IT BM. */
  clientId: string;
  /** OAuth client secret. */
  clientSecret: string;
  /** Token endpoint (default `${baseUrl}/oauth/token`). */
  tokenUrl?: string;
  /** Override del path para push (default `/api/decisions`). */
  decisionsPath?: string;
  /** Override del path para context fetch (default `/api/contexts`). */
  contextsPath?: string;
  /** SFTP / S3 location del file-drop overnight; null si solo API. */
  reconciliationDrop?: {
    transport: 'sftp' | 's3';
    location: string;        // e.g. 'sftp://puzzle-recon.bancamarch.es/incoming/' o 's3://bucket/path/'
  };
  /** Timeout HTTP en ms (default 10_000). */
  httpTimeoutMs?: number;
}

export class PuzzleAdmissionAdapter implements AdmissionAdapter {
  readonly kind = 'admission' as const;
  readonly name = 'puzzle-bm';

  private readonly config: PuzzleConfig;

  constructor(config: PuzzleConfig) {
    this.config = config;
    if (!config.baseUrl || !config.clientId || !config.clientSecret) {
      throw new Error('PuzzleAdmissionAdapter requires baseUrl + clientId + clientSecret');
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

  async pushPricingDecision(
    decision: AdmissionDecisionPush,
  ): Promise<AdapterResult<{ externalId: string | null }>> {
    // Real impl: POST ${baseUrl}${decisionsPath} con body = decision +
    // dedup header `x-idempotency-key: ${decision.dealId}-${decision.pricingSnapshotHash}`.
    // Devuelve { externalId } cuando PUZZLE crea su registro.
    return fail(
      'unreachable',
      `puzzle-bm adapter is a stub; would push deal ${decision.dealId} (${decision.decision})`,
    );
  }

  async fetchAdmissionContext(
    _dealId: string,
  ): Promise<AdapterResult<AdmissionContext | null>> {
    // Real impl: GET ${baseUrl}${contextsPath}/${dealId}.
    // Devuelve `ok(null)` cuando PUZZLE no encuentra el deal — distingue
    // de `unreachable` (network down) o `auth` (token expired).
    return ok(null);
  }

  async pullReconciliation(
    _asOfDate: string,
  ): Promise<AdapterResult<AdmissionReconciliationItem[]>> {
    // Real impl: si reconciliationDrop está definido, abre conexión
    // SFTP/S3 al path con sufijo de fecha y parsea el csv. Si no, hace
    // GET ${baseUrl}/api/reconciliation?as_of=${asOfDate}.
    return ok([]);
  }
}
