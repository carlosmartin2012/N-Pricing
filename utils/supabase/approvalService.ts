import type { ApprovalTask, PricingDossier } from '../../types';
import { configService } from './config';

export const approvalService = {
  async fetchApprovalTasks(): Promise<ApprovalTask[]> {
    return configService.fetchApprovalTasks();
  },

  async saveApprovalTasks(tasks: ApprovalTask[]): Promise<void> {
    await configService.saveApprovalTasks(tasks);
  },

  async fetchPricingDossiers(): Promise<PricingDossier[]> {
    return configService.fetchPricingDossiers();
  },

  async savePricingDossiers(dossiers: PricingDossier[]): Promise<void> {
    await configService.savePricingDossiers(dossiers);
  },
};
