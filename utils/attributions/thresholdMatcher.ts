/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A).
 *
 * Threshold matching: dado un quote y un set de thresholds, decide cuáles
 * aplican y cuál(es) aceptan los criterios.
 *
 * Sin I/O. Sin DB. Lógica pura para que router y simulator la consuman
 * tanto en server (server/routes/attributions.ts) como en cliente (UI
 * simulator del Approval Cockpit).
 */

import type {
  AttributionScope,
  AttributionThreshold,
} from '../../types/attributions';

// ---------------------------------------------------------------------------
// Scope matching
// ---------------------------------------------------------------------------

/**
 * Un threshold con `scope = {}` aplica universalmente. Si el threshold
 * declara criterios, el scope del deal debe satisfacerlos todos.
 *
 * Para arrays (product, segment, currency): el scope del deal debe estar
 * incluido. Para tenorMaxMonths: el plazo del deal debe ser ≤ máximo.
 */
export function scopeMatches(
  dealScope: AttributionScope,
  thresholdScope: AttributionScope,
): boolean {
  // product
  if (Array.isArray(thresholdScope.product) && thresholdScope.product.length > 0) {
    const dealProducts = arrayOrEmpty(dealScope.product);
    if (!dealProducts.some((p) => thresholdScope.product!.includes(p))) {
      return false;
    }
  }

  // segment
  if (Array.isArray(thresholdScope.segment) && thresholdScope.segment.length > 0) {
    const dealSegments = arrayOrEmpty(dealScope.segment);
    if (!dealSegments.some((s) => thresholdScope.segment!.includes(s))) {
      return false;
    }
  }

  // currency
  if (Array.isArray(thresholdScope.currency) && thresholdScope.currency.length > 0) {
    const dealCurrencies = arrayOrEmpty(dealScope.currency);
    if (!dealCurrencies.some((c) => thresholdScope.currency!.includes(c))) {
      return false;
    }
  }

  // tenorMaxMonths — el deal debe estar dentro del plazo máximo del threshold
  if (typeof thresholdScope.tenorMaxMonths === 'number') {
    const dealTenor = typeof dealScope.tenorMaxMonths === 'number'
      ? dealScope.tenorMaxMonths
      : null;
    if (dealTenor === null || dealTenor > thresholdScope.tenorMaxMonths) {
      return false;
    }
  }

  return true;
}

function arrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

// ---------------------------------------------------------------------------
// Time-window filtering
// ---------------------------------------------------------------------------

/**
 * El threshold está vigente si `isActive=true` y `asOfDate` está entre
 * `activeFrom` y `activeTo` (inclusive). `activeTo=null` significa "sin
 * caducidad".
 */
export function isThresholdVigent(
  threshold: AttributionThreshold,
  asOfDate: string,
): boolean {
  if (!threshold.isActive) return false;
  if (asOfDate < threshold.activeFrom) return false;
  if (threshold.activeTo !== null && asOfDate > threshold.activeTo) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Threshold acceptance
// ---------------------------------------------------------------------------

export interface QuoteCriteria {
  deviationBps: number;   // desviación negativa = peor para el banco; positiva = mejor
  rarocPp: number;
  volumeEur: number;
}

/**
 * Un threshold acepta el quote si:
 *  - deviationBps no excede `deviationBpsMax` (en valor absoluto sobre el lado
 *    desfavorable: una desviación de -8 bps requiere `deviationBpsMax >= 8`).
 *  - rarocPp es ≥ `rarocPpMin`.
 *  - volumeEur es ≤ `volumeEurMax`.
 *
 * Cada criterio NULL en el threshold se ignora (sin restricción).
 */
export function thresholdAccepts(
  threshold: AttributionThreshold,
  criteria: QuoteCriteria,
): boolean {
  // deviationBpsMax: lo modelamos como "máximo descuento aceptable".
  // deviationBps en el quote es signed; el threshold compara contra el valor
  // absoluto del lado desfavorable (negativo = el cliente paga menos del estándar).
  if (threshold.deviationBpsMax !== null) {
    const unfavorableBps = Math.max(0, -criteria.deviationBps);
    if (unfavorableBps > threshold.deviationBpsMax) return false;
  }

  if (threshold.rarocPpMin !== null) {
    if (criteria.rarocPp < threshold.rarocPpMin) return false;
  }

  if (threshold.volumeEurMax !== null) {
    if (criteria.volumeEur > threshold.volumeEurMax) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Finder
// ---------------------------------------------------------------------------

/**
 * Filtra thresholds que aplican a este deal: scope match + vigentes en
 * `asOfDate`. NO evalúa aceptación de criterios — eso lo hace
 * `thresholdAccepts` por separado.
 */
export function findApplicableThresholds(
  thresholds: AttributionThreshold[],
  dealScope: AttributionScope,
  asOfDate: string,
): AttributionThreshold[] {
  return thresholds.filter(
    (t) => isThresholdVigent(t, asOfDate) && scopeMatches(dealScope, t.scope),
  );
}

/**
 * Cuántos thresholds de un nivel aceptan el quote. Usado por el router
 * para decidir si un nivel puede aprobar (al menos uno acepta).
 */
export function levelAcceptsQuote(
  thresholds: AttributionThreshold[],
  levelId: string,
  criteria: QuoteCriteria,
): boolean {
  return thresholds.some(
    (t) => t.levelId === levelId && thresholdAccepts(t, criteria),
  );
}
