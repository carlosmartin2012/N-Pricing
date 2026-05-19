import type { FTPResult, RAROCInputs, Transaction } from '../../types';

/**
 * Derive a RAROCInputs patch from the live deal + its pricing result so the
 * RAROC workspace mirrors what the Calculator is showing.
 *
 * Only fields that map cleanly are overwritten. RAROC-specific levers
 * (hurdleRate, opRiskCapitalCharge, pillar2CapitalCharge, riskFreeRate,
 * operatingCostPct, minRegCapitalReq, ecl) keep whatever the user had —
 * they are not encoded in the Transaction.
 *
 * Rate units: RAROCInputs stores percent (6.5 = 6.5%); FTPResult does the same.
 */
export function dealToRarocInputsPatch(
  deal: Transaction,
  result: FTPResult | null
): Partial<RAROCInputs> {
  const patch: Partial<RAROCInputs> = {};

  if (deal.id) patch.transactionId = deal.id;

  if (Number.isFinite(deal.amount) && deal.amount > 0) {
    patch.loanAmt = deal.amount;
    patch.osAmt = deal.drawnAmount ?? deal.amount;
    patch.ead = deal.ead ?? deal.externalEad ?? deal.amount;
  }

  if (deal.feeIncome != null && Number.isFinite(deal.feeIncome)) {
    patch.feeIncome = deal.feeIncome;
  }

  const effectiveRwa = result?.effectiveRwa ?? deal.rwaIrb ?? deal.rwaStandardized;
  if (effectiveRwa != null && Number.isFinite(effectiveRwa) && effectiveRwa >= 0) {
    patch.rwa = effectiveRwa;
  } else if (Number.isFinite(deal.amount) && Number.isFinite(deal.riskWeight) && deal.amount > 0) {
    patch.rwa = deal.amount * deal.riskWeight;
  }

  if (result) {
    if (Number.isFinite(result.finalClientRate)) {
      patch.interestRate = result.finalClientRate;
    }
    if (Number.isFinite(result.totalFTP)) {
      patch.cofRate = result.totalFTP;
    }
    if (Number.isFinite(result.finalClientRate) && Number.isFinite(result.totalFTP)) {
      patch.interestSpread = result.finalClientRate - result.totalFTP;
    }
  }

  return patch;
}

/**
 * Apply a patch over a base set of inputs. Pure helper used by the hydration
 * effect so we keep test surface narrow.
 */
export function applyRarocInputsPatch(
  base: RAROCInputs,
  patch: Partial<RAROCInputs>
): RAROCInputs {
  return { ...base, ...patch };
}
