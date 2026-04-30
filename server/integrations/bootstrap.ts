import { adapterRegistry } from '../../integrations/registry';
import {
  InMemoryCoreBanking, InMemoryCrm, InMemoryMarketData, InMemoryAdmission, InMemoryBudgetSource,
} from '../../integrations/inMemory';
import { SalesforceCrmAdapter } from '../../integrations/crm/salesforce';
import { BloombergMarketDataAdapter } from '../../integrations/marketData/bloomberg';
import { PuzzleAdmissionAdapter } from '../../integrations/admission/puzzle';
import { BmHostCoreBanking } from '../../integrations/coreBanking/bmHost';
import { AlquidBudgetSourceAdapter } from '../../integrations/budget/alquid';

/**
 * Wires the adapter registry at server boot. Lives in the server layer
 * (not in `integrations/`) because it decides *which* concrete adapter
 * goes live for each kind — that's deployment configuration, not a
 * property of the adapter library itself.
 *
 * Selection rule per kind: env var `ADAPTER_<KIND>=<name>` picks a named
 * adapter (currently 'in-memory' | 'salesforce' | 'bloomberg'). Falls back
 * to the reference in-memory adapter so a fresh `npm run dev` or a fresh
 * container exposes useful data out of the box without any external
 * credentials. Production deploys that forget to set these vars get the
 * in-memory impl — harmless but visibly not the real thing from the
 * integrations dashboard.
 */
