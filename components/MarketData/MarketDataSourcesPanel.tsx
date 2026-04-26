import React, { useEffect, useMemo, useState } from 'react';
import { createAuditEntry } from '../../api/audit';
import { Activity, DatabaseZap, Save, SatelliteDish, Sparkles } from 'lucide-react';
import type { MarketDataSource, UserProfile } from '../../types';
import { Badge, Button, Panel, SelectInput, TextInput } from '../ui/LayoutComponents';
import { useToast } from '../ui/Toast';
import { marketDataIngestionService } from '../../utils/supabase/marketDataIngestionService';
import {
  buildMarketDataSourceDraft,
  buildMarketDataSourceFromDraft,
  createDefaultMarketDataSourceDraft,
  type MarketDataSourceDraft,
} from './marketDataSourcesUtils';

interface MarketDataSourcesPanelProps {
  currentCurrency: string;
  selectedDate: string;
  user: UserProfile | null;
  sources: MarketDataSource[];
  selectedSourceId: string;
  onSelectedSourceChange: (sourceId: string) => void;
  onSourcesChange: React.Dispatch<React.SetStateAction<MarketDataSource[]>>;
}

const MarketDataSourcesPanel: React.FC<MarketDataSourcesPanelProps> = ({
  currentCurrency,
  selectedDate,
  user,
  sources,
  selectedSourceId,
  onSelectedSourceChange,
  onSourcesChange,
}) => {
  const { addToast } = useToast();
  const [draft, setDraft] = useState<MarketDataSourceDraft>(() => createDefaultMarketDataSourceDraft(currentCurrency));
  const yieldCurveSources = useMemo(() => sources.filter((source) => source.sourceType === 'YieldCurve'), [sources]);
  const selectedSource = useMemo(
    () => yieldCurveSources.find((source) => source.id === selectedSourceId),
    [selectedSourceId, yieldCurveSources]
  );

  useEffect(() => {
    if (selectedSource) {
      setDraft(buildMarketDataSourceDraft(selectedSource));
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      currenciesInput: currentDraft.currenciesInput || currentCurrency,
    }));
  }, [currentCurrency, selectedSource]);

  const handleDraftChange = <K extends keyof MarketDataSourceDraft>(key: K, value: MarketDataSourceDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const resetDraft = () => {
    onSelectedSourceChange('');
    setDraft(createDefaultMarketDataSourceDraft(currentCurrency));
  };

  const handleSave = async () => {
    const source = buildMarketDataSourceFromDraft(draft, currentCurrency, selectedSource);
    const nextSources = await marketDataIngestionService.registerMarketDataSource(source);
    onSourcesChange(nextSources);
    onSelectedSourceChange(source.id);

    await createAuditEntry({
      userEmail: user?.email || 'system',
      userName: user?.name || 'System',
      action: selectedSource ? 'UPDATE_MARKET_DATA_SOURCE' : 'REGISTER_MARKET_DATA_SOURCE',
      module: 'MARKET_DATA',
      description: `${selectedSource ? 'Updated' : 'Registered'} source ${source.name} for ${source.currencies.join(', ')}`,
      details: {
        sourceId: source.id,
        provider: source.provider,
        status: source.status,
      },
    });

    addToast('success', `Market data source ${source.name} is now governed.`);
  };

  return (
    <Panel
      className="min-h-[320px]"
      title="Market Data Sources"
      icon={<SatelliteDish className="h-4 w-4 text-cyan-400" />}
      actions={<Badge variant="outline">{yieldCurveSources.length} governed sources</Badge>}
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[var(--nfq-radius-card)] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <DatabaseZap className="h-4 w-4 text-cyan-400" />
                Active Capture Context
              </div>
              <div className="text-sm text-white">{currentCurrency} curve snapshot</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{selectedDate}</Badge>
                <Badge variant={selectedSource ? 'success' : 'warning'}>
                  {selectedSource ? selectedSource.provider : 'Ungoverned capture'}
                </Badge>
              </div>
            </div>

            <div className="rounded-[var(--nfq-radius-card)] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Governance Intent
              </div>
              <p className="text-sm leading-relaxed text-slate-300">
                Register the provider once and reuse it on each curve save/import so reporting can cite provenance.
              </p>
            </div>
          </div>

          <div className="rounded-[var(--nfq-radius-card)] border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white">
                  {selectedSource ? `Editing ${selectedSource.name}` : 'Register Yield Curve Source'}
                </h4>
                <p className="text-xs text-slate-400">
                  This registry is used by curve snapshots and future market-data adapters.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetDraft}>
                Reset
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="nfq-label">Source Name</span>
                <TextInput
                  value={draft.name}
                  onChange={(event) => handleDraftChange('name', event.target.value)}
                  placeholder="Bloomberg BVAL USD Curve"
                />
              </label>
              <label className="space-y-1.5">
                <span className="nfq-label">Provider</span>
                <TextInput
                  value={draft.provider}
                  onChange={(event) => handleDraftChange('provider', event.target.value)}
                  placeholder="Bloomberg"
                />
              </label>
              <label className="space-y-1.5">
                <span className="nfq-label">Covered Currencies</span>
                <TextInput
                  value={draft.currenciesInput}
                  onChange={(event) => handleDraftChange('currenciesInput', event.target.value)}
                  placeholder="USD, EUR, GBP"
                />
              </label>
              <label className="space-y-1.5">
                <span className="nfq-label">Status</span>
                <SelectInput
                  value={draft.status}
                  onChange={(event) => handleDraftChange('status', event.target.value as MarketDataSource['status'])}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </SelectInput>
              </label>
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="nfq-label">Notes</span>
              <textarea
                value={draft.notes}
                onChange={(event) => handleDraftChange('notes', event.target.value)}
                rows={3}
                className="nfq-input-field min-h-[90px] resize-y"
                placeholder="Provenance, refresh SLA, validation notes..."
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  void handleSave();
                }}
              >
                <Save className="mr-2 h-4 w-4" />
                {selectedSource ? 'Update Source' : 'Register Source'}
              </Button>
              {selectedSource && (
                <Button variant="outline" onClick={() => onSelectedSourceChange(selectedSource.id)}>
                  Use For Current Curve
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[var(--nfq-radius-card)] border border-white/10 bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Registered Sources</h4>
              <p className="text-xs text-slate-400">Choose one before saving/importing a governed curve snapshot.</p>
            </div>
            <Badge variant="secondary">{currentCurrency}</Badge>
          </div>

          <div className="space-y-3">
            {yieldCurveSources.length === 0 ? (
              <div className="rounded-[var(--nfq-radius-card)] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                No governed source yet. You can still save a curve, but provenance will be weaker until a source is
                registered.
              </div>
            ) : (
              yieldCurveSources.map((source) => {
                const isSelected = source.id === selectedSourceId;
                const supportsCurrency = source.currencies.includes(currentCurrency);

                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => onSelectedSourceChange(source.id)}
                    className={`w-full rounded-[var(--nfq-radius-card)] border p-4 text-left transition ${
                      isSelected
                        ? 'border-cyan-500/40 bg-cyan-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{source.name}</div>
                        <div className="mt-1 text-xs text-slate-400">{source.provider}</div>
                      </div>
                      <Badge variant={source.status === 'Active' ? 'success' : 'warning'}>{source.status}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {source.currencies.map((currency) => (
                        <Badge
                          key={`${source.id}-${currency}`}
                          variant={currency === currentCurrency ? 'secondary' : 'outline'}
                        >
                          {currency}
                        </Badge>
                      ))}
                      <Badge variant={supportsCurrency ? 'success' : 'warning'}>
                        {supportsCurrency ? 'Ready for current curve' : 'Needs currency coverage'}
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                      <Activity className="h-3.5 w-3.5" />
                      Last sync:{' '}
                      {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : 'Pending first capture'}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
};

export default MarketDataSourcesPanel;
