import type { Transaction, FTPResult } from '../types';

/**
 * Interface for custom pricing gap plugins.
 * Institutions can implement this to inject their own adjustments
 * without modifying the core pricing engine.
 */
export interface PricingGapPlugin {
  /** Unique plugin identifier */
  id: string;
  /** Display name shown in the pricing receipt */
  name: string;
  /** Human-readable description */
  description: string;
  /** Version string for audit trail */
  version: string;
  /** Whether this plugin is currently enabled */
  enabled: boolean;
  /** Plugin category for grouping in UI */
  category: 'regulatory' | 'risk' | 'commercial' | 'esg' | 'custom';
  /**
   * Calculate the adjustment in basis points (positive = charge, negative = discount).
   * Receives the deal parameters and the partial FTP result computed so far.
   */
  calculate: (deal: Transaction, partialResult: Partial<FTPResult>) => PricingGapResult;
}

export interface PricingGapResult {
  /** Adjustment in percentage points (e.g., 0.15 = 15bps) */
  adjustment: number;
  /** Human-readable breakdown for the pricing receipt */
  breakdown: string;
  /** Optional metadata for audit trail */
  metadata?: Record<string, unknown>;
}

/**
 * Registry that manages pricing gap plugins.
 * Plugins are evaluated in order after the core engine gaps.
 */
class PluginRegistry {
  private plugins = new Map<string, PricingGapPlugin>();

  register(plugin: PricingGapPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  getAll(): PricingGapPlugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabled(): PricingGapPlugin[] {
    return this.getAll().filter((p) => p.enabled);
  }

  /**
   * Evaluate all enabled plugins against a deal.
   * Returns the total adjustment and per-plugin results.
   */
  evaluate(deal: Transaction, partialResult: Partial<FTPResult>): {
    totalAdjustment: number;
    results: Array<{ plugin: PricingGapPlugin; result: PricingGapResult }>;
  } {
    const results: Array<{ plugin: PricingGapPlugin; result: PricingGapResult }> = [];
    let totalAdjustment = 0;

    for (const plugin of this.getEnabled()) {
      try {
        const result = plugin.calculate(deal, partialResult);
        results.push({ plugin, result });
        totalAdjustment += result.adjustment;
      } catch {
        results.push({
          plugin,
          result: { adjustment: 0, breakdown: 'Plugin error — skipped', metadata: { error: true } },
        });
      }
    }

    return { totalAdjustment, results };
  }
}

/** Singleton plugin registry */
export const pluginRegistry = new PluginRegistry();

// ── Example built-in plugins ────────────────────────────────────────────────

/** Operational risk surcharge based on product complexity */
export const OPERATIONAL_RISK_PLUGIN: PricingGapPlugin = {
  id: 'operational-risk-surcharge',
  name: 'Operational Risk Surcharge',
  description: 'Additional charge for complex structured products based on operational risk assessment',
  version: '1.0.0',
  enabled: false,
  category: 'risk',
  calculate: (deal) => {
    const isComplex = deal.amortization !== 'Bullet' && deal.durationMonths > 60;
    const adjustment = isComplex ? 0.05 : 0;
    return {
      adjustment,
      breakdown: isComplex
        ? `Complex structure (${deal.amortization}, ${deal.durationMonths}m) → +5bp`
        : 'Standard structure → 0bp',
    };
  },
};

/** Country risk premium for cross-border exposures */
export const COUNTRY_RISK_PLUGIN: PricingGapPlugin = {
  id: 'country-risk-premium',
  name: 'Country Risk Premium',
  description: 'Sovereign risk adjustment for cross-border lending exposures',
  version: '1.0.0',
  enabled: false,
  category: 'regulatory',
  calculate: (deal) => {
    const currencyPremium: Record<string, number> = {
      USD: 0, EUR: 0, GBP: 0.02, CHF: 0, BRL: 0.25, MXN: 0.15, TRY: 0.40,
    };
    const adjustment = currencyPremium[deal.currency] ?? 0.05;
    return {
      adjustment,
      breakdown: `${deal.currency} exposure → ${(adjustment * 100).toFixed(0)}bp`,
      metadata: { currency: deal.currency },
    };
  },
};

export const EXAMPLE_PLUGINS: PricingGapPlugin[] = [
  OPERATIONAL_RISK_PLUGIN,
  COUNTRY_RISK_PLUGIN,
];
