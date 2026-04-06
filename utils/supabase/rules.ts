import type { GeneralRule, RuleVersion } from '../../types';
import { mapRuleFromDB, mapRuleToDB, mapRuleVersionFromDB } from './mappers';
import { log, supabase, todayIso } from './shared';

export const ruleService = {
  async fetchRules(): Promise<GeneralRule[]> {
    const { data, error } = await supabase.from('rules').select('*');
    if (error) {
      log.error('Error fetching rules', { code: error.code });
      return [];
    }

    return (data || []).map(mapRuleFromDB);
  },

  async saveRule(rule: GeneralRule) {
    const { error } = await supabase.from('rules').upsert(mapRuleToDB(rule));
    if (error) log.error('Error saving rule', { code: error.code });
  },

  async deleteRule(id: number) {
    const { error } = await supabase.from('rules').delete().eq('id', id);
    if (error) log.error('Error deleting rule', { code: error.code });
  },

  async fetchRuleVersions(ruleId: number): Promise<RuleVersion[]> {
    const { data, error } = await supabase
      .from('rule_versions')
      .select('*')
      .eq('rule_id', ruleId)
      .order('version', { ascending: false });

    if (error) {
      log.error('Error fetching rule versions', { code: error.code });
      return [];
    }

    return (data || []).map(mapRuleVersionFromDB);
  },

  async createRuleVersion(
    ruleId: number,
    ruleData: Partial<GeneralRule>,
    changedBy: string,
    changeReason: string,
  ): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('rule_versions')
        .select('version')
        .eq('rule_id', ruleId)
        .order('version', { ascending: false })
        .limit(1);

      const currentMaxVersion = existing && existing.length > 0 ? existing[0].version : 0;
      const newVersion = currentMaxVersion + 1;
      const today = todayIso();

      if (currentMaxVersion > 0) {
        const { error: updateError } = await supabase
          .from('rule_versions')
          .update({ effective_to: today })
          .eq('rule_id', ruleId)
          .eq('version', currentMaxVersion);

        if (updateError) {
          log.error('Error closing previous rule version', { code: updateError.code });
        }
      }

      const { error: insertError } = await supabase
        .from('rule_versions')
        .insert({
          rule_id: ruleId,
          version: newVersion,
          business_unit: ruleData.businessUnit,
          product: ruleData.product,
          segment: ruleData.segment,
          tenor: ruleData.tenor,
          base_method: ruleData.baseMethod,
          base_reference: ruleData.baseReference,
          spread_method: ruleData.spreadMethod,
          liquidity_reference: ruleData.liquidityReference,
          strategic_spread: ruleData.strategicSpread ?? 0,
          formula_spec: ruleData.formulaSpec ?? null,
          effective_from: today,
          effective_to: null,
          changed_by: changedBy,
          change_reason: changeReason,
        });

      if (insertError) log.error('Error creating rule version', { code: insertError.code });
    } catch (error) {
      log.warn('createRuleVersion failed', { error: String(error) });
    }
  },
};
