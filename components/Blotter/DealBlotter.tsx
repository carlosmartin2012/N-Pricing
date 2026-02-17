
import React, { useState } from 'react';
import { Panel, Badge, TextInput, InputGroup, SelectInput } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { Transaction, ProductDefinition, ClientEntity, BusinessUnit } from '../../types';
import { MOCK_BEHAVIOURAL_MODELS } from '../../constants';
import { Search, Filter, Download, ChevronDown, ArrowUpRight, ArrowDownLeft, MoreHorizontal, Edit, Trash2, Upload, FileUp, Plus } from 'lucide-react';
import { FileUploadModal } from '../ui/FileUploadModal';
import { storage } from '../../utils/storage';
import { translations, Language } from '../../translations';
import { downloadTemplate, parseExcel } from '../../utils/excelUtils';

interface Props {
  deals: Transaction[];
  setDeals: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: ProductDefinition[];
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  language: Language;
  user: any;
}

const DealBlotter: React.FC<Props> = ({ deals, setDeals, products, clients, businessUnits, language, user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const t = translations[language];

  // Drawer States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedDeal, setSelectedDeal] = useState<Partial<Transaction> | null>(null);

  const dealTemplate = "id,clientId,clientType,productType,amount,currency,startDate,durationMonths,marginTarget,riskWeight,capitalRatio,targetROE,operationalCostBps,status\nTRD-90001,CL-1001,Corporate,LOAN_COMM,2500000,USD,2023-10-25,24,2.5,100,11.5,15,45,Pending\nTRD-90002,CL-1002,Corporate,DEP_TERM,500000,EUR,2023-10-25,12,1.2,0,11.5,12,20,Pending";

  const handleImport = async (data: any[]) => {
    // Check if it's an ID modification import or a full deal import
    const isIDMod = data[0] && (data[0].NewID !== undefined || data[0].newID !== undefined);

    if (isIDMod) {
      const updatedDeals = deals.map(deal => {
        const mod = data.find(row => (row.ID || row.id) === deal.id);
        if (mod) {
          return { ...deal, id: mod.NewID || mod.newID };
        }
        return deal;
      });
      setDeals(updatedDeals);
      storage.addAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        action: 'BATCH_ID_RENAME',
        module: 'BLOTTER',
        description: `Renamed deal IDs via Excel import for multiple transactions.`
      });
    } else {
      const newDeals: Transaction[] = data.map(row => ({
        id: row.id || row.ID || `TRD-IMP-${Math.floor(Math.random() * 100000)}`,
        clientId: row.clientId || row.ClientID || 'Unknown',
        clientType: row.clientType || row.ClientType || 'Corporate',
        productType: row.productType || row.ProductType || 'LOAN_COMM',
        amount: parseFloat(row.amount || row.Amount) || 0,
        currency: row.currency || row.Currency || 'USD',
        startDate: row.startDate || row.StartDate || new Date().toISOString().split('T')[0],
        durationMonths: parseFloat(row.durationMonths || row.DurationMonths) || 12,
        amortization: (row.amortization || row.Amortization || 'Bullet') as any,
        repricingFreq: (row.repricingFreq || row.RepricingFreq || 'Fixed') as any,
        marginTarget: parseFloat(row.marginTarget || row.MarginTarget) || 0,
        riskWeight: parseFloat(row.riskWeight || row.RiskWeight) || 100,
        capitalRatio: parseFloat(row.capitalRatio || row.CapitalRatio) || 11.5,
        targetROE: parseFloat(row.targetROE || row.TargetROE) || 15,
        operationalCostBps: parseFloat(row.operationalCostBps || row.OperationalCostBps) || 40,
        status: (row.status || row.Status || 'Pending') as any,
        businessLine: 'Imported',
        businessUnit: 'BU-001',
        fundingBusinessUnit: 'BU-900',
        transitionRisk: 'Neutral',
        physicalRisk: 'Low'
      }));

      setDeals(prev => [...newDeals, ...prev]);

      storage.addAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        action: 'IMPORT_DEALS',
        module: 'BLOTTER',
        description: `Imported ${newDeals.length} deals from Excel.`
      });
    }
    setIsImportOpen(false);
  };

  const handleDownloadTemplate = () => downloadTemplate('DEAL_BLOTTER_IDS', 'Deal_ID_Modification_Template');

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.clientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deal.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || deal.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const fmtCurrency = (val: number, ccy: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 }).format(val);

  const handleEdit = (deal: Transaction) => {
    setSelectedDeal({ ...deal });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (selectedDeal) {
      await storage.saveDeal(selectedDeal);
      setIsEditOpen(false);
    }
  };

  const handleNewDeal = () => {
    setSelectedDeal({
      id: `TRD-${Math.floor(Math.random() * 100000)}`,
      clientId: '',
      clientType: 'Corporate',
      productType: 'LOAN_COMM',
      amount: 1000000,
      currency: 'USD',
      marginTarget: 2.0,
      startDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      businessLine: 'Corp Fin',
      durationMonths: 12,
      businessUnit: 'BU-001',
      fundingBusinessUnit: 'BU-900',
      riskWeight: 100,
      capitalRatio: 11.5,
      targetROE: 15,
      operationalCostBps: 40,
      transitionRisk: 'Neutral',
      physicalRisk: 'Low'
    });
    setIsNewOpen(true);
  };

  const handleSaveNew = async () => {
    if (selectedDeal && selectedDeal.clientId) {
      // Local state will be updated via App.tsx subscription
      await storage.saveDeal(selectedDeal as Transaction);
      setIsNewOpen(false);
    }
  };

  const handleDelete = (deal: Transaction) => {
    setSelectedDeal(deal);
    setIsDeleteOpen(true);
  }

  const confirmDelete = async () => {
    if (selectedDeal && selectedDeal.id) {
      await storage.deleteDeal(selectedDeal.id);
      setIsDeleteOpen(false);
    }
  }

  const renderDealForm = () => {
    if (!selectedDeal) return null;
    return (
      <div className="space-y-6">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Deal ID</div>
          <div className="text-sm font-mono text-cyan-400">{selectedDeal.id}</div>
        </div>

        <div className="space-y-4 border-b border-slate-800 pb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase">Counterparty</h4>
          <InputGroup label="Client ID">
            <SelectInput
              value={selectedDeal.clientId}
              onChange={(e) => {
                const c = clients.find(cl => cl.id === e.target.value);
                setSelectedDeal({
                  ...selectedDeal,
                  clientId: e.target.value,
                  clientType: c?.type || ''
                });
              }}
            >
              <option value="">-- Select Client ID --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
            </SelectInput>
          </InputGroup>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Business Unit">
              <SelectInput value={selectedDeal.businessUnit} onChange={(e) => setSelectedDeal({ ...selectedDeal, businessUnit: e.target.value })}>
                {businessUnits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectInput>
            </InputGroup>
            <InputGroup label="Funding Center">
              <SelectInput value={selectedDeal.fundingBusinessUnit} onChange={(e) => setSelectedDeal({ ...selectedDeal, fundingBusinessUnit: e.target.value })}>
                {businessUnits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectInput>
            </InputGroup>
          </div>
        </div>

        <div className="space-y-4 border-b border-slate-800 pb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase">Product Structure</h4>
          <InputGroup label="Product Definition">
            <SelectInput value={selectedDeal.productType} onChange={(e) => setSelectedDeal({ ...selectedDeal, productType: e.target.value })}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectInput>
          </InputGroup>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Amount">
              <TextInput type="number" value={selectedDeal.amount} onChange={(e) => setSelectedDeal({ ...selectedDeal, amount: parseFloat(e.target.value) })} />
            </InputGroup>
            <InputGroup label="Currency">
              <SelectInput value={selectedDeal.currency} onChange={(e) => setSelectedDeal({ ...selectedDeal, currency: e.target.value })}>
                <option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option>
              </SelectInput>
            </InputGroup>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Start Date">
              <TextInput type="date" value={selectedDeal.startDate} onChange={(e) => setSelectedDeal({ ...selectedDeal, startDate: e.target.value })} />
            </InputGroup>
            <InputGroup label="Duration (Months)">
              <TextInput type="number" value={selectedDeal.durationMonths} onChange={(e) => setSelectedDeal({ ...selectedDeal, durationMonths: parseFloat(e.target.value) })} />
            </InputGroup>
          </div>
          <InputGroup label="Margin Target (%)">
            <TextInput type="number" step="0.01" value={selectedDeal.marginTarget} onChange={(e) => setSelectedDeal({ ...selectedDeal, marginTarget: parseFloat(e.target.value) })} />
          </InputGroup>
        </div>

        <div className="space-y-4 border-b border-slate-800 pb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase">Risk & Capital</h4>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Risk Weight (%)">
              <TextInput type="number" value={selectedDeal.riskWeight} onChange={(e) => setSelectedDeal({ ...selectedDeal, riskWeight: parseFloat(e.target.value) })} />
            </InputGroup>
            <InputGroup label="Capital Ratio (%)">
              <TextInput type="number" step="0.1" value={selectedDeal.capitalRatio} onChange={(e) => setSelectedDeal({ ...selectedDeal, capitalRatio: parseFloat(e.target.value) })} />
            </InputGroup>
            <InputGroup label="Target ROE (%)">
              <TextInput type="number" value={selectedDeal.targetROE} onChange={(e) => setSelectedDeal({ ...selectedDeal, targetROE: parseFloat(e.target.value) })} />
            </InputGroup>
            <InputGroup label="Op Cost (bps)">
              <TextInput type="number" value={selectedDeal.operationalCostBps} onChange={(e) => setSelectedDeal({ ...selectedDeal, operationalCostBps: parseFloat(e.target.value) })} />
            </InputGroup>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase">Behavioural & ESG</h4>
          <InputGroup label="Behavioural Model">
            <SelectInput value={selectedDeal.behaviouralModelId || ''} onChange={(e) => setSelectedDeal({ ...selectedDeal, behaviouralModelId: e.target.value })}>
              <option value="">-- None --</option>
              {MOCK_BEHAVIOURAL_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </SelectInput>
          </InputGroup>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Transition Risk">
              <SelectInput value={selectedDeal.transitionRisk} onChange={(e) => setSelectedDeal({ ...selectedDeal, transitionRisk: e.target.value as any })}>
                <option value="Green">Green</option><option value="Neutral">Neutral</option><option value="Amber">Amber</option><option value="Brown">Brown</option>
              </SelectInput>
            </InputGroup>
            <InputGroup label="Physical Risk">
              <SelectInput value={selectedDeal.physicalRisk} onChange={(e) => setSelectedDeal({ ...selectedDeal, physicalRisk: e.target.value as any })}>
                <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
              </SelectInput>
            </InputGroup>
          </div>
        </div>

        <InputGroup label="Workflow Status">
          <SelectInput
            value={selectedDeal.status}
            onChange={(e) => setSelectedDeal({ ...selectedDeal, status: e.target.value as any })}
            className={selectedDeal.status === 'Booked' ? 'text-emerald-400' : selectedDeal.status === 'Rejected' ? 'text-red-400' : 'text-amber-400'}
          >
            <option value="Pending">Pending</option>
            <option value="Booked">Booked</option>
            <option value="Rejected">Rejected</option>
            <option value="Review">Review</option>
          </SelectInput>
        </InputGroup>
      </div>
    );
  }

  return (
    <Panel
      title={t.dealBlotter}
      className="h-full overflow-hidden"
      actions={
        <div className="flex gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded border border-slate-700 text-xs flex items-center gap-1 transition-colors"
            title="Download ID Modification Template"
          >
            <FileUp size={14} /> <span className="hidden sm:inline">ID Template</span>
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-slate-700 text-xs flex items-center gap-1 transition-colors"
          >
            <Upload size={14} /> <span className="hidden sm:inline">Import Excel</span>
          </button>
          <button
            onClick={handleNewDeal}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs flex items-center gap-1 transition-colors font-bold shadow-lg shadow-cyan-900/20"
          >
            <Plus size={14} /> <span className="hidden sm:inline">New Deal</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full bg-slate-50 dark:bg-black">
        {/* Blotter Toolbar */}
        <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-950">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search Client or ID..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <div className="flex items-center gap-2 shrink-0">
              <Filter size={14} className="text-slate-400" />
              <select
                className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 outline-none border-none py-1 cursor-pointer"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <button className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors shrink-0">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transaction ID</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client / Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Product</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tenor</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Margin</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-black">
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">{deal.id}</div>
                      <div className="text-[9px] text-slate-400">{deal.startDate}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-200">{deal.clientId}</div>
                      <div className="text-[10px] text-slate-500">{deal.clientType}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                      <Badge variant="outline" className="text-[9px] font-bold">{deal.productType}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {fmtCurrency(deal.amount, deal.currency)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center hidden sm:table-cell">
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{deal.durationMonths}m</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hidden lg:table-cell">
                      +{deal.marginTarget.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <Badge variant={
                        deal.status === 'Approved' ? 'success' :
                          deal.status === 'Rejected' ? 'danger' : 'warning'
                      } className="text-[9px]">
                        {deal.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(deal)} className="p-1 text-slate-400 hover:text-cyan-500 transition-colors"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(deal)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="p-2 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-500 flex gap-6 justify-end font-mono">
          <div>TOTAL VOL: <span className="text-slate-300">$125.4M</span></div>
          <div>AVG RATE: <span className="text-slate-300">5.12%</span></div>
          <div>ROWS: <span className="text-slate-300">{filteredDeals.length}</span></div>
        </div>

        {/* --- DRAWERS --- */}

        {/* Edit Drawer */}
        <Drawer
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Deal: ${selectedDeal?.id || ''}`}
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded">Save Changes</button>
            </div>
          }
        >
          {renderDealForm()}
        </Drawer>

        {/* New Deal Drawer */}
        <Drawer
          isOpen={isNewOpen}
          onClose={() => setIsNewOpen(false)}
          title="Create New Transaction"
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsNewOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button onClick={handleSaveNew} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded">Create Deal</button>
            </div>
          }
        >
          {renderDealForm()}
        </Drawer>

        {/* Import Drawer (FileUploadModal) */}
        <FileUploadModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onUpload={handleImport}
          title="Import Transaction Batch"
          templateName="deals_template.csv"
          templateContent={dealTemplate}
        />

        {/* Delete Confirmation Drawer */}
        <Drawer
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title="Delete Transaction"
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded">Confirm Delete</button>
            </div>
          }
        >
          <div className="text-center p-4">
            <div className="w-16 h-16 bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <h3 className="text-slate-200 font-bold mb-2">Are you sure?</h3>
            <p className="text-xs text-slate-400">
              This action will permanently delete deal <span className="text-white font-mono">{selectedDeal?.id}</span> and reverse all associated accounting entries.
            </p>
          </div>
        </Drawer>
      </div>
    </Panel>
  );
};

export default DealBlotter;
