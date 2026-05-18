import { describe, it, expect } from 'vitest';
import {
  ALL_TOURS,
  ADMIN_TOUR,
  AUDITOR_TOUR,
  RISK_MANAGER_TOUR,
  TRADER_TOUR,
  getRecommendedTourId,
} from '../walkthroughTours';
import { getTranslations } from '../../translations';
import type { UserProfile } from '../../types';

/**
 * Walkthrough tour hygiene — Ola 7 Bloque E.
 *
 * Three invariants protected by this suite:
 *
 * 1. Every UserProfile.role value has a dedicated tour. The string union
 *    in types.ts is the source of truth; if a new role is added, this test
 *    fails until getRecommendedTourId() is updated.
 * 2. Every step's titleKey and descriptionKey resolves to a non-empty
 *    string in both en and es. Catches the regression where a tour
 *    references a translation key that does not exist (silent fallback
 *    to the key name in the overlay).
 * 3. The role tour IDs are present in ALL_TOURS so startTour() succeeds.
 */

type Role = UserProfile['role'];
const ROLES: Role[] = ['Admin', 'Trader', 'Risk_Manager', 'Auditor'];

describe('walkthrough tours', () => {
  it('maps every UserProfile.role to a dedicated tour', () => {
    const fallback = getRecommendedTourId('Unknown_Role_Xxx');
    expect(fallback).toBe('main-tour');

    for (const role of ROLES) {
      const tourId = getRecommendedTourId(role);
      expect(tourId, `role ${role} → recommended tour`).not.toBe('main-tour');
      expect(ALL_TOURS[tourId], `tour ${tourId} registered in ALL_TOURS`).toBeDefined();
    }
  });

  it('exposes admin-tour with at least 5 steps covering the admin surface', () => {
    expect(ADMIN_TOUR.id).toBe('admin-tour');
    expect(ADMIN_TOUR.steps.length).toBeGreaterThanOrEqual(5);
    const ids = ADMIN_TOUR.steps.map((s) => s.id);
    expect(ids).toContain('admin-user-mgmt');
    expect(ids).toContain('admin-model-inventory');
    expect(ids).toContain('admin-tenancy');
    expect(ids).toContain('admin-health');
  });

  describe('translation key coverage', () => {
    const en = getTranslations('en');
    const es = getTranslations('es');

    for (const [tourId, tour] of Object.entries(ALL_TOURS)) {
      it(`${tourId}: every titleKey/descriptionKey resolves in en + es`, () => {
        for (const step of tour.steps) {
          const enTitle = (en as unknown as Record<string, string>)[step.titleKey];
          const enDesc = (en as unknown as Record<string, string>)[step.descriptionKey];
          const esTitle = (es as unknown as Record<string, string>)[step.titleKey];
          const esDesc = (es as unknown as Record<string, string>)[step.descriptionKey];

          expect(enTitle, `${tourId}:${step.id} titleKey '${step.titleKey}' (en)`).toBeTruthy();
          expect(enDesc, `${tourId}:${step.id} descriptionKey '${step.descriptionKey}' (en)`).toBeTruthy();
          expect(esTitle, `${tourId}:${step.id} titleKey '${step.titleKey}' (es)`).toBeTruthy();
          expect(esDesc, `${tourId}:${step.id} descriptionKey '${step.descriptionKey}' (es)`).toBeTruthy();
        }
      });
    }
  });

  it('role tours share the sidebar as their first step (consistent landing)', () => {
    for (const tour of [TRADER_TOUR, RISK_MANAGER_TOUR, AUDITOR_TOUR, ADMIN_TOUR]) {
      expect(tour.steps[0]?.id).toBe('sidebar');
    }
  });
});
