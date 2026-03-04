// ─── LCR Outflow Factors by Product/Deposit Type (Gap 4) ─────────────────────
// Source: Product Level Recommendations (Santander PPTX slides 12-13)
// Key format: productType_stability_clientType or lcrClassification

export const LCR_OUTFLOW_TABLE: Record<string, number> = {
  // Retail Deposits
  'DEP_CASA_Stable': 0.05,
  'DEP_CASA_Semi_Stable': 0.10,
  'DEP_CASA_Non_Stable': 0.20,
  'DEP_TERM_Stable': 0.00,          // penalty >= loss of interest
  'DEP_TERM_Semi_Stable': 0.05,     // penalty < loss of interest
  'DEP_TERM_Non_Stable': 0.10,

  // Corporate/Institutional Deposits
  'DEP_TERM_Operational': 0.25,
  'DEP_TERM_Non_Operational': 0.40,
  'DEP_CASA_Operational': 0.25,
  'DEP_CASA_Non_Operational': 0.40,
  'DEP_TERM_Financial': 1.00,

  // Credit Lines
  'CRED_LINE_Committed_Corporate': 0.10,
  'CRED_LINE_Committed_Retail': 0.05,
  'CRED_LINE_Committed_Financial': 0.40,
  'CRED_LINE_Liquidity_Financial': 1.00,
  'CRED_LINE_Uncommitted': 0.00,

  // Repo / Secured
  'REPO_L1_HQLA': 0.00,
  'REPO_L2A_HQLA': 0.15,
  'REPO_L2B_HQLA': 0.50,
  'REPO_Non_HQLA': 1.00,

  // Legacy classification keys (backward compat)
  'Corp_Credit': 0.10,
  'Corp_Liquidity': 0.30,
  'IFI_Liquidity': 1.00,
  'Retail_Stable': 0.05,
  'Retail_Other': 0.10,
};

// ─── NSFR Available Stable Funding (ASF) Factors (Gap 5) ─────────────────────
// Source: Product Level Recommendations (slides 15-16)

export const NSFR_ASF_TABLE: Record<string, number> = {
  'CAPITAL': 1.00,
  'LONG_TERM_WHOLESALE_GT1Y': 1.00,
  'STABLE_DEPOSIT': 0.95,
  'SEMI_STABLE_DEPOSIT': 0.90,
  'NON_STABLE_DEPOSIT': 0.80,
  'OPERATIONAL_DEPOSIT': 0.50,
  'SHORT_TERM_WHOLESALE_6M_1Y': 0.50,
  'SHORT_TERM_WHOLESALE_LT6M': 0.00,
};

// ─── NSFR Required Stable Funding (RSF) Factors ─────────────────────────────

export const NSFR_RSF_TABLE: Record<string, number> = {
  'CASH_HQLA_L1': 0.00,
  'HQLA_L2A': 0.15,
  'HQLA_L2B': 0.50,
  'LOAN_LT1Y_CORP': 0.50,
  'LOAN_GT1Y_CORP_RW_LT35': 0.65,
  'LOAN_GT1Y_CORP_RW_GT35': 0.85,
  'MORTGAGE_RW_LT35': 0.65,
  'MORTGAGE_RW_GT35': 0.85,
  'CONSUMER_LOAN': 0.85,
  'CREDIT_CARD': 0.85,
  'OFF_BALANCE_COMMITTED': 0.05,
  'OFF_BALANCE_UNCOMMITTED': 0.00,
};

// ─── HQLA Buffer Cost (for LCR charge calculation) ──────────────────────────

export const LCR_HQLA_COST_BPS = 12.5; // bps: cost of holding HQLA buffer

// ─── NSFR Stable Maturity and Baseline ───────────────────────────────────────

export const NSFR_STABLE_MATURITY_MONTHS = 12; // 1Y stable part maturity
export const NSFR_BASE_COST_BPS = 8.0; // bps: baseline NSFR cost

// Legacy exports (backward compatibility)
export const LCR_FACTORS = LCR_OUTFLOW_TABLE;
export const NSFR_FACTORS = {
  Stable_Maturity_Cap: NSFR_STABLE_MATURITY_MONTHS,
  Undrawn_RSF: NSFR_RSF_TABLE['OFF_BALANCE_COMMITTED'],
};
