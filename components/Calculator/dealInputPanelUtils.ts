import type { ChangeEvent } from 'react';
import type {
  BehaviouralModel,
  ClientEntity,
  ProductDefinition,
  Transaction,
} from '../../types';

export type DealFieldValue = Transaction[keyof Transaction] | undefined;
export type DealFieldChange = (field: keyof Transaction, value: DealFieldValue) => void;

const OPTIONAL_NUMERIC_FIELDS = new Set<keyof Transaction>([
  'ead',
  'feeIncome',
  'repricingMonths',
  'haircutPct',
]);

export const DEAL_CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'JPY'] as const;
export const DEAL_AMORTIZATION_OPTIONS: Transaction['amortization'][] = ['Bullet', 'French', 'Linear'];
export const DEAL_REPRICING_OPTIONS: Transaction['repricingFreq'][] = ['Daily', 'Monthly', 'Quarterly', 'Fixed'];
export const DEAL_DEPOSIT_STABILITY_OPTIONS: NonNullable<Transaction['depositStability']>[] = [
  'Stable',
  'Semi_Stable',
  'Non_Stable',
];
export const DEAL_TRANSITION_RISK_OPTIONS: Transaction['transitionRisk'][] = [
  'Green',
  'Neutral',
  'Amber',
  'Brown',
];
export const DEAL_PHYSICAL_RISK_OPTIONS: Transaction['physicalRisk'][] = ['Low', 'Medium', 'High'];
export const DEAL_COLLATERAL_OPTIONS: NonNullable<Transaction['collateralType']>[] = [
  'None',
  'Sovereign',
  'Corporate',
  'Cash',
  'Real_Estate',
];

export function getClientDisplayName(
  clients: ClientEntity[],
  clientId: string,
) {
  return clients.find((client) => client.id === clientId)?.name ?? 'No Selection';
}

export function formatDealAmount(
  amount: number,
  currency: string,
) {
  if (!amount) {
    return '-';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getDefaultLcrOutflowPct(product: ProductDefinition) {
  if (product.category === 'Liability') {
    return 100;
  }

  if (product.id === 'CRED_LINE') {
    return 10;
  }

  return 0;
}

export function getAvailableBehaviouralModels(
  productId: string,
  products: ProductDefinition[],
  behaviouralModels: BehaviouralModel[],
) {
  const selectedProduct = products.find((product) => product.id === productId);

  if (selectedProduct?.category === 'Asset') {
    return behaviouralModels.filter((model) => model.type === 'Prepayment_CPR');
  }

  return behaviouralModels.filter((model) => model.type === 'NMD_Replication');
}

export function parseDealFieldValue(
  field: keyof Transaction,
  event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
): DealFieldValue {
  const rawValue = event.target.value;

  if (event.target.type === 'number' || event.target.type === 'range') {
    if (rawValue === '') {
      return OPTIONAL_NUMERIC_FIELDS.has(field) ? undefined : 0;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return OPTIONAL_NUMERIC_FIELDS.has(field) ? undefined : 0;
    }

    return parsedValue;
  }

  return rawValue;
}
