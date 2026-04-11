import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DataContextType } from '../../contexts/DataContext';
import { useToast } from '../../components/ui/Toast';
import { createLogger } from '../../utils/logger';
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import { monitoringService } from '../../utils/supabase/monitoring';

const log = createLogger('sync-realtime');

interface RealtimePayload {
  table?: string;
  eventType: string;
  mapped?: unknown;
  old?: { id?: string | number };
  config_key?: string;
}

function updateCollectionState<T extends { id?: string | number }>(
  setter: Dispatch<SetStateAction<T[]>>,
  eventType: string,
  mappedRecord: T | undefined,
  oldRecord: { id?: string | number } | undefined
) {
  setter((previous) => {
    if (eventType === 'INSERT') {
      return mappedRecord ? [mappedRecord, ...previous] : previous;
    }

    if (eventType === 'UPDATE') {
      return mappedRecord ? previous.map((item) => (item.id === mappedRecord.id ? mappedRecord : item)) : previous;
    }

    if (eventType === 'DELETE') {
      return previous.filter((item) => item.id !== oldRecord?.id);
    }

    return previous;
  });
}

export function useRealtimeSync(data: DataContextType) {
  const { addToast } = useToast();
  const {
    setDeals,
    setBehaviouralModels,
    setRules,
    setClients,
    setBusinessUnits,
    setProducts,
    setUsers,
    setShocks,
    setRarocInputs,
    setMethodologyChangeRequests,
    setMethodologyVersions,
    setApprovalTasks,
    setPricingDossiers,
    setPortfolioSnapshots,
    setMarketDataSources,
  } = data;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let channel: ReturnType<typeof monitoringService.subscribeToAll> | null = null;

    try {
      channel = monitoringService.subscribeToAll((payload) => {
        const { table, eventType, mapped: mappedRecord, old: oldRecord, config_key } =
          payload as RealtimePayload;

        if (table === 'deals') updateCollectionState(setDeals, eventType, mappedRecord as DataContextType['deals'][number] | undefined, oldRecord);
        if (table === 'behavioural_models') {
          updateCollectionState(
            setBehaviouralModels,
            eventType,
            mappedRecord as DataContextType['behaviouralModels'][number] | undefined,
            oldRecord,
          );
        }
        if (table === 'rules') updateCollectionState(setRules, eventType, mappedRecord as DataContextType['rules'][number] | undefined, oldRecord);
        if (table === 'clients') updateCollectionState(setClients, eventType, mappedRecord as DataContextType['clients'][number] | undefined, oldRecord);
        if (table === 'business_units') {
          updateCollectionState(setBusinessUnits, eventType, mappedRecord as DataContextType['businessUnits'][number] | undefined, oldRecord);
        }
        if (table === 'products') {
          updateCollectionState(setProducts, eventType, mappedRecord as DataContextType['products'][number] | undefined, oldRecord);
        }
        if (table === 'users') updateCollectionState(setUsers, eventType, mappedRecord as DataContextType['users'][number] | undefined, oldRecord);

        if (table === 'system_config' && eventType !== 'DELETE' && mappedRecord) {
          if (config_key === 'shocks') setShocks(mappedRecord as DataContextType['shocks']);
          if (config_key === 'raroc_inputs') setRarocInputs(mappedRecord as DataContextType['rarocInputs']);
          if (config_key === 'methodology_change_requests') {
            setMethodologyChangeRequests(mappedRecord as DataContextType['methodologyChangeRequests']);
          }
          if (config_key === 'methodology_versions') setMethodologyVersions(mappedRecord as DataContextType['methodologyVersions']);
          if (config_key === 'approval_tasks') setApprovalTasks(mappedRecord as DataContextType['approvalTasks']);
          if (config_key === 'pricing_dossiers') setPricingDossiers(mappedRecord as DataContextType['pricingDossiers']);
          if (config_key === 'portfolio_snapshots') setPortfolioSnapshots(mappedRecord as DataContextType['portfolioSnapshots']);
          if (config_key === 'market_data_sources') setMarketDataSources(mappedRecord as DataContextType['marketDataSources']);
        }
      });
    } catch (error) {
      log.error('Failed to set up realtime subscription', { error: String(error) });
      addToast('error', 'Realtime sync unavailable. Changes from other users will not appear.');
    }

    return () => {
      channel?.unsubscribe();
    };
  }, [
    addToast,
    setBehaviouralModels,
    setBusinessUnits,
    setClients,
    setDeals,
    setMethodologyChangeRequests,
    setMethodologyVersions,
    setApprovalTasks,
    setPricingDossiers,
    setPortfolioSnapshots,
    setMarketDataSources,
    setProducts,
    setRarocInputs,
    setRules,
    setShocks,
    setUsers,
  ]);
}
