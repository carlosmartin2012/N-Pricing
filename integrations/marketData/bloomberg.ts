import { fail, type MarketDataAdapter, type MarketYieldCurveSnapshot, type AdapterHealth, type AdapterResult } from '../types';

/**
 * Bloomberg / BLPAPI market data adapter — STUB.
 *
 * The real implementation needs:
 *   - Bloomberg B-PIPE or HAPI subscription (BLPAPI / DAPI)
 *   - Per-curve ticker mapping (e.g. EUR swap → 'EUSWE Curncy' constituents)
 *   - Reference data calls for last_price + history for as-of-date queries
 *   - License compliance (data redistribution rules)
 *
 * Refinitiv equivalent lives next to this file when needed.
 */

export interface BloombergConfig {
  appName: string;
  serverHost?: string;        // default 'localhost' for B-PIPE
  serverPort?: number;        // default 8194
  curveTickers: Record<string, string[]>;   // currency → array of tickers
}

export class BloombergMarketDataAdapter implements MarketDataAdapter {
  readonly kind = 'market_data' as const;
  readonly name = 'bloomberg';
  private readonly config: BloombergConfig;

  constructor(config: BloombergConfig) {
    if (!config.appName) throw new Error('BloombergMarketDataAdapter requires appName');
    this.config = config;
  }

  async health(): Promise<AdapterHealth> {
    return {
      ok: false,
      message: `stub adapter — pending real BLPAPI session for ${this.config.appName}`,
      checkedAt: new Date().toISOString(),
    };
  }

  async fetchYieldCurve(currency: string): Promise<AdapterResult<MarketYieldCurveSnapshot>> {
    const tickers = this.config.curveTickers[currency];
    if (!tickers?.length) {
      return fail('not_found', `no curve tickers configured for ${currency}`);
    }
    return fail('unreachable', 'bloomberg adapter is a stub; provide BLPAPI credentials');
  }

  async fetchFxRate(_base: string, _quote: string): Promise<AdapterResult<number>> {
    return fail('unreachable', 'bloomberg adapter is a stub');
  }
}
