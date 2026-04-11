import { MOCK_YIELD_CURVE } from '../../constants';
import type { YieldCurvePoint } from '../../types';

interface YieldCurveHistoryPoint {
  tenor: string;
  rate: string | number;
  prev?: string | number;
}

interface YieldCurveHistoryEntry {
  id?: number | string;
  currency: string;
  as_of_date?: string;
  asOfDate?: string;
  created_at?: string;
  createdAt?: string;
  grid_data?: YieldCurveHistoryPoint[];
  gridData?: YieldCurveHistoryPoint[];
}

export interface CurveSnapshotVersion {
  id: string;
  date: string;
  user: string;
  curve: string;
}

export interface CurveDisplayPoint extends YieldCurvePoint {
  baseRate: number;
  index: number;
}

export const CURVE_PANEL_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const;

export const getCurveHistoryKey = (currency: string, date: string) =>
  `${currency}-${date}`;

export const getCurveDateFromKey = (key: string) =>
  key.split('-').slice(1).join('-');

export const mapCurveHistoryRecords = (history: YieldCurveHistoryEntry[]) => {
  const historyMap: Record<string, YieldCurvePoint[]> = {};
  const versions: CurveSnapshotVersion[] = [];

  history.forEach((entry) => {
    const date = entry.as_of_date || entry.asOfDate || 'unknown';
    const key = getCurveHistoryKey(entry.currency, date);
    historyMap[key] = (entry.grid_data || entry.gridData || []).map((point) => ({
      tenor: point.tenor,
      rate: Number(point.rate) || 0,
      prev: Number(point.prev || point.rate) || 0,
    }));
    versions.push({
      id: `v${entry.id}`,
      date: entry.created_at || entry.createdAt || date,
      user: 'System',
      curve: `${entry.currency} ${date}`,
    });
  });

  return { historyMap, versions };
};

export const buildYieldCurveData = ({
  currency,
  selectedDate,
  shockBps,
  curvesHistory,
}: {
  currency: string;
  selectedDate: string;
  shockBps: number;
  curvesHistory: Record<string, YieldCurvePoint[]>;
}): CurveDisplayPoint[] => {
  let basePoints = curvesHistory[getCurveHistoryKey(currency, selectedDate)];

  if (!basePoints) {
    let modifier = 0;
    if (currency === 'EUR') modifier = -1.5;
    if (currency === 'GBP') modifier = 0.5;
    if (currency === 'JPY') modifier = -4;
    const dateNum = selectedDate.split('-').reduce((sum, part) => sum + Number(part), 0);
    const dateMod = (dateNum % 5) * 0.1;

    basePoints = MOCK_YIELD_CURVE.map(point => ({
      tenor: point.tenor,
      rate: Math.max(0.1, point.rate + modifier + dateMod),
      prev: Math.max(0.1, point.prev + modifier),
    }));
  }

  return basePoints.map((point, index) => {
    const rateValue = Number(point.rate) || 0;
    const prevValue = Number(point.prev) || rateValue;
    const shockedRate = rateValue + (shockBps / 100);

    return {
      ...point,
      baseRate: rateValue,
      prev: prevValue,
      rate: Math.max(0.01, shockedRate),
      index,
    };
  });
};

export const buildCurveTemplateRows = (
  curvesHistory: Record<string, YieldCurvePoint[]>,
) => {
  const rows: Array<Record<string, string | number | undefined>> = [];

  Object.entries(curvesHistory).forEach(([key, points]) => {
    const [currency] = key.split('-');
    points.forEach(point => {
      rows.push({
        Currency: currency,
        Tenor: point.tenor,
        Rate: point.rate,
        Prev: point.prev,
      });
    });
  });

  return rows;
};
