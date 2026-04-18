import type { EntityUser } from '../../../types/entity';

// Shared types + pure helpers for the EntityOnboarding drawer. Kept in
// their own module so the step components can import them without pulling
// in the rest of the orchestrator (which depends on Drawer, React Query
// hooks, and the entities API client).

export interface BasicInfo {
  name: string;
  legalName: string;
  shortCode: string;
  country: string;
  baseCurrency: string;
}

export interface ConfigState {
  autoApproval: string;
  l1: string;
  l2: string;
  timezone: string;
}

export interface AssignedUser {
  userId: string; // stores user.email per upsertEntityUser API
  role: EntityUser['role'];
  isPrimary: boolean;
}

export const STEP_KEYS = ['basicInfo', 'configuration', 'assignUsers', 'reviewCreate'] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const COUNTRY_OPTIONS = [
  { value: 'ES', label: 'Spain (ES)' },
  { value: 'PT', label: 'Portugal (PT)' },
  { value: 'UK', label: 'United Kingdom (UK)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'FR', label: 'France (FR)' },
  { value: 'IT', label: 'Italy (IT)' },
  { value: 'US', label: 'United States (US)' },
];

export const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

export const TIMEZONE_OPTIONS = [
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET/WEST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
  { value: 'UTC', label: 'UTC' },
];

export const ROLE_OPTIONS: EntityUser['role'][] = ['Admin', 'Trader', 'Risk_Manager', 'Auditor'];

export const INITIAL_BASIC: BasicInfo = {
  name: '',
  legalName: '',
  shortCode: '',
  country: 'ES',
  baseCurrency: 'EUR',
};

export const INITIAL_CONFIG: ConfigState = {
  autoApproval: '500000',
  l1: '2000000',
  l2: '10000000',
  timezone: 'Europe/Madrid',
};

// ── Pure validators ────────────────────────────────────────────────────────
// Exported so unit tests can exercise the rules without rendering the UI.
// Each returns the first error message encountered, or null when valid.

export function validateBasicInfo(basicInfo: BasicInfo): string | null {
  if (!basicInfo.name.trim()) return 'Entity name is required.';
  if (!basicInfo.shortCode.trim()) return 'Short code is required.';
  if (basicInfo.shortCode.length > 6) return 'Short code must be 6 characters or fewer.';
  if (!/^[A-Z0-9]+$/.test(basicInfo.shortCode)) {
    return 'Short code must be uppercase alphanumeric (A–Z, 0–9).';
  }
  return null;
}

export function validateConfiguration(config: ConfigState): string | null {
  const auto = Number(config.autoApproval);
  const l1 = Number(config.l1);
  const l2 = Number(config.l2);
  if (!Number.isFinite(auto) || !Number.isFinite(l1) || !Number.isFinite(l2)) {
    return 'Approval thresholds must be valid numbers.';
  }
  if (auto <= 0 || l1 <= 0 || l2 <= 0) return 'All approval thresholds must be positive.';
  if (auto >= l1) return 'Auto-approval threshold must be less than L1.';
  if (l1 >= l2) return 'L1 threshold must be less than L2.';
  return null;
}

// Normalises user-entered short codes to the on-wire shape: uppercase,
// max 6 chars. Centralised so the form input and validation agree on
// what "short code" means.
export function normaliseShortCode(value: string): string {
  return value.toUpperCase().slice(0, 6);
}
