import { useCallback, useEffect, useRef } from 'react';
import type { DataContextType } from '../../contexts/DataContext';
import { localCache } from '../../utils/localCache';
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import { supabaseService } from '../../utils/supabaseService';

function useDebouncedRemotePersistence<T>({
  value,
  isLoading,
  save,
  delay = 2000,
}: {
  value: T;
  isLoading: boolean;
  save: (value: T) => void | Promise<void>;
  delay?: number;
}) {
  const previousValue = useRef(value);

  useEffect(() => {
    if (isLoading) {
      previousValue.current = value;
      return;
    }

    if (!isSupabaseConfigured) return;

    const timer = setTimeout(() => {
      if (JSON.stringify(previousValue.current) !== JSON.stringify(value)) {
        void save(value);
        previousValue.current = value;
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, isLoading, save, value]);
}

export function useConfigPersistence(data: DataContextType) {
  const saveTransitionGrid = useCallback(
    (nextValue: DataContextType['transitionGrid']) => supabaseService.saveEsgGrid('transition', nextValue),
    []
  );
  const savePhysicalGrid = useCallback(
    (nextValue: DataContextType['physicalGrid']) => supabaseService.saveEsgGrid('physical', nextValue),
    []
  );
  const saveGreeniumGrid = useCallback(
    (nextValue: DataContextType['greeniumGrid']) => supabaseService.saveEsgGrid('greenium', nextValue),
    []
  );

  useEffect(() => {
    localCache.saveLocal('n_pricing_rules', data.rules);
  }, [data.rules]);

  useEffect(() => {
    localCache.saveLocal('n_pricing_clients', data.clients);
  }, [data.clients]);

  useEffect(() => {
    localCache.saveLocal('n_pricing_behavioural', data.behaviouralModels);
  }, [data.behaviouralModels]);

  useEffect(() => {
    localCache.saveLocal('n_pricing_deals', data.deals);
  }, [data.deals]);

  useDebouncedRemotePersistence({
    value: data.ftpRateCards,
    isLoading: data.isLoading,
    save: supabaseService.saveRateCards,
  });

  useDebouncedRemotePersistence({
    value: data.transitionGrid,
    isLoading: data.isLoading,
    save: saveTransitionGrid,
  });

  useDebouncedRemotePersistence({
    value: data.physicalGrid,
    isLoading: data.isLoading,
    save: savePhysicalGrid,
  });

  useDebouncedRemotePersistence({
    value: data.greeniumGrid,
    isLoading: data.isLoading,
    save: saveGreeniumGrid,
  });

  useDebouncedRemotePersistence({
    value: data.approvalMatrix,
    isLoading: data.isLoading,
    save: supabaseService.saveApprovalMatrix,
  });

  useDebouncedRemotePersistence({
    value: data.shocks,
    isLoading: data.isLoading,
    save: supabaseService.saveShocks,
  });

  useDebouncedRemotePersistence({
    value: data.methodologyChangeRequests,
    isLoading: data.isLoading,
    save: supabaseService.saveMethodologyChangeRequests,
  });

  useDebouncedRemotePersistence({
    value: data.methodologyVersions,
    isLoading: data.isLoading,
    save: supabaseService.saveMethodologyVersions,
  });

  useDebouncedRemotePersistence({
    value: data.approvalTasks,
    isLoading: data.isLoading,
    save: supabaseService.saveApprovalTasks,
  });

  useDebouncedRemotePersistence({
    value: data.pricingDossiers,
    isLoading: data.isLoading,
    save: supabaseService.savePricingDossiers,
  });

  useDebouncedRemotePersistence({
    value: data.portfolioSnapshots,
    isLoading: data.isLoading,
    save: supabaseService.savePortfolioSnapshots,
  });

  useDebouncedRemotePersistence({
    value: data.marketDataSources,
    isLoading: data.isLoading,
    save: supabaseService.saveMarketDataSources,
  });
}