export function bootstrapAdapters(): void {
  // Core banking: in-memory ref por defecto. Ola 9 Bloque B añade el
  // adapter BM HOST mainframe (file-drop SFTP) — opt-in via
  // ADAPTER_CORE_BANKING=bm-host + BM_HOST_SFTP_HOST/USER/PRIVATE_KEY.
  const cbKind = (process.env.ADAPTER_CORE_BANKING ?? 'in-memory').toLowerCase();
  if (cbKind === 'bm-host') {
    const sftpHost = process.env.BM_HOST_SFTP_HOST;
    const sftpUser = process.env.BM_HOST_SFTP_USER;
    const sftpPrivateKeyPem = process.env.BM_HOST_SFTP_PRIVATE_KEY_PEM;
    const dropDirectory = process.env.BM_HOST_DROP_DIRECTORY ?? '/incoming/pricing-recon';
    if (sftpHost && sftpUser && sftpPrivateKeyPem) {
      adapterRegistry.register(new BmHostCoreBanking({
        sftpHost,
        sftpUser,
        sftpPrivateKeyPem,
        dropDirectory,
        sftpPort:         process.env.BM_HOST_SFTP_PORT ? Number(process.env.BM_HOST_SFTP_PORT) : undefined,
        sftpPassphrase:   process.env.BM_HOST_SFTP_PASSPHRASE,
        filenameTemplate: process.env.BM_HOST_FILENAME_TEMPLATE,
        encoding:         process.env.BM_HOST_ENCODING === 'ebcdic' ? 'ebcdic' : 'utf-8',
      }));
    } else {
      console.warn('[adapters] ADAPTER_CORE_BANKING=bm-host but BM_HOST_SFTP_HOST/USER/PRIVATE_KEY missing — falling back to in-memory');
      adapterRegistry.register(new InMemoryCoreBanking());
    }
  } else {
    adapterRegistry.register(new InMemoryCoreBanking());
  }

  // CRM
  const crmKind = (process.env.ADAPTER_CRM ?? 'in-memory').toLowerCase();
  if (crmKind === 'salesforce') {
    const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    if (instanceUrl && clientId && clientSecret) {
      adapterRegistry.register(new SalesforceCrmAdapter({
        instanceUrl,
        clientId,
        clientSecret,
        username: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD,
        privateKeyPem: process.env.SALESFORCE_PRIVATE_KEY_PEM,
      }));
    } else {
      console.warn('[adapters] ADAPTER_CRM=salesforce but SALESFORCE_INSTANCE_URL/CLIENT_ID/CLIENT_SECRET missing — falling back to in-memory');
      adapterRegistry.register(new InMemoryCrm());
    }
  } else {
    adapterRegistry.register(new InMemoryCrm());
  }

  // Market data
  const marketKind = (process.env.ADAPTER_MARKET_DATA ?? 'in-memory').toLowerCase();
  if (marketKind === 'bloomberg') {
    const appName = process.env.BLOOMBERG_APP_NAME;
    if (appName) {
      const tickersRaw = process.env.BLOOMBERG_CURVE_TICKERS;
      let curveTickers: Record<string, string[]> = {};
      if (tickersRaw && tickersRaw.trim().length > 0) {
        // Distinguir "string vacío/whitespace" (intencional, mapa vacío)
        // de "JSON corrupto" (operator error, debe alertar). En la
        // versión previa el catch silenciaba ambos casos y el motor
        // arrancaba con curveTickers={} sin pista del problema.
        try {
          const parsed = JSON.parse(tickersRaw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            curveTickers = parsed as Record<string, string[]>;
          } else {
            const reason = `BLOOMBERG_CURVE_TICKERS must be a JSON object {currency: [tickers]}, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`;
            if (process.env.NODE_ENV === 'production' && process.env.PRICING_ALLOW_MOCKS !== 'true') {
              throw new Error(`[adapters] ${reason}`);
            }
            console.error(`[adapters] ${reason} — using empty curve tickers map`);
          }
        } catch (parseErr) {
          const reason = `BLOOMBERG_CURVE_TICKERS is not valid JSON: ${(parseErr as Error).message}`;
          if (process.env.NODE_ENV === 'production' && process.env.PRICING_ALLOW_MOCKS !== 'true') {
            throw new Error(`[adapters] ${reason}`, { cause: parseErr });
          }
          console.error(`[adapters] ${reason} — using empty curve tickers map`);
        }
      }
      adapterRegistry.register(new BloombergMarketDataAdapter({
        appName,
        serverHost: process.env.BLOOMBERG_SERVER_HOST,
        serverPort: process.env.BLOOMBERG_SERVER_PORT ? Number(process.env.BLOOMBERG_SERVER_PORT) : undefined,
        curveTickers,
      }));
    } else {
      console.warn('[adapters] ADAPTER_MARKET_DATA=bloomberg but BLOOMBERG_APP_NAME missing — falling back to in-memory');
      adapterRegistry.register(new InMemoryMarketData());
    }
  } else {
    adapterRegistry.register(new InMemoryMarketData());
  }

  // Admission (Ola 9 Bloque A) — PUZZLE for Banca March, in-memory for dev.
  // Falls back to in-memory when ADAPTER_ADMISSION is unset or 'in-memory'.
  const admissionKind = (process.env.ADAPTER_ADMISSION ?? 'in-memory').toLowerCase();
  if (admissionKind === 'puzzle') {
    const baseUrl = process.env.PUZZLE_BASE_URL;
    const clientId = process.env.PUZZLE_CLIENT_ID;
    const clientSecret = process.env.PUZZLE_CLIENT_SECRET;
    if (baseUrl && clientId && clientSecret) {
      adapterRegistry.register(new PuzzleAdmissionAdapter({
        baseUrl,
        clientId,
        clientSecret,
        tokenUrl:        process.env.PUZZLE_TOKEN_URL,
        decisionsPath:   process.env.PUZZLE_DECISIONS_PATH,
        contextsPath:    process.env.PUZZLE_CONTEXTS_PATH,
      }));
    } else {
      console.warn('[adapters] ADAPTER_ADMISSION=puzzle but PUZZLE_BASE_URL/CLIENT_ID/CLIENT_SECRET missing — falling back to in-memory');
      adapterRegistry.register(new InMemoryAdmission());
    }
  } else {
    adapterRegistry.register(new InMemoryAdmission());
  }

  // Budget source (Ola 9 Bloque C) — ALQUID for Banca March, in-memory dev.
  const budgetKind = (process.env.ADAPTER_BUDGET ?? 'in-memory').toLowerCase();
  if (budgetKind === 'alquid') {
    const baseUrl = process.env.ALQUID_BASE_URL;
    const clientId = process.env.ALQUID_CLIENT_ID;
    const clientSecret = process.env.ALQUID_CLIENT_SECRET;
    if (baseUrl && clientId && clientSecret) {
      adapterRegistry.register(new AlquidBudgetSourceAdapter({
        baseUrl,
        clientId,
        clientSecret,
        tokenUrl:         process.env.ALQUID_TOKEN_URL,
        assumptionsPath:  process.env.ALQUID_ASSUMPTIONS_PATH,
      }));
    } else {
      console.warn('[adapters] ADAPTER_BUDGET=alquid but ALQUID_BASE_URL/CLIENT_ID/CLIENT_SECRET missing — falling back to in-memory');
      adapterRegistry.register(new InMemoryBudgetSource());
    }
  } else {
    adapterRegistry.register(new InMemoryBudgetSource());
  }
}
