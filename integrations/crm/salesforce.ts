import { fail, ok, type CrmAdapter, type CrmCustomer, type AdapterHealth, type AdapterResult } from '../types';

/**
 * Salesforce Financial Services Cloud adapter — STUB.
 *
 * The real implementation needs:
 *   - Connected App with OAuth Username-Password or JWT Bearer flow
 *   - Salesforce REST API (/services/data/v59.0/sobjects/...)
 *   - SOQL query builder for the relationship search
 *   - Field mapping FSC schema → CrmCustomer (FSC FinancialAccount,
 *     AccountContactRelation, FinServ__InsurancePolicy__c, etc.)
 *
 * This file exists so the rest of the system can compile and tests can
 * inject a concrete adapter. When the bank delivers credentials, the
 * `verifyAndFetch` and `searchSoql` helpers below are the only places
 * that need real HTTP calls.
 */

export interface SalesforceConfig {
  instanceUrl: string;        // e.g. https://my-bank.my.salesforce.com
  clientId: string;
  clientSecret: string;
  username?: string;          // for password OAuth
  password?: string;
  privateKeyPem?: string;     // for JWT Bearer
  apiVersion?: string;        // default 'v59.0'
}

export class SalesforceCrmAdapter implements CrmAdapter {
  readonly kind = 'crm' as const;
  readonly name = 'salesforce-fsc';

  // Held for reference once real implementation lands; intentionally unused.
  private readonly config: SalesforceConfig;

  constructor(config: SalesforceConfig) {
    this.config = config;
    if (!config.instanceUrl || !config.clientId) {
      throw new Error('SalesforceCrmAdapter requires instanceUrl + clientId');
    }
  }

  async health(): Promise<AdapterHealth> {
    // Real impl: HEAD /services/data → 200
    return {
      ok: false,
      message: `stub adapter — pending real implementation against ${this.config.instanceUrl}`,
      checkedAt: new Date().toISOString(),
    };
  }

  async fetchCustomer(_externalId: string): Promise<AdapterResult<CrmCustomer | null>> {
    return fail('unreachable', 'salesforce-fsc adapter is a stub; provide credentials + implement HTTP layer');
  }

  async searchCustomers(_query: string, _limit?: number): Promise<AdapterResult<CrmCustomer[]>> {
    return ok([]);
  }
}
