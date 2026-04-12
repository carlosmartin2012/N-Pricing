import type { Transaction, FTPResult } from '../types';

/** Safe toFixed that handles NaN/undefined by returning '0.0000'. */
function safeFixed(v: number | undefined | null, digits = 4): string {
  return Number.isFinite(v) ? (v as number).toFixed(digits) : (0).toFixed(digits);
}

/** Format amount with thousand separators and currency. */
function fmtAmount(amount: number | undefined, currency: string): string {
  return `${esc(currency)} ${(amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Escape HTML-special characters to prevent injection in generated markup. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the full HTML string for a pricing receipt PDF.
 * Separated from the rendering step so it can be tested or reused.
 */
function buildPricingReceiptHTML(
  deal: Transaction,
  result: FTPResult,
  clientName: string,
): string {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timestamp = new Date().toISOString();
  const dealId = deal.id || 'NEW';
  const traceId = `NPR-${dealId}-${Date.now().toString(36).toUpperCase()}`;

  const approvalColor = result.approvalLevel === 'Auto' ? '#10b981'
    : result.approvalLevel === 'L1_Manager' ? '#f59e0b'
    : result.approvalLevel === 'L2_Committee' ? '#f97316'
    : '#ef4444';

  return `<!DOCTYPE html>
<html>
<head>
  <title>FTP Pricing Receipt - ${esc(dealId)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 48px 56px; max-width: 800px; margin: 0 auto; position: relative; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 96px; font-weight: 800; color: rgba(6, 182, 212, 0.04); letter-spacing: 8px; pointer-events: none; z-index: 0; white-space: nowrap; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #0891b2; position: relative; z-index: 1; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #06b6d4, #0891b2); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 18px; }
    .brand-name { font-size: 24px; font-weight: 700; color: #0891b2; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px; }
    .meta { text-align: right; font-size: 12px; color: #64748b; line-height: 1.8; }
    .meta strong { color: #1e293b; font-weight: 600; }
    .meta .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .section { margin-bottom: 24px; position: relative; z-index: 1; }
    .section-title { font-size: 11px; font-weight: 600; color: #0891b2; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; }
    td:first-child { color: #64748b; width: 55%; font-size: 12px; }
    td:last-child { text-align: right; font-weight: 500; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .highlight { background: #f0fdfa; }
    .highlight td { font-weight: 700; color: #0891b2; font-size: 14px; }
    .approval-badge { display: inline-block; padding: 4px 16px; border-radius: 20px; color: white; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; position: relative; z-index: 1; }
    .footer-left { font-size: 9px; color: #94a3b8; line-height: 1.6; }
    .trace-id { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #94a3b8; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
    .confidential { display: inline-block; margin-top: 8px; font-size: 8px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 2px; }
    @media print { body { padding: 24px 32px; } .watermark { position: fixed; } }
  </style>
</head>
<body>
  <div class="watermark">N-PRICING</div>

  <div class="header">
    <div class="brand">
      <div class="brand-icon">N</div>
      <div>
        <div class="brand-name">N-Pricing</div>
        <div class="brand-sub">Funds Transfer Pricing Receipt</div>
      </div>
    </div>
    <div class="meta">
      <strong>Deal ID:</strong> <span class="mono">${esc(dealId)}</span><br/>
      <strong>Date:</strong> ${esc(date)}<br/>
      <strong>Client:</strong> ${esc(clientName)}<br/>
      <strong>Status:</strong> ${esc(deal.status || 'New')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Deal Parameters</div>
    <table>
      <tr><td>Product</td><td>${esc(deal.productType)}</td></tr>
      <tr><td>Category</td><td>${esc(deal.category)}</td></tr>
      <tr><td>Amount</td><td>${fmtAmount(deal.amount, deal.currency)}</td></tr>
      <tr><td>Duration</td><td>${deal.durationMonths ?? 0} months</td></tr>
      <tr><td>Amortization</td><td>${esc(deal.amortization)}</td></tr>
      <tr><td>Repricing</td><td>${esc(deal.repricingFreq)}</td></tr>
      <tr><td>Risk Weight</td><td>${deal.riskWeight ?? 0}%</td></tr>
      <tr><td>Collateral</td><td>${esc(deal.collateralType || 'None')}</td></tr>
      <tr><td>ESG Transition</td><td>${esc(deal.transitionRisk)}</td></tr>
      <tr><td>ESG Physical</td><td>${esc(deal.physicalRisk)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">FTP Decomposition</div>
    <table>
      <tr><td>Base Rate (IRRBB)</td><td>${safeFixed(result.baseRate)}%</td></tr>
      <tr><td>Liquidity Premium</td><td>${safeFixed(result._liquidityPremiumDetails)}%</td></tr>
      <tr><td>LCR Charge (CLC)</td><td>${safeFixed(result._clcChargeDetails)}%</td></tr>
      <tr><td>NSFR Charge</td><td>${safeFixed(result.nsfrCost)}%</td></tr>
      <tr><td>Liquidity Recharge</td><td>${safeFixed(result.liquidityRecharge)}%</td></tr>
      <tr><td>Credit Cost (PD×LGD)</td><td>${safeFixed(result.regulatoryCost)}%</td></tr>
      <tr><td>Operational Cost</td><td>${safeFixed(result.operationalCost)}%</td></tr>
      <tr><td>Capital Charge</td><td>${safeFixed(result.capitalCharge)}%</td></tr>
      <tr><td>ESG Transition</td><td>${safeFixed(result.esgTransitionCharge)}%</td></tr>
      <tr><td>ESG Physical</td><td>${safeFixed(result.esgPhysicalCharge)}%</td></tr>
      <tr><td>Strategic Spread</td><td>${safeFixed(result.strategicSpread)}%</td></tr>
      <tr><td>Incentivisation</td><td>${safeFixed(result.incentivisationAdj)}%</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Pricing Summary</div>
    <table>
      <tr><td>Floor Price</td><td>${safeFixed(result.floorPrice)}%</td></tr>
      <tr><td>Technical Price</td><td>${safeFixed(result.technicalPrice)}%</td></tr>
      <tr class="highlight"><td>Total FTP</td><td>${safeFixed(result.totalFTP)}%</td></tr>
      <tr><td>Margin Target</td><td>${safeFixed(deal.marginTarget, 2)}%</td></tr>
      <tr class="highlight"><td>Final Client Rate</td><td>${safeFixed(result.finalClientRate)}%</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Risk &amp; Governance</div>
    <table>
      <tr><td>RAROC</td><td>${safeFixed(result.raroc, 2)}%</td></tr>
      <tr><td>Economic Profit</td><td>${fmtAmount(result.economicProfit, deal.currency)}</td></tr>
      <tr><td>Approval Level</td><td><span class="approval-badge" style="background: ${approvalColor}">${esc(result.approvalLevel)}</span></td></tr>
      <tr><td>Methodology</td><td>${esc(result.matchedMethodology)}</td></tr>
      <tr><td>Formula</td><td>${esc(result.formulaUsed || '-')}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Accounting Entry</div>
    <table>
      <tr><td>Source (Debit)</td><td>${esc(result.accountingEntry?.source)}: ${fmtAmount(result.accountingEntry?.amountDebit, deal.currency)}</td></tr>
      <tr><td>Destination (Credit)</td><td>${esc(result.accountingEntry?.dest)}: ${fmtAmount(result.accountingEntry?.amountCredit, deal.currency)}</td></tr>
    </table>
  </div>

  <div class="footer">
    <div class="footer-left">
      N-Pricing FTP Engine — NFQ Advisory<br/>
      Generated ${esc(timestamp)}<br/>
      <span class="confidential">Confidential — Internal Use Only</span>
    </div>
    <div style="text-align: right">
      <div class="trace-id">${esc(traceId)}</div>
    </div>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

/**
 * Generate a printable pricing receipt and trigger browser print dialog.
 * Opens a new window, writes the receipt HTML, and triggers print.
 */
export function exportPricingPDF(
  deal: Transaction,
  result: FTPResult,
  clientName: string,
): void {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) return;

  const html = buildPricingReceiptHTML(deal, result, clientName);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
