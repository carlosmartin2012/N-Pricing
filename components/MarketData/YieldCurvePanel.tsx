import React, { useState, useMemo, useEffect } from 'react';
import * as auditApi from '../../api/audit';
import * as marketDataApi from '../../api/marketData';
import { localCache } from '../../utils/localCache';
import { monitoringService } from '../../utils/supabase/monitoring';
import { marketDataIngestionService } from '../../utils/supabase/marketDataIngestionService';
import { FileUploadModal } from '../ui/FileUploadModal';
import { YieldCurvePoint } from '../../types';
import { downloadTemplate } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import MarketDataSourcesPanel from './MarketDataSourcesPanel';
import { markMarketDataSourceSynced } from './marketDataSourcesUtils';
import YieldCurveRatesPanel from './YieldCurveRatesPanel';
import YieldCurveWorkspace from './YieldCurveWorkspace';
import {
  buildCurveTemplateRows,
  buildYieldCurveData,
  getCurveHistoryKey,
  mapCurveHistoryRecords,
  type CurveSnapshotVersion,
} from './yieldCurveUtils';

interface CurveImportRow {
  Tenor?: string;
  tenor?: string;
  Rate?: string | number;
  rate?: string | number;
  Prev?: string | number;
  prev?: string | number;
}

interface RealtimeCurvePoint {
  tenor: string;
  rate: string | number;
  prev: string | number;
}

interface YieldCurveRealtimePayload {
  table: string;
  eventType: string;
  mapped?: {
    currency: string;
    date: string;
    points: RealtimeCurvePoint[];
  };
}

