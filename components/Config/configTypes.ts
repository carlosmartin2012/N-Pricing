import type { UserProfile } from '../../types';

export type MethodologyConfigMode = 'METHODOLOGY' | 'SYS_CONFIG' | 'ALL';

export type MethodologyTabId =
  | 'GENERAL'
  | 'ESG'
  | 'GOVERNANCE'
  | 'MASTER'
  | 'RATE_CARDS'
  | 'SCHEDULES';

export type ConfigUser = UserProfile | null;
