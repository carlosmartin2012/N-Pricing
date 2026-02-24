import React, { useState } from 'react';
import { Transaction, ViewState, ApprovalMatrixConfig, ClientEntity, ProductDefinition, BusinessUnit, GeneralRule, UserProfile, BehaviouralModel, YieldCurvePoint, FtpRateCard } from './types';
import { INITIAL_DEAL, MOCK_CLIENTS, MOCK_PRODUCT_DEFS, MOCK_BUSINESS_UNITS, MOCK_DEALS, MOCK_USERS, MOCK_YIELD_CURVE, MOCK_BEHAVIOURAL_MODELS, WHITELISTED_EMAILS, MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID, MOCK_RULES, MOCK_FTP_RATE_CARDS } from './constants';
import DealInputPanel from './components/Calculator/DealInputPanel';
import MethodologyVisualizer from './components/Calculator/MethodologyVisualizer';
import PricingReceipt from './components/Calculator/PricingReceipt';
import MethodologyConfig from './components/Config/MethodologyConfig';
import DealBlotter from './components/Blotter/DealBlotter';
import YieldCurvePanel from './components/MarketData/YieldCurvePanel';
import AccountingLedger from './components/Accounting/AccountingLedger';
import BehaviouralModels from './components/Behavioural/BehaviouralModels';
import UserManual from './components/Docs/UserManual';
import UserManagement from './components/Admin/UserManagement';
import AuditLog from './components/Admin/AuditLog';
import GeminiAssistant from './components/Intelligence/GeminiAssistant';
import GenAIChat from './components/Intelligence/GenAIChat';
import LiquidityDashboard from './components/Liquidity/LiquidityDashboard';
import ReportingDashboard from './components/Reporting/ReportingDashboard';
import RAROCCalculator from './components/RAROC/RAROCCalculator';
import { Sidebar } from './components/ui/Sidebar';
import { Header } from './components/ui/Header';
import { Calculator, LineChart, FileText, Settings, Activity, BookOpen, Users, Sparkles, GitBranch, LayoutDashboard, ShieldCheck, Zap, BarChart4, Percent } from 'lucide-react';
import { Login } from './components/ui/Login';
import { UserConfigModal } from './components/ui/UserConfigModal';
import { UniversalImportModal } from './components/ui/UniversalImportModal';
import { translations, Language } from './translations';

