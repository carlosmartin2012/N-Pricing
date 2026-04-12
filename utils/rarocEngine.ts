/**
 * RAROC Engine (Gap 6)
 * Exact formula from client's RAROC Excel model:
 *
 * Gross Revenue = EAD × InterestSpread + FeeIncome
 * COF = EAD × (IRRBB_FTP + Liquidity_FTP + CLC)
 * Capital Income = RWA × MinRegCap% × RiskFreeRate
 * OpCost = EAD × OpCostPct
 * Total RegCap = CreditRiskCap + Pillar2Cap + OpRiskCap
 * RAROC = (GrossRev - COF - ECL - OpCost + CapIncome) / TotalRegCap
 * EVA = RAROC - HurdleRate
 */

import { RAROCInputs } from '../types';

export interface RAROCResult {
  grossRevenue: number;
  costOfFunds: number;
  operatingCost: number;
  capitalIncome: number;
  creditRiskCapital: number;
  pillar2Capital: number;
  opRiskCapital: number;
  totalRegCapital: number;
  riskAdjustedReturn: number;
  raroc: number;      // %
  eva: number;         // %
  economicProfit: number; // absolute
}

/**
 * Full RAROC calculation aligned with client's Excel model.
 */
export function calculateRAROC(inputs: RAROCInputs): RAROCResult {
  const {
    ead, interestSpread, feeIncome, cofRate,
    rwa, ecl, operatingCostPct, riskFreeRate,
    minRegCapitalReq, pillar2CapitalCharge, opRiskCapitalCharge,
    hurdleRate, osAmt,
  } = inputs;

  // Guard: if core numeric inputs are NaN/Infinity, return zero result
  // rather than propagating corruption through RAROC → approval decisions.
  if (!Number.isFinite(ead) || !Number.isFinite(rwa) || !Number.isFinite(hurdleRate)) {
    return {
      grossRevenue: 0, costOfFunds: 0, operatingCost: 0, capitalIncome: 0,
      creditRiskCapital: 0, pillar2Capital: 0, opRiskCapital: 0, totalRegCapital: 0,
      riskAdjustedReturn: 0, raroc: 0, eva: 0, economicProfit: 0,
    };
  }

  // Revenue
  const grossRevenue = ead * (interestSpread / 100) + feeIncome;

  // Cost of funds (using the FTP rate passed in as cofRate)
  const costOfFunds = ead * (cofRate / 100);

  // Operating cost
  const operatingCost = (operatingCostPct / 100) * osAmt;

  // Capital components
  const creditRiskCapital = rwa * (minRegCapitalReq / 100);
  const pillar2Capital = ead * (pillar2CapitalCharge / 100);
  const opRiskCapital = ead * (opRiskCapitalCharge / 100);
  const totalRegCapital = creditRiskCapital + pillar2Capital + opRiskCapital;

  // Capital income (return on total regulatory capital at risk-free rate)
  const capitalIncome = totalRegCapital * (riskFreeRate / 100);

  // Risk-adjusted return
  const riskAdjustedReturn = grossRevenue - costOfFunds - ecl - operatingCost + capitalIncome;

  // RAROC and EVA
  const raroc = totalRegCapital > 0 ? (riskAdjustedReturn / totalRegCapital) * 100 : 0;
  const eva = raroc - hurdleRate;
  const economicProfit = riskAdjustedReturn - totalRegCapital * (hurdleRate / 100);

  return {
    grossRevenue,
    costOfFunds,
    operatingCost,
    capitalIncome,
    creditRiskCapital,
    pillar2Capital,
    opRiskCapital,
    totalRegCapital,
    riskAdjustedReturn,
    raroc,
    eva,
    economicProfit,
  };
}

/**
 * Build RAROCInputs from a deal and its FTP result.
 * Bridge between pricingEngine output and RAROC calculation.
 */
export function buildRAROCInputsFromDeal(
  deal: {
    amount: number;
    ead?: number;
    feeIncome?: number;
    riskWeight: number;
    capitalRatio: number;
    targetROE: number;
    operationalCostBps: number;
    marginTarget: number;
    clientId: string;
  },
  ftpRate: number,       // total FTP rate (%)
  riskFreeRate: number,  // from yield curve ON tenor (%)
): RAROCInputs {
  const ead = deal.ead || deal.amount;
  const rwa = ead * (deal.riskWeight / 100);

  return {
    transactionId: deal.clientId,
    loanAmt: deal.amount,
    osAmt: deal.amount,
    ead,
    interestRate: ftpRate + deal.marginTarget,
    interestSpread: deal.marginTarget,
    cofRate: ftpRate,
    rwa,
    ecl: 0, // Overridden by pricingEngine with Anejo IX credit cost
    feeIncome: deal.feeIncome || 0,
    operatingCostPct: (Number.isFinite(deal.operationalCostBps) ? deal.operationalCostBps : 0) / 100,
    riskFreeRate,
    opRiskCapitalCharge: 0.2,    // 20bps standard
    minRegCapitalReq: deal.capitalRatio,
    hurdleRate: deal.targetROE,
    pillar2CapitalCharge: 1.5,   // Standard Pillar 2 add-on
  };
}
