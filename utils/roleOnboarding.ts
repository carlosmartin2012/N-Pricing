import type { UserRole } from './dealWorkflow';

/**
 * Maps a user role to the role-specific onboarding tour id (Ola 7
 * Bloque E). Returns null when the role has no dedicated tour — the
 * caller should fall back to the generic main-tour or skip auto-start.
 *
 * Tour ids match the keys in ALL_TOURS in
 * `constants/walkthroughTours.ts`. Kept as a separate module so it can
 * be unit-tested without dragging the entire walkthrough provider tree
 * into the test runner.
 */
export function tourIdForRole(role: UserRole | string | null | undefined): string | null {
  switch (role) {
    case 'Trader':       return 'trader-tour';
    case 'Risk_Manager': return 'risk-manager-tour';
    case 'Auditor':      return 'auditor-tour';
    case 'Admin':        return 'main-tour'; // Admins get the broad overview
    default:             return null;
  }
}
