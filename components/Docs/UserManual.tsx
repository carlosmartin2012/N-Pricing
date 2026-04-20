import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Panel } from '../ui/LayoutComponents';
import {
  Activity,
  BookA,
  BookOpen,
  BookOpenCheck,
  Briefcase,
  Calculator,
  Compass,
  DatabaseZap,
  FileSignature,
  FileText,
  GitBranch,
  Grid3X3,
  HeartPulse,
  History,
  LayoutDashboard,
  LayoutPanelLeft,
  LifeBuoy,
  LineChart,
  Plug,
  Route,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { translations, getTranslations } from '../../translations';
import { useUI } from '../../contexts/UIContext';
import { useWalkthrough } from '../../contexts/WalkthroughContext';
import { getUserManualContent } from '../../utils/userManualContent';

/*
 * User Manual — organized by the 4 lifecycle buckets of the new nav:
 *   Commercial → Pricing → Insights → Governance
 * Plus a "Power user" section for ⌘K command palette, Customer 360 drawer,
 * and the formulas + glossary reference at the bottom.
 */

// --- Helper Components ---

const TocItem: React.FC<{ targetId: string; label: string; accent?: string }> = ({
  targetId,
  label,
  accent,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <button
      onClick={handleClick}
      className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-cyan-400"
    >
      {accent && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent}`} />}
      {label}
    </button>
  );
};

const TocSectionLabel: React.FC<{ label: string; accent: string }> = ({ label, accent }) => (
  <div className={`mt-4 flex items-center gap-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] ${accent}`}>
    {label}
  </div>
);

const SectionHeader: React.FC<{ icon: LucideIcon; title: string; color: string }> = ({
  icon: Icon,
  title,
  color,
}) => (
  <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
    <Icon size={22} className={color} />
    <h3 className={`text-xl font-bold ${color}`}>{title}</h3>
  </div>
);

const FeatureCard: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
    <h4 className="mb-1 text-sm font-bold text-slate-200">{title}</h4>
    <p className="text-xs leading-snug text-slate-500">{desc}</p>
  </div>
);

const Shortcut: React.FC<{ keys: string; desc: string }> = ({ keys, desc }) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-4 py-2.5">
    <span className="text-sm text-slate-300">{desc}</span>
    <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200">
      {keys}
    </kbd>
  </div>
);

// --- Main Component ---

const UserManual: React.FC = () => {
  const { language } = useUI();
  const t = getTranslations(language) || translations['en'];
  const { startTour } = useWalkthrough();
  const isES = language === 'es';

  const L = (en: string, es: string) => (isES ? es : en);
  const guide = getUserManualContent(language);

  return (
    <Panel title={`N Pricing — ${t.manual}`} className="h-full">
      <div className="flex h-full">
        {/* Table of Contents */}
        <div className="hidden w-72 space-y-1 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 lg:block">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            {L('Contents', 'Contenidos')}
          </h4>
          <nav className="space-y-0.5">
            <TocItem targetId="intro" label={L('Introduction', 'Introducción')} />
            <TocItem targetId="whats-new" label={L("What's new", 'Novedades')} />
            <TocItem targetId="architecture" label={L('Architecture', 'Arquitectura')} />

            <TocSectionLabel label={L('Commercial', 'Comercial')} accent="text-emerald-400" />
            <TocItem targetId="customers" label={L('Customers (360°)', 'Clientes (360°)')} accent="bg-emerald-400" />
            <TocItem targetId="campaigns" label={L('Campaigns', 'Campañas')} accent="bg-emerald-400" />
            <TocItem targetId="target-grid" label={L('Target Grid', 'Target Grid')} accent="bg-emerald-400" />

            <TocSectionLabel label="Pricing" accent="text-cyan-400" />
            <TocItem targetId="pricing-engine" label={L('Pricing Engine (4 tabs)', 'Motor de Pricing (4 tabs)')} accent="bg-cyan-400" />
            <TocItem targetId="blotter" label={L('Deal Blotter', 'Deal Blotter')} accent="bg-cyan-400" />
            <TocItem targetId="accounting" label={L('Accounting Ledger', 'Libro Contable')} accent="bg-cyan-400" />

            <TocSectionLabel label="Insights" accent="text-amber-400" />
            <TocItem targetId="analytics" label="Analytics" accent="bg-amber-400" />
            <TocItem targetId="market-data" label={L('Yield Curves', 'Curvas de Tipos')} accent="bg-amber-400" />
            <TocItem targetId="behavioural" label={L('Behavioural Models', 'Modelos Comportamentales')} accent="bg-amber-400" />

            <TocSectionLabel label="Governance" accent="text-violet-300" />
            <TocItem targetId="methodology" label={L('Methodology', 'Metodología')} accent="bg-violet-400" />
            <TocItem targetId="model-inventory" label="Model Inventory" accent="bg-violet-400" />
            <TocItem targetId="dossiers" label={L('Signed Dossiers', 'Dossiers Firmados')} accent="bg-violet-400" />
            <TocItem targetId="escalations" label="Escalations" accent="bg-violet-400" />
            <TocItem targetId="snapshots" label="Snapshot Replay" accent="bg-violet-400" />

            <TocSectionLabel label={L('Power user', 'Power user')} accent="text-fuchsia-300" />
            <TocItem targetId="command-palette" label="Command Palette (⌘K)" accent="bg-fuchsia-400" />
            <TocItem targetId="customer-drawer" label="Customer 360 Drawer" accent="bg-fuchsia-400" />
            <TocItem targetId="shortcuts" label={L('Keyboard shortcuts', 'Atajos de teclado')} accent="bg-fuchsia-400" />

            <TocSectionLabel label={L('Operational guide', 'Guía operativa')} accent="text-cyan-300" />
            <TocItem targetId="quickstart" label={L('Quick start', 'Puesta en marcha')} accent="bg-cyan-400" />
            <TocItem targetId="workflows" label={L('Workflows', 'Flujos operativos')} accent="bg-cyan-400" />
            <TocItem targetId="data-modes" label={L('Data modes', 'Modos de datos')} accent="bg-cyan-400" />
            <TocItem targetId="troubleshooting" label={L('Troubleshooting', 'Resolución problemas')} accent="bg-cyan-400" />

            <TocSectionLabel label={L('Reference', 'Referencia')} accent="text-slate-400" />
            <TocItem targetId="formulas" label={t.manual_formulasTitle} />
            <TocItem targetId="glossary" label={t.manual_glossaryTitle} />
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth p-6" id="manual-content">
          <div className="mx-auto max-w-4xl space-y-12">

            {/* Introduction */}
            <section id="intro" className="space-y-4 pt-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="rounded-lg border border-cyan-900 bg-cyan-950 p-2 text-cyan-400">
                  <BookOpen size={24} />
                </div>
                <h2 className="text-3xl font-bold text-slate-100">
                  {L('Welcome to N Pricing', 'Bienvenido a N Pricing')}
                </h2>
              </div>
              <p className="leading-relaxed text-slate-400">
                {L(
                  'N Pricing is an integrated bank-pricing platform covering three scopes on a single engine: internal Funds Transfer Pricing (FTP), relational customer pricing, and real-time channel quoting for branch/web/mobile/partner. Multi-tenant with strict RLS, snapshot-first for regulatory reproducibility, MRM-governed under SR 11-7 / EBA.',
                  'N Pricing es una plataforma integral de pricing bancario que cubre tres ámbitos en un mismo motor: Funds Transfer Pricing (FTP) interno, pricing relacional al cliente y cotización de canales en tiempo real para sucursal/web/móvil/partner. Multi-tenant con RLS estricto, snapshot-first por requerimiento regulatorio, gobernado bajo MRM SR 11-7 / EBA.',
                )}
              </p>
              <button
                onClick={() => startTour('business-flow-tour')}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--nfq-accent)]/20 bg-[var(--nfq-accent)]/10 px-4 py-3 text-left transition-colors hover:bg-[var(--nfq-accent)]/20"
              >
                <Compass size={20} className="shrink-0 text-[var(--nfq-accent)]" />
                <div>
                  <span className="text-sm font-semibold text-slate-200">
                    {L('Start guided tour (~1 min)', 'Iniciar tour guiado (~1 min)')}
                  </span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {L(
                      'Walk through the 4 lifecycle buckets + Command Palette + Customer 360 drawer.',
                      'Recorre los 4 buckets del ciclo de vida + Command Palette + drawer Customer 360.',
                    )}
                  </p>
                </div>
              </button>
            </section>

            {/* What's new */}
            <section id="whats-new" className="space-y-4 pt-4">
              <SectionHeader
                icon={Sparkles}
                title={L("What's new — Nav restructure (Q2 2026)", 'Novedades — Reestructuración de nav (Q2 2026)')}
                color="text-fuchsia-300"
              />
              <p className="text-slate-400">
                {L(
                  'The navigation has been reorganized around the pricing lifecycle (4 buckets instead of 7 sections), the Pricing Engine is now a single entry with 4 internal tabs (Deal · RAROC · Stress · What-If), and a global Command Palette (⌘K) plus a Customer 360 Drawer give power users contextual access without cluttering the sidebar.',
                  'La navegación se ha reorganizado en torno al ciclo de vida del pricing (4 buckets en lugar de 7 secciones), el Pricing Engine es ahora una sola entrada con 4 tabs internas (Deal · RAROC · Stress · What-If), y el Command Palette global (⌘K) más el Drawer Customer 360 dan acceso contextual a usuarios avanzados sin saturar el sidebar.',
                )}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FeatureCard
                  title={L('4-bucket sidebar', 'Sidebar en 4 buckets')}
                  desc={L(
                    'Commercial · Pricing · Insights · Governance. Color-coded section dots, tab hints on items with sub-views.',
                    'Commercial · Pricing · Insights · Governance. Puntos de color por sección, indicador de tabs en items con sub-vistas.',
                  )}
                />
                <FeatureCard
                  title={L('Unified Pricing workspace', 'Workspace unificado de Pricing')}
                  desc={L(
                    'Calculator, RAROC, Stress and What-If share the same deal context. Switching tab keeps your inputs.',
                    'Calculator, RAROC, Stress y What-If comparten el mismo contexto del deal. Cambiar de tab conserva los inputs.',
                  )}
                />
                <FeatureCard
                  title="Command Palette (⌘K)"
                  desc={L(
                    '18 destinations + 7 aux + 50 clients (drawer) + deals + actions. Fuzzy search.',
                    '18 destinos + 7 auxiliares + 50 clientes (drawer) + operaciones + acciones. Búsqueda fuzzy.',
                  )}
                />
                <FeatureCard
                  title={L('Customer 360 Drawer', 'Drawer Customer 360')}
                  desc={L(
                    'Invokable from any view — open a client 360 without losing your current workspace.',
                    'Invocable desde cualquier vista — abre el 360 del cliente sin perder el workspace actual.',
                  )}
                />
                <FeatureCard
                  title="Snapshot Replay UI"
                  desc={L(
                    'Replay any stored pricing snapshot against the live engine and see field-level diffs.',
                    'Re-ejecuta cualquier snapshot almacenado contra el motor actual y ve el diff por campo.',
                  )}
                />
                <FeatureCard
                  title={L('SLO + Adapter Health', 'SLO + Adapter Health')}
                  desc={L(
                    'Promoted from inside Health to first-class destinations reachable via ⌘K.',
                    'Ascendidos de Health a destinos de primera clase vía ⌘K.',
                  )}
                />
              </div>
            </section>

            {/* Architecture — high level */}
            <section id="architecture" className="space-y-4 pt-4">
              <SectionHeader icon={Briefcase} title={L('Architecture at a glance', 'Arquitectura de un vistazo')} color="text-slate-200" />
              <p className="text-slate-400">
                {L(
                  'React 19 SPA with Context API for state, @tanstack/react-query for data fetching, and Express + PostgreSQL for the server. Pricing runs on a server-side engine with snapshot-first reproducibility. Multi-tenant via Postgres RLS; every entity-scoped request carries x-entity-id and resolves through the tenancy middleware.',
                  'SPA de React 19 con Context API para estado, @tanstack/react-query para data fetching, y Express + PostgreSQL en el servidor. El pricing corre en un motor server-side con reproducibilidad snapshot-first. Multi-tenant vía RLS de Postgres; cada request entity-scoped lleva x-entity-id y pasa por el middleware de tenancy.',
                )}
              </p>
            </section>

            <hr className="border-slate-800" />

            {/* ═══════════════ COMMERCIAL ═══════════════ */}
            <h2 className="flex items-center gap-3 border-l-4 border-emerald-400 pl-4 text-2xl font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {L('Commercial — pre-deal', 'Comercial — pre-deal')}
            </h2>

            <section id="customers" className="space-y-4 pt-2">
              <SectionHeader icon={Users} title={L('Customers (Customer 360)', 'Clientes (Customer 360)')} color="text-emerald-400" />
              <p className="text-slate-400">
                {L(
                  'The relational view of the customer. Aggregates active positions, snapshot metrics (NIM, fees, EVA, NPS, share of wallet), and applicable top-down pricing targets. Cross-bonus for pricing is derived automatically from the customer\'s real holdings — no manual per-deal attachment needed.',
                  'La vista relacional del cliente. Agrega posiciones activas, métricas snapshot (NIM, fees, EVA, NPS, share of wallet) y targets top-down de pricing aplicables. El cross-bonus se deriva automáticamente de las posiciones reales del cliente — no hace falta adjuntarlo deal a deal.',
                )}
              </p>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FeatureCard title={L('Search & select', 'Búsqueda y selección')} desc={L('Filter clients by name, ID, segment.', 'Filtra por nombre, ID o segmento.')} />
                <FeatureCard title={L('KPI strip', 'Strip de KPIs')} desc={L('Active positions · Total exposure · Share of wallet · Relationship age.', 'Posiciones activas · Exposición total · Share of wallet · Antigüedad de la relación.')} />
                <FeatureCard title={L('Positions table', 'Tabla de posiciones')} desc={L('Product · category · amount · margin · status, synced from core banking.', 'Producto · categoría · importe · margen · estado, sincronizado con core banking.')} />
                <FeatureCard title={L('Applicable targets', 'Targets aplicables')} desc={L('Segment × product × currency × period with margin/pre-approved/hard-floor.', 'Segmento × producto × divisa × periodo con margen/pre-aprobado/hard floor.')} />
                <FeatureCard title={L('CSV import', 'Importación CSV')} desc={L('POST /api/customer360/import/positions and /metrics for bulk upload.', 'POST /api/customer360/import/positions y /metrics para carga masiva.')} />
                <FeatureCard title={L('Open as drawer', 'Abrir como drawer')} desc={L('From ⌘K or any deal-with-client view — no navigation needed.', 'Desde ⌘K o cualquier vista con cliente — sin salir de tu workspace.')} />
              </ul>
            </section>

            <section id="campaigns" className="space-y-4 pt-4">
              <SectionHeader icon={Target} title={L('Campaigns', 'Campañas')} color="text-emerald-400" />
              <p className="text-slate-400">
                {L(
                  'Time-bound commercial deltas applied to channel pricing. Matched by segment × product × currency × channel × window × volume, with a state machine (DRAFT → ACTIVE → PAUSED → ENDED) enforcing governance before any delta hits a quote.',
                  'Deltas comerciales con vigencia temporal aplicados al pricing de canal. Se emparejan por segmento × producto × divisa × canal × ventana × volumen, con una máquina de estados (DRAFT → ACTIVE → PAUSED → ENDED) que garantiza el control antes de que ningún delta toque una cotización.',
                )}
              </p>
            </section>

            <section id="target-grid" className="space-y-4 pt-4">
              <SectionHeader icon={Grid3X3} title="Target Grid" color="text-emerald-400" />
              <p className="text-slate-400">
                {L(
                  'The official rate card derived from the current pricing methodology snapshot. Three view modes: Table (exact values), Heatmap (visual density of deviations), and Diff (compare any two snapshots field-by-field to audit methodology evolution).',
                  'La rate card oficial derivada del snapshot metodológico vigente. Tres modos de vista: Table (valores exactos), Heatmap (densidad visual de desviaciones) y Diff (compara cualquier par de snapshots campo a campo para auditar la evolución metodológica).',
                )}
              </p>
            </section>

            <hr className="border-slate-800" />

            {/* ═══════════════ PRICING ═══════════════ */}
            <h2 className="flex items-center gap-3 border-l-4 border-cyan-400 pl-4 text-2xl font-bold text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              {L('Pricing — calculate + execute', 'Pricing — calcular + ejecutar')}
            </h2>

            <section id="pricing-engine" className="space-y-4 pt-2">
              <SectionHeader
                icon={Calculator}
                title={L('Pricing Engine (4 tabs in one workspace)', 'Pricing Engine (4 tabs en un mismo workspace)')}
                color="text-cyan-400"
              />
              <p className="text-slate-400">
                {L(
                  'The single entry point for pricing. Four tabs share the same deal context — switching tab never loses your inputs:',
                  'Punto único de entrada para pricing. Cuatro tabs comparten el mismo contexto del deal — cambiar de tab nunca borra tus inputs:',
                )}
              </p>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FeatureCard
                  title="Deal"
                  desc={L(
                    '19-component FTP waterfall: base rate, liquidity premium, LCR/NSFR, capital, CSRBB, ESG (greenium, DNSH, ISF), CRR3 output floor. Plus IFRS9 stage, cross-bonus from positions, inverse optimizer, delegation audit.',
                    'Waterfall FTP de 19 componentes: tipo base, prima de liquidez, LCR/NSFR, capital, CSRBB, ESG (greenium, DNSH, ISF), output floor CRR3. Más IFRS9 stage, cross-bonus desde posiciones, inverse optimizer, delegation audit.',
                  )}
                />
                <FeatureCard
                  title="RAROC"
                  desc={L('RAROC with economic profit vs hurdle rate, cost-of-capital waterfall, profitability flag for the approval queue.', 'RAROC con economic profit vs hurdle, waterfall del coste de capital, flag de rentabilidad para la cola de aprobación.')}
                />
                <FeatureCard
                  title="Stress"
                  desc={L('EBA GL 2018/02 — 6 standard shocks (±200bp parallel, ±250bp short, steepener, flattener). Live re-pricing vs current curves.', 'EBA GL 2018/02 — 6 shocks estándar (±200bp paralelo, ±250bp corto, steepener, flattener). Re-pricing en vivo contra curvas vigentes.')}
                />
                <FeatureCard
                  title="What-If"
                  desc={L('Simulate methodology changes, calibrate elasticity from historical take-rate, and backtest against realized book.', 'Simula cambios metodológicos, calibra elasticidad desde take-rate histórico y backtest contra el book realizado.')}
                />
              </ul>
              <p className="text-xs text-slate-500">
                {L('Direct URLs: ', 'URLs directas: ')}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-cyan-400">/pricing</code>{' '}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-cyan-400">/raroc</code>{' '}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-cyan-400">/stress-testing</code>{' '}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-cyan-400">/what-if</code>
                {L(' — all resolve to the same workspace with the matching tab active.', ' — todas resuelven al mismo workspace con la tab correspondiente activa.')}
              </p>
            </section>

            <section id="blotter" className="space-y-4 pt-4">
              <SectionHeader icon={FileText} title={L('Deal Blotter', 'Deal Blotter')} color="text-cyan-400" />
              <p className="text-slate-400">
                {L(
                  'Centralized registry of all priced, booked, pending and rejected deals. Used for audit and portfolio management. Inline CRUD, search, CSV/XML bulk import and export for regulatory reporting.',
                  'Registro centralizado de todas las operaciones cotizadas, reservadas, pendientes y rechazadas. Usado para auditoría y gestión de cartera. CRUD inline, búsqueda, import/export masivo CSV/XML para reporting regulatorio.',
                )}
              </p>
            </section>

            <section id="accounting" className="space-y-4 pt-4">
              <SectionHeader icon={LayoutDashboard} title={L('Accounting Ledger', 'Libro Contable')} color="text-cyan-400" />
              <p className="text-slate-400">
                {L(
                  'Double-entry view of FTP flows between Business Units and Central Treasury. Click any row to see T-accounts: debits on the Commercial Unit, credits on the ALM Desk. Reconciles against pricing_snapshots for audit trail.',
                  'Vista de partida doble de los flujos FTP entre Unidades de Negocio y Tesorería Central. Click en cualquier fila para ver T-accounts: débitos en la Unidad Comercial, créditos en la Mesa ALM. Reconcilia contra pricing_snapshots para el rastro de auditoría.',
                )}
              </p>
            </section>

            <hr className="border-slate-800" />

            {/* ═══════════════ INSIGHTS ═══════════════ */}
            <h2 className="flex items-center gap-3 border-l-4 border-amber-400 pl-4 text-2xl font-bold text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {L('Insights — understand the portfolio', 'Insights — entender la cartera')}
            </h2>

            <section id="analytics" className="space-y-4 pt-2">
              <SectionHeader icon={LineChart} title="Analytics" color="text-amber-400" />
              <p className="text-slate-400">
                {L(
                  'The analytics suite — previously "Reporting". 15+ dashboards grouped in tabs: Overview, Funding Curves, Pipeline, Executive, Scenario Repricing, Vintage, Backtest, Portfolio Review (AI), Client Profitability, Concentration, Price Elasticity, Ex-Post RAROC, Pricing Discipline, Custom Dashboard, and Behavioural Impact.',
                  'La suite analítica — antes «Reporting». 15+ dashboards agrupados en tabs: Overview, Funding Curves, Pipeline, Executive, Scenario Repricing, Vintage, Backtest, Portfolio Review (IA), Client Profitability, Concentration, Price Elasticity, Ex-Post RAROC, Pricing Discipline, Custom Dashboard y Behavioural Impact.',
                )}
              </p>
              <p className="text-xs text-slate-500">
                {L('Pricing Discipline is now a tab inside Analytics — the old ', 'Pricing Discipline es ahora una tab dentro de Analytics — la antigua ')}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-amber-400">/discipline</code>
                {L(' route deep-links into it.', ' deep-linkea directamente.')}
              </p>
            </section>

            <section id="market-data" className="space-y-4 pt-4">
              <SectionHeader icon={LineChart} title={L('Yield Curves', 'Curvas de Tipos')} color="text-amber-400" />
              <p className="text-slate-400">
                {L(
                  'Multi-currency (USD, EUR, GBP, JPY) sovereign and swap curves that drive the engine in real time. Parallel shift controls (bps), collateral-type switches, and a centralized history of curve snapshots for audit.',
                  'Curvas soberanas y swap multi-divisa (USD, EUR, GBP, JPY) que alimentan el motor en tiempo real. Controles de shift paralelo (bps), switches de tipo de colateral y un historial centralizado de snapshots de curvas para auditoría.',
                )}
              </p>
            </section>

            <section id="behavioural" className="space-y-4 pt-4">
              <SectionHeader icon={Activity} title={L('Behavioural Models', 'Modelos Comportamentales')} color="text-amber-400" />
              <p className="text-slate-400">
                {L(
                  'Configuration for non-maturing deposits (NMDs) and loan prepayments (CPR). Define replicating-portfolio tranches for sticky deposits and penalty-free allowances for mortgages. Calibrations feed back into behavioural maturity (BM) in the pricing engine.',
                  'Configuración para depósitos sin vencimiento (NMDs) y prepagos de préstamos (CPR). Define tramos del portfolio replicante para depósitos estables y permisos sin penalización para hipotecas. Las calibraciones vuelven al motor vía vencimiento comportamental (BM).',
                )}
              </p>
            </section>

            <hr className="border-slate-800" />

            {/* ═══════════════ GOVERNANCE ═══════════════ */}
            <h2 className="flex items-center gap-3 border-l-4 border-violet-400 pl-4 text-2xl font-bold text-violet-300">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              {L('Governance — control + reproducibility', 'Gobierno — control + reproducibilidad')}
            </h2>

            <section id="methodology" className="space-y-4 pt-2">
              <SectionHeader icon={GitBranch} title={L('Methodology', 'Metodología')} color="text-violet-300" />
              <p className="text-slate-400">
                {L(
                  'The source of truth for pricing rules. Rate Cards (liquidity premia, credit spreads), ESG Grid (transition, physical, greenium), General Rules (priority-based logic per business unit), Master Data (clients, business units, products), Governance thresholds (RAROC for auto-approval vs committee), and Report Scheduling. Every change versions a new methodology snapshot.',
                  'Fuente de verdad para las reglas de pricing. Rate Cards (prima de liquidez, spreads de crédito), ESG Grid (transition, physical, greenium), General Rules (lógica por prioridad por unidad de negocio), Master Data (clientes, unidades, productos), umbrales de Governance (RAROC para auto-aprobación vs comité) y Report Scheduling. Cada cambio versiona un nuevo snapshot metodológico.',
                )}
              </p>
            </section>

            <section id="model-inventory" className="space-y-4 pt-4">
              <SectionHeader icon={BookOpenCheck} title={L('Model Inventory', 'Model Inventory')} color="text-violet-300" />
              <p className="text-slate-400">
                {L(
                  'The SR 11-7 / EBA model inventory. Every behavioural model, pricing rule, elasticity model, or AI model is catalogued with kind, version, status, owner and validation-doc URL. Auditor-facing view; populated automatically from the rules and behavioural models modules.',
                  'El inventario SR 11-7 / EBA. Cada modelo comportamental, regla de pricing, modelo de elasticidad o IA se cataloga con kind, versión, status, owner y URL del documento de validación. Vista orientada al auditor; se puebla automáticamente desde Rules y Behavioural Models.',
                )}
              </p>
            </section>

            <section id="dossiers" className="space-y-4 pt-4">
              <SectionHeader icon={FileSignature} title={L('Signed Dossiers', 'Dossiers Firmados')} color="text-violet-300" />
              <p className="text-slate-400">
                {L(
                  'Committee-grade pricing dossiers signed with HMAC-SHA256 over canonical JSON. Any tampering breaks the signature; the regulator can verify independently. Each dossier bundles the deal, the pricing result, the methodology snapshot, and the approval trail.',
                  'Dossiers de pricing aptos para comité firmados con HMAC-SHA256 sobre JSON canónico. Cualquier manipulación rompe la firma; el supervisor puede verificar de forma independiente. Cada dossier agrupa el deal, el resultado, el snapshot metodológico y el rastro de aprobación.',
                )}
              </p>
            </section>

            <section id="escalations" className="space-y-4 pt-4">
              <SectionHeader icon={ShieldAlert} title="Escalations" color="text-violet-300" />
              <p className="text-slate-400">
                {L(
                  'Temporal approval escalation workflow: L1 → L2 → Committee with per-entity timeouts. A server-side sweeper promotes stale pending approvals so nothing gets stuck. UI shows the queue state and the aging of each item.',
                  'Flujo de escalado temporal de aprobaciones: L1 → L2 → Comité con timeouts por entidad. Un sweeper server-side promueve las aprobaciones estancadas para que nada se quede bloqueado. La UI muestra el estado de la cola y el aging de cada item.',
                )}
              </p>
            </section>

            <section id="snapshots" className="space-y-4 pt-4">
              <SectionHeader icon={History} title="Snapshot Replay" color="text-violet-300" />
              <p className="text-slate-400">
                {L(
                  'Every pricing calculation writes an immutable snapshot (input + context + output + sha256 hashes + engine version). The Snapshot Replay UI lets you re-run any recorded snapshot against the current engine and see field-level diffs (deltaAbs / deltaBps). If the output hash matches byte-for-byte, reproducibility is guaranteed. If it drifts, the diff shows exactly which fields and by how much.',
                  'Cada cálculo del motor escribe un snapshot inmutable (input + contexto + output + hashes sha256 + versión del motor). La UI de Snapshot Replay permite re-ejecutar cualquier snapshot contra el motor actual y ver el diff a nivel de campo (deltaAbs / deltaBps). Si el hash coincide byte a byte, la reproducibilidad está garantizada. Si cambia, el diff muestra qué campos han derivado y en qué magnitud.',
                )}
              </p>
              <p className="text-xs text-slate-500">
                {L('Access via ⌘K → "Snapshot Replay" or ', 'Acceso vía ⌘K → «Snapshot Replay» o ')}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-violet-300">/snapshots</code>
              </p>
            </section>

            <hr className="border-slate-800" />

            {/* ═══════════════ POWER USER ═══════════════ */}
            <h2 className="flex items-center gap-3 border-l-4 border-fuchsia-400 pl-4 text-2xl font-bold text-fuchsia-300">
              <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
              {L('Power user features', 'Features para usuario avanzado')}
            </h2>

            <section id="command-palette" className="space-y-4 pt-2">
              <SectionHeader icon={Search} title="Command Palette (⌘K)" color="text-fuchsia-300" />
              <p className="text-slate-400">
                {L(
                  'The keyboard-first way to navigate. Press ⌘K (Mac) or Ctrl+K (Windows/Linux) from anywhere, or click the "Search…" pill in the header. Searches fuzzy over:',
                  'La forma keyboard-first de navegar. Pulsa ⌘K (Mac) o Ctrl+K (Windows/Linux) desde cualquier punto, o haz click en el pill «Search…» del header. Búsqueda fuzzy sobre:',
                )}
              </p>
              <ul className="space-y-2 pl-5 text-sm text-slate-400 list-disc">
                <li><strong className="text-slate-200">{L('18 main-nav destinations', '18 destinos del main nav')}</strong></li>
                <li><strong className="text-slate-200">{L('7 auxiliary destinations', '7 destinos auxiliares')}</strong>: RAROC, Stress, What-If, Discipline, SLO Dashboard, Adapter Health, Snapshot Replay</li>
                <li><strong className="text-slate-200">{L('Up to 50 clients', 'Hasta 50 clientes')}</strong> — {L('clicking one opens the Customer 360 drawer over your current view (no navigation).', 'al hacer click se abre el drawer Customer 360 sobre tu vista actual (sin navegar).')}</li>
                <li><strong className="text-slate-200">{L('Up to 20 recent deals', 'Hasta 20 deals recientes')}</strong> — {L('jumps to the Blotter filtered on that deal.', 'salta al Blotter filtrado por ese deal.')}</li>
                <li><strong className="text-slate-200">{L('Actions', 'Acciones')}</strong>: New Deal · Import Data · Toggle theme</li>
              </ul>
            </section>

            <section id="customer-drawer" className="space-y-4 pt-4">
              <SectionHeader icon={LayoutPanelLeft} title={L('Customer 360 Drawer', 'Drawer Customer 360')} color="text-fuchsia-300" />
              <p className="text-slate-400">
                {L(
                  'Customer context should never force you to leave what you are doing. The drawer opens on the right (640px wide) with the full relationship panel — KPIs, positions, applicable targets, latest metrics — over any view. ESC or backdrop click dismisses. A "Full page" button jumps to /customers?id=X when you need the standalone workspace (e.g. to import CSV positions).',
                  'El contexto del cliente nunca debería obligarte a salir de lo que estés haciendo. El drawer se abre a la derecha (640px) con el panel relacional completo — KPIs, posiciones, targets aplicables, métricas recientes — sobre cualquier vista. ESC o click en el backdrop lo cierran. Un botón «Full page» salta a /customers?id=X cuando necesites el workspace completo (p. ej. para importar positions CSV).',
                )}
              </p>
            </section>

            <section id="shortcuts" className="space-y-4 pt-4">
              <SectionHeader icon={BookOpen} title={L('Keyboard shortcuts', 'Atajos de teclado')} color="text-fuchsia-300" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Shortcut keys="⌘K / Ctrl+K" desc={L('Open Command Palette', 'Abrir Command Palette')} />
                <Shortcut keys="Esc" desc={L('Close drawer / modal / palette', 'Cerrar drawer / modal / palette')} />
                <Shortcut keys="↑↓" desc={L('Navigate palette items', 'Navegar items del palette')} />
                <Shortcut keys="↵ Enter" desc={L('Select palette item', 'Seleccionar item del palette')} />
              </div>
            </section>

            <hr className="border-slate-800" />

            {/* ═══════════════ OPERATIONAL GUIDE ═══════════════ */}
            <h2 className="flex items-center gap-3 border-l-4 border-cyan-400 pl-4 text-2xl font-bold text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              {L('Operational guide', 'Guía operativa')}
            </h2>

            <section id="quickstart" className="space-y-4 pt-2">
              <SectionHeader icon={Route} title={L('Quick start', 'Puesta en marcha rápida')} color="text-cyan-300" />
              <p className="text-slate-400">{guide.hero.subtitle}</p>
              <ol className="space-y-3 pl-1">
                {guide.quickStart.map((step, idx) => (
                  <li key={step.title} className="flex gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 font-mono text-xs font-bold text-cyan-400">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{step.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section id="workflows" className="space-y-4 pt-4">
              <SectionHeader icon={Compass} title={L('Operational workflows', 'Flujos operativos')} color="text-cyan-300" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {guide.workflows.map((wf) => (
                  <div key={wf.title} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{wf.title}</h4>
                      <p className="mt-1 text-[11px] uppercase tracking-widest text-cyan-400">{wf.audience}</p>
                    </div>
                    <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-slate-400">
                      {wf.steps.map((s) => (<li key={s}>{s}</li>))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>

            <section id="data-modes" className="space-y-4 pt-4">
              <SectionHeader icon={DatabaseZap} title={L('Data modes', 'Modos de datos')} color="text-cyan-300" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <h4 className="mb-2 text-sm font-bold text-amber-300">{guide.dataModes.demo.title}</h4>
                  <ul className="space-y-1.5 pl-1 text-xs text-slate-400">
                    {guide.dataModes.demo.bullets.map((b) => (
                      <li key={b} className="flex gap-2"><span className="text-amber-400">•</span><span>{b}</span></li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <h4 className="mb-2 text-sm font-bold text-emerald-300">{guide.dataModes.live.title}</h4>
                  <ul className="space-y-1.5 pl-1 text-xs text-slate-400">
                    {guide.dataModes.live.bullets.map((b) => (
                      <li key={b} className="flex gap-2"><span className="text-emerald-400">•</span><span>{b}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section id="troubleshooting" className="space-y-4 pt-4">
              <SectionHeader icon={LifeBuoy} title={L('Troubleshooting', 'Resolución de problemas')} color="text-cyan-300" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {guide.troubleshooting.map((item) => (
                  <div key={item.title} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <h4 className="mb-1 text-sm font-bold text-slate-200">{item.title}</h4>
                    <p className="text-xs leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-300">
                  {L('Support checklist', 'Checklist de soporte')}
                </h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  {guide.supportChecklist.map((c) => (
                    <li key={c} className="flex gap-2 leading-relaxed"><span className="text-cyan-400">•</span><span>{c}</span></li>
                  ))}
                </ul>
              </div>
            </section>

            <hr className="border-slate-800" />

            {/* Pricing Formulas */}
            <section id="formulas" className="space-y-4 pt-4">
              <SectionHeader icon={Calculator} title={t.manual_formulasTitle} color="text-amber-400" />
              <p className="text-slate-400">{t.manual_formulasIntro}</p>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                      <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-slate-500">
                        {L('Component', 'Componente')}
                      </th>
                      <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-slate-500">
                        {L('Formula', 'Fórmula')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {(
                      [
                        ['Base Rate', t.tooltip_formula_baseRate],
                        ['Liquidity Premium', t.tooltip_formula_liquidityPremium],
                        ['LCR Buffer (CLC)', t.tooltip_formula_clcCharge],
                        ['NSFR Charge', t.tooltip_formula_nsfrCharge],
                        ['Strategic Spread', t.tooltip_formula_strategicSpread],
                        ['Capital Charge', t.tooltip_formula_capitalCharge],
                        ['Capital Income', t.tooltip_formula_capitalIncome],
                        ['ESG Transition', t.tooltip_formula_esgTransition],
                        ['ESG Physical', t.tooltip_formula_esgPhysical],
                        ['Greenium', t.tooltip_formula_esgGreenium],
                        ['Option Cost', t.tooltip_formula_optionCost],
                        ['Floor Price', t.tooltip_formula_floorPrice],
                        ['Technical Price', t.tooltip_formula_technicalPrice],
                        ['RAROC', t.tooltip_formula_raroc],
                      ] as const
                    ).map(([component, formula]) => (
                      <tr key={component} className="transition-colors hover:bg-slate-900/40">
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-300">{component}</td>
                        <td className="px-4 py-2.5 font-mono text-xs leading-relaxed text-slate-400">{formula}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Glossary */}
            <section id="glossary" className="space-y-4 pt-4">
              <SectionHeader icon={BookA} title={t.manual_glossaryTitle} color="text-purple-400" />
              <p className="text-slate-400">{t.manual_glossaryIntro}</p>
              <div className="space-y-3">
                {(
                  [
                    t.glossary_dtm,
                    t.glossary_rm,
                    t.glossary_bm,
                    t.glossary_ftp,
                    t.glossary_raroc,
                    t.glossary_lcr,
                    t.glossary_nsfr,
                    t.glossary_lp,
                    t.glossary_clc,
                    t.glossary_nmd,
                    t.glossary_cpr,
                    t.glossary_esg,
                  ] as string[]
                ).map((entry) => {
                  const colonIdx = entry?.indexOf(':') ?? -1;
                  const term = colonIdx > -1 ? entry.slice(0, colonIdx) : entry;
                  const definition = colonIdx > -1 ? entry.slice(colonIdx + 1).trim() : '';
                  return (
                    <div key={term} className="rounded-lg border border-slate-800/60 bg-slate-900/60 px-4 py-3">
                      <dt className="font-mono text-sm font-bold tracking-wide text-slate-200">{term}</dt>
                      {definition && (
                        <dd className="mt-1 text-xs leading-relaxed text-slate-400">{definition}</dd>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Operational health */}
            <section id="ops" className="space-y-4 pt-4">
              <SectionHeader icon={HeartPulse} title={L('Operational health (reachable via ⌘K)', 'Salud operativa (vía ⌘K)')} color="text-slate-400" />
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FeatureCard title="SLO Dashboard" desc={L('p50/p95/p99 latency per minute for the pricing engine. 8 SLIs catalogued.', 'Latencia p50/p95/p99 por minuto del motor de pricing. 8 SLIs catalogados.')} />
                <FeatureCard title="Adapter Health" desc={L('CoreBanking · CRM · MarketData · SSO — live health from the adapter registry.', 'CoreBanking · CRM · MarketData · SSO — salud en vivo del adapter registry.')} />
                <FeatureCard title="System Audit" desc={L('Full real-time traceability of user and system actions, filterable and paginable.', 'Trazabilidad completa en tiempo real de acciones de usuario y sistema, filtrable y paginable.')} />
              </ul>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Plug size={12} />
                {L('These live outside the main sidebar to keep it lean — use ⌘K or direct URLs (', 'Viven fuera del sidebar principal para no sobre-extenderlo — usa ⌘K o URLs directas (')}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-slate-400">/slo</code>{' '}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-slate-400">/adapters</code>
                {L(').', ').')}
              </p>
            </section>

            <div className="h-24" />
          </div>
        </div>
      </div>
    </Panel>
  );
};

export default UserManual;