import { storage } from './utils/storage';
import { supabaseService } from './utils/supabaseService';
import ShocksDashboard from './components/Risk/ShocksDashboard';
import { PricingShocks } from './utils/pricingEngine';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => storage.loadCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(!!storage.loadCurrentUser());
  const [theme] = useState<'dark'>('dark');
  const setTheme = () => { }; // Fixed: No-op for enforced dark mode
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [currentView, setCurrentView] = useState<ViewState>('CALCULATOR');
  const [isLoading, setIsLoading] = useState(true);

  const [dealParams, setDealParams] = useState<Transaction>(INITIAL_DEAL);
  const [matchedMethod, setMatchedMethod] = useState<string>('Matched Maturity');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Persistent States — initialized empty; Supabase is the single source of truth
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [deals, setDeals] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<GeneralRule[]>([]);
  const [behaviouralModels, setBehaviouralModels] = useState<BehaviouralModel[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [yieldCurves, setYieldCurves] = useState<any[]>([]);

  const [approvalMatrix, setApprovalMatrix] = useState<ApprovalMatrixConfig>(() => storage.loadLocal('n_pricing_approval_matrix', {
    autoApprovalThreshold: 15.0,
    l1Threshold: 10.0,
    l2Threshold: 5.0
  }));

  const [shocks, setShocks] = useState<PricingShocks>({ interestRate: 0, liquiditySpread: 0 });
  const [ftpRateCards, setFtpRateCards] = useState<FtpRateCard[]>([]);
  const [transitionGrid, setTransitionGrid] = useState<any[]>([]);
  const [physicalGrid, setPhysicalGrid] = useState<any[]>([]);
  const [rarocInputs, setRarocInputs] = useState<RAROCInputs | null>(null);

  // --- THEME SYNC ---
  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // --- SUPABASE REAL-TIME LIFECYCLE ---

  // 1. Initial Hydration from Supabase (V5.0: Demo-First Strategy)
  React.useEffect(() => {
    const hydrate = async () => {
      // Step A: Immediate injection of MOCK data to prevent loading lags
      setDeals(MOCK_DEALS);
      setClients(MOCK_CLIENTS);
      setUsers(MOCK_USERS);
      setBehaviouralModels(MOCK_BEHAVIOURAL_MODELS);
      setRules(MOCK_RULES);
      setProducts(MOCK_PRODUCT_DEFS);
      setBusinessUnits(MOCK_BUSINESS_UNITS);
      setFtpRateCards(MOCK_FTP_RATE_CARDS);
      setTransitionGrid(MOCK_TRANSITION_GRID);
      setPhysicalGrid(MOCK_PHYSICAL_GRID);
      setYieldCurves(MOCK_YIELD_CURVE);

      setIsLoading(false); // Enable UI immediately

      // Step B: Background Sync with Supabase (if available)
      try {
        const [dbDeals, dbModels, dbRules, dbClients, dbUnits, dbProducts, dbUsers, dbShocks, dbRateCards, dbTransGrid, dbPhysGrid, dbYieldCurves, dbRaroc] = await Promise.all([
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
          supabaseService.fetchRarocInputs()
        ]);

        if (dbDeals && dbDeals.length > 0) setDeals(dbDeals);
        if (dbModels && dbModels.length > 0) setBehaviouralModels(dbModels);
        if (dbRules && dbRules.length > 0) setRules(dbRules);
        if (dbClients && dbClients.length > 0) setClients(dbClients);
        if (dbUnits && dbUnits.length > 0) setBusinessUnits(dbUnits);
        if (dbProducts && dbProducts.length > 0) setProducts(dbProducts);
        if (dbUsers && dbUsers.length > 0) setUsers(dbUsers);
        if (dbShocks) setShocks(dbShocks);
        if (dbRateCards && dbRateCards.length > 0) setFtpRateCards(dbRateCards);
        if (dbTransGrid && dbTransGrid.length > 0) setTransitionGrid(dbTransGrid);
        if (dbPhysGrid && dbPhysGrid.length > 0) setPhysicalGrid(dbPhysGrid);
        if (dbYieldCurves && dbYieldCurves.length > 0) setYieldCurves(dbYieldCurves);
        if (dbRaroc) setRarocInputs(dbRaroc);
      } catch (err) {
        console.warn("Supabase background sync failed, staying on MOCK data.", err);
      }

      // System Bootstrap Audit
      storage.addAuditEntry({
        userEmail: currentUser?.email || 'system',
        userName: currentUser?.name || 'System',
        action: 'SYSTEM_BOOTSTRAP',
        module: 'CALCULATOR',
        description: 'Demo Mocks Hydrated. Background Supabase sync initiated.'
      });
    };
    hydrate();
  }, []);

  // 2. Real-time Subscription
  React.useEffect(() => {
    const channel = supabaseService.subscribeToAll((payload) => {
      const { table, eventType, mapped: mappedRecord, old: oldRecord } = payload;

      const updateState = (setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        setter(prev => {
          if (eventType === 'INSERT') {
            if (!mappedRecord) return prev;
            return [mappedRecord, ...prev];
          }
          if (eventType === 'UPDATE') {
            if (!mappedRecord) return prev;
            return prev.map(item => item.id === mappedRecord.id ? mappedRecord : item);
          }
          if (eventType === 'DELETE') {
            const idToRemove = oldRecord?.id;
            return prev.filter(item => item.id !== idToRemove);
          }
          return prev;
        });
      };

      if (table === 'deals') updateState(setDeals);
      if (table === 'behavioural_models') updateState(setBehaviouralModels);
      if (table === 'rules') updateState(setRules);
      if (table === 'clients') updateState(setClients);
      if (table === 'business_units') updateState(setBusinessUnits);
      if (table === 'products') updateState(setProducts);
      if (table === 'users') updateState(setUsers);
      if (table === 'system_config' && eventType !== 'DELETE') {
        if (mappedRecord) {
          const configKey = (payload as any).config_key;
          if (configKey === 'shocks') setShocks(mappedRecord);
          if (configKey === 'raroc_inputs') setRarocInputs(mappedRecord);
        }
      }
    });

    return () => { channel.unsubscribe(); };
  }, []);

  // 3. Presence Tracking
  React.useEffect(() => {
    if (isAuthenticated && currentUser) {
      const presenceChannel = supabaseService.trackPresence(currentUser.id, {
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role
      });
      return () => { presenceChannel.unsubscribe(); };
    }
  }, [isAuthenticated, currentUser]);

  // 4. SESSION_END — fires when user closes tab or navigates away
  React.useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery during page unload
      const entry = {
        user_email: currentUser.email,
        user_name: currentUser.name,
        action: 'SESSION_END',
        module: 'AUTH',
        description: `User ${currentUser.name} closed the application.`,
        details: {},
        timestamp: new Date().toISOString()
      };
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        navigator.sendBeacon(
          `${supabaseUrl}/rest/v1/audit_log`,
          new Blob(
            [JSON.stringify(entry)],
            { type: 'application/json' }
          )
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, currentUser]);

  // 3. Local Auto-Save (Backup Only)
  React.useEffect(() => { storage.saveLocal('n_pricing_rules', rules); }, [rules]);
  React.useEffect(() => { storage.saveLocal('n_pricing_clients', clients); }, [clients]);
  React.useEffect(() => { storage.saveLocal('n_pricing_approval_matrix', approvalMatrix); }, [approvalMatrix]);
  React.useEffect(() => { storage.saveLocal('n_pricing_behavioural', behaviouralModels); }, [behaviouralModels]);
  React.useEffect(() => { storage.saveLocal('n_pricing_deals', deals); }, [deals]);

  // 4. Shocks Persistence (Debounced)
  const prevShocks = React.useRef(shocks);
  React.useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(prevShocks.current) !== JSON.stringify(shocks)) {
        supabaseService.saveShocks(shocks);
        // Audit logging moved back to ShocksDashboard.tsx with onMouseUp to avoid log spamming
        prevShocks.current = shocks;
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [shocks, isLoading, currentUser]);

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const t = translations[language];

  const handleParamChange = (key: keyof Transaction, value: any) => {
    setDealParams(prev => ({ ...prev, [key]: value }));
  };

  const handleLogin = async (email: string) => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    let loggedUser: UserProfile;
    const now = new Date().toISOString();

    if (user) {
      loggedUser = { ...user, lastLogin: now };
    } else {
      loggedUser = {
        id: `USR-${Math.floor(Math.random() * 10000)}`,
        name: email.split('@')[0].replace('.', ' '),
        email: email,
        role: 'Trader',
        status: 'Active',
        lastLogin: now,
        department: 'General'
      };
    }

    setCurrentUser(loggedUser);
    setIsAuthenticated(true);
    storage.saveCurrentUser(loggedUser);

    // Persist user login in Supabase
    await supabaseService.upsertUser(loggedUser);

    storage.addAuditEntry({
      userEmail: email,
      userName: loggedUser.name,
      action: 'LOGIN',
      module: 'CALCULATOR',
      description: `User ${loggedUser.name} logged into the system.`
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    storage.saveCurrentUser(null);
  };

  const handleUniversalImport = async (module: string, rawData: any[]) => {
    // Defensive Filter: Ignore completely empty rows
    const data = rawData.filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ''));
    switch (module) {
      case 'YIELD_CURVES': {
        // Group points by currency for multi-currency import
        const curves: Record<string, YieldCurvePoint[]> = {};

        data.forEach(r => {
          const cur = r.Currency || r.currency || 'USD';
          if (!curves[cur]) curves[cur] = [];
          curves[cur].push({
            tenor: r.Tenor || r.tenor || '1M',
            rate: parseFloat(r.Rate || r.rate) || 0,
            prev: parseFloat(r.Prev || r.prev) || 0
          });
        });

        for (const [cur, points] of Object.entries(curves)) {
          await storage.saveCurveSnapshot(cur, new Date().toISOString().split('T')[0], points);

          await storage.addAuditEntry({
            userEmail: currentUser?.email || 'unknown',
            userName: currentUser?.name || 'Unknown User',
            action: 'IMPORT_YIELD_CURVES',
            module: 'MARKET_DATA',
            description: `Imported ${points.length} curve points for ${cur}`
          });
        }
        break;
      }
      case 'METHODOLOGY': {
        const rulesToSave = data.map(r => ({
          id: r.ID || r.id || Math.floor(Math.random() * 10000),
          businessUnit: r.BusinessUnit || r.businessUnit || 'General',
          product: r.Product || r.product || 'Unknown',
          segment: r.Segment || r.segment || 'All',
          tenor: r.Tenor || r.tenor || 'Any',
          baseMethod: r.BaseMethod || r.baseMethod || 'Matched Maturity',
          baseReference: r.BaseReference || r.baseReference || 'USD-SOFR',
          spreadMethod: r.SpreadMethod || r.spreadMethod || 'Fixed',
          liquidityReference: r.LiquidityReference || r.liquidityReference || 'Standard',
          strategicSpread: parseFloat(r.StrategicSpread || r.strategicSpread) || 0
        }));
        for (const rule of rulesToSave) {
          await supabaseService.saveRule(rule as GeneralRule);
        }
        await storage.addAuditEntry({
          userEmail: currentUser?.email || 'unknown',
          userName: currentUser?.name || 'Unknown User',
          action: 'IMPORT_METHODOLOGY',
          module: 'METHODOLOGY',
          description: `Imported ${rulesToSave.length} methodology rules.`
        });
        break;
      }
      case 'BEHAVIOURAL': {
        const modelsToSave = data.map(r => ({
          id: r.ID || r.id || `MOD-IMP-${Math.floor(Math.random() * 1000)}`,
          name: r.Name || r.name || 'Imported Model',
          type: (r.Type || r.type || 'NMD_Replication') as any,
          description: r.Description || r.description || '',
          coreRatio: parseFloat(r.CoreRatio || r.coreRatio) || 50,
          decayRate: parseFloat(r.DecayRate || r.decayRate) || 0,
          betaFactor: parseFloat(r.BetaFactor || r.betaFactor) || 0.5,
          cpr: parseFloat(r.CPR || r.cpr) || 5,
          penaltyExempt: parseFloat(r.PenaltyExempt || r.penaltyExempt) || 0,
          replicationProfile: r.ReplicationProfile ? (typeof r.ReplicationProfile === 'string' ? JSON.parse(r.ReplicationProfile) : r.ReplicationProfile) : []
        }));
        for (const model of modelsToSave) {
          await storage.saveBehaviouralModel(model as BehaviouralModel);
        }
        await storage.addAuditEntry({
          userEmail: currentUser?.email || 'unknown',
          userName: currentUser?.name || 'Unknown User',
          action: 'IMPORT_BEHAVIOURAL',
          module: 'BEHAVIOURAL',
          description: `Imported ${modelsToSave.length} behavioural models.`
        });
        break;
      }
      case 'SHOCKS': {
        const row = data[0];
        const newShocks = {
          interestRate: parseFloat(row.InterestRateShock || row.interestRateShock) || 0,
          liquiditySpread: parseFloat(row.LiquiditySpreadShock || row.liquiditySpreadShock) || 0
        };
        setShocks(newShocks);
        await supabaseService.saveShocks(newShocks);

        await storage.addAuditEntry({
          userEmail: currentUser?.email || 'unknown',
          userName: currentUser?.name || 'Unknown User',
          action: 'IMPORT_SHOCKS',
          module: 'SHOCKS',
          description: `Universal import applied shocks: IR=${newShocks.interestRate}bps, Liq=${newShocks.liquiditySpread}bps`
        });
        break;
      }
      case 'DEALS': {
        const dealsToSave = data.map(r => ({
          id: r.ID || r.id || r['Transact ID'] || `DL-${Math.floor(Math.random() * 99999)}`,
          clientId: r.Client || r.clientId || 'Unknown Client',
          amount: parseFloat(r.Amount || r.amount) || 0,
          currency: r.Currency || r.currency || 'USD',
          productType: r.Product || r.productType || 'Loan',
          startDate: r.Date || r.startDate || new Date().toISOString().split('T')[0],
          durationMonths: parseInt(r.Duration || r.durationMonths) || 12,
          status: 'Draft',
          businessUnit: r.BU || r.businessUnit || 'Retail',
          marginTarget: parseFloat(r.Margin || r.marginTarget) || 0
        }));
        for (const dl of dealsToSave) {
          await storage.saveDeal(dl as Transaction);
        }
        break;
      }
    }

    storage.addAuditEntry({
      userEmail: currentUser?.email || 'unknown',
      userName: currentUser?.name || 'Unknown User',
      action: `UNIVERSAL_IMPORT_${module}`,
      module: 'CONFIG',
      description: `Universal import performed for ${module} (${data.length} records)`
    });
  };

  if (!isAuthenticated) {
    const combinedWhitelist = [...new Set([...users.map(u => u.email), ...WHITELISTED_EMAILS])];
    return <Login onLogin={handleLogin} whitelistedEmails={combinedWhitelist} language={language} />;
  }

  const mainNavItems = [
    { id: 'CALCULATOR', label: t.pricingEngine, icon: Calculator },
    { id: 'REPORTING', label: 'Reporting ALM', icon: BarChart4 },
    { id: 'BLOTTER', label: t.dealBlotter, icon: FileText },
    { id: 'MARKET_DATA', label: t.yieldCurves, icon: LineChart },
    { id: 'BEHAVIOURAL', label: t.behaviouralModels, icon: Activity },
    { id: 'RAROC', label: 'RAROC Terminal', icon: Percent },
    { id: 'METHODOLOGY', label: t.methodology, icon: GitBranch },
    { id: 'ACCOUNTING', label: t.accountingLedger, icon: LayoutDashboard },
    { id: 'SHOCKS', label: t.shocks, icon: Zap },
    { id: 'CONFIG', label: t.systemConfig, icon: Settings },
  ];

  const bottomNavItems = [
    { id: 'USER_CONFIG', label: t.userConfig, icon: Settings },
    { id: 'USER_MGMT', label: t.userMgmt, icon: Users },
    { id: 'AUDIT_LOG', label: t.auditLog, icon: ShieldCheck },
    { id: 'MANUAL', label: t.manual, icon: BookOpen },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-slate-200 font-sans selection:bg-cyan-900 selection:text-white overflow-hidden transition-colors duration-300">

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        currentView={currentView}
        setCurrentView={setCurrentView}
        mainNavItems={mainNavItems}
        bottomNavItems={bottomNavItems}
        onOpenConfig={() => setIsConfigModalOpen(true)}
        language={language}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative h-full">

        <Header
          isSidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
          currentView={currentView}
          mainNavItems={mainNavItems}
          bottomNavItems={bottomNavItems}
          theme={theme}
          setTheme={setTheme}
          language={language}
          setLanguage={setLanguage}
          user={currentUser}
          onLogout={handleLogout}
          onOpenImport={() => setIsImportModalOpen(true)}
        />

        <main className="flex-1 p-3 md:p-6 overflow-auto relative custom-scrollbar bg-slate-50 dark:bg-black">
          <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-[0.02]"
            style={{ backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>

          {currentView === 'CALCULATOR' && (
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 md:gap-6 relative z-0 h-full">
              <div className="lg:col-span-4 w-full h-full flex flex-col">
                <DealInputPanel
                  values={dealParams}
                  onChange={handleParamChange}
                  setDealParams={setDealParams}
                  deals={deals}
                  clients={clients}
                  setClients={setClients}
                  products={products}
                  businessUnits={businessUnits}
                  language={language}
                  behaviouralModels={behaviouralModels}
                />
              </div>
              <div className="lg:col-span-4 w-full h-full flex flex-col">
                <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
              </div>
              <div className="lg:col-span-4 w-full h-full flex flex-col">
                <PricingReceipt
                  deal={dealParams}
                  setMatchedMethod={setMatchedMethod}
                  approvalMatrix={approvalMatrix}
                  language={language}
                  shocks={shocks}
                  user={currentUser}
                />
              </div>
            </div>
          )}

          {currentView === 'BLOTTER' && (
            <div className="h-full relative z-0">
              <DealBlotter
                deals={deals}
                setDeals={setDeals}
                products={products}
                clients={clients}
                businessUnits={businessUnits}
                language={language}
                user={currentUser}
              />
            </div>
          )}

          {currentView === 'REPORTING' && (
            <div className="h-full relative z-0 flex flex-col">
              <ReportingDashboard
                deals={deals}
                products={products}
                businessUnits={businessUnits}
                shocks={shocks}
                clients={clients}
              />
            </div>
          )}

          {currentView === 'RAROC' && (
            <div className="h-full relative z-0">
              <RAROCCalculator
                externalInputs={rarocInputs}
                onUpdateExternal={(inputs) => {
                  setRarocInputs(inputs);
                  supabaseService.saveRarocInputs(inputs);
                }}
              />
            </div>
          )}

          {currentView === 'MARKET_DATA' && (
            <div className="h-full relative z-0">
              <YieldCurvePanel language={language} user={currentUser} />
            </div>
          )}

          {currentView === 'BEHAVIOURAL' && (
            <div className="h-full relative z-0">
              <BehaviouralModels models={behaviouralModels} setModels={setBehaviouralModels} user={currentUser} />
            </div>
          )}

          {currentView === 'METHODOLOGY' && (
            <div className="h-full relative z-0">
              <MethodologyConfig
                mode="METHODOLOGY"
                rules={rules}
                setRules={setRules}
                approvalMatrix={approvalMatrix}
                setApprovalMatrix={setApprovalMatrix}
                products={products}
                setProducts={setProducts}
                businessUnits={businessUnits}
                setBusinessUnits={setBusinessUnits}
                clients={clients}
                setClients={setClients}
                ftpRateCards={ftpRateCards}
                setFtpRateCards={setFtpRateCards}
                transitionGrid={transitionGrid}
                setTransitionGrid={setTransitionGrid}
                physicalGrid={physicalGrid}
                setPhysicalGrid={setPhysicalGrid}
                user={currentUser}
              />
            </div>
          )}

          {currentView === 'ACCOUNTING' && (
            <div className="h-full relative z-0">
              <AccountingLedger />
            </div>
          )}

          {currentView === 'CONFIG' && (
            <div className="h-full relative z-0">
              <MethodologyConfig
                mode="SYS_CONFIG"
                rules={rules}
                setRules={setRules}
                approvalMatrix={approvalMatrix}
                setApprovalMatrix={setApprovalMatrix}
                products={products}
                setProducts={setProducts}
                businessUnits={businessUnits}
                setBusinessUnits={setBusinessUnits}
                clients={clients}
                setClients={setClients}
                ftpRateCards={ftpRateCards}
                setFtpRateCards={setFtpRateCards}
                transitionGrid={transitionGrid}
                setTransitionGrid={setTransitionGrid}
                physicalGrid={physicalGrid}
                setPhysicalGrid={setPhysicalGrid}
                user={currentUser}
              />
            </div>
          )}

          {currentView === 'USER_MGMT' && (
            <div className="h-full relative z-0 flex flex-col">
              <UserManagement users={users} setUsers={setUsers} />
            </div>
          )}

          {currentView === 'AUDIT_LOG' && (
            <div className="h-full relative z-0">
              <AuditLog />
            </div>
          )}

          {currentView === 'MANUAL' && (
            <div className="h-full relative z-0">
              <UserManual language={language} />
            </div>
          )}


          {currentView === 'AI_LAB' && (
            <div className="h-full relative z-0 flex flex-col">
              <GenAIChat
                deals={deals}
                marketSummary={`USD Overnight: ${MOCK_YIELD_CURVE[0].rate}%`}
              />
            </div>
          )}

          {currentView === 'SHOCKS' && (
            <div className="h-full relative z-0 flex flex-col">
              <ShocksDashboard
                deal={dealParams}
                approvalMatrix={approvalMatrix}
                language={language}
                shocks={shocks}
                setShocks={setShocks}
                user={currentUser}
              />
            </div>
          )}

        </main>

        <button
          onClick={() => setIsAiOpen(true)}
          className={`fixed bottom-6 right-6 w-12 h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center justify-center transition-transform hover:scale-110 z-40 ${isAiOpen ? 'scale-0' : 'scale-100'}`}
        >
          <Sparkles size={24} className="animate-pulse" />
        </button>

        <GeminiAssistant
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
          onOpenFullChat={() => {
            setIsAiOpen(false);
            setCurrentView('AI_LAB');
          }}
          contextData={{
            activeDeal: dealParams,
            marketContext: `Current Base USD Yield Curve: ${JSON.stringify(MOCK_YIELD_CURVE.slice(0, 5))}...`
          }}
        />

        <UserConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          language={language}
          setLanguage={setLanguage}
          theme={theme}
          setTheme={setTheme}
        />

        <UniversalImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleUniversalImport}
        />

      </div>
    </div>
  );
};

export default App;
