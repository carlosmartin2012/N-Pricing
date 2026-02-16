import { Transaction, FTPResult, ApprovalMatrixConfig } from '../types';
import { MOCK_BEHAVIOURAL_MODELS, MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID } from '../constants';

export interface PricingShocks {
    interestRate: number; // bps
    liquiditySpread: number; // bps
}

export const calculatePricing = (
    deal: Transaction,
    approvalMatrix: ApprovalMatrixConfig,
    shocks: PricingShocks = { interestRate: 0, liquiditySpread: 0 }
): FTPResult => {
    // 0. Empty State Check
    if (!deal.productType || deal.amount === 0) {
        return {
            baseRate: 0, liquiditySpread: 0, strategicSpread: 0, optionCost: 0, regulatoryCost: 0, operationalCost: 0, capitalCharge: 0, esgTransitionCharge: 0, esgPhysicalCharge: 0,
            floorPrice: 0, technicalPrice: 0, targetPrice: 0, totalFTP: 0, finalClientRate: 0, raroc: 0, economicProfit: 0, approvalLevel: 'Rejected',
            matchedMethodology: 'Matched Maturity' as any, matchReason: '', accountingEntry: { source: '-', dest: '-', amountDebit: 0, amountCredit: 0 }
        };
    }

    // 1. Base Interest Rate (Interés)
    let rawBaseRate = 3.0 + (deal.durationMonths * 0.08);
    if (deal.currency === 'EUR') rawBaseRate -= 1.0;
    if (deal.currency === 'JPY') rawBaseRate -= 2.5;

    // 2. Liquidity Cost (Funding/Liquidez)
    // Basic heuristic: Loan usually adds liquidity cost, Deposit provides liquidity benefit (negative cost)
    let rawLiquidity = deal.productType.includes('LOAN') ? 0.45 : -0.10;
    if (deal.durationMonths > 36) rawLiquidity += 0.2;

    // Unshocked Base FTP (for anchoring Client Rate)
    const baseFTP = rawBaseRate + rawLiquidity;

    // --- APPLY SHOCKS ---
    const baseRate = rawBaseRate + (shocks.interestRate / 100);
    const liquidity = rawLiquidity + (shocks.liquiditySpread / 100);

    // 3. Expected Loss (Regulatory Cost / Credit)
    // Formula: Risk Weight * 1% (Simplified EL)
    const regulatoryCost = (deal.riskWeight / 100) * 0.85;

    // 4. Operational Cost (Input from Panel)
    const operationalCost = deal.operationalCostBps / 100;

    // 5. Capital Charge (Cost of Equity)
    // RWA * CapitalRatio * ROE
    const capitalCharge = (deal.riskWeight / 100) * (deal.capitalRatio / 100) * deal.targetROE;

    // 6. ESG Adjustment (Split: Transition + Physical)
    let transCharge = 0;
    const transRule = MOCK_TRANSITION_GRID.find(r => r.classification === deal.transitionRisk);
    if (transRule) transCharge = transRule.adjustmentBps / 100;

    let physCharge = 0;
    const physRule = MOCK_PHYSICAL_GRID.find(r => r.riskLevel === deal.physicalRisk);
    if (physRule) physCharge = physRule.adjustmentBps / 100;

    // 7. Strategic Spread (Previously Behavioural)
    let strategicSpread = 0;
    if (deal.behaviouralModelId) {
        const model = MOCK_BEHAVIOURAL_MODELS.find(m => m.id === deal.behaviouralModelId);
        if (model) {
            if (model.type === 'Prepayment_CPR') {
                strategicSpread = (model.cpr || 0) * 0.05;
            } else if (model.type === 'NMD_Replication') {
                strategicSpread = -((model.coreRatio || 50) / 100) * 0.30;
            }
        }
    }

    // --- AGGREGATES ---
    const ftp = baseRate + liquidity; // Shocked Cost
    const floorPrice = ftp + regulatoryCost + operationalCost + transCharge + physCharge + strategicSpread;
    const technicalPrice = floorPrice + capitalCharge; // Hurdle Price to meet ROE

    // Final Client Rate: Anchored to Base FTP + Margin (to show margin compression under stress)
    const finalRate = baseFTP + deal.marginTarget;

    // RAROC Calculation
    // Net Income % = Final Rate - Floor Price (All costs except capital charge)
    const netIncomePct = finalRate - floorPrice;

    // Allocated Capital % (Relative to Notional)
    const allocatedCapitalPct = (deal.riskWeight / 100) * deal.capitalRatio;

    // RAROC = (Net Income / Allocated Capital)
    const raroc = allocatedCapitalPct > 0 ? (netIncomePct / allocatedCapitalPct) * 100 : 0;

    // Economic Profit (EVA) = Net Income - (Capital * CostOfEquity/ROE)
    const economicProfit = netIncomePct - capitalCharge;

    // Governance Dynamic Check
    let approvalLevel: 'Auto' | 'L1_Manager' | 'L2_Committee' | 'Rejected' = 'Rejected';

    if (raroc >= approvalMatrix.autoApprovalThreshold) {
        approvalLevel = 'Auto';
    } else if (raroc >= approvalMatrix.l1Threshold) {
        approvalLevel = 'L1_Manager';
    } else if (raroc >= approvalMatrix.l2Threshold) {
        approvalLevel = 'L2_Committee';
    } else {
        approvalLevel = 'Rejected';
    }

    // Method Selection
    const method = deal.repricingFreq === 'Fixed' ? 'Matched Maturity' : 'Moving Average';

    return {
        baseRate,
        liquiditySpread: liquidity,
        strategicSpread,
        optionCost: strategicSpread, // Keeping legacy type structure valid
        regulatoryCost,
        operationalCost,
        capitalCharge,
        esgTransitionCharge: transCharge,
        esgPhysicalCharge: physCharge,

        floorPrice,
        technicalPrice,
        targetPrice: technicalPrice + 0.5, // Arbitrary commercial buffer

        totalFTP: ftp,
        finalClientRate: finalRate,
        raroc,
        economicProfit,
        approvalLevel,

        matchedMethodology: method as any,
        matchReason: 'Standard Term Logic',
        accountingEntry: {
            source: deal.businessLine,
            dest: 'Central Treasury',
            amountDebit: deal.amount * (ftp / 100),
            amountCredit: deal.amount * (ftp / 100),
        }
    };
};