const YieldCurvePanel: React.FC = () => {
  const { currentUser: user } = useAuth();
  const { t } = useUI();
  const appData = useData();
  const [currency, setCurrency] = useState('USD');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shockBps, setShockBps] = useState<number>(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [curvesHistory, setCurvesHistory] = useState<Record<string, YieldCurvePoint[]>>(() => localCache.getCurves());
  const [curveVersions, setCurveVersions] = useState<CurveSnapshotVersion[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');

  const selectedSource = useMemo(
    () =>
      appData.marketDataSources.find((source) => source.id === selectedSourceId && source.sourceType === 'YieldCurve'),
    [appData.marketDataSources, selectedSourceId]
  );

  useEffect(() => {
    const availableSources = appData.marketDataSources.filter((source) => source.sourceType === 'YieldCurve');
    if (!availableSources.length) {
      if (selectedSourceId) setSelectedSourceId('');
      return;
    }

    if (selectedSource?.currencies.includes(currency)) {
      return;
    }

    const nextSource =
      availableSources.find((source) => source.status === 'Active' && source.currencies.includes(currency)) ||
      availableSources[0];

    if (nextSource?.id !== selectedSourceId) {
      setSelectedSourceId(nextSource?.id || '');
    }
  }, [appData.marketDataSources, currency, selectedSource, selectedSourceId]);

  // Load curve history from Supabase on mount and when currency changes
  useEffect(() => {
    marketDataApi
      .listYieldCurves()
      .then((history) => {
        const matchingHistory = history.filter((entry) => entry.currency === currency);
        if (!matchingHistory.length) return;
        const normalizedHistory = matchingHistory.map((entry) => ({
          id: entry.id,
          currency: entry.currency,
          as_of_date: entry.asOfDate,
          grid_data: entry.gridData,
        }));
        const { historyMap, versions } = mapCurveHistoryRecords(normalizedHistory);
        setCurvesHistory((prev) => ({ ...prev, ...historyMap }));
        setCurveVersions(versions.slice(0, 10));
      })
      .catch(() => {});
  }, [currency]);

  // Sync History to Storage
  useEffect(() => {
    localCache.saveCurves(curvesHistory);
  }, [curvesHistory]);

  // Realtime Sync for Yield Curves
  useEffect(() => {
    const subscription = monitoringService.subscribeToAll((rawPayload) => {
      const payload = rawPayload as YieldCurveRealtimePayload;
      if (payload.table === 'yield_curves' && payload.eventType === 'INSERT') {
        const mapped = payload.mapped;
        if (!mapped) return;

        const { currency: cur, date: d, points: pts } = mapped;
        const key = getCurveHistoryKey(cur, d);

        setCurvesHistory((prev) => ({
          ...prev,
          [key]: pts.map((pt) => ({
            tenor: pt.tenor,
            rate: parseFloat(String(pt.rate)) || 0,
            prev: parseFloat(String(pt.prev)) || parseFloat(String(pt.rate)) || 0,
          })),
        }));
      }
    });
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Transform mock data based on currency AND date to simulate historical curves
  const data = useMemo(
    () =>
      buildYieldCurveData({
        currency,
        selectedDate,
        shockBps,
        curvesHistory,
      }),
    [currency, selectedDate, shockBps, curvesHistory]
  );

  // DEFENSIVE GUARDS: If no data, return a safe minimal set to prevent SVG math crashes
  const chartData = useMemo(() => {
    if (!data || data.length < 2) {
      return [
        { tenor: '1M', rate: 0.01, prev: 0.01, baseRate: 0.01, index: 0 },
        { tenor: '1Y', rate: 0.01, prev: 0.01, baseRate: 0.01, index: 1 },
      ];
    }
    return data;
  }, [data]);

  const handleSaveSnapshot = async () => {
    const key = getCurveHistoryKey(currency, selectedDate);
    const snapshotPoints = chartData.map((d) => ({ tenor: d.tenor, rate: d.baseRate, prev: d.prev }));
    const syncedAt = new Date().toISOString();

    setCurvesHistory((prev) => ({
      ...prev,
      [key]: snapshotPoints,
    }));

    if (selectedSource) {
      await marketDataIngestionService.captureYieldCurveSnapshot({
        sourceId: selectedSource.id,
        currency,
        date: selectedDate,
        points: snapshotPoints,
      });
      appData.setMarketDataSources((previous) =>
        previous.map((source) =>
          source.id === selectedSource.id ? markMarketDataSourceSynced(source, currency, syncedAt) : source
        )
      );
    } else {
      await marketDataApi.saveCurveHistorySnapshot(currency, selectedDate, snapshotPoints);
    }

    // Update active yield curve in DataContext if it's the current date
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate === today || currency === 'USD') {
      appData.setYieldCurves(snapshotPoints);
    }

    // Add to version list
    setCurveVersions((prev) =>
      [
        {
          id: `v${Date.now().toString(36)}`,
          date: new Date().toISOString().slice(0, 16).replace('T', ' '),
          user: user?.name || 'Unknown',
          curve: `${currency} ${selectedDate}`,
        },
        ...prev,
      ].slice(0, 10)
    );

    void auditApi.logAudit({
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown User',
      action: 'SAVE_CURVE_SNAPSHOT',
      module: 'MARKET_DATA',
      description: `Saved ${currency} curve snapshot for ${selectedDate}${selectedSource ? ` via ${selectedSource.name}` : ''} to Supabase`,
      details: selectedSource ? { sourceId: selectedSource.id, provider: selectedSource.provider } : undefined,
    });
  };

  const handleImport = async (importedData: CurveImportRow[]) => {
    const key = getCurveHistoryKey(currency, selectedDate);
    const newCurve: YieldCurvePoint[] = importedData.map((row) => ({
      tenor: row.Tenor || row.tenor || '',
      rate: Number(row.Rate || row.rate) || 0,
      prev: Number(row.Prev || row.prev) || 0,
    }));

    setCurvesHistory((prev) => ({ ...prev, [key]: newCurve }));
    setIsImportOpen(false);

    if (selectedSource) {
      const syncedAt = new Date().toISOString();
      await marketDataIngestionService.captureYieldCurveSnapshot({
        sourceId: selectedSource.id,
        currency,
        date: selectedDate,
        points: newCurve,
      });
      appData.setMarketDataSources((previous) =>
        previous.map((source) =>
          source.id === selectedSource.id ? markMarketDataSourceSynced(source, currency, syncedAt) : source
        )
      );
    } else {
      await marketDataApi.saveCurveHistorySnapshot(currency, selectedDate, newCurve);
    }
    appData.setYieldCurves(newCurve);

    void auditApi.logAudit({
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown User',
      action: 'IMPORT_CURVE',
      module: 'MARKET_DATA',
      description: `Imported ${currency} yield curve for ${selectedDate} (${newCurve.length} tenors)${selectedSource ? ` via ${selectedSource.name}` : ''}`,
      details: selectedSource ? { sourceId: selectedSource.id, provider: selectedSource.provider } : undefined,
    });
  };

  const handleDownloadTemplate = async () => {
    const liveData = buildCurveTemplateRows(curvesHistory);

    // If no data, use default template
    const dataToExport = liveData.length > 0 ? liveData : undefined;
    await downloadTemplate('YIELD_CURVE', `Yield_Curve_Data_${currency}`, dataToExport);
  };

  const curveTemplate = 'tenor,rate,prev\nON,5.25,5.20\n1M,5.30,5.28\n1Y,5.10,5.05\n10Y,4.25,4.30';

  // Real curve version history (loaded from Supabase + local saves)
  const pricingVersions = curveVersions;

  return (
    <div data-tour="market-data-panel" className="flex flex-col xl:grid xl:grid-cols-3 gap-4 md:gap-6 h-full min-h-0 overflow-auto custom-scrollbar">
      {/* Chart Section */}
      <div className="xl:col-span-2 flex flex-col min-h-[300px] md:min-h-[500px] xl:min-h-0">
        <YieldCurveWorkspace
          title={t.yieldCurves}
          currency={currency}
          selectedDate={selectedDate}
          shockBps={shockBps}
          chartData={chartData}
          curvesHistory={curvesHistory}
          onDateChange={setSelectedDate}
          onShockChange={setShockBps}
          onCurrencyChange={setCurrency}
          onDownloadTemplate={handleDownloadTemplate}
          onSaveSnapshot={handleSaveSnapshot}
          onOpenImport={() => setIsImportOpen(true)}
        />
      </div>

      {/* Rates Table Section */}
      <div className="flex flex-col h-full min-h-[250px] md:min-h-[400px] xl:min-h-0">
        <YieldCurveRatesPanel currency={currency} data={data} versions={pricingVersions} />
      </div>

      <div className="xl:col-span-3">
        <MarketDataSourcesPanel
          currentCurrency={currency}
          selectedDate={selectedDate}
          user={user}
          sources={appData.marketDataSources}
          selectedSourceId={selectedSourceId}
          onSelectedSourceChange={setSelectedSourceId}
          onSourcesChange={appData.setMarketDataSources}
        />
      </div>

      <FileUploadModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onUpload={handleImport}
        title={`Import ${currency} Curve`}
        templateName="yield_curve_template.csv"
        templateContent={curveTemplate}
      />
    </div>
  );
};

export default YieldCurvePanel;
