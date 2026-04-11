import type { ApprovalTask, PricingDossier } from '../../types';
import * as configApi from '../../api/config';

export const approvalService = {
  async fetchApprovalTasks(): Promise<ApprovalTask[]> {
    return configApi.fetchApprovalTasks();
  },

  async saveApprovalTasks(tasks: ApprovalTask[]): Promise<void> {
    await configApi.saveApprovalTasks(tasks);
  },

  async fetchPricingDossiers(): Promise<PricingDossier[]> {
    return configApi.fetchPricingDossiers();
  },

  async savePricingDossiers(dossiers: PricingDossier[]): Promise<void> {
    await configApi.savePricingDossiers(dossiers);
  },
};
