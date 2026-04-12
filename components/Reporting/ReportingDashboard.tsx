import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { INITIAL_DEAL } from '../../constants';
import { Badge } from '../ui/LayoutComponents';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useCoreData, useMarketData } from '../../contexts/DataContext';
import { BarChart4, RefreshCw, AlertCircle, Info, Calculator, Globe, Lock, Unlock, Layers, Download, ChevronDown } from 'lucide-react';

import { useEntity } from '../../contexts/EntityContext';
import { useUI } from '../../contexts/UIContext';
import {
  generateLCRReport,
  generateNSFRReport,
  generateIRRBBReport,
  exportLCRToXML,
  exportNSFRToXML,
  exportIRRBBToJSON,
} from '../../utils/regulatoryExport';
import type { Transaction } from '../../types';
import ExecutiveDashboard from './ExecutiveDashboard';
import PortfolioSnapshotsDashboard from './PortfolioSnapshotsDashboard';
import { buildPricingContext, getPrimaryLiquidityPoints } from '../../utils/pricingContext';
import { batchReprice } from '../../utils/pricingEngine';
import { usePortfolioMetrics } from './hooks/usePortfolioMetrics';
import { useScenarioAnalysis } from './hooks/useScenarioAnalysis';
import { useFundingCurveData } from './hooks/useFundingCurveData';
import {
  TAB_GROUPS,
  DEFAULT_CURRENCY,
  DEFAULT_COLLATERAL_TYPE,
  DEFAULT_CURVE_SHIFT,
  DEFAULT_SUB_TAB,
  LCR_OUTFLOW_PRESETS,
  CURRENCY_OPTIONS,
} from './reportingConstants';
import type { SubTab } from './reportingConstants';
import type { FundingCollateralType } from './reportingTypes';

