import React, { createContext, useContext, useState } from 'react';
import type {
  YieldCurvePoint,
  DualLiquidityCurve,
  FtpRateCard,
  TransitionRateCard,
  PhysicalRateCard,
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
  const [behaviouralModels, setBehaviouralModels] = useState<BehaviouralModel[]>([]);
  const [marketDataSources, setMarketDataSources] = useState<MarketDataSource[]>([]);

  return (
    <MarketDataContext.Provider
      value={{
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
        behaviouralModels,
        setBehaviouralModels,
        marketDataSources,
        setMarketDataSources,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = (): MarketDataContextType => {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error('useMarketData must be used within MarketDataProvider');
  return ctx;
};
