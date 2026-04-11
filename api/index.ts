/**
 * Centralized API layer for N-Pricing.
 *
 * Domain-specific modules wrapping all Supabase calls with:
 *  - Full TypeScript typing
 *  - Consistent error handling via safeSupabaseCall
 *  - snake_case DB ↔ camelCase TS mapping
 *
 * Usage:
 *   import { deals, marketData, config, audit } from '../api';
 *   const allDeals = await deals.listDeals();
 *   await audit.logAudit({ ... });
 */

export * as deals from './deals';
export * as marketData from './marketData';
export * as config from './config';
export * as audit from './audit';
export * as notifications from './notifications';
export * as entities from './entities';
export * as reportSchedules from './reportSchedules';

export * as observability from './observability';

// Re-export mappers for consumers that need direct access
export * as mappers from './mappers';
