import type {
  AnyAdapter,
  CoreBankingAdapter,
  CrmAdapter,
  MarketDataAdapter,
  AdmissionAdapter,
  BudgetSourceAdapter,
  AdapterKind,
  AdapterHealth,
} from './types';

/**
 * Adapter registry. Singleton-per-process map of integrations the system
 * knows about. The bank's deployment configures which concrete adapter is
 * registered for each (kind, name); the rest of the code consumes by kind.
 */

class AdapterRegistry {
  private adapters = new Map<AdapterKind, AnyAdapter>();

  register(adapter: AnyAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  unregister(kind: AdapterKind): void {
    this.adapters.delete(kind);
  }

  clear(): void {
    this.adapters.clear();
  }

  has(kind: AdapterKind): boolean {
    return this.adapters.has(kind);
  }

  coreBanking(): CoreBankingAdapter | null {
    const a = this.adapters.get('core_banking');
    return a?.kind === 'core_banking' ? a : null;
  }
  crm(): CrmAdapter | null {
    const a = this.adapters.get('crm');
    return a?.kind === 'crm' ? a : null;
  }
  marketData(): MarketDataAdapter | null {
    const a = this.adapters.get('market_data');
    return a?.kind === 'market_data' ? a : null;
  }
  admission(): AdmissionAdapter | null {
    const a = this.adapters.get('admission');
    return a?.kind === 'admission' ? a : null;
  }
  budget(): BudgetSourceAdapter | null {
    const a = this.adapters.get('budget');
    return a?.kind === 'budget' ? a : null;
  }

  async healthAll(): Promise<Array<{ kind: AdapterKind; name: string; health: AdapterHealth }>> {
    const out: Array<{ kind: AdapterKind; name: string; health: AdapterHealth }> = [];
    for (const adapter of this.adapters.values()) {
      const health = await adapter.health().catch((err): AdapterHealth => ({
        ok: false,
        message: err instanceof Error ? err.message : 'health probe threw',
        checkedAt: new Date().toISOString(),
      }));
      out.push({ kind: adapter.kind, name: adapter.name, health });
    }
    return out;
  }
}

const SINGLETON = new AdapterRegistry();
export const adapterRegistry = SINGLETON;

// Test helpers — convenience for swapping the registry per test
export function _newRegistry(): AdapterRegistry {
  return new AdapterRegistry();
}
