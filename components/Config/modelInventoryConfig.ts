import type {
  ModelCategory,
  ModelMetadata,
  ModelStatus,
} from '../../utils/pricing/modelInventory';

export const DEFAULT_SEED: ModelMetadata[] = [
  {
    id: 'MDL-PD-001',
    name: 'Anejo IX PD — Corporate',
    category: 'PD',
    status: 'PRODUCTION',
    version: '2.1.0',
    owner: 'Risk Modeling',
    description:
      'PD curve per Anejo IX corporate segment with Spanish macro overlay',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    nextValidationDate: '2026-06-30',
    validationFrequency: 'ANNUAL',
    methodologyRef: 'internal://models/pd-corp-v2',
    applicableSegments: ['Corporate', 'SME'],
    dataSources: ['Core banking', 'CIRBE'],
    limitations: ['Limited historical data on 2008-2011 cycle'],
    regulatoryRefs: ['Anejo IX BdE Circular 4/2017', 'CRR Art. 180'],
  },
  {
    id: 'MDL-LGD-001',
    name: 'Anejo IX LGD — Mortgage',
    category: 'LGD',
    status: 'PRODUCTION',
    version: '1.4.2',
    owner: 'Risk Modeling',
    description: 'Secured mortgage LGD with HPI-dependent haircuts',
    effectiveFrom: '2025-03-15',
    effectiveTo: null,
    nextValidationDate: '2026-03-15',
    validationFrequency: 'ANNUAL',
    regulatoryRefs: ['Anejo IX BdE', 'CRR Art. 181'],
  },
  {
    id: 'MDL-NMD-001',
    name: 'NMD Replicating Portfolio',
    category: 'NMD_REPLICATION',
    status: 'PRODUCTION',
    version: '3.0.0',
    owner: 'ALM',
    description: 'Core/volatile split with caterpillar replication profile',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    nextValidationDate: '2026-01-01',
    validationFrequency: 'ANNUAL',
    regulatoryRefs: ['EBA GL/2018/02 IRRBB'],
  },
  {
    id: 'MDL-CPR-001',
    name: 'Mortgage Prepayment CPR',
    category: 'PREPAYMENT',
    status: 'INTERNAL_VALIDATION',
    version: '0.9.1',
    owner: 'ALM',
    description: 'CPR model with rate-dependent and demographic drivers',
    effectiveFrom: '2026-03-01',
    effectiveTo: null,
    nextValidationDate: '2026-05-01',
    validationFrequency: 'SEMI_ANNUAL',
  },
  {
    id: 'MDL-XBN-001',
    name: 'Cross-Bonus Fulfillment',
    category: 'CROSS_BONUSES',
    status: 'PRODUCTION',
    version: '1.2.0',
    owner: 'Retail Strategy',
    description:
      'Fulfillment probability for nómina, seguros, plan de pensiones',
    effectiveFrom: '2025-09-01',
    effectiveTo: null,
    nextValidationDate: '2026-09-01',
    validationFrequency: 'ANNUAL',
  },
  {
    id: 'MDL-NSS-001',
    name: 'NSS Curve Fit',
    category: 'FTP_CURVE',
    status: 'PRODUCTION',
    version: '1.0.0',
    owner: 'Treasury Quant',
    description: 'Nelson-Siegel-Svensson fit for EUR/USD/GBP yield curves',
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
    nextValidationDate: '2027-04-01',
    validationFrequency: 'ANNUAL',
    regulatoryRefs: ['ECB methodology doc'],
  },
];

export const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PD: { bg: 'bg-nfq-coral/10', text: 'text-nfq-coral', label: 'PD' },
  LGD: { bg: 'bg-nfq-amber/10', text: 'text-nfq-amber', label: 'LGD' },
  EAD: { bg: 'bg-nfq-amber/10', text: 'text-nfq-amber', label: 'EAD' },
  NMD_BETA: { bg: 'bg-nfq-violet/10', text: 'text-nfq-violet', label: 'NMD β' },
  NMD_REPLICATION: {
    bg: 'bg-nfq-violet/10',
    text: 'text-nfq-violet',
    label: 'NMD Repl',
  },
  PREPAYMENT: { bg: 'bg-nfq-steel/10', text: 'text-nfq-steel', label: 'CPR' },
  CROSS_BONUSES: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    label: 'Bonus',
  },
  BEHAVIORAL: {
    bg: 'bg-nfq-violet/10',
    text: 'text-nfq-violet',
    label: 'Behav',
  },
  FTP_CURVE: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Curve' },
  STRESS_SCENARIO: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Stress',
  },
  OTHER: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Other' },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
  INTERNAL_VALIDATION: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  APPROVED: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  PRODUCTION: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  DEPRECATED: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  RETIRED: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

export const STATUS_LABELS: Record<ModelStatus, string> = {
  DRAFT: 'Borrador',
  INTERNAL_VALIDATION: 'Validación interna',
  APPROVED: 'Aprobado',
  PRODUCTION: 'Producción',
  DEPRECATED: 'Obsoleto',
  RETIRED: 'Retirado',
};

export const CATEGORY_OPTIONS: ModelCategory[] = [
  'PD',
  'LGD',
  'EAD',
  'NMD_BETA',
  'NMD_REPLICATION',
  'PREPAYMENT',
  'CROSS_BONUSES',
  'BEHAVIORAL',
  'FTP_CURVE',
  'STRESS_SCENARIO',
  'OTHER',
];

export const STATUS_OPTIONS: ModelStatus[] = [
  'DRAFT',
  'INTERNAL_VALIDATION',
  'APPROVED',
  'PRODUCTION',
  'DEPRECATED',
  'RETIRED',
];

export function formatDateES(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function isOverdue(iso: string): boolean {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() < Date.now();
  } catch {
    return false;
  }
}
