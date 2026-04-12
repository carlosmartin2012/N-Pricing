export type MarketDataProvider = 'bloomberg' | 'refinitiv' | 'ecb' | 'bde' | 'custom';
export type FeedFrequency = 'realtime' | 'intraday' | 'eod' | 'manual';
export type FeedStatus = 'active' | 'paused' | 'error' | 'disconnected';

export interface MarketDataFeed {
  id: string;
  entityId: string;
  provider: MarketDataProvider;
  name: string;
  description: string;
  frequency: FeedFrequency;
  status: FeedStatus;
  config: MarketDataFeedConfig;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface MarketDataFeedConfig {
  /** API endpoint or connection string */
  endpoint?: string;
  /** API key reference (stored in env, not in config) */
  apiKeyRef?: string;
  /** Instruments/tickers to subscribe to */
  instruments: string[];
  /** Currency pairs for FX rates */
  currencies: string[];
  /** Yield curve tenors to fetch */
  tenors: string[];
  /** Mapping from provider field names to internal field names */
  fieldMapping?: Record<string, string>;
  /** Retry configuration */
  retryAttempts?: number;
  retryDelayMs?: number;
}

/** Pre-configured feed templates for common providers */
export const FEED_TEMPLATES: Record<MarketDataProvider, Omit<MarketDataFeed, 'id' | 'entityId' | 'lastSyncAt' | 'lastError' | 'createdAt'>> = {
  bloomberg: {
    provider: 'bloomberg',
    name: 'Bloomberg B-PIPE',
    description: 'Real-time market data via Bloomberg B-PIPE terminal feed',
    frequency: 'realtime',
    status: 'disconnected',
    isActive: false,
    config: {
      instruments: ['ESTR Index', 'SOFR Index', 'EUR003M Index', 'USD003M Index'],
      currencies: ['EUR', 'USD', 'GBP', 'CHF'],
      tenors: ['ON', '1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'],
      retryAttempts: 3,
      retryDelayMs: 5000,
    },
  },
  refinitiv: {
    provider: 'refinitiv',
    name: 'Refinitiv Eikon',
    description: 'Market data via LSEG Refinitiv Data Platform',
    frequency: 'eod',
    status: 'disconnected',
    isActive: false,
    config: {
      instruments: ['EURIBOR3MD=', 'USDONFSR=', 'EUR=', 'GBP='],
      currencies: ['EUR', 'USD', 'GBP'],
      tenors: ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', '30Y'],
      retryAttempts: 2,
      retryDelayMs: 10000,
    },
  },
  ecb: {
    provider: 'ecb',
    name: 'ECB Statistical Data Warehouse',
    description: 'Official ECB yield curves and reference rates via SDMX API',
    frequency: 'eod',
    status: 'disconnected',
    isActive: false,
    config: {
      endpoint: 'https://data-api.ecb.europa.eu/service/data',
      instruments: ['FM.B.U2.EUR.4F.KR.MRR_FR.LEV', 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y'],
      currencies: ['EUR'],
      tenors: ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'],
    },
  },
  bde: {
    provider: 'bde',
    name: 'Banco de España',
    description: 'BdE market data and reference rates',
    frequency: 'eod',
    status: 'disconnected',
    isActive: false,
    config: {
      endpoint: 'https://www.bde.es/webbe/es/estadisticas',
      instruments: [],
      currencies: ['EUR'],
      tenors: ['1Y', '5Y', '10Y'],
    },
  },
  custom: {
    provider: 'custom',
    name: 'Custom Feed',
    description: 'Custom market data integration via REST API',
    frequency: 'manual',
    status: 'disconnected',
    isActive: false,
    config: {
      instruments: [],
      currencies: [],
      tenors: [],
      retryAttempts: 3,
      retryDelayMs: 5000,
    },
  },
};
