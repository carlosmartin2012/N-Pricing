import type { GeneralRule, RuleVersion } from '../../types';
import { mapRuleFromDB, mapRuleToDB, mapRuleVersionFromDB } from './mappers';
import { apiGet, apiPost, apiDelete } from '../apiFetch';
import { log } from './shared';

export const ruleService = {
  async fetchRules(): Promise<GeneralRule[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/config/rules');
      return rows.map(mapRuleFromDB);
    } catch (err) {
      log.error('Error fetching rules', { error: String(err) });
      return [];
    }
  },

  async saveRule(rule: GeneralRule) {
    try {
      await apiPost('/config/rules', mapRuleToDB(rule));
    } catch (err) {
      log.error('Error saving rule', { error: String(err) });
    }
  },

  async deleteRule(id: number) {
    try {
      await apiDelete(`/config/rules/${id}`);
    } catch (err) {
      log.error('Error deleting rule', { error: String(err) });
    }
  },

  async fetchRuleVersions(ruleId: number): Promise<RuleVersion[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>(`/config/rules/${ruleId}/versions`);
      return rows.map(mapRuleVersionFromDB);
    } catch {
      return [];
    }
  },

  async createRuleVersion(ruleId: number, ruleData: Partial<GeneralRule>, changedBy: string, changeReason: string): Promise<void> {
    try {
      await apiPost(`/config/rules/${ruleId}/versions`, { ...ruleData, changedBy, changeReason });
    } catch (err) {
      log.warn('createRuleVersion failed', { error: String(err) });
    }
  },
};
