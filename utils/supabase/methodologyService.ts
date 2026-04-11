import type { MethodologyChangeRequest, MethodologyVersion } from '../../types';
import * as configApi from '../../api/config';

export const methodologyService = {
  async fetchMethodologyChangeRequests(): Promise<MethodologyChangeRequest[]> {
    return configApi.fetchMethodologyChangeRequests();
  },

  async saveMethodologyChangeRequests(requests: MethodologyChangeRequest[]): Promise<void> {
    await configApi.saveMethodologyChangeRequests(requests);
  },

  async fetchMethodologyVersions(): Promise<MethodologyVersion[]> {
    return configApi.fetchMethodologyVersions();
  },

  async saveMethodologyVersions(versions: MethodologyVersion[]): Promise<void> {
    await configApi.saveMethodologyVersions(versions);
  },
};
