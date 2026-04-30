/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A) types.
 *
 * Migration: supabase/migrations/20260620000001_attributions.sql
 *
 * Modela "delegated authority by hierarchy" como árbol N-ario:
 *   - AttributionLevel       → nodo del árbol (Oficina/Zona/Territorial/Comité)
 *   - AttributionThreshold   → umbral por nivel × scope (jsonb)
 *   - AttributionDecision    → decisión inmutable, hash chain a pricing_snapshots
 *
 * Coexiste con el `delegationTier` plano de FTPResult (5 tiers fijos):
 * el legacy se queda como fast-path; este modelo es la evolución flexible
 * que cada tenant configura según su organigrama (BBVA con 5+ niveles,
 * BM con 3-4, bancos pequeños con 2-3).
 *
 * Ver `docs/ola-8-atribuciones-banca-march.md` §1 para diseño completo.
 */

// ---------------------------------------------------------------------------
// attribution_levels
// ---------------------------------------------------------------------------

/**
 * Nodo del árbol N-ario de niveles organizativos. `parentId` NULL = nivel raíz
 * (típicamente Oficina). `levelOrder` permite saltos jerárquicos: un Director
 * con `levelOrder=1` puede aprobar directamente sin pasar por Zona en ciertos
 * productos si tiene threshold aplicable.
 */
