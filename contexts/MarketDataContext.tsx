import React, { createContext, useContext, useState, useMemo } from 'react';
import type {
  YieldCurvePoint,
  DualLiquidityCurve,
  FtpRateCard,
  TransitionRateCard,
  PhysicalRateCard,
  GreeniumRateCard,
  BehaviouralModel,
  MarketDataSource,
} from '../types';

export interface MarketDataContextType {
  yieldCurves: YieldCurvePoint[];
  setYieldCurves: React.Dispatch<React.SetStateAction<YieldCurvePoint[]>>;
  liquidityCurves: DualLiquidityCurve[];
  setLiquidityCurves: React.Dispatch<React.SetStateAction<DualLiquidityCurve[]>>;
  ftpRateCards: FtpRateCard[];
  setFtpRateCards: React.Dispatch<React.SetStateAction<FtpRateCard[]>>;
  transitionGrid: TransitionRateCard[];
  setTransitionGrid: React.Dispatch<React.SetStateAction<TransitionRateCard[]>>;
  physicalGrid: PhysicalRateCard[];
  setPhysicalGrid: React.Dispatch<React.SetStateAction<PhysicalRateCard[]>>;
  greeniumGrid: GreeniumRateCard[];
  setGreeniumGrid: React.Dispatch<React.SetStateAction<GreeniumRateCard[]>>;
  behaviouralModels: BehaviouralModel[];
  setBehaviouralModels: React.Dispatch<React.SetStateAction<BehaviouralModel[]>>;
  marketDataSources: MarketDataSource[];
  setMarketDataSources: React.Dispatch<React.SetStateAction<MarketDataSource[]>>;
}

const MarketDataContext = createContext<MarketDataContextType | null>(null);

export const MarketDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [yieldCurves, setYieldCurves] = useState<YieldCurvePoint[]>([]);
  const [liquidityCurves, setLiquidityCurves] = useState<DualLiquidityCurve[]>([]);
  const [ftpRateCards, setFtpRateCards] = useState<FtpRateCard[]>([]);
  const [transitionGrid, setTransitionGrid] = useState<TransitionRateCard[]>([]);
  const [physicalGrid, setPhysicalGrid] = useState<PhysicalRateCard[]>([]);
  const [greeniumGrid, setGreeniumGrid] = useState<GreeniumRateCard[]>([]);
  const [behaviouralModels, setBehaviouralModels] = useState<BehaviouralModel[]>([]);
  const [marketDataSources, setMarketDataSources] = useState<MarketDataSource[]>([]);

  const value = useMemo(
    () => ({
      yieldCurves,
      setYieldCurves,
      liquidityCurves,
      setLiquidityCurves,
      ftpRateCards,
      setFtpRateCards,
      transitionGrid,
      setTransitionGrid,
      physicalGrid,
      setPhysicalGrid,
      greeniumGrid,
      setGreeniumGrid,
      behaviouralModels,
      setBehaviouralModels,
      marketDataSources,
      setMarketDataSources,
    }),
    [
      yieldCurves,
      liquidityCurves,
      ftpRateCards,
      transitionGrid,
      physicalGrid,
      greeniumGrid,
      behaviouralModels,
      marketDataSources,
    ]
  );

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = (): MarketDataContextType => {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error('useMarketData must be used within MarketDataProvider');
  return ctx;
};
