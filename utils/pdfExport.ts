import type { Transaction, FTPResult } from '../types';

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
 * Generate a printable pricing receipt and trigger browser print dialog.
 * Uses a new window with formatted HTML that produces a clean PDF.
 */
export function exportPricingPDF(
  deal: Transaction,
  result: FTPResult,
  clientName: string,
): void {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) return;

  const date = new Date().toLocaleDateString('en-GB');
  const dealId = deal.id || 'NEW';

  const approvalColor = result.approvalLevel === 'Auto' ? '#10b981'
    : result.approvalLevel === 'L1_Manager' ? '#f59e0b'
    : result.approvalLevel === 'L2_Committee' ? '#f97316'
    : '#ef4444';

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>FTP Pricing Receipt - ${dealId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #0891b2; padding-bottom: 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #0891b2; }
    .logo span { color: #64748b; font-weight: normal; font-size: 14px; display: block; }
    .meta { text-align: right; font-size: 12px; color: #64748b; }
    .meta strong { color: #1e293b; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14px; font-weight: 600; color: #0891b2; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 6px 12px; border-bottom: 1px solid #f1f5f9; }
    td:first-child { color: #64748b; width: 55%; }
    td:last-child { text-align: right; font-weight: 500; }
    .highlight { background: #f0fdfa; }
    .highlight td { font-weight: 700; color: #0891b2; font-size: 15px; }
    .approval-badge { display: inline-block; padding: 4px 16px; border-radius: 20px; color: white; font-weight: 600; font-size: 13px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">N-Pricing<span>Funds Transfer Pricing Receipt</span></div>
    <div class="meta">
      <strong>Deal ID:</strong> ${esc(dealId)}<br/>
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
      <tr><td>Amount</td><td>${esc(deal.currency)} ${deal.amount.toLocaleString()}</td></tr>
      <tr><td>Duration</td><td>${deal.durationMonths} months</td></tr>
      <tr><td>Amortization</td><td>${esc(deal.amortization)}</td></tr>
      <tr><td>Repricing</td><td>${esc(deal.repricingFreq)}</td></tr>
      <tr><td>Risk Weight</td><td>${deal.riskWeight}%</td></tr>
      <tr><td>ESG Transition</td><td>${esc(deal.transitionRisk)}</td></tr>
      <tr><td>ESG Physical</td><td>${esc(deal.physicalRisk)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">FTP Decomposition</div>
    <table>
      <tr><td>Base Rate (IRRBB)</td><td>${result.baseRate.toFixed(4)}%</td></tr>
      <tr><td>Liquidity Premium</td><td>${result._liquidityPremiumDetails.toFixed(4)}%</td></tr>
      <tr><td>LCR Charge (CLC)</td><td>${result._clcChargeDetails.toFixed(4)}%</td></tr>
      <tr><td>NSFR Charge</td><td>${(result.nsfrCost || 0).toFixed(4)}%</td></tr>
      <tr><td>Liquidity Recharge</td><td>${(result.liquidityRecharge || 0).toFixed(4)}%</td></tr>
      <tr><td>Credit Cost (PD×LGD)</td><td>${result.regulatoryCost.toFixed(4)}%</td></tr>
      <tr><td>Operational Cost</td><td>${result.operationalCost.toFixed(4)}%</td></tr>
      <tr><td>Capital Charge</td><td>${result.capitalCharge.toFixed(4)}%</td></tr>
      <tr><td>ESG Transition</td><td>${result.esgTransitionCharge.toFixed(4)}%</td></tr>
      <tr><td>ESG Physical</td><td>${result.esgPhysicalCharge.toFixed(4)}%</td></tr>
      <tr><td>Strategic Spread</td><td>${result.strategicSpread.toFixed(4)}%</td></tr>
      <tr><td>Incentivisation</td><td>${(result.incentivisationAdj || 0).toFixed(4)}%</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Pricing Summary</div>
    <table>
      <tr><td>Floor Price</td><td>${result.floorPrice.toFixed(4)}%</td></tr>
      <tr><td>Technical Price</td><td>${result.technicalPrice.toFixed(4)}%</td></tr>
      <tr class="highlight"><td>Total FTP</td><td>${result.totalFTP.toFixed(4)}%</td></tr>
      <tr><td>Margin Target</td><td>${deal.marginTarget.toFixed(2)}%</td></tr>
      <tr class="highlight"><td>Final Client Rate</td><td>${result.finalClientRate.toFixed(4)}%</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Risk & Governance</div>
    <table>
      <tr><td>RAROC</td><td>${result.raroc.toFixed(2)}%</td></tr>
      <tr><td>Economic Profit</td><td>${deal.currency} ${result.economicProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>
      <tr><td>Approval Level</td><td><span class="approval-badge" style="background: ${approvalColor}">${esc(result.approvalLevel)}</span></td></tr>
      <tr><td>Methodology</td><td>${esc(result.matchedMethodology)}</td></tr>
      <tr><td>Formula</td><td>${esc(result.formulaUsed || '-')}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Accounting Entry</div>
    <table>
      <tr><td>Source (Debit)</td><td>${esc(result.accountingEntry.source)}: ${esc(deal.currency)} ${result.accountingEntry.amountDebit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>
      <tr><td>Destination (Credit)</td><td>${esc(result.accountingEntry.dest)}: ${esc(deal.currency)} ${result.accountingEntry.amountCredit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>
    </table>
  </div>

  <div class="footer">
    N-Pricing FTP Engine | Generated ${new Date().toISOString()} | Confidential
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
