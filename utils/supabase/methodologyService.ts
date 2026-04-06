import type { MethodologyChangeRequest, MethodologyVersion } from '../../types';
import { configService } from './config';

export const methodologyService = {
  async fetchMethodologyChangeRequests(): Promise<MethodologyChangeRequest[]> {
    return configService.fetchMethodologyChangeRequests();
  },

  async saveMethodologyChangeRequests(requests: MethodologyChangeRequest[]): Promise<void> {
    await configService.saveMethodologyChangeRequests(requests);
  },

  async fetchMethodologyVersions(): Promise<MethodologyVersion[]> {
    return configService.fetchMethodologyVersions();
  },

  async saveMethodologyVersions(versions: MethodologyVersion[]): Promise<void> {
    await configService.saveMethodologyVersions(versions);
  },
};
