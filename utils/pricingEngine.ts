import { Transaction, FTPResult, ApprovalMatrixConfig } from '../types';
import { MOCK_BEHAVIOURAL_MODELS, MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID } from '../constants';
import { LCR_FACTORS, NSFR_FACTORS } from '../constants/regulations';

// Helper: Linear Interpolation for Liquidity Premium
const getLiquidityPremium = (months: number): number => {
    // Simplified Liquidity Curve: 1M=0.10%, 12M=0.45%, 36M=0.65%, 60M=0.85%
    const curve = [
        { mm: 1, bps: 10 },
        { mm: 12, bps: 45 },
        { mm: 36, bps: 65 },
        { mm: 60, bps: 85 }
    ];

    if (months <= 1) return curve[0].bps / 100;
    if (months >= 60) return curve[3].bps / 100;

    // Find bounding points
    const upperIndex = curve.findIndex(p => p.mm >= months);
    const lower = curve[upperIndex - 1];
    const upper = curve[upperIndex];

    const ratio = (months - lower.mm) / (upper.mm - lower.mm);
    return (lower.bps + ratio * (upper.bps - lower.bps)) / 100;
};

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
    const creditCost = (deal.riskWeight / 100) * 0.85;

    // --- NEW REGULATORY COSTS (LCR / NSFR) ---
    let lcrCost = 0;
    let nsfrCost = 0;

    // LCR Cost for Undrawn Lines
    if (deal.undrawnAmount && deal.undrawnAmount > 0) {
        // Cost = Undrawn * {0.05 * LP(1Y) + (%LCR - 0.05) * [LP(HQLA) - LP(Refi)]}
        // Simplified Logic for Demo:
        const lp1Y = getLiquidityPremium(12);
        const lpHQLA = 0.15; // Assumption
        const lpRefi = 0.05; // Assumption
        const lcrFactor = deal.lcrClassification ? LCR_FACTORS[deal.lcrClassification] : 0.10;

        // Cost applied to the undrawn portion converted to rate impact on the drawn amount if possible, 
        // OR return as absolute cost. Here we assume pricing is on the total facility or drawn amount.
        // For rate impact on drawn amount:
        if (deal.amount > 0) {
            const costAbs = deal.undrawnAmount * (0.05 * lp1Y + (lcrFactor - 0.05) * (lpHQLA - lpRefi));
            lcrCost = (costAbs / deal.amount) * 100; // in %
        }
    }

    // Operational Deposit Benefit (Negative Cost)
    if (deal.depositType === 'Operational') {
        // Benefit: Reduction in spread due to stability
        lcrCost -= 0.15;
    }

    // NSFR Cost via Stable Maturity Cap
    if (deal.durationMonths > NSFR_FACTORS.Stable_Maturity_Cap && deal.productType.includes('LOAN')) {
        const excessTerm = deal.durationMonths - NSFR_FACTORS.Stable_Maturity_Cap;
        nsfrCost += excessTerm * 0.02; // 2bps per month of excess term
    }

    const regulatoryCost = creditCost + lcrCost + nsfrCost;

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
        lcrCost,
        nsfrCost,
        termAdjustment: nsfrCost, // Mapping nsfr to term adjustment for now
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
