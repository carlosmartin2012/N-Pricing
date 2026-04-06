import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DataContextType } from '../../contexts/DataContext';
import { useToast } from '../../components/ui/Toast';
import { createLogger } from '../../utils/logger';
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import { supabaseService } from '../../utils/supabaseService';

const log = createLogger('sync-realtime');

function updateCollectionState<T extends { id: string | number }>(
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

    let channel: ReturnType<typeof supabaseService.subscribeToAll> | null = null;

    try {
      channel = supabaseService.subscribeToAll((payload: any) => {
        const { table, eventType, mapped: mappedRecord, old: oldRecord } = payload;

        if (table === 'deals') updateCollectionState(setDeals, eventType, mappedRecord, oldRecord);
        if (table === 'behavioural_models') {
          updateCollectionState(setBehaviouralModels, eventType, mappedRecord, oldRecord);
        }
        if (table === 'rules') updateCollectionState(setRules, eventType, mappedRecord, oldRecord);
        if (table === 'clients') updateCollectionState(setClients, eventType, mappedRecord, oldRecord);
        if (table === 'business_units') {
          updateCollectionState(setBusinessUnits, eventType, mappedRecord, oldRecord);
        }
        if (table === 'products') {
          updateCollectionState(setProducts, eventType, mappedRecord, oldRecord);
        }
        if (table === 'users') updateCollectionState(setUsers, eventType, mappedRecord, oldRecord);

        if (table === 'system_config' && eventType !== 'DELETE' && mappedRecord) {
          const configKey = (payload as { config_key?: string }).config_key;
          if (configKey === 'shocks') setShocks(mappedRecord);
          if (configKey === 'raroc_inputs') setRarocInputs(mappedRecord);
          if (configKey === 'methodology_change_requests') {
            setMethodologyChangeRequests(mappedRecord);
          }
          if (configKey === 'methodology_versions') setMethodologyVersions(mappedRecord);
          if (configKey === 'approval_tasks') setApprovalTasks(mappedRecord);
          if (configKey === 'pricing_dossiers') setPricingDossiers(mappedRecord);
          if (configKey === 'portfolio_snapshots') setPortfolioSnapshots(mappedRecord);
          if (configKey === 'market_data_sources') setMarketDataSources(mappedRecord);
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
