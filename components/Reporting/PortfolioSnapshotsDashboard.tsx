import React, { useEffect, useMemo, useState } from 'react';
import { createAuditEntry } from '../../api/audit';
import { Archive, Download, Layers3, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import type { ApprovalMatrixConfig, PortfolioSnapshot, Transaction } from '../../types';
import { Badge, Button, Panel, SelectInput, TextInput } from '../ui/LayoutComponents';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useGovernance } from '../../contexts/DataContext';
import type { PricingContext } from '../../utils/pricingEngine';
import { portfolioReportingService } from '../../utils/supabase/portfolioReportingService';
import {
  buildPortfolioSnapshotCsv,
  buildPortfolioSnapshotDelta,
  createPortfolioScenario,
  PORTFOLIO_SCENARIO_PRESETS,
  type PortfolioScenarioPreset,
} from './portfolioSnapshotsUtils';

interface PortfolioSnapshotsDashboardProps {
  deals: Transaction[];
  approvalMatrix: ApprovalMatrixConfig;
  pricingContext: PricingContext;
}

const nominalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNominal(amount: number) {
  return nominalFormatter.format(amount);
}

const PortfolioSnapshotsDashboard: React.FC<PortfolioSnapshotsDashboardProps> = ({
  deals,
  approvalMatrix,
  pricingContext,
}) => {
  const { currentUser } = useAuth();
  const { portfolioSnapshots: snapshots, setPortfolioSnapshots: onSnapshotsChange } = useGovernance();
  const { addToast } = useToast();
  const [snapshotName, setSnapshotName] = useState(`Portfolio Snapshot ${new Date().toISOString().slice(0, 10)}`);
  const [selectedPreset, setSelectedPreset] = useState<PortfolioScenarioPreset>('BASE');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');

  const eligibleDeals = useMemo(() => deals.filter((deal) => deal.id && deal.amount > 0), [deals]);

  useEffect(() => {
    if (snapshots.length > 0 && !selectedSnapshotId) {
      setSelectedSnapshotId(snapshots[0].id);
    }
  }, [selectedSnapshotId, snapshots]);

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? snapshots[0],
    [selectedSnapshotId, snapshots]
  );
  const comparisonSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id !== selectedSnapshot?.id),
    [selectedSnapshot?.id, snapshots]
  );
  const delta = useMemo(
    () => buildPortfolioSnapshotDelta(selectedSnapshot, comparisonSnapshot),
    [comparisonSnapshot, selectedSnapshot]
  );

  const handleCreateSnapshot = async () => {
    const actorEmail = currentUser?.email || 'system';
    const actorName = currentUser?.name || 'System';
    const scenario = createPortfolioScenario({
      preset: selectedPreset,
      name: `${PORTFOLIO_SCENARIO_PRESETS[selectedPreset].label} ${new Date().toISOString().slice(0, 10)}`,
      createdByEmail: actorEmail,
      createdByName: actorName,
    });
    const snapshot = portfolioReportingService.createPortfolioSnapshot({
      name: snapshotName.trim() || `Portfolio Snapshot ${new Date().toISOString().slice(0, 10)}`,
      scenario,
      deals: eligibleDeals,
      approvalMatrix,
      pricingContext,
      createdByEmail: actorEmail,
      createdByName: actorName,
    });

    onSnapshotsChange((previous) => [snapshot, ...previous]);
    setSelectedSnapshotId(snapshot.id);

    await createAuditEntry({
      userEmail: actorEmail,
      userName: actorName,
      action: 'CREATE_PORTFOLIO_SNAPSHOT',
      module: 'REPORTING',
      description: `Created portfolio snapshot ${snapshot.name}`,
      details: {
        snapshotId: snapshot.id,
        scenario: snapshot.scenario.name,
        shocks: snapshot.scenario.shocks,
        dealCount: snapshot.dealIds.length,
      },
    });

    addToast('success', `Snapshot ${snapshot.name} created with ${snapshot.dealIds.length} deals.`);
  };

  const handleExportSnapshot = async (snapshot: PortfolioSnapshot) => {
    const csv = buildPortfolioSnapshotCsv(snapshot);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${snapshot.name.replaceAll(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    await createAuditEntry({
      userEmail: currentUser?.email || 'system',
      userName: currentUser?.name || 'System',
      action: 'EXPORT_PORTFOLIO_SNAPSHOT',
      module: 'REPORTING',
      description: `Exported portfolio snapshot ${snapshot.name}`,
      details: {
        snapshotId: snapshot.id,
      },
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel
        title="Snapshot Factory"
        icon={<Archive className="h-4 w-4 text-cyan-400" />}
        actions={<Badge variant="outline">{eligibleDeals.length} eligible deals</Badge>}
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="nfq-label">Snapshot Name</span>
              <TextInput
                value={snapshotName}
                onChange={(event) => setSnapshotName(event.target.value)}
                placeholder="Portfolio Snapshot 2026-04-02"
              />
            </label>
            <label className="space-y-1.5">
              <span className="nfq-label">Scenario Preset</span>
              <SelectInput
                value={selectedPreset}
                onChange={(event) => setSelectedPreset(event.target.value as PortfolioScenarioPreset)}
              >
                {Object.entries(PORTFOLIO_SCENARIO_PRESETS).map(([preset, definition]) => (
                  <option key={preset} value={preset}>
                    {definition.label}
                  </option>
                ))}
              </SelectInput>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="nfq-label mb-1 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Approval Lens
              </div>
              <div className="font-mono-nums text-2xl font-semibold text-white">
                {percentageFormatter.format(approvalMatrix.autoApprovalThreshold)}%
              </div>
              <div className="mt-1 text-xs text-slate-400">Auto-approval threshold currently enforced.</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="nfq-label mb-1 flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-cyan-400" />
                Scenario Definition
              </div>
              <div className="text-sm font-semibold text-white">{PORTFOLIO_SCENARIO_PRESETS[selectedPreset].label}</div>
              <div className="mt-1 text-xs text-slate-400">
                {PORTFOLIO_SCENARIO_PRESETS[selectedPreset].description}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="nfq-label mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Shock Pack
              </div>
              <div className="font-mono text-sm font-semibold text-white">
                IR {PORTFOLIO_SCENARIO_PRESETS[selectedPreset].shocks.interestRate >= 0 ? '+' : ''}
                {PORTFOLIO_SCENARIO_PRESETS[selectedPreset].shocks.interestRate} bps
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">
                Liquidity {PORTFOLIO_SCENARIO_PRESETS[selectedPreset].shocks.liquiditySpread >= 0 ? '+' : ''}
                {PORTFOLIO_SCENARIO_PRESETS[selectedPreset].shocks.liquiditySpread} bps
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                void handleCreateSnapshot();
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Create Snapshot
            </Button>
            {selectedSnapshot && (
              <Button
                variant="outline"
                onClick={() => {
                  void handleExportSnapshot(selectedSnapshot);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Snapshot Intelligence"
        icon={<TrendingUp className="h-4 w-4 text-cyan-400" />}
        actions={<Badge variant="secondary">{snapshots.length} snapshots</Badge>}
      >
        <div className="space-y-5">
          {selectedSnapshot ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Exposure</div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {formatNominal(selectedSnapshot.totals.exposure)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Delta vs previous {delta.exposureDelta >= 0 ? '+' : ''}
                    {formatNominal(delta.exposureDelta)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Average RAROC</div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {percentageFormatter.format(selectedSnapshot.totals.averageRaroc)}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Delta vs previous {delta.rarocDelta >= 0 ? '+' : ''}
                    {percentageFormatter.format(delta.rarocDelta)}%
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Average Client Rate</div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {percentageFormatter.format(selectedSnapshot.totals.averageFinalRate)}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Delta vs previous {delta.finalRateDelta >= 0 ? '+' : ''}
                    {percentageFormatter.format(delta.finalRateDelta)}%
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Recent Snapshots</h4>
                      <p className="text-xs text-slate-400">Reusable portfolio states for committee and reporting.</p>
                    </div>
                    <Badge variant="outline">{selectedSnapshot.scenario.name}</Badge>
                  </div>

                  <div className="space-y-3">
                    {snapshots.map((snapshot) => (
                      <button
                        key={snapshot.id}
                        type="button"
                        onClick={() => setSelectedSnapshotId(snapshot.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          snapshot.id === selectedSnapshot.id
                            ? 'border-cyan-500/40 bg-cyan-500/10'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{snapshot.name}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {new Date(snapshot.createdAt).toLocaleString()} by {snapshot.createdByName}
                            </div>
                          </div>
                          <Badge variant="secondary">{snapshot.results.length} deals</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{snapshot.scenario.name}</Badge>
                          <Badge variant="success">{snapshot.totals.approved} auto-approved</Badge>
                          <Badge variant="warning">{snapshot.totals.pendingApproval} pending</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Selected Snapshot Detail</h4>
                      <p className="text-xs text-slate-400">
                        Scenario {selectedSnapshot.scenario.name} with {selectedSnapshot.results.length} priced deals.
                      </p>
                    </div>
                    <Badge variant="outline">
                      IR {selectedSnapshot.scenario.shocks.interestRate >= 0 ? '+' : ''}
                      {selectedSnapshot.scenario.shocks.interestRate} / LP
                      {selectedSnapshot.scenario.shocks.liquiditySpread >= 0 ? '+' : ''}
                      {selectedSnapshot.scenario.shocks.liquiditySpread}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {selectedSnapshot.results.slice(0, 8).map((result) => (
                      <div
                        key={`${selectedSnapshot.id}-${result.dealId}`}
                        className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="truncate font-medium text-white">{result.dealId}</div>
                          <div className="text-xs text-slate-500">{result.currency}</div>
                        </div>
                        <div className="text-right text-slate-200">
                          {result.currency} {formatNominal(result.amount)}
                        </div>
                        <div className="text-right text-slate-200">{percentageFormatter.format(result.raroc)}%</div>
                        <div className="text-right">
                          <Badge
                            variant={
                              result.approvalLevel === 'Auto'
                                ? 'success'
                                : result.approvalLevel === 'Rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {result.approvalLevel}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
              No portfolio snapshot yet. Create one to freeze a governed pricing state for reporting and committee.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default PortfolioSnapshotsDashboard;
