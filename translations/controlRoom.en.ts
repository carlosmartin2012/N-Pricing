/**
 * Control Room translation pack — English.
 *
 * Extracted from `translations.ts` on 2026-05-20 — largest single domain
 * (33 keys per locale) and entry surface for every user landing into
 * `/control-room` after login. All keys carry the `controlRoom*` prefix
 * so dispersion in the monolith was zero; pure mechanical move.
 */
export const controlRoomEn = {
  controlRoomToday: 'Today',
  controlRoomDecisions: 'Decision queue',
  controlRoomActionQueue: 'Action queue',
  controlRoomActionQueueSub: 'Approvals and review items',
  controlRoomExposure: 'Exposure',
  controlRoomExposureSub: 'Current deal book',
  controlRoomDataFreshness: 'Stale feeds',
  controlRoomDataFreshnessSub: 'Market sources older than 24h',
  controlRoomExceptions: 'Exceptions',
  controlRoomExceptionsSub: 'Rejected or blocked deals',
  controlRoomOpenBlotter: 'Open blotter',
  controlRoomNoActionsTitle: 'Inbox at zero',
  controlRoomNoActionsCta: 'Start new deal',
  controlRoomNoActions: 'No deal requires immediate action.',
  controlRoomRecommended: 'Recommended next',
  controlRoomMarketReadiness: 'Market readiness',
  controlRoomActiveSources: 'Active sources',
  controlRoomYieldCurvePoints: 'Yield curve points',
  controlRoomLiquidityCurves: 'Liquidity curves',
  controlRoomDossiers: 'Signed dossiers',
  controlRoomOperationalSignals: 'Operational signals',
  controlRoomPendingApprovals: 'Pending approvals',
  controlRoomOverdueApprovals: 'Overdue approvals',
  controlRoomMethodologyChanges: 'Methodology changes',
  controlRoomSyncState: 'Sync state',
  controlRoomStressPricing: 'Stress pricing',
  controlRoomDiscipline: 'Pricing discipline',
  controlRoomApprovals: 'Approvals',
  controlRoomMarketData: 'Market data',
  controlRoomMethodology: 'Methodology',
  controlRoomHealth: 'System health',
  controlRoomNewQuote: 'New quote',
  controlRoomPipeline: 'Pipeline',
};

export type ControlRoomTranslationKeys = typeof controlRoomEn;
