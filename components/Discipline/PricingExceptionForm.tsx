import React, { useState, useCallback } from 'react';
import { FileWarning, Send, X } from 'lucide-react';
import { useCreateException } from '../../hooks/queries/useDisciplineQueries';
import type { PricingExceptionReasonCode } from '../../types';

interface Props {
  dealId: string;
  onSubmit: () => void;
  onCancel: () => void;
}

const REASON_CODES: { value: PricingExceptionReasonCode; label: string }[] = [
  { value: 'relationship', label: 'Relationship Pricing' },
  { value: 'strategic_client', label: 'Strategic Client' },
  { value: 'market_spread', label: 'Market Spread Adjustment' },
  { value: 'competitive_pressure', label: 'Competitive Pressure' },
  { value: 'volume_commitment', label: 'Volume Commitment' },
  { value: 'cross_sell', label: 'Cross-Sell Opportunity' },
  { value: 'other', label: 'Other' },
];

const PricingExceptionForm: React.FC<Props> = ({ dealId, onSubmit, onCancel }) => {
  const [reasonCode, setReasonCode] = useState<PricingExceptionReasonCode>('relationship');
  const [reasonDetail, setReasonDetail] = useState('');

  const createMutation = useCreateException();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!reasonDetail.trim()) return;

      createMutation.mutate(
        {
          dealId,
          reasonCode,
          reasonDetail: reasonDetail.trim(),
          requestedBy: '', // will be filled by backend / auth context
          status: 'pending',
        },
        {
          onSuccess: () => onSubmit(),
        },
      );
    },
    [dealId, reasonCode, reasonDetail, createMutation, onSubmit],
  );

  return (
    <div className="nfq-kpi-card">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning size={16} className="text-amber-400" />
          <span className="nfq-kpi-label">New Pricing Exception</span>
        </div>
        <button
          onClick={onCancel}
          className="rounded p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Deal info summary */}
      <div className="mb-5 rounded-lg border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-4 py-3">
        <div className="nfq-kpi-label mb-1">Deal Reference</div>
        <span className="font-mono text-xs text-cyan-400">{dealId}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Reason code */}
        <label className="flex flex-col gap-2">
          <span className="nfq-label">Reason Code</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as PricingExceptionReasonCode)}
            className="nfq-select-field text-xs"
            required
          >
            {REASON_CODES.map((rc) => (
              <option key={rc.value} value={rc.value}>{rc.label}</option>
            ))}
          </select>
        </label>

        {/* Reason detail */}
        <label className="flex flex-col gap-2">
          <span className="nfq-label">Justification</span>
          <textarea
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder="Describe the business rationale for this pricing exception..."
            rows={4}
            required
            className="nfq-input-field resize-none text-xs"
          />
          <span className="text-[10px] text-[color:var(--nfq-text-muted)]">
            {reasonDetail.length}/500 characters
          </span>
        </label>

        {/* Error state */}
        {createMutation.isError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-4 py-2 text-xs text-rose-400">
            Failed to create exception. Please try again.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="nfq-button nfq-button-ghost px-4 text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !reasonDetail.trim()}
            className="nfq-button nfq-button-primary px-4 text-xs disabled:opacity-50"
          >
            <Send size={14} className="mr-1.5 inline" />
            {createMutation.isPending ? 'Submitting...' : 'Submit Exception'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PricingExceptionForm;
