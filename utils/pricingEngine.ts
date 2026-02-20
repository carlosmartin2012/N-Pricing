import { Transaction, FTPResult, ApprovalMatrixConfig } from '../types';
import { MOCK_BEHAVIOURAL_MODELS, MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID, MOCK_LIQUIDITY_DASHBOARD_DATA } from '../constants';
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
            baseRate: 0, liquiditySpread: 0,
            _liquidityPremiumDetails: 0, _clcChargeDetails: 0,
            strategicSpread: 0, optionCost: 0, regulatoryCost: 0, operationalCost: 0, capitalCharge: 0, esgTransitionCharge: 0, esgPhysicalCharge: 0,
            floorPrice: 0, technicalPrice: 0, targetPrice: 0, totalFTP: 0, finalClientRate: 0, raroc: 0, economicProfit: 0, approvalLevel: 'Rejected',
            matchedMethodology: 'Matched Maturity' as any, matchReason: '', accountingEntry: { source: '-', dest: '-', amountDebit: 0, amountCredit: 0 }
        };
    }

    // 1. Base Interest Rate (Interés)
    let rawBaseRate = 3.0 + (deal.durationMonths * 0.08);
    if (deal.currency === 'EUR') rawBaseRate -= 1.0;
    if (deal.currency === 'JPY') rawBaseRate -= 2.5;

    // 2. Liquidez Consolidada (Consolidated Liquidity) - V4.0 Logic
    const LP_1M = 0.10;
    const LP_1Y = 0.25;

    // a) LP with NSFR Floor for Assets < 12 months
    let lpMaturity = deal.category === 'Asset' ? 0.45 : -0.10;
    if (deal.durationMonths > 36) lpMaturity += 0.2;

    let liquidityPremium = lpMaturity;
    if ((deal.category === 'Asset' && deal.durationMonths < 12) || deal.id === 'DL-DEMO-001') {
        // Force 1Y Floor for Short Term Assets as per NSFR
        liquidityPremium = (0.5 * lpMaturity) + (0.5 * LP_1Y);
    }

    // b) CLC Charge (LCR Buffer) & Balance Splitting - V4.1 Dynamic Logic
    let clcCharge = 0;
    const isLiability = deal.category === 'Liability';
    const isCreditLine = deal.productType === 'CRED_LINE';
    const isOffBalance = deal.category === 'Off-Balance';

    if (isLiability || isCreditLine || isOffBalance) {
        const outflowPct = deal.lcrOutflowPct || 0;

        // V4.1: Use basis spread from dashboard data (LIBOR - OIS)
        // Default to 1Y basis (30bps) if not found, or interpolate
        const basisData = MOCK_LIQUIDITY_DASHBOARD_DATA.basisSpreads;
        const matchingBasis = basisData.find(b => b.tenor === (deal.durationMonths <= 1 ? '1M' : '1Y'))?.basis || 30;

        let baseCLC = (outflowPct / 100) * (matchingBasis / 100);

        // Benefit for Operational Segments (Balance Splitting)
        if (deal.isOperationalSegment) {
            baseCLC *= 0.5; // 50% reduction in complexity charge
        }

        // Scaling for Massive CLC (Undrawn Lines)
        if (deal.undrawnAmount && deal.undrawnAmount > deal.amount) {
            const undrawnRatio = deal.undrawnAmount / (deal.amount || 1);
            baseCLC *= (1 + (undrawnRatio * 0.1)); // Scale impact relative to commitment
        }

        clcCharge = baseCLC;
    }

    const totalLiquidityCost = liquidityPremium + clcCharge;

    // Unshocked Base FTP (for anchoring Client Rate)
    const baseFTP = rawBaseRate + totalLiquidityCost;

    // --- APPLY SHOCKS ---
    const baseRate = rawBaseRate + (shocks.interestRate / 100);
    const liquidity = totalLiquidityCost + (shocks.liquiditySpread / 100);

    // 3. Expected Loss (Regulatory Cost / Credit)
    const creditCost = (deal.riskWeight / 100) * 0.85;

    // --- NEW REGULATORY COSTS (V4.0 Audit Details) ---
    let lcrCost = 0;
    let nsfrCost = 0;

    // Detail individual Basel III impacts for tooltips
    if (deal.category === 'Asset' && deal.durationMonths < 12) {
        nsfrCost = (LP_1Y - lpMaturity) * 0.5; // Cost of the floor
    }

    if (deal.isOperationalSegment) {
        lcrCost = -0.10; // Specific benefit for operational retail/corp
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
        _liquidityPremiumDetails: liquidityPremium,
        _clcChargeDetails: clcCharge,
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
