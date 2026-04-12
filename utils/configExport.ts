import type { GeneralRule, TransitionRateCard, PhysicalRateCard, GreeniumRateCard, IncentivisationRule, SDRConfig, LRConfig, DualLiquidityCurve } from '../types';

interface ExportableConfig {
  version: string;
  exportedAt: string;
  rules: GeneralRule[];
  transitionGrid: TransitionRateCard[];
  physicalGrid: PhysicalRateCard[];
  greeniumGrid?: GreeniumRateCard[];
  incentivisationRules?: IncentivisationRule[];
  sdrConfig?: SDRConfig;
  lrConfig?: LRConfig;
  liquidityCurves?: DualLiquidityCurve[];
}

export function exportConfig(config: ExportableConfig): void {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `n-pricing-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const MAX_CONFIG_FILE_BYTES = 2 * 1024 * 1024;

export function parseConfigFile(file: File): Promise<ExportableConfig> {
  return new Promise((resolve, reject) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (extension !== 'json') {
      reject(new Error('Unsupported file type. Use a .json config file.'));
      return;
    }
    if (file.size > MAX_CONFIG_FILE_BYTES) {
      reject(new Error('Config file too large. Maximum supported size is 2 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') {
          reject(new Error('Failed to read file as text'));
          return;
        }
        const config = JSON.parse(reader.result) as ExportableConfig;
        if (!config.version || !config.rules) {
          reject(new Error('Invalid config file format'));
          return;
        }
        resolve(config);
      } catch {
        reject(new Error('Failed to parse config file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function validateConfig(config: ExportableConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(config.rules)) errors.push('rules must be an array');
  if (!Array.isArray(config.transitionGrid)) errors.push('transitionGrid must be an array');
  if (!Array.isArray(config.physicalGrid)) errors.push('physicalGrid must be an array');

  for (const rule of config.rules || []) {
    if (!rule.id) errors.push(`Rule missing id`);
    if (!rule.businessUnit) errors.push(`Rule ${rule.id} missing businessUnit`);
  }

  return { valid: errors.length === 0, errors };
}
