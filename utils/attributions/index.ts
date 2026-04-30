/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A) barrel export.
 *
 * Importar desde aquí para no acoplar a la estructura interna de los módulos:
 *
 *   import { routeApproval, simulate, quoteFromFtpResult } from '@/utils/attributions';
 */

export {
  scopeMatches,
  isThresholdVigent,
  thresholdAccepts,
  findApplicableThresholds,
  levelAcceptsQuote,
  type QuoteCriteria,
} from './thresholdMatcher';

export {
  sortLevelsAscending,
  findRoot,
  buildApprovalChain,
  findChildren,
  findDescendants,
} from './chainBuilder';

export {
  quoteFromFtpResult,
  routeApproval,
  type RouteApprovalOptions,
} from './attributionRouter';

export {
  applyAdjustments,
  simulate,
} from './attributionSimulator';