export interface AttributionLevel {
  id: string;
  entityId: string;
  name: string;
  parentId: string | null;
  levelOrder: number;
  rbacRole: string;
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// attribution_thresholds
// ---------------------------------------------------------------------------

/**
 * Scope describe el universo de operaciones al que aplica un threshold.
 * Vacío `{}` significa "aplica a todas". El matcher selecciona thresholds
 * cuyo scope es subconjunto del scope del deal.
 */
export interface AttributionScope {
  product?: string[];           // ["loan","mortgage","line_of_credit"]
  segment?: string[];
  currency?: string[];
  tenorMaxMonths?: number;
  /** Extensible — el matcher usa los criterios definidos arriba; el resto
   * queda como metadata para reporting. */
  [key: string]: unknown;
}

/**
 * Umbral por (nivel × scope). Al menos uno de `deviationBpsMax`,
 * `rarocPpMin` o `volumeEurMax` debe estar definido (constraint en DB).
 *
 * Semántica:
 *  - deviationBpsMax: máx. desviación negativa (en bps) sobre precio estándar
 *    que el nivel puede aprobar. Una desviación de -8 bps requiere nivel con
 *    deviationBpsMax >= 8.
 *  - rarocPpMin: RAROC mínimo (en puntos porcentuales) que el nivel acepta.
 *  - volumeEurMax: volumen máximo en EUR aprobable.
 */
export interface AttributionThreshold {
  id: string;
  entityId: string;
  levelId: string;
  scope: AttributionScope;
  deviationBpsMax: number | null;
  rarocPpMin: number | null;
  volumeEurMax: number | null;
  activeFrom: string;            // YYYY-MM-DD
  activeTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// attribution_decisions
// ---------------------------------------------------------------------------

export type AttributionDecisionStatus =
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'expired'
  | 'reverted';

/**
 * Metadata serializada con la decisión: refleja el routing context al
 * momento del decide. Crítico para reproducibilidad regulatoria.
 */
export interface AttributionRoutingMetadata {
  deviationBps: number;
  rarocPp: number;
  volumeEur: number;
  scope: AttributionScope;
  /** Cualquier dato adicional relevante (tags, free-form). */
  extra?: Record<string, unknown>;
}

/**
 * Decisión inmutable. `pricingSnapshotHash` es FK lógica a
 * `pricing_snapshots.hash` validada por trigger en INSERT.
 *
 * Para anular se inserta una nueva con `decision='reverted'` (nunca UPDATE).
 */
export interface AttributionDecision {
  id: string;
  entityId: string;
  dealId: string;
  requiredLevelId: string;
  decidedByLevelId: string | null;
  decidedByUser: string | null;
  decision: AttributionDecisionStatus;
  reason: string | null;
  pricingSnapshotHash: string;
  routingMetadata: AttributionRoutingMetadata;
  decidedAt: string;
}

// ---------------------------------------------------------------------------
// Routing & Simulation domain
// ---------------------------------------------------------------------------

/**
 * Razón por la que un quote requiere cierto nivel. Útil para UX
 * ("Necesita Zona porque RAROC 11.5% < 12% mínimo").
 */
export type RoutingReason =
  | 'within_threshold'        // todos los criterios pasan en el nivel mínimo
  | 'deviation_exceeded'      // desviación supera todos los thresholds menores
  | 'raroc_below_min'         // RAROC bajo el mínimo de niveles inferiores
  | 'volume_exceeded'         // volumen supera capacidad de niveles inferiores
  | 'no_applicable_threshold' // ningún threshold aplica al scope ⇒ comité
  | 'below_hard_floor';       // precio bajo hard floor regulatorio ⇒ rechazo

/**
 * Quote mínimo que el routing necesita. Diseñado para ser construible desde
 * `FTPResult` (motor existente) sin duplicación: ver `quoteFromFtpResult`
 * en `utils/attributions/attributionRouter.ts`.
 */
export interface AttributionQuote {
  /** Precio final propuesto al cliente, en bps. */
  finalClientRateBps: number;
  /** Precio estándar (target) en bps — referencia para la desviación. */
  standardRateBps: number;
  /** Hard floor regulatorio (capital + LCR + NSFR + opex), en bps. */
  hardFloorRateBps: number;
  /** RAROC en puntos porcentuales (12.4 = 12.4%). */
  rarocPp: number;
  /** Volumen del deal en EUR. */
  volumeEur: number;
  /** Scope del deal para matching. */
  scope: AttributionScope;
}

/**
 * Resultado del routing: nivel mínimo requerido + cadena de aprobación
 * desde la base hasta required (útil para UX que muestra el árbol).
 */
export interface RoutingResult {
  requiredLevel: AttributionLevel;
  /** Cadena bottom-up: oficina → zona → ... → required. */
  approvalChain: AttributionLevel[];
  reason: RoutingReason;
  metadata: AttributionRoutingMetadata;
  /** True cuando el quote viola el hard floor; el routing devuelve el comité
   *  pero la UI debe deshabilitar la aprobación. */
  belowHardFloor: boolean;
}

/**
 * Input al simulador: quote actual + ajustes propuestos por el comercial.
 */
export interface SimulationInput {
  quote: AttributionQuote;
  /** Ajustes propuestos. Negativos para "bajar X". */
  proposedAdjustments: {
    /** Delta sobre `finalClientRateBps` (e.g. -5 = bajar 5 bps). */
    deviationBpsDelta?: number;
    /** Volumen extra de venta cruzada esperada (EUR) — afecta RAROC vía
     *  cross-bonus si el motor lo soporta downstream. */
    crossSellEur?: number;
    /** Delta de plazo en meses. Re-evalúa scope.tenorMaxMonths matching. */
    tenorMonthsDelta?: number;
    /** Override de RAROC (cuando el comercial ya recalculó externamente). */
    rarocPpOverride?: number;
  };
}

/**
 * Resultado de la simulación: quote ajustado + nuevo routing + diff legible
 * para UX ("ahorras 3 días, no escala a Zona").
 */
export interface SimulationResult {
  adjustedQuote: AttributionQuote;
  newRouting: RoutingResult;
  diffVsOriginal: {
    deviationBps: number;
    rarocPp: number;
    requiredLevelChanged: boolean;
    /** Niveles que ya NO necesitan aprobar (desplazado hacia abajo). */
    levelsAvoided: AttributionLevel[];
  };
}

// ---------------------------------------------------------------------------
// Aggregates (matrix snapshot consumida por UI y router)
// ---------------------------------------------------------------------------

/**
 * Matriz completa de un tenant: árbol + thresholds activos. La construye
 * el server desde DB; el router puro la consume sin tocar DB.
 */
export interface AttributionMatrix {
  entityId: string;
  levels: AttributionLevel[];          // sólo active=true
  thresholds: AttributionThreshold[];  // sólo isActive=true en fecha vigente
  /** Snapshot del momento de carga; útil para caché de cliente. */
  loadedAt: string;
}
