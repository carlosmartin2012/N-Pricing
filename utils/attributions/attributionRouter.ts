/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A).
 *
 * Servicio principal de routing: dado un quote y la matriz de un tenant,
 * determina el nivel mínimo que tiene atribución para aprobar y la cadena
 * de aprobación correspondiente.
 *
 * Pure: no I/O. Mismo motor corre cliente (simulator) y server (router).
 *
 * Algoritmo:
 *  1) Si `finalClientRateBps < hardFloorRateBps` ⇒ violación regulatoria,
 *     el routing devuelve la raíz del comité y `belowHardFloor=true`. La
 *     UX deshabilita la aprobación.
 *  2) Calcula `deviationBps = finalClientRateBps - standardRateBps`
 *     (positivo = el cliente paga más; negativo = descuento que hay que
 *     justificar con atribución).
 *  3) Filtra thresholds aplicables al `scope` del deal (matcher) y vigentes
 *     en `asOfDate`.
 *  4) Recorre niveles ascendente por `levelOrder`. El primer nivel que
 *     tiene al menos un threshold que acepta los criterios del quote es
 *     el nivel mínimo requerido.
 *  5) Si ningún nivel acepta ⇒ escala al comité (último nivel del árbol).
 */

import type { FTPResult } from '../../types';
import type {
  AttributionLevel,
  AttributionMatrix,
  AttributionQuote,
  AttributionRoutingMetadata,
  AttributionScope,
  RoutingReason,
  RoutingResult,
} from '../../types/attributions';
import { buildApprovalChain, sortLevelsAscending } from './chainBuilder';
import {
  findApplicableThresholds,
  levelAcceptsQuote,
  thresholdAccepts,
  type QuoteCriteria,
} from './thresholdMatcher';

// ---------------------------------------------------------------------------
// Quote construction
// ---------------------------------------------------------------------------

/**
 * Construye un AttributionQuote desde un FTPResult del motor existente.
 * Convierte rates (decimal) a bps (multiplicando por 10000) para que toda
 * la lógica de atribuciones razone en una sola unidad.
 *
 * `ftp.targetPrice` es el precio estándar comercial (mínimo + margen). Si
 * no estuviera disponible, se cae al `floorPrice` (precio mínimo regulatorio
 * — más conservador, peor UX, pero seguro).
 */
export function quoteFromFtpResult(
  ftp: FTPResult,
  scope: AttributionScope,
  volumeEur: number,
): AttributionQuote {
  const standardRateBps = (ftp.targetPrice ?? ftp.floorPrice) * 10000;
  return {
    finalClientRateBps: ftp.finalClientRate * 10000,
    standardRateBps,
    hardFloorRateBps: ftp.floorPrice * 10000,
    rarocPp: ftp.raroc * 100, // raroc viene como ratio (0.124 = 12.4%) → pp
    volumeEur,
    scope,
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export interface RouteApprovalOptions {
  /** Fecha contra la que se evalúa la vigencia de thresholds. Default = hoy. */
  asOfDate?: string;
  /** Override para tests deterministas. */
  now?: () => Date;
}

/**
 * Servicio principal: dado un quote + matriz del tenant, devuelve el nivel
 * mínimo requerido. Nunca lanza — siempre devuelve un RoutingResult válido
 * (incluso para matriz vacía, devolviendo nivel raíz disponible).
 */
export function routeApproval(
  quote: AttributionQuote,
  matrix: AttributionMatrix,
  options: RouteApprovalOptions = {},
): RoutingResult {
  const today = options.asOfDate ?? toIsoDate(options.now?.() ?? new Date());

  const sortedLevels = sortLevelsAscending(matrix.levels);
  const deviationBps = quote.finalClientRateBps - quote.standardRateBps;
  const criteria: QuoteCriteria = {
    deviationBps,
    rarocPp: quote.rarocPp,
    volumeEur: quote.volumeEur,
  };
  const metadata: AttributionRoutingMetadata = {
    deviationBps,
    rarocPp: quote.rarocPp,
    volumeEur: quote.volumeEur,
    scope: quote.scope,
  };

  // 1) Hard floor regulatorio — escalar a comité y marcar belowHardFloor.
  if (quote.finalClientRateBps < quote.hardFloorRateBps) {
    const top = highestLevel(sortedLevels);
    if (!top) {
      throw new Error('routeApproval: matriz vacía, no se puede enrutar');
    }
    return {
      requiredLevel: top,
      approvalChain: buildApprovalChain(top.id, matrix.levels),
      reason: 'below_hard_floor',
      metadata,
      belowHardFloor: true,
    };
  }

  // 2) Filtrar thresholds aplicables al scope + vigentes.
  const applicable = findApplicableThresholds(matrix.thresholds, quote.scope, today);

  if (applicable.length === 0) {
    // Ningún threshold aplica al scope → comité.
    const top = highestLevel(sortedLevels);
    if (!top) {
      throw new Error('routeApproval: matriz vacía, no se puede enrutar');
    }
    return {
      requiredLevel: top,
      approvalChain: buildApprovalChain(top.id, matrix.levels),
      reason: 'no_applicable_threshold',
      metadata,
      belowHardFloor: false,
    };
  }

  // 3) Recorrer niveles ascendente — primer nivel que acepta es el mínimo.
  for (const level of sortedLevels) {
    if (levelAcceptsQuote(applicable, level.id, criteria)) {
      return {
        requiredLevel: level,
        approvalChain: buildApprovalChain(level.id, matrix.levels),
        reason: 'within_threshold',
        metadata,
        belowHardFloor: false,
      };
    }
  }

  // 4) Ningún nivel acepta — diagnóstico de la razón principal.
  const top = highestLevel(sortedLevels);
  if (!top) {
    throw new Error('routeApproval: matriz vacía, no se puede enrutar');
  }
  return {
    requiredLevel: top,
    approvalChain: buildApprovalChain(top.id, matrix.levels),
    reason: diagnoseFailure(applicable, criteria),
    metadata,
    belowHardFloor: false,
  };
}

/**
 * Diagnóstico de por qué ningún nivel aceptó: revisa qué criterio falla
 * más frecuentemente para reportar el motivo dominante.
 */
function diagnoseFailure(
  applicable: ReturnType<typeof findApplicableThresholds>,
  criteria: QuoteCriteria,
): RoutingReason {
  let deviationFails = 0;
  let rarocFails = 0;
  let volumeFails = 0;

  for (const t of applicable) {
    if (
      t.deviationBpsMax !== null &&
      Math.max(0, -criteria.deviationBps) > t.deviationBpsMax
    ) {
      deviationFails++;
    }
    if (t.rarocPpMin !== null && criteria.rarocPp < t.rarocPpMin) {
      rarocFails++;
    }
    if (t.volumeEurMax !== null && criteria.volumeEur > t.volumeEurMax) {
      volumeFails++;
    }
  }

  // El criterio que falla en más thresholds es el dominante.
  const max = Math.max(deviationFails, rarocFails, volumeFails);
  if (max === 0) return 'no_applicable_threshold';
  if (deviationFails === max) return 'deviation_exceeded';
  if (rarocFails === max) return 'raroc_below_min';
  return 'volume_exceeded';
}

function highestLevel(sortedAsc: AttributionLevel[]): AttributionLevel | null {
  return sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1] : null;
}

function toIsoDate(d: Date): string {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Re-export helpers
// ---------------------------------------------------------------------------

export { thresholdAccepts };
