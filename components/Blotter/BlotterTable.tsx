import React, { useRef, useMemo } from 'react';
import { BookOpen, CheckCircle2, Clock, Copy, Edit, FileSearch, FileText, RotateCcw, Send, Target, Trash2, XCircle } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '../ui/LayoutComponents';
import {
  canCreateOrCloneDeals,
  canDeleteDeal,
  canEditDeal,
  formatStatus,
  getAvailableActions,
  type UserRole,
  type WorkflowAction,
} from '../../utils/dealWorkflow';
import { getOutcomeStyle } from '../../utils/dealOutcome';
import type { BehaviouralModel, Transaction } from '../../types';

const VIRTUAL_THRESHOLD = 50;
const ROW_HEIGHT_ESTIMATE = 48;

interface Props {
  deals: Transaction[];
  behaviouralModels: BehaviouralModel[];
  userRole: UserRole;
  onWorkflowAction: (deal: Transaction, action: WorkflowAction) => void;
  onOpenDossier: (deal: Transaction) => void;
  onCloneDeal: (deal: Transaction) => void;
  onEditDeal: (deal: Transaction) => void;
  onDeleteDeal: (deal: Transaction) => void;
  onCaptureOutcome?: (deal: Transaction) => void;
  formatCurrency: (value: number, currency: string) => string;
  selectedDealIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

const getActionIcon = (label: string) => {
  if (label.includes('Submit')) return <Send size={12} />;
  if (label.includes('Approve')) return <CheckCircle2 size={12} />;
  if (label.includes('Reject')) return <XCircle size={12} />;
  if (label.includes('Book')) return <BookOpen size={12} />;
  if (label.includes('Rework') || label.includes('Re-submit')) return <RotateCcw size={12} />;
  return <Clock size={12} />;
};

const getActionColor = (to: string) => {
  if (to === 'Approved') return 'bg-[var(--nfq-success)] hover:bg-[var(--nfq-success-hover)] text-white';
  if (to === 'Rejected') return 'bg-[var(--nfq-danger)] hover:bg-[var(--nfq-danger-hover)] text-white';
  if (to === 'Booked') return 'bg-[var(--nfq-info)] hover:bg-[var(--nfq-info-hover)] text-white';
  if (to === 'Pending_Approval') return 'bg-[var(--nfq-warning)] hover:bg-[var(--nfq-warning-hover)] text-white';
  return 'bg-[var(--nfq-bg-bright)] hover:bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-secondary)]';
};

const getStatusStyle = (status: string | undefined) => {
  switch (status) {
    case 'Draft':
      return { dot: 'bg-[var(--nfq-text-muted)]', text: 'text-[color:var(--nfq-text-muted)]' };
    case 'Pending_Approval':
      return { dot: 'bg-[var(--nfq-warning)]', text: 'text-[var(--nfq-warning)]' };
    case 'Approved':
      return { dot: 'bg-[var(--nfq-success)]', text: 'text-[var(--nfq-success)]' };
    case 'Rejected':
      return { dot: 'bg-[var(--nfq-danger)]', text: 'text-[var(--nfq-danger)]' };
    case 'Booked':
      return { dot: 'bg-[var(--nfq-info)]', text: 'text-[var(--nfq-info)]' };
    default:
      return { dot: 'bg-[var(--nfq-text-muted)]', text: 'text-[color:var(--nfq-text-muted)]' };
  }
};

const DealRow: React.FC<{
  deal: Transaction;
  userRole: UserRole;
  modelNames: Map<string, string>;
  onWorkflowAction: (deal: Transaction, action: WorkflowAction) => void;
  onOpenDossier: (deal: Transaction) => void;
  onCloneDeal: (deal: Transaction) => void;
  onEditDeal: (deal: Transaction) => void;
  onDeleteDeal: (deal: Transaction) => void;
  onCaptureOutcome?: (deal: Transaction) => void;
  formatCurrency: (value: number, currency: string) => string;
  style?: React.CSSProperties;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}> = ({ deal, userRole, modelNames, onWorkflowAction, onOpenDossier, onCloneDeal, onEditDeal, onDeleteDeal, onCaptureOutcome, formatCurrency, style, isSelected, onToggleSelect }) => {
  const availableActions = getAvailableActions(deal.status || 'Draft', userRole);
  const canEdit = canEditDeal(deal, userRole);
  const canClone = canCreateOrCloneDeals(userRole);
  const canDelete = canDeleteDeal(userRole);
  const editDisabledTitle = userRole === 'Auditor' ? 'Read-only role' : 'Deal is locked';
  const editDisabledLabel = userRole === 'Auditor' ? `Edit disabled for deal ${deal.id}` : `Deal ${deal.id} is locked`;

  const statusStyle = getStatusStyle(deal.status);

  return (
    <tr style={style} className={`group transition-colors hover:bg-[var(--nfq-bg-elevated)] even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] ${isSelected ? '!bg-[rgba(6,182,212,0.06)]' : ''}`}>
      {onToggleSelect && (
        <td className="w-10 border-b border-[color:var(--nfq-border-ghost)] px-2 py-2 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
          />
        </td>
      )}
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
        <div className="font-mono text-xs font-bold text-[var(--nfq-accent)] [font-variant-numeric:tabular-nums]">{deal.id}</div>
        <div className="font-mono text-[9px] text-[color:var(--nfq-text-muted)] [font-variant-numeric:tabular-nums]">{deal.startDate}</div>
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
        <div className="text-xs font-bold text-[color:var(--nfq-text-primary)]">{deal.clientId}</div>
        <div className="text-[10px] text-[color:var(--nfq-text-muted)]">{deal.clientType}</div>
      </td>
      <td className="hidden whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 md:table-cell">
        <Badge variant="outline" className="text-[9px] font-bold">
          {deal.productType}
        </Badge>
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs font-bold text-[color:var(--nfq-text-secondary)] [font-variant-numeric:tabular-nums]">
        {formatCurrency(deal.amount, deal.currency)}
      </td>
      <td className="hidden whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center font-mono text-xs text-[color:var(--nfq-text-tertiary)] [font-variant-numeric:tabular-nums] sm:table-cell">
        {deal.durationMonths}m
      </td>
      <td className="hidden whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs font-bold text-[var(--nfq-success)] [font-variant-numeric:tabular-nums] lg:table-cell">
        +{(deal.marginTarget ?? 0).toFixed(2)}%
      </td>
      <td className="hidden whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 xl:table-cell">
        <div className="max-w-[200px] truncate text-[10px] text-[color:var(--nfq-text-muted)]">
          {modelNames.get(deal.behaviouralModelId || '') || '-'}
        </div>
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center">
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          <span className={`font-mono text-[10px] font-medium uppercase tracking-wide ${statusStyle.text}`}>
            {formatStatus(deal.status || 'Draft')}
          </span>
        </span>
      </td>
      <td className="hidden whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center lg:table-cell">
        {(() => {
          const outcomeStyle = getOutcomeStyle(deal.wonLost);
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${outcomeStyle.dot}`} />
              <span className={`font-mono text-[10px] font-medium uppercase tracking-wide ${outcomeStyle.text}`}>
                {outcomeStyle.label}
              </span>
            </span>
          );
        })()}
      </td>
      <td className="hidden whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center md:table-cell">
        <div className="flex flex-wrap items-center justify-center gap-1">
          {availableActions.map((action) => (
            <button
              key={action.to}
              onClick={() => onWorkflowAction(deal, action)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] font-bold transition-colors ${getActionColor(action.to)}`}
              title={`${action.label} (requires ${action.requiredRoles.join('/')})`}
            >
              {getActionIcon(action.label)}
              {action.label}
            </button>
          ))}
          {availableActions.length === 0 && <span className="text-[9px] text-[color:var(--nfq-text-faint)]">No actions</span>}
        </div>
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onOpenDossier(deal)}
            className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[var(--nfq-accent)]"
            title="Open committee dossier"
            aria-label={`Open committee dossier for deal ${deal.id}`}
          >
            <FileSearch size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => onCloneDeal(deal)}
            className={`p-1 transition-colors ${canClone ? 'text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-warning)]' : 'cursor-not-allowed text-[color:var(--nfq-text-faint)]'}`}
            disabled={!canClone}
            title={canClone ? 'Clone deal' : 'Read-only role'}
            aria-label={canClone ? `Clone deal ${deal.id}` : `Clone disabled for deal ${deal.id}`}
          >
            <Copy size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => onEditDeal(deal)}
            className={`p-1 transition-colors ${canEdit ? 'text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-accent)]' : 'cursor-not-allowed text-[color:var(--nfq-text-faint)]'}`}
            disabled={!canEdit}
            title={canEdit ? 'Edit deal' : editDisabledTitle}
            aria-label={canEdit ? `Edit deal ${deal.id}` : editDisabledLabel}
          >
            <Edit size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => onDeleteDeal(deal)}
            className={`p-1 transition-colors ${canDelete ? 'text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-danger)]' : 'cursor-not-allowed text-[color:var(--nfq-text-faint)]'}`}
            disabled={!canDelete}
            title={canDelete ? 'Delete deal' : 'Read-only role'}
            aria-label={canDelete ? `Delete deal ${deal.id}` : `Delete disabled for deal ${deal.id}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
          {onCaptureOutcome && (
            <button
              onClick={() => onCaptureOutcome(deal)}
              className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[var(--nfq-accent)]"
              title="Capture deal outcome (won/lost)"
              aria-label={`Capture outcome for deal ${deal.id}`}
            >
              <Target size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

const TableHeader: React.FC<{ hasSelection?: boolean; allSelected?: boolean; onToggleAll?: () => void }> = ({ hasSelection, allSelected, onToggleAll }) => (
  <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
    <tr>
      {hasSelection && (
        <th scope="col" className="w-10 border-b border-[color:var(--nfq-border-ghost)] px-2 py-2 text-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
          />
        </th>
      )}
      <th scope="col" className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-left nfq-label">
        Transaction ID
      </th>
      <th scope="col" className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-left nfq-label">
        Client / Type
      </th>
      <th scope="col" className="hidden border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-left nfq-label md:table-cell">
        Product
      </th>
      <th scope="col" className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right nfq-label">
        Amount
      </th>
      <th scope="col" className="hidden border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center nfq-label sm:table-cell">
        Tenor
      </th>
      <th scope="col" className="hidden border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right nfq-label lg:table-cell">
        Margin
      </th>
      <th scope="col" className="hidden border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-left nfq-label xl:table-cell">
        Model
      </th>
      <th scope="col" className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center nfq-label">
        Status
      </th>
      <th scope="col" className="hidden border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center nfq-label lg:table-cell">
        Outcome
      </th>
      <th scope="col" className="hidden border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center nfq-label md:table-cell">
        Actions
      </th>
      <th scope="col" className="w-10 border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right nfq-label" />
    </tr>
  </thead>
);

const BlotterTable: React.FC<Props> = ({
  deals,
  behaviouralModels,
  userRole,
  onWorkflowAction,
  onOpenDossier,
  onCloneDeal,
  onEditDeal,
  onDeleteDeal,
  onCaptureOutcome,
  formatCurrency,
  selectedDealIds = new Set(),
  onSelectionChange,
}) => {
  const toggleDeal = (dealId: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedDealIds);
    if (next.has(dealId)) next.delete(dealId);
    else next.add(dealId);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (selectedDealIds.size === deals.filter((d) => d.id).length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(deals.map((d) => d.id).filter(Boolean) as string[]));
    }
  };
  const modelNames = useMemo(
    () => new Map(behaviouralModels.map((model) => [model.id, model.name])),
    [behaviouralModels]
  );

  const useVirtual = deals.length > VIRTUAL_THRESHOLD;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: deals.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 10,
    enabled: useVirtual,
  });

  if (deals.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--nfq-bg-elevated)]">
          <FileText size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">No deals found</h3>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--nfq-text-muted)]">
            Create your first deal to start pricing, or adjust your search filters.
          </p>
        </div>
      </div>
    );
  }

  const rowProps = {
    userRole,
    modelNames,
    onWorkflowAction,
    onOpenDossier,
    onCloneDeal,
    onEditDeal,
    onDeleteDeal,
    onCaptureOutcome,
    formatCurrency,
  };

  /* ------ Small list: render all rows without virtualization ------ */
  if (!useVirtual) {
    return (
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full" aria-label="Deal blotter">
            <TableHeader hasSelection={!!onSelectionChange} allSelected={selectedDealIds.size > 0 && selectedDealIds.size === deals.filter((d) => d.id).length} onToggleAll={toggleAll} />
            <tbody>
              {deals.map((deal) => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  {...rowProps}
                  isSelected={deal.id ? selectedDealIds.has(deal.id) : false}
                  onToggleSelect={onSelectionChange && deal.id ? () => toggleDeal(deal.id!) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ------ Large list: virtual scrolling ------ */
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Padding-based approach: empty spacer rows before/after the visible window
  // so the scrollbar height and position remain correct.
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto custom-scrollbar"
    >
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full" aria-label="Deal blotter">
          <TableHeader hasSelection={!!onSelectionChange} allSelected={selectedDealIds.size > 0 && selectedDealIds.size === deals.filter((d) => d.id).length} onToggleAll={toggleAll} />
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop, padding: 0, border: 0 }} colSpan={11} />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const deal = deals[virtualRow.index];
              if (!deal) return null;
              return (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  {...rowProps}
                  isSelected={deal.id ? selectedDealIds.has(deal.id) : false}
                  onToggleSelect={onSelectionChange && deal.id ? () => toggleDeal(deal.id!) : undefined}
                  style={{
                    height: `${virtualRow.size}px`,
                  }}
                />
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom, padding: 0, border: 0 }} colSpan={11} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BlotterTable;