// Lazy-loaded chart-heavy sub-dashboards (recharts tree-shaking + code splitting)
const MaturityLadder = React.lazy(() => import('./MaturityLadder'));
const CurrencyGap = React.lazy(() => import('./CurrencyGap'));
const NIISensitivity = React.lazy(() => import('./NIISensitivity'));
const PricingAnalytics = React.lazy(() => import('./PricingAnalytics'));
const BehaviourFocusDashboard = React.lazy(() => import('./BehaviourFocusDashboard'));
const FundingCurvesDashboard = React.lazy(() => import('./FundingCurvesDashboard'));
const OverviewDashboard = React.lazy(() => import('./OverviewDashboard'));
const PnlAttribution = React.lazy(() => import('./PnlAttribution'));
const VintageAnalysis = React.lazy(() => import('./VintageAnalysis'));
const BacktestingDashboard = React.lazy(() => import('./BacktestingDashboard'));
const PortfolioReviewDashboard = React.lazy(() => import('./PortfolioReviewDashboard'));
const DashboardBuilder = React.lazy(() => import('./DashboardBuilder').then((m) => ({ default: m.DashboardBuilder })));
const ClientProfitabilityDashboard = React.lazy(() => import('./ClientProfitabilityDashboard'));
const ConcentrationDashboard = React.lazy(() => import('./ConcentrationDashboard'));
const PriceElasticityDashboard = React.lazy(() => import('./PriceElasticityDashboard'));
const ExPostRAROCDashboard = React.lazy(() => import('./ExPostRAROCDashboard'));

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ReportingDashboard: React.FC = () => {
  // Granular context subscriptions: avoids re-renders from governance changes
  const { deals, products, businessUnits, clients, approvalMatrix, rules } = useCoreData();
  const marketData = useMarketData();

  const { activeEntity, isGroupScope } = useEntity();
  const { t } = useUI();
  const behaviouralModels = marketData.behaviouralModels;
  const liquidityCurvePoints = useMemo(
    () => getPrimaryLiquidityPoints(marketData.liquidityCurves),
    [marketData.liquidityCurves]
  );
  const pricingContext = useMemo(
    () =>
      buildPricingContext(
        {
          yieldCurves: marketData.yieldCurves,
          liquidityCurves: marketData.liquidityCurves,
          rules,
          ftpRateCards: marketData.ftpRateCards,
          transitionGrid: marketData.transitionGrid,
          physicalGrid: marketData.physicalGrid,
          greeniumGrid: marketData.greeniumGrid,
          behaviouralModels: marketData.behaviouralModels,
        },
        {
          clients,
          products,
          businessUnits,
        }
      ),
    [
      businessUnits,
      clients,
      rules,
      marketData.behaviouralModels,
      marketData.ftpRateCards,
      marketData.liquidityCurves,
      marketData.physicalGrid,
      marketData.greeniumGrid,
      marketData.transitionGrid,
      marketData.yieldCurves,
      products,
    ]
  );

  // Tab state
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(DEFAULT_SUB_TAB);

  // Selection state
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [scenarioDeal, setScenarioDeal] = useState<Transaction>(INITIAL_DEAL);
  const [isModified, setIsModified] = useState(false);

  // Funding Curve Filters & What-if
  const [selectedCurrency, setSelectedCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [collateralType, setCollateralType] = useState<FundingCollateralType>(DEFAULT_COLLATERAL_TYPE);
  const [curveShift, setCurveShift] = useState<number>(DEFAULT_CURVE_SHIFT);

  // Regulatory export dropdown
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const referenceDate = new Date().toISOString().slice(0, 10);
  const entityId = activeEntity?.id ?? 'unknown';

  const handleExportLCR = () => {
    const report = generateLCRReport(deals, referenceDate, entityId);
    downloadFile(exportLCRToXML(report), `LCR_${entityId}_${referenceDate}.xml`, 'application/xml');
    setExportMenuOpen(false);
  };

  const handleExportNSFR = () => {
    const report = generateNSFRReport(deals, referenceDate, entityId);
    downloadFile(exportNSFRToXML(report), `NSFR_${entityId}_${referenceDate}.xml`, 'application/xml');
    setExportMenuOpen(false);
  };

  const handleExportIRRBB = () => {
    const report = generateIRRBBReport(deals, referenceDate, entityId);
    downloadFile(exportIRRBBToJSON(report), `IRRBB_${entityId}_${referenceDate}.json`, 'application/json');
    setExportMenuOpen(false);
  };

  // Sync scenarioDeal when selection changes
  useEffect(() => {
    if (selectedDealId) {
      const deal = deals.find((d) => d.id === selectedDealId);
      if (deal) {
        setScenarioDeal({ ...deal });
        setIsModified(false);
      }
    }
  }, [selectedDealId, deals]);

  const handleScenarioChange = <K extends keyof Transaction>(key: K, value: Transaction[K]) => {
    setScenarioDeal((prev) => ({ ...prev, [key]: value }));
    setIsModified(true);
  };

  // --- DERIVED DATA (via hooks) ---
  const { portfolioMetrics, portfolioByBU } = usePortfolioMetrics({ deals, businessUnits });
  const { metrics, lcrHistory } = useScenarioAnalysis({ scenarioDeal, portfolioMetrics, liquidityCurvePoints });
  const fundingCurveData = useFundingCurveData({ liquidityCurvePoints, selectedCurrency, collateralType, curveShift });

  // Lazy-computed results Map for Portfolio Review tab (computed only when active)
  const portfolioResultsMap = useMemo(() => {
    if (activeSubTab !== 'PORTFOLIO_REVIEW') return new Map();
    return batchReprice(deals, approvalMatrix, pricingContext);
  }, [activeSubTab, deals, approvalMatrix, pricingContext]);

  const findClientName = (id: string) => clients.find((c) => c.id === id)?.name || id;

  return (
    <div className="flex flex-col h-full bg-[var(--nfq-bg-root)] text-[color:var(--nfq-text-secondary)] overflow-hidden font-sans">
      {isGroupScope && (
        <div className="flex items-center gap-2 bg-cyan-500/10 border-b border-cyan-500/20 px-4 md:px-6 py-2">
          <Globe className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
            Group Consolidated View
          </span>
          <span className="text-xs text-slate-400 ml-2">
            Aggregated data across all entities
          </span>
        </div>
      )}
      {/* Top Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between border-b border-[var(--nfq-border-ghost)] px-4 md:px-6 py-3 bg-[var(--nfq-bg-surface)] gap-3">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BarChart4 className="text-cyan-400 w-5 h-5" />
            <h2 className="text-sm font-bold tracking-tight text-white uppercase font-mono">
              FTP Analytics <span className="text-slate-500 font-normal">v4.6</span>
            </h2>
          </div>
          <div className="hidden xl:block h-4 w-[1px] bg-white/10" />
          <nav className="nfq-tab-list">
            {TAB_GROUPS.map((group, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div className="h-4 w-[1px] bg-[var(--nfq-border-ghost)] mx-1 self-center" />}
                {group.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                    className={`nfq-tab ${
                      activeSubTab === tab.key
                        ? 'nfq-tab--active'
                        : ''
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 pr-4 border-r border-[var(--nfq-border-ghost)]">
            <label className="nfq-label">Focus:</label>
            <select
              value={selectedDealId}
              onChange={(e) => setSelectedDealId(e.target.value)}
              className="nfq-select-field min-w-[160px] max-w-[320px] text-xs text-[color:var(--nfq-accent)]"
            >
              <option value="">-- Global Portfolio --</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} | {findClientName(d.clientId)}
                </option>
              ))}
            </select>
            {isGroupScope && (
              <span className="nfq-label text-cyan-400 text-[10px]">ALL ENTITIES</span>
            )}
          </div>
          {/* Regulatory Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((prev) => !prev)}
              className="nfq-btn-ghost flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider"
              title={t.regulatoryExport}
            >
              <Download className="w-3.5 h-3.5" />
              {t.regulatoryExport}
              <ChevronDown className={`w-3 h-3 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg bg-[var(--nfq-bg-surface)] border border-[var(--nfq-border-ghost)] shadow-xl py-1">
                <button
                  onClick={handleExportLCR}
                  className="w-full text-left px-4 py-2 text-xs font-mono hover:bg-white/5 text-[color:var(--nfq-text-secondary)] hover:text-white transition-colors"
                >
                  {t.exportLCR}
                </button>
                <button
                  onClick={handleExportNSFR}
                  className="w-full text-left px-4 py-2 text-xs font-mono hover:bg-white/5 text-[color:var(--nfq-text-secondary)] hover:text-white transition-colors"
                >
                  {t.exportNSFR}
                </button>
                <button
                  onClick={handleExportIRRBB}
                  className="w-full text-left px-4 py-2 text-xs font-mono hover:bg-white/5 text-[color:var(--nfq-text-secondary)] hover:text-white transition-colors"
                >
                  {t.exportIRRBB}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end">
            <span className="nfq-label">Market State</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                SOFR: 5.32
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
                BI-3: OK
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Contextual What-if Panel */}
        <div className="hidden lg:block w-72 xl:w-80 border-r border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-root)] overflow-y-auto custom-scrollbar p-4 xl:p-6 space-y-8 shrink-0">
          {activeSubTab === 'OVERVIEW' ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="nfq-label flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[color:var(--nfq-accent)]" /> Contract Simulation
                  </h3>
                  {isModified && (
                    <button
                      onClick={() => {
                        if (selectedDealId) {
                          const id = selectedDealId;
                          setSelectedDealId('');
                          setTimeout(() => setSelectedDealId(id), 0);
                        } else {
                          setScenarioDeal(INITIAL_DEAL);
                        }
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
                    >
                      <RefreshCw className="w-3 h-3" /> RESET
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="nfq-label">Notional Amount</label>
                    <input
                      type="number"
                      value={scenarioDeal.amount}
                      onChange={(e) => handleScenarioChange('amount', Number(e.target.value))}
                      className="nfq-input-field"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="nfq-label">
                      Term (Months): {scenarioDeal.durationMonths}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="120"
                      value={scenarioDeal.durationMonths}
                      onChange={(e) => handleScenarioChange('durationMonths', Number(e.target.value))}
                      className="w-full accent-[var(--nfq-accent)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="nfq-label">LCR Outflow %</label>
                    <div className="grid grid-cols-4 gap-2">
                      {LCR_OUTFLOW_PRESETS.map((val) => (
                        <button
                          key={val}
                          onClick={() => handleScenarioChange('lcrOutflowPct', val)}
                          className={`text-[10px] py-1 rounded-[var(--nfq-radius-md)] border font-mono ${scenarioDeal.lcrOutflowPct === val ? 'bg-[var(--nfq-accent-subtle)] border-[var(--nfq-accent)] text-[color:var(--nfq-accent)]' : 'bg-[var(--nfq-bg-input)] border-[var(--nfq-border-ghost)] text-[color:var(--nfq-text-muted)]'}`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="nfq-kpi-card">
                <h4 className="nfq-label flex items-center gap-2 mb-3">
                  <Info className="w-3 h-3" /> Selection Context
                </h4>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-[color:var(--nfq-text-muted)]">Asset/Liab:</span>{' '}
                    <span className="text-[color:var(--nfq-text-primary)] font-mono">{scenarioDeal.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[color:var(--nfq-text-muted)]">Effective LP:</span>{' '}
                    <span className="text-[color:var(--nfq-text-primary)] font-mono">{metrics.lpValue} bps</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="nfq-label flex items-center gap-2 mb-6">
                  <Globe className="w-4 h-4 text-[color:var(--nfq-accent)]" /> Curve Controls
                </h3>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="nfq-label">Base Currency</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CURRENCY_OPTIONS.map((ccy) => (
                        <button
                          key={ccy}
                          onClick={() => setSelectedCurrency(ccy)}
                          className={`py-2 rounded-[var(--nfq-radius-md)] text-[11px] font-mono border transition-all ${selectedCurrency === ccy ? 'bg-[var(--nfq-accent-subtle)] border-[var(--nfq-accent)] text-[color:var(--nfq-accent)]' : 'bg-[var(--nfq-bg-input)] border-[var(--nfq-border-ghost)] text-[color:var(--nfq-text-muted)]'}`}
                        >
                          {ccy}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="nfq-label">Collateralization</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCollateralType('Secured')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--nfq-radius-md)] text-[10px] font-bold border ${collateralType === 'Secured' ? 'bg-[var(--nfq-success-subtle)] border-[var(--nfq-success)] text-[color:var(--nfq-success)]' : 'bg-[var(--nfq-bg-input)] border-[var(--nfq-border-ghost)] text-[color:var(--nfq-text-muted)]'}`}
                      >
                        <Lock size={12} /> SECURED
                      </button>
                      <button
                        onClick={() => setCollateralType('Unsecured')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--nfq-radius-md)] text-[10px] font-bold border ${collateralType === 'Unsecured' ? 'bg-[var(--nfq-danger-subtle)] border-[var(--nfq-danger)] text-[color:var(--nfq-danger)]' : 'bg-[var(--nfq-bg-input)] border-[var(--nfq-border-ghost)] text-[color:var(--nfq-text-muted)]'}`}
                      >
                        <Unlock size={12} /> UNSEC
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-[var(--nfq-border-ghost)]">
                    <div className="flex justify-between items-center mb-1">
                      <label className="nfq-label">Curve Shock (bps)</label>
                      <span
                        className={`text-[11px] font-mono ${curveShift >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {curveShift > 0 && '+'}
                        {curveShift} bps
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={curveShift}
                      onChange={(e) => setCurveShift(Number(e.target.value))}
                      className="w-full accent-[var(--nfq-accent)]"
                    />
                    <div className="flex justify-between text-[8px] text-[color:var(--nfq-text-faint)] font-mono">
                      <span>-100BP</span> <span>PARALLEL</span> <span>+100BP</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="nfq-kpi-card">
                <h4 className="nfq-label flex items-center gap-2 mb-3 text-[color:var(--nfq-success)]">
                  <Layers className="w-3 h-3" /> Model Insights
                </h4>
                <p className="text-[9px] text-[color:var(--nfq-text-muted)] leading-relaxed font-mono">
                  Simulating {collateralType} {selectedCurrency} liquidity curves using a spline interpolation based on
                  Market {collateralType === 'Secured' ? 'Repo' : 'Wholesale'} reference rates.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--nfq-bg-root)] p-8 space-y-8">
          <Suspense fallback={<LoadingSpinner />}>
            {activeSubTab === 'OVERVIEW' ? (
              <OverviewDashboard
                metrics={metrics}
                lcrHistory={lcrHistory}
                portfolioByBU={portfolioByBU}
                deals={deals}
                products={products}
                businessUnits={businessUnits}
                clients={clients}
              />
            ) : activeSubTab === 'FUNDING_CURVES' ? (
              <FundingCurvesDashboard
                selectedCurrency={selectedCurrency}
                collateralType={collateralType}
                fundingCurveData={fundingCurveData}
              />
            ) : activeSubTab === 'MATURITY_LADDER' ? (
              <MaturityLadder deals={deals} />
            ) : activeSubTab === 'CURRENCY_GAP' ? (
              <CurrencyGap deals={deals} />
            ) : activeSubTab === 'NII_SENSITIVITY' ? (
              <NIISensitivity deals={deals} />
            ) : activeSubTab === 'PNL_ATTRIBUTION' ? (
              <PnlAttribution
                deals={deals}
                products={products}
                businessUnits={businessUnits}
                clients={clients}
                contextData={{ ...marketData, approvalMatrix, rules }}
              />
            ) : activeSubTab === 'EXECUTIVE' ? (
              <ExecutiveDashboard
                deals={deals}
                products={products}
                portfolioMetrics={portfolioMetrics}
                portfolioByBU={portfolioByBU}
              />
            ) : activeSubTab === 'PRICING_ANALYTICS' ? (
              <PricingAnalytics deals={deals} businessUnits={businessUnits} products={products} clients={clients} />
            ) : activeSubTab === 'PORTFOLIO_SNAPSHOTS' ? (
              <PortfolioSnapshotsDashboard
                deals={deals}
                approvalMatrix={approvalMatrix}
                pricingContext={pricingContext}
              />
            ) : activeSubTab === 'VINTAGE' ? (
              <VintageAnalysis
                deals={deals}
                products={products}
                businessUnits={businessUnits}
                clients={clients}
              />
            ) : activeSubTab === 'BACKTEST' ? (
              <BacktestingDashboard
                deals={deals}
                products={products}
                businessUnits={businessUnits}
                clients={clients}
              />
            ) : activeSubTab === 'PORTFOLIO_REVIEW' ? (
              <PortfolioReviewDashboard
                deals={deals}
                results={portfolioResultsMap}
              />
            ) : activeSubTab === 'CUSTOM_DASHBOARD' ? (
              <DashboardBuilder />
            ) : activeSubTab === 'CLIENT_PROFITABILITY' ? (
              <ClientProfitabilityDashboard deals={deals} clients={clients} />
            ) : activeSubTab === 'CONCENTRATION' ? (
              <ConcentrationDashboard deals={deals} />
            
            ) : activeSubTab === 'PRICE_ELASTICITY' ? (
              <PriceElasticityDashboard deals={deals} />
            ) : activeSubTab === 'EX_POST_RAROC' ? (
              <ExPostRAROCDashboard deals={deals} />
            ) : false ? (
              <DashboardBuilder />
            ) : (
              <BehaviourFocusDashboard behaviouralModels={behaviouralModels} />
            )}
          </Suspense>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-8 border-t border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] px-6 flex items-center justify-between font-mono text-[10px]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--nfq-success)] animate-pulse" />
            <span className="text-[color:var(--nfq-success)] font-bold">SYSTEMS: ACTIVE</span>
          </div>
          <span className="text-[color:var(--nfq-text-faint)]">CURRENCY_MODE: {selectedCurrency}_REF</span>
        </div>
        <div className="flex items-center gap-4 text-[color:var(--nfq-text-muted)]">
          <span className="flex items-center gap-1">
            <AlertCircle size={10} /> BASEL_III_STABLE
          </span>
          <span className="text-[color:var(--nfq-text-faint)] font-bold uppercase">N-Pricing Terminal Node</span>
        </div>
      </div>
    </div>
  );
};

export default ReportingDashboard;
