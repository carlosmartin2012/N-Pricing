import { useCallback, useEffect, useRef } from 'react';
import * as configApi from '../../api/config';
import type { DataContextType } from '../../contexts/DataContext';
import { localCache } from '../../utils/localCache';
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import { saveSystemConfigValue } from '../../utils/supabase/systemConfig';
import { canPersistRemotely } from '../../utils/dataModeUtils';

function useDebouncedRemotePersistence<T>({
  value,
  isLoading,
  dataMode,
  save,
  delay = 2000,
}: {
  value: T;
  isLoading: boolean;
  dataMode: DataContextType['dataMode'];
  save: (value: T) => void | Promise<void>;
  delay?: number;
}) {
  const previousValue = useRef(value);

  useEffect(() => {
    if (isLoading) {
      previousValue.current = value;
      return;
    }

    if (!canPersistRemotely({ dataMode, isSupabaseConfigured })) return;

    const timer = setTimeout(() => {
      if (JSON.stringify(previousValue.current) !== JSON.stringify(value)) {
        void save(value);
        previousValue.current = value;
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [dataMode, delay, isLoading, save, value]);
}

export function useConfigPersistence(data: DataContextType) {
  const saveTransitionGrid = useCallback(
    (nextValue: DataContextType['transitionGrid']) => configApi.saveEsgGrid('transition', nextValue),
    []
  );
  const savePhysicalGrid = useCallback(
    (nextValue: DataContextType['physicalGrid']) => configApi.saveEsgGrid('physical', nextValue),
    []
  );
  const saveGreeniumGrid = useCallback(
    (nextValue: DataContextType['greeniumGrid']) =>
      saveSystemConfigValue('greenium_grid', nextValue, 'saveEsgGrid:greenium'),
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
    dataMode: data.dataMode,
    save: configApi.saveRateCards,
  });

  useDebouncedRemotePersistence({
    value: data.transitionGrid,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: saveTransitionGrid,
  });

  useDebouncedRemotePersistence({
    value: data.physicalGrid,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: savePhysicalGrid,
  });

  useDebouncedRemotePersistence({
    value: data.greeniumGrid,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: saveGreeniumGrid,
  });

  useDebouncedRemotePersistence({
    value: data.approvalMatrix,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.saveApprovalMatrix,
  });

  useDebouncedRemotePersistence({
    value: data.shocks,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.saveShocks,
  });

  useDebouncedRemotePersistence({
    value: data.methodologyChangeRequests,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.saveMethodologyChangeRequests,
  });

  useDebouncedRemotePersistence({
    value: data.methodologyVersions,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.saveMethodologyVersions,
  });

  useDebouncedRemotePersistence({
    value: data.approvalTasks,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.saveApprovalTasks,
  });

  useDebouncedRemotePersistence({
    value: data.pricingDossiers,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.savePricingDossiers,
  });

  useDebouncedRemotePersistence({
    value: data.portfolioSnapshots,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.savePortfolioSnapshots,
  });

  useDebouncedRemotePersistence({
    value: data.marketDataSources,
    isLoading: data.isLoading,
    dataMode: data.dataMode,
    save: configApi.saveMarketDataSources,
  });
}
