import { useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import {
  MOCK_DEALS, MOCK_CLIENTS, MOCK_USERS, MOCK_BEHAVIOURAL_MODELS,
  MOCK_RULES, MOCK_PRODUCT_DEFS, MOCK_BUSINESS_UNITS,
  MOCK_FTP_RATE_CARDS, MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID, MOCK_YIELD_CURVE,
  MOCK_LIQUIDITY_CURVES,
} from '../constants';
import { storage } from '../utils/storage';
import { supabaseService } from '../utils/supabaseService';

/**
 * Handles initial data hydration, real-time subscriptions,
 * presence tracking, session end logging, and local auto-save.
 */
export const useSupabaseSync = () => {
  const data = useData();
  const { currentUser, isAuthenticated } = useAuth();
  const prevShocks = useRef(data.shocks);

  // 1. Initial Hydration (Supabase-First, Mock-Fallback Strategy)
  useEffect(() => {
    const hydrate = async () => {
      try {
        // Step A: Try Supabase first
        const [dbDeals, dbModels, dbRules, dbClients, dbUnits, dbProducts, dbUsers, dbShocks, dbRateCards, dbTransGrid, dbPhysGrid, dbYieldCurves, dbRaroc, dbApprovalMatrix, dbLiqCurves] = await Promise.all([
          storage.getDeals(),
          storage.getBehaviouralModels(),
          supabaseService.fetchRules(),
          supabaseService.fetchClients(),
          supabaseService.fetchBusinessUnits(),
          supabaseService.fetchProducts(),
          supabaseService.fetchUsers(),
          supabaseService.fetchShocks(),
          supabaseService.fetchRateCards(),
          supabaseService.fetchEsgGrid('transition'),
          supabaseService.fetchEsgGrid('physical'),
          supabaseService.fetchYieldCurves(),
          supabaseService.fetchRarocInputs(),
          supabaseService.fetchApprovalMatrix(),
          supabaseService.fetchLiquidityCurves(),
        ]);

        // Use Supabase data if available, otherwise fall back to mocks
        data.setDeals(dbDeals?.length ? dbDeals : MOCK_DEALS);
        data.setBehaviouralModels(dbModels?.length ? dbModels : MOCK_BEHAVIOURAL_MODELS);
        data.setRules(dbRules?.length ? dbRules : MOCK_RULES);
        data.setClients(dbClients?.length ? dbClients : MOCK_CLIENTS);
        data.setBusinessUnits(dbUnits?.length ? dbUnits : MOCK_BUSINESS_UNITS);
        data.setProducts(dbProducts?.length ? dbProducts : MOCK_PRODUCT_DEFS);
        data.setUsers(dbUsers?.length ? dbUsers : MOCK_USERS);
        if (dbShocks) data.setShocks(dbShocks);
        data.setFtpRateCards(dbRateCards?.length ? dbRateCards : MOCK_FTP_RATE_CARDS);
        data.setTransitionGrid(dbTransGrid?.length ? dbTransGrid : MOCK_TRANSITION_GRID);
        data.setPhysicalGrid(dbPhysGrid?.length ? dbPhysGrid : MOCK_PHYSICAL_GRID);
        data.setYieldCurves(dbYieldCurves?.length ? dbYieldCurves : MOCK_YIELD_CURVE);
        data.setLiquidityCurves(dbLiqCurves?.length ? dbLiqCurves : MOCK_LIQUIDITY_CURVES);
        if (dbRaroc) data.setRarocInputs(dbRaroc);
        if (dbApprovalMatrix) data.setApprovalMatrix(dbApprovalMatrix);

        const hasRemoteData = [dbDeals, dbModels, dbRules, dbClients, dbUnits, dbProducts].some(d => d?.length);
        data.setSyncStatus(hasRemoteData ? 'synced' : 'mock');
      } catch (err) {
        // Step B: Full mock fallback on Supabase failure
        console.warn('Supabase sync failed, loading mock data.', err);
        data.setDeals(MOCK_DEALS);
        data.setClients(MOCK_CLIENTS);
        data.setUsers(MOCK_USERS);
        data.setBehaviouralModels(MOCK_BEHAVIOURAL_MODELS);
        data.setRules(MOCK_RULES);
        data.setProducts(MOCK_PRODUCT_DEFS);
        data.setBusinessUnits(MOCK_BUSINESS_UNITS);
        data.setFtpRateCards(MOCK_FTP_RATE_CARDS);
        data.setTransitionGrid(MOCK_TRANSITION_GRID);
        data.setPhysicalGrid(MOCK_PHYSICAL_GRID);
        data.setYieldCurves(MOCK_YIELD_CURVE);
        data.setLiquidityCurves(MOCK_LIQUIDITY_CURVES);
        data.setSyncStatus('error');
      }

      data.setIsLoading(false);

      storage.addAuditEntry({
        userEmail: currentUser?.email || 'system',
        userName: currentUser?.name || 'System',
        action: 'SYSTEM_BOOTSTRAP',
        module: 'CALCULATOR',
        description: `Data hydrated. Status: ${data.syncStatus}.`,
      });
    };
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Real-time Subscription
  useEffect(() => {
    const channel = supabaseService.subscribeToAll((payload: any) => {
      const { table, eventType, mapped: mappedRecord, old: oldRecord } = payload;

      const updateState = (setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        setter((prev: any[]) => {
          if (eventType === 'INSERT') return mappedRecord ? [mappedRecord, ...prev] : prev;
          if (eventType === 'UPDATE') return mappedRecord ? prev.map((item: any) => item.id === mappedRecord.id ? mappedRecord : item) : prev;
          if (eventType === 'DELETE') return prev.filter((item: any) => item.id !== oldRecord?.id);
          return prev;
        });
      };

      if (table === 'deals') updateState(data.setDeals);
      if (table === 'behavioural_models') updateState(data.setBehaviouralModels);
      if (table === 'rules') updateState(data.setRules);
      if (table === 'clients') updateState(data.setClients);
      if (table === 'business_units') updateState(data.setBusinessUnits);
      if (table === 'products') updateState(data.setProducts);
      if (table === 'users') updateState(data.setUsers);
      if (table === 'system_config' && eventType !== 'DELETE' && mappedRecord) {
        const configKey = (payload as any).config_key;
        if (configKey === 'shocks') data.setShocks(mappedRecord);
        if (configKey === 'raroc_inputs') data.setRarocInputs(mappedRecord);
      }
    });

    return () => { channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Presence Tracking
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const presenceChannel = supabaseService.trackPresence(currentUser.id, {
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      });
      return () => { presenceChannel.unsubscribe(); };
    }
  }, [isAuthenticated, currentUser]);

  // 4. SESSION_END on tab close
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const handleBeforeUnload = () => {
      const entry = {
        user_email: currentUser.email,
        user_name: currentUser.name,
        action: 'SESSION_END',
        module: 'AUTH',
        description: `User ${currentUser.name} closed the application.`,
        details: {},
        timestamp: new Date().toISOString(),
      };
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        // Use fetch with keepalive instead of sendBeacon to include auth headers
        fetch(`${supabaseUrl}/rest/v1/audit_log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(entry),
          keepalive: true, // ensures request completes even after page unload
        }).catch(() => {}); // fire-and-forget
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, currentUser]);

  // 5. Local + Supabase Auto-Save (Debounced)
  useEffect(() => { storage.saveLocal('n_pricing_rules', data.rules); }, [data.rules]);
  useEffect(() => { storage.saveLocal('n_pricing_clients', data.clients); }, [data.clients]);
  useEffect(() => { storage.saveLocal('n_pricing_behavioural', data.behaviouralModels); }, [data.behaviouralModels]);
  useEffect(() => { storage.saveLocal('n_pricing_deals', data.deals); }, [data.deals]);

  // 5b. Config persistence to Supabase (debounced)
  const prevRateCards = useRef(data.ftpRateCards);
  const prevTransGrid = useRef(data.transitionGrid);
  const prevPhysGrid = useRef(data.physicalGrid);
  const prevApproval = useRef(data.approvalMatrix);

  useEffect(() => {
    if (data.isLoading) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(prevRateCards.current) !== JSON.stringify(data.ftpRateCards)) {
        supabaseService.saveRateCards(data.ftpRateCards);
        prevRateCards.current = data.ftpRateCards;
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [data.ftpRateCards, data.isLoading]);

  useEffect(() => {
    if (data.isLoading) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(prevTransGrid.current) !== JSON.stringify(data.transitionGrid)) {
        supabaseService.saveEsgGrid('transition', data.transitionGrid);
        prevTransGrid.current = data.transitionGrid;
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [data.transitionGrid, data.isLoading]);

  useEffect(() => {
    if (data.isLoading) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(prevPhysGrid.current) !== JSON.stringify(data.physicalGrid)) {
        supabaseService.saveEsgGrid('physical', data.physicalGrid);
        prevPhysGrid.current = data.physicalGrid;
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [data.physicalGrid, data.isLoading]);

  useEffect(() => {
    if (data.isLoading) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(prevApproval.current) !== JSON.stringify(data.approvalMatrix)) {
        supabaseService.saveApprovalMatrix(data.approvalMatrix);
        prevApproval.current = data.approvalMatrix;
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [data.approvalMatrix, data.isLoading]);

  // 6. Shocks Persistence (Debounced)
  useEffect(() => {
    if (data.isLoading) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(prevShocks.current) !== JSON.stringify(data.shocks)) {
        supabaseService.saveShocks(data.shocks);
        prevShocks.current = data.shocks;
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [data.shocks, data.isLoading]);
};
