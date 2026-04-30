/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A).
 *
 * Simulador: aplica ajustes propuestos al quote y devuelve el nuevo
 * routing + diff legible para UX ("ahorras 3 días, no escala a Zona").
 *
 * Es el corazón del Approval Cockpit: el comercial mueve sliders
 * (margen, V.Cruzada, plazo) y ve EN TIEMPO REAL quién tiene atribución
 * sobre el resultado simulado.
 *
 * Pure: no I/O. Reutiliza `routeApproval` para el routing.
 */

import type {
  AttributionLevel,
  AttributionMatrix,
  AttributionQuote,
  SimulationInput,
  SimulationResult,
} from '../../types/attributions';
import { routeApproval, type RouteApprovalOptions } from './attributionRouter';

/**
 * Aplica los ajustes propuestos al quote. Cada ajuste es opcional; los no
 * provistos no modifican el campo correspondiente.
 *
 * Importante: esta función NO recalcula RAROC ni FTP — sólo aplica los
 * ajustes que el comercial propone. Si el ajuste implica recalcular el
 * motor (e.g. plazo afecta capital charge), el caller debe haber pasado
 * `rarocPpOverride` con el resultado del recálculo. Esto mantiene el
 * simulator desacoplado del motor.
 */
export function applyAdjustments(
  quote: AttributionQuote,
  adjustments: SimulationInput['proposedAdjustments'],
): AttributionQuote {
  const next: AttributionQuote = {
    ...quote,
    scope: { ...quote.scope },
  };

  if (typeof adjustments.deviationBpsDelta === 'number') {
    next.finalClientRateBps = quote.finalClientRateBps + adjustments.deviationBpsDelta;
  }

  if (typeof adjustments.rarocPpOverride === 'number') {
    next.rarocPp = adjustments.rarocPpOverride;
  }

  if (typeof adjustments.tenorMonthsDelta === 'number') {
    const currentTenor = typeof quote.scope.tenorMaxMonths === 'number'
      ? quote.scope.tenorMaxMonths
      : 0;
    next.scope.tenorMaxMonths = Math.max(0, currentTenor + adjustments.tenorMonthsDelta);
  }

  // crossSellEur no afecta directamente al quote — el motor downstream lo
  // traduce a RAROC vía cross-bonus. Si el caller no pasa rarocPpOverride,
  // este ajuste queda como pista para reporting (extra metadata).

  return next;
}

/**
 * Simula el efecto de unos ajustes sobre el routing. Devuelve quote
 * ajustado + nuevo routing + diff (qué niveles ya no necesitan aprobar).
 */
export function simulate(
  input: SimulationInput,
  matrix: AttributionMatrix,
  options: RouteApprovalOptions = {},
): SimulationResult {
  const adjustedQuote = applyAdjustments(input.quote, input.proposedAdjustments);
  const originalRouting = routeApproval(input.quote, matrix, options);
  const newRouting = routeApproval(adjustedQuote, matrix, options);

  const requiredLevelChanged =
    originalRouting.requiredLevel.id !== newRouting.requiredLevel.id;

  // Niveles que estaban en la cadena original y ya NO aparecen en la nueva.
  const newChainIds = new Set(newRouting.approvalChain.map((l) => l.id));
  const levelsAvoided: AttributionLevel[] = originalRouting.approvalChain.filter(
    (l) => !newChainIds.has(l.id),
  );

  return {
    adjustedQuote,
    newRouting,
    diffVsOriginal: {
      deviationBps: newRouting.metadata.deviationBps - originalRouting.metadata.deviationBps,
      rarocPp: newRouting.metadata.rarocPp - originalRouting.metadata.rarocPp,
      requiredLevelChanged,
      levelsAvoided,
    },
  };
}
