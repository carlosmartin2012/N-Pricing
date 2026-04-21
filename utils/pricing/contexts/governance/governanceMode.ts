/**
 * Governance mode flag — part of the governance bounded context.
 *
 * Reads VITE_GOVERNANCE_MODE once per call. Kept pure (no module-level
 * caching) so tests can mutate import.meta.env between cases.
 */

export type GovernanceMode = 'RAROC' | 'EVA';

export const getGovernanceMode = (): GovernanceMode => {
  const raw = String(import.meta.env?.VITE_GOVERNANCE_MODE ?? 'EVA').toUpperCase();
  return raw === 'RAROC' ? 'RAROC' : 'EVA';
};
