import React, { useMemo } from 'react';
import { Badge, Button } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { BookOpen, CheckCircle2, Download, FileSearch, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import type {
  ApprovalTask,
  MarketDataSource,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
  Transaction,
} from '../../types';
import type { WorkflowAction } from '../../utils/dealWorkflow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deal: Transaction | null;
  dossier?: PricingDossier;
  approvalTask?: ApprovalTask;
  methodologyVersion?: MethodologyVersion;
  portfolioSnapshot?: PortfolioSnapshot;
  marketDataSources: MarketDataSource[];
  availableActions: WorkflowAction[];
  onWorkflowAction: (deal: Transaction, action: WorkflowAction) => void;
  onExportPackage: () => void;
}

const getActionIcon = (action: WorkflowAction) => {
  if (action.to === 'Approved') return <CheckCircle2 className="h-4 w-4" />;
  if (action.to === 'Rejected') return <XCircle className="h-4 w-4" />;
  if (action.to === 'Booked') return <BookOpen className="h-4 w-4" />;
  return <ShieldCheck className="h-4 w-4" />;
};

const CommitteeDossierDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  deal,
  dossier,
  approvalTask,
  methodologyVersion,
  portfolioSnapshot,
  marketDataSources,
  availableActions,
  onWorkflowAction,
  onExportPackage,
}) => {
  const relevantSources = useMemo(() => {
    if (!dossier?.groundedContext?.marketDataSourceIds?.length) return marketDataSources;
    return marketDataSources.filter((source) => dossier.groundedContext?.marketDataSourceIds?.includes(source.id));
  }, [dossier?.groundedContext?.marketDataSourceIds, marketDataSources]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Committee Dossier${deal?.id ? ` • ${deal.id}` : ''}`}
      size="xl"
      footer={
        deal ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={onExportPackage}>
              <Download className="mr-2 h-4 w-4" />
              Export Review Package
            </Button>
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action) => (
                <Button
                  key={`${deal.id}-${action.to}`}
                  onClick={() => onWorkflowAction(deal, action)}
                  variant={action.to === 'Rejected' ? 'ghost' : 'primary'}
                >
                  {getActionIcon(action)}
                  <span className="ml-2">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : null
      }
    >
      {!deal || !dossier ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-6 text-sm text-[color:var(--nfq-text-secondary)]">
          No governed dossier is available for this transaction yet. Submit it for approval first to generate the full
          committee pack.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
              <div className="nfq-label">Status</div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--nfq-text-primary)]">{dossier.status}</div>
              <div className="mt-2">
                <Badge variant={dossier.status === 'Approved' || dossier.status === 'Booked' ? 'success' : 'warning'}>
                  {dossier.approvalLevel}
                </Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
              <div className="nfq-label">Final Client Rate</div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--nfq-text-primary)]">
                {dossier.pricingResult.finalClientRate.toFixed(2)}%
              </div>
              <div className="mt-1 text-xs text-[color:var(--nfq-text-secondary)]">
                RAROC {dossier.pricingResult.raroc.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
              <div className="nfq-label">Methodology</div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                {methodologyVersion?.label || dossier.methodologyVersionId}
              </div>
              <div className="mt-1 text-xs text-[color:var(--nfq-text-secondary)]">
                {dossier.pricingResult.matchedMethodology}
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
              <div className="nfq-label">Committee Support</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{dossier.evidence.length} evidence items</Badge>
                <Badge variant="outline">{dossier.aiResponseTraces?.length || 0} AI traces</Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">Pricing Narrative</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="nfq-label">Deal</div>
                    <div className="mt-1 text-sm text-[color:var(--nfq-text-primary)]">{deal.id}</div>
                  </div>
                  <div>
                    <div className="nfq-label">Client</div>
                    <div className="mt-1 text-sm text-[color:var(--nfq-text-primary)]">{deal.clientId}</div>
                  </div>
                  <div>
                    <div className="nfq-label">Amount</div>
                    <div className="mt-1 text-sm text-[color:var(--nfq-text-primary)]">
                      {deal.currency} {deal.amount.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="nfq-label">Term</div>
                    <div className="mt-1 text-sm text-[color:var(--nfq-text-primary)]">
                      {deal.durationMonths} months
                    </div>
                  </div>
                  <div>
                    <div className="nfq-label">Formula</div>
                    <div className="mt-1 text-sm text-[color:var(--nfq-text-primary)]">
                      {dossier.pricingResult.formulaUsed || 'Not captured'}
                    </div>
                  </div>
                  <div>
                    <div className="nfq-label">Decision Path</div>
                    <div className="mt-1 text-sm text-[color:var(--nfq-text-primary)]">
                      {approvalTask?.requiredRole || 'No approval task'}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">Approval Context</h3>
                </div>
                {approvalTask ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{approvalTask.status}</Badge>
                      <Badge variant="outline">{approvalTask.requiredRole}</Badge>
                    </div>
                    <div className="text-sm text-[color:var(--nfq-text-primary)]">{approvalTask.description}</div>
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <div className="nfq-label">Submitted By</div>
                        <div className="mt-1 text-[color:var(--nfq-text-primary)]">{approvalTask.submittedByName}</div>
                      </div>
                      <div>
                        <div className="nfq-label">Submitted At</div>
                        <div className="mt-1 text-[color:var(--nfq-text-primary)]">
                          {new Date(approvalTask.submittedAt).toLocaleString()}
                        </div>
                      </div>
                      {approvalTask.decidedAt && (
                        <>
                          <div>
                            <div className="nfq-label">Decided By</div>
                            <div className="mt-1 text-[color:var(--nfq-text-primary)]">
                              {approvalTask.decidedByName || approvalTask.decidedByEmail}
                            </div>
                          </div>
                          <div>
                            <div className="nfq-label">Decided At</div>
                            <div className="mt-1 text-[color:var(--nfq-text-primary)]">
                              {new Date(approvalTask.decidedAt).toLocaleString()}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--nfq-text-secondary)]">
                    No live approval task is attached to this dossier.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">AI Support</h3>
                </div>
                {dossier.aiResponseTraces?.length ? (
                  <div className="space-y-3">
                    {dossier.aiResponseTraces
                      .slice(-3)
                      .reverse()
                      .map((trace) => (
                        <div
                          key={trace.id}
                          className="rounded-xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{trace.model}</Badge>
                            {trace.groundedContext.methodologyVersionId && (
                              <Badge variant="secondary">{trace.groundedContext.methodologyVersionId}</Badge>
                            )}
                            {trace.groundedContext.portfolioSnapshotId && (
                              <Badge variant="warning">{trace.groundedContext.portfolioSnapshotId}</Badge>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-[color:var(--nfq-text-secondary)]">
                            {trace.responsePreview || 'Trace stored without response preview.'}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--nfq-text-secondary)]">
                    No AI committee trace recorded yet for this dossier.
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-5">
                <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">Evidence Pack</h3>
                <div className="mt-4 space-y-3">
                  {dossier.evidence.map((evidence) => (
                    <div
                      key={evidence.id}
                      className="rounded-xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[color:var(--nfq-text-primary)]">
                            {evidence.label}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--nfq-text-secondary)]">
                            {evidence.id} • {evidence.format.toUpperCase()}
                          </div>
                        </div>
                        <Badge variant={evidence.status === 'Generated' ? 'success' : 'warning'}>
                          {evidence.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-5">
                <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">Grounding</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {dossier.groundedContext?.methodologyVersionId && (
                    <Badge variant="secondary">{dossier.groundedContext.methodologyVersionId}</Badge>
                  )}
                  {dossier.groundedContext?.portfolioSnapshotId && (
                    <Badge variant="warning">{dossier.groundedContext.portfolioSnapshotId}</Badge>
                  )}
                  {relevantSources.map((source) => (
                    <Badge key={source.id} variant="outline">
                      {source.name}
                    </Badge>
                  ))}
                </div>
                {portfolioSnapshot && (
                  <div className="mt-4 rounded-xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4 text-sm">
                    <div className="font-medium text-[color:var(--nfq-text-primary)]">{portfolioSnapshot.name}</div>
                    <div className="mt-1 text-[color:var(--nfq-text-secondary)]">
                      {portfolioSnapshot.results.length} deals • Avg RAROC{' '}
                      {portfolioSnapshot.totals.averageRaroc.toFixed(2)}%
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};

export default CommitteeDossierDrawer;
