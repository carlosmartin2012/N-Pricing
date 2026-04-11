import React from 'react';
import type { ApprovalMatrixConfig, FTPResult, Transaction } from '../../types';
import { Badge } from '../ui/LayoutComponents';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileDown,
  FilePlus,
  Save,
  TrendingUp,
  XCircle,
} from 'lucide-react';

interface PricingReceiptSummaryProps {
  approvalMatrix: ApprovalMatrixConfig;
  customerRateLabel?: string;
  deal: Transaction;
  result: FTPResult;
}

export function PricingReceiptSummary({
  approvalMatrix,
  customerRateLabel,
  deal,
  result,
}: PricingReceiptSummaryProps) {
  return (
    <div
      data-tour="receipt-raroc"
      className="border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h4 className="nfq-label">Projected RAROC</h4>
          <div
            data-testid="receipt-raroc"
            className={`font-mono-nums text-3xl font-bold tracking-tight ${
              result.raroc >= approvalMatrix.autoApprovalThreshold
                ? 'text-emerald-600 dark:text-emerald-400'
                : result.raroc > 0
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-red-500'
            }`}
          >
            {result.raroc.toFixed(2)}%
          </div>
          <div className="font-mono text-[10px] text-slate-500">Target {deal.targetROE}%</div>
        </div>

        <div className="text-right">
          <h4 className="nfq-label">{customerRateLabel}</h4>
          <div
            data-testid="receipt-final-rate"
            className="font-mono-nums text-2xl font-bold text-slate-900 dark:text-white"
          >
            {result.finalClientRate.toFixed(2)}%
          </div>
          <div className="font-mono text-[10px] text-slate-500">All-in Price</div>
        </div>
      </div>

      <div
        data-testid="receipt-approval"
        className={`flex items-center gap-2 rounded border p-2 ${
          result.approvalLevel === 'Auto'
            ? 'border-emerald-900 bg-emerald-950/30 text-emerald-400'
            : result.approvalLevel === 'L1_Manager'
              ? 'border-amber-900 bg-amber-950/30 text-amber-400'
              : result.approvalLevel === 'L2_Committee'
                ? 'border-orange-900 bg-orange-950/30 text-orange-400'
                : 'border-red-900 bg-red-950/30 text-red-400'
        }`}
      >
        {result.approvalLevel === 'Auto' && <CheckCircle2 size={16} />}
        {result.approvalLevel === 'L1_Manager' && <AlertTriangle size={16} />}
        {result.approvalLevel === 'L2_Committee' && <TrendingUp size={16} />}
        {result.approvalLevel === 'Rejected' && <XCircle size={16} />}

        <div className="flex-1 text-xs font-bold uppercase">
          {result.approvalLevel === 'Auto' && 'Automatic Approval'}
          {result.approvalLevel === 'L1_Manager' && 'Requires L1 Manager Review'}
          {result.approvalLevel === 'L2_Committee' && 'Escalation: Pricing Committee'}
          {result.approvalLevel === 'Rejected' && 'Deal Below Floor - Rejected'}
        </div>
      </div>
    </div>
  );
}

interface PricingReceiptFooterProps {
  dealSaveStatus: 'idle' | 'saving' | 'saved';
  onExportReceipt: () => void;
  onSaveAsDeal: () => void;
  saveStatus: 'idle' | 'saving' | 'saved';
  validationErrorCount: number;
}

export function PricingReceiptFooter({
  dealSaveStatus,
  onExportReceipt,
  onSaveAsDeal,
  saveStatus,
  validationErrorCount,
}: PricingReceiptFooterProps) {
  return (
    <div
      data-tour="save-deal"
      className="flex items-center gap-2 border-t border-slate-700 bg-slate-900 p-3"
    >
      <button
        data-testid="save-deal-btn"
        onClick={onSaveAsDeal}
        disabled={dealSaveStatus === 'saving' || validationErrorCount > 0}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
          validationErrorCount > 0
            ? 'cursor-not-allowed bg-slate-700 text-slate-500'
            : dealSaveStatus === 'saved'
              ? 'bg-emerald-600 text-white'
              : 'bg-cyan-600 text-white hover:bg-cyan-500'
        }`}
      >
        {dealSaveStatus === 'saved' ? (
          <Check size={14} />
        ) : dealSaveStatus === 'saving' ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent border-white" />
        ) : (
          <FilePlus size={14} />
        )}
        {dealSaveStatus === 'saved'
          ? 'Deal Saved to Blotter'
          : dealSaveStatus === 'saving'
            ? 'Saving...'
            : 'Save as Deal'}
      </button>
      <button
        onClick={onExportReceipt}
        className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-600"
        title="Print / Save as PDF"
      >
        <FileDown size={14} /> PDF
      </button>
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-500">
          <Save size={10} /> Auto-saved
        </div>
      )}
    </div>
  );
}

interface PricingReceiptAccountingPanelProps {
  accountingEntry: FTPResult['accountingEntry'];
  currencyFormatter: (value: number) => string;
  onToggle: () => void;
  showAccounting: boolean;
}

export function PricingReceiptAccountingPanel({
  accountingEntry,
  currencyFormatter,
  onToggle,
  showAccounting,
}: PricingReceiptAccountingPanelProps) {
  return (
    <div className="border-t border-slate-700 bg-slate-900 p-2">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded p-2 text-xs text-slate-400 transition-colors hover:bg-slate-800"
      >
        <span className="flex items-center gap-2 font-mono font-bold uppercase">
          {showAccounting ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          GL Posting Preview
        </span>
        <Badge variant="default">GL: 102-393</Badge>
      </button>

      {showAccounting && (
        <div className="animate-in slide-in-from-top-2 mt-2 space-y-2 rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] fade-in">
          <div className="grid grid-cols-12 gap-2 text-slate-300">
            <div className="col-span-1 text-slate-500">DR</div>
            <div className="col-span-5">{accountingEntry.source}</div>
            <div className="col-span-2 text-right text-slate-500">EXP</div>
            <div className="col-span-4 text-right">
              {currencyFormatter(accountingEntry.amountDebit)}
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2 text-slate-300">
            <div className="col-span-1 text-slate-500">CR</div>
            <div className="col-span-5">{accountingEntry.dest}</div>
            <div className="col-span-2 text-right text-slate-500">INC</div>
            <div className="col-span-4 text-right">
              {currencyFormatter(accountingEntry.amountCredit)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
