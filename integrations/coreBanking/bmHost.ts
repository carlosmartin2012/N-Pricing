import {
  fail,
  ok,
  type CoreBankingAdapter,
  type CoreBankingDeal,
  type CoreBankingBookedRow,
  type AdapterHealth,
  type AdapterResult,
} from '../types';

/**
 * BM HOST mainframe adapter — STUB (Ola 9 Bloque B).
 *
 * Patrón típico de un mainframe IBM: NO hay API real-time confiable;
 * la integración funciona via SFTP file-drop nightly + reconciliación
 * batch al día siguiente.
 *
 * Implementación real:
 *   - SFTP client con credenciales rotativas (ssh-key + passphrase
 *     vault-managed). Usar `ssh2-sftp-client` (deps a añadir cuando
 *     IT BM cierre el contrato).
 *   - Parser de fichero columnar fijo (record length 256 bytes,
 *     EBCDIC codificado en algunos casos). El layout exacto es
 *     parte del workshop S10 con IT BM.
 *   - upsertBookedDeal probablemente NO es feasible — el mainframe
 *     solo acepta entradas via batch del front-office, no via API.
 *     El método queda como `fail('not_found')` con mensaje
 *     explicativo (mismo patrón que stubs read-only).
 *   - pullBookedRows lee el drop del día asOfDate desde SFTP, parsea
 *     y devuelve las filas. Re-leer el mismo as_of es seguro (idempotente).
 *
 * Este archivo existe para que el sistema compile y el workshop con
 * IT BM tenga superficie pública estable antes de tocar el wire.
 */

export interface BmHostConfig {
  /** SFTP host (e.g. host-recon.bancamarch.es). */
  sftpHost: string;
  sftpPort?: number;             // default 22
  sftpUser: string;
  sftpPrivateKeyPem: string;     // PEM contents; nunca path en disco fuera de prod
  sftpPassphrase?: string;
  /** Directorio remoto donde el mainframe deja el drop diario. */
  dropDirectory: string;         // e.g. '/incoming/pricing-recon'
  /** Plantilla del nombre de fichero. Soporta `{YYYY}{MM}{DD}`. Default `pricing-recon-{YYYY}{MM}{DD}.dat`. */
  filenameTemplate?: string;
  /** Si la entidad usa codificación EBCDIC en lugar de UTF-8. */
  encoding?: 'utf-8' | 'ebcdic';
  /** Timeout SFTP en ms (default 30_000). */
  sftpTimeoutMs?: number;
}

export class BmHostCoreBanking implements CoreBankingAdapter {
  readonly kind = 'core_banking' as const;
  readonly name = 'bm-host-mainframe';

  private readonly config: BmHostConfig;

  constructor(config: BmHostConfig) {
    this.config = config;
    if (!config.sftpHost || !config.sftpUser || !config.sftpPrivateKeyPem) {
      throw new Error('BmHostCoreBanking requires sftpHost + sftpUser + sftpPrivateKeyPem');
    }
    if (!config.dropDirectory) {
      throw new Error('BmHostCoreBanking requires dropDirectory');
    }
  }

  async health(): Promise<AdapterHealth> {
    // Real impl: abre conexión SFTP, lista el directorio, comprueba
    // que el drop del día (o del último día hábil) existe y tiene
    // tamaño > 0.
    return {
      ok: false,
      message: `stub adapter — pending real SFTP impl against ${this.config.sftpHost}${this.config.dropDirectory}`,
      checkedAt: new Date().toISOString(),
    };
  }

  async fetchActiveDeals(_clientId: string): Promise<AdapterResult<CoreBankingDeal[]>> {
    // Mainframe HOST no expone API real-time → no podemos servir esto.
    return fail(
      'not_found',
      'bm-host-mainframe is a batch-only adapter; live deal fetch is not supported. Use the in-memory reference adapter for dev or implement a separate API channel for live fetches.',
    );
  }

  async upsertBookedDeal(_deal: CoreBankingDeal): Promise<AdapterResult<{ externalId: string }>> {
    // El mainframe no acepta upserts via integration layer — los
    // deals se bookan por el flujo del front-office. El stub
    // devuelve unreachable para que el caller no asuma que escribir
    // funciona.
    return fail(
      'unreachable',
      'bm-host-mainframe does not accept upsert from N-Pricing — deals are booked via the front-office batch.',
    );
  }

  async pullBookedRows(_asOfDate: string): Promise<AdapterResult<CoreBankingBookedRow[]>> {
    // Real impl: SFTP connect → read file at dropDirectory/${filename}
    // → parse columnar layout → map a CoreBankingBookedRow[].
    return ok([]);
  }
}
