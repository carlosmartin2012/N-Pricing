import { describe, it, expect } from 'vitest';
import {
  buildWaterfallExplanation,
  buildCopilotSystemPrompt,
  buildCopilotUserMessage,
} from '../waterfallExplainer';
import type { Transaction, FTPResult } from '../../types';

const deal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 5_000_000,
  startDate: '2024-01-01',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.25,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  lcrOutflowPct: 0,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

const result: FTPResult = {
  baseRate: 4.5,
  liquiditySpread: 0.85,
  _liquidityPremiumDetails: 0.85,
  _clcChargeDetails: 0.1,
  strategicSpread: 0.2,
  optionCost: 0,
  regulatoryCost: 0.35,
  lcrCost: 0.1,
  nsfrCost: 0.05,
  operationalCost: 0.45,
  capitalCharge: 1.1,
  esgTransitionCharge: 0.05,
  esgPhysicalCharge: 0.02,
  floorPrice: 5.3,
  technicalPrice: 6.4,
  targetPrice: 6.7,
  totalFTP: 6.82,
  finalClientRate: 7.25,
  raroc: 13.25,
  economicProfit: 45_000,
  approvalLevel: 'L1_Manager',
  matchedMethodology: 'Matched Maturity',
  matchReason: 'LOAN_COMM/USD/24M',
  accountingEntry: { source: 'BU-001', dest: 'BU-900', amountDebit: 0, amountCredit: 0 },
};

describe('buildWaterfallExplanation', () => {
  it('produces Spanish output with expected labels', () => {
    const text = buildWaterfallExplanation(deal, result, { language: 'es' });
    expect(text).toContain('Desglose FTP');
    expect(text).toContain('Prima de liquidez');
    expect(text).toContain('Carga LCR');
    expect(text).toContain('Total FTP');
    expect(text).toContain('Tasa final cliente');
    expect(text).toContain('Nivel de aprobación');
  });

  it('produces English output with expected labels', () => {
    const text = buildWaterfallExplanation(deal, result, { language: 'en' });
    expect(text).toContain('FTP Waterfall Breakdown');
    expect(text).toContain('Liquidity premium');
    expect(text).toContain('LCR charge');
    expect(text).toContain('Total FTP');
    expect(text).toContain('Final client rate');
    expect(text).toContain('Approval level');
  });

  it('formats numbers as percentages with 3 decimals', () => {
    const text = buildWaterfallExplanation(deal, result);
    expect(text).toContain('4.500%');   // baseRate
    expect(text).toContain('6.820%');   // totalFTP
    expect(text).toContain('7.250%');   // finalClientRate
    expect(text).toContain('13.250%');  // raroc
  });

  it('includes approval level when RAROC section is enabled', () => {
    const text = buildWaterfallExplanation(deal, result, { includeRaroc: true });
    expect(text).toContain('L1_Manager');
  });

  it('omits RAROC section when disabled', () => {
    const text = buildWaterfallExplanation(deal, result, { includeRaroc: false });
    expect(text).not.toContain('RAROC');
    expect(text).not.toContain('L1_Manager');
  });

  it('skips optional rows when LCR/NSFR absent', () => {
    const noCharges: FTPResult = { ...result, lcrCost: undefined, nsfrCost: undefined };
    const text = buildWaterfallExplanation(deal, noCharges);
    expect(text).not.toContain('Carga LCR');
    expect(text).not.toContain('Carga NSFR');
  });
});

describe('buildCopilotSystemPrompt', () => {
  it('returns non-empty Spanish prompt by default', () => {
    const prompt = buildCopilotSystemPrompt();
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt).toContain('copiloto');
  });

  it('returns non-empty English prompt when requested', () => {
    const prompt = buildCopilotSystemPrompt('en');
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt).toContain('copilot');
  });
});

describe('buildCopilotUserMessage', () => {
  it('combines waterfall context with the user question', () => {
    const message = buildCopilotUserMessage(
      deal,
      result,
      '¿Por qué el RAROC está bajo?',
      'es',
    );
    expect(message).toContain('Contexto de la operación');
    expect(message).toContain('Desglose FTP');
    expect(message).toContain('Pregunta del gestor');
    expect(message).toContain('¿Por qué el RAROC está bajo?');
  });

  it('uses English framing when language=en', () => {
    const message = buildCopilotUserMessage(deal, result, 'Why is RAROC low?', 'en');
    expect(message).toContain('Deal context');
    expect(message).toContain('User question');
    expect(message).toContain('Why is RAROC low?');
  });
});
