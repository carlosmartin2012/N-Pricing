
import React, { useState } from 'react';
import { Panel, Badge, TextInput, InputGroup, SelectInput } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { Transaction, ProductDefinition, ClientEntity, BusinessUnit } from '../../types';
import { MOCK_BEHAVIOURAL_MODELS } from '../../constants';
import { Search, Filter, Download, ChevronDown, ArrowUpRight, ArrowDownLeft, MoreHorizontal, Edit, Trash2, Upload, FileUp, Plus } from 'lucide-react';
import { FileUploadModal } from '../ui/FileUploadModal';
import { storage } from '../../utils/storage';

interface Props {
  deals: Transaction[];
  setDeals: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: ProductDefinition[];
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
}

const DealBlotter: React.FC<Props> = ({ deals, setDeals, products, clients, businessUnits }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Drawer States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedDeal, setSelectedDeal] = useState<Partial<Transaction> | null>(null);

  const dealTemplate = "id,clientId,clientType,productType,amount,currency,startDate,durationMonths,marginTarget,riskWeight,capitalRatio,targetROE,operationalCostBps,status\nTRD-90001,CL-1001,Corporate,LOAN_COMM,2500000,USD,2023-10-25,24,2.5,100,11.5,15,45,Pending\nTRD-90002,CL-1002,Corporate,DEP_TERM,500000,EUR,2023-10-25,12,1.2,0,11.5,12,20,Pending";

  const handleImport = (data: any[]) => {
    const newDeals: Transaction[] = data.map(row => ({
      id: row.id || `TRD-IMP-${Math.floor(Math.random() * 100000)}`,
      clientId: row.clientId || 'Unknown',
      clientType: row.clientType || 'Corporate',
      productType: row.productType || 'LOAN_COMM',
      amount: parseFloat(row.amount) || 0,
      currency: row.currency || 'USD',
      startDate: row.startDate || new Date().toISOString().split('T')[0],
      durationMonths: parseFloat(row.durationMonths) || 12,
      amortization: (row.amortization as any) || 'Bullet',
      repricingFreq: (row.repricingFreq as any) || 'Fixed',
      marginTarget: parseFloat(row.marginTarget) || 0,
      riskWeight: parseFloat(row.riskWeight) || 100,
      capitalRatio: parseFloat(row.capitalRatio) || 11.5,
      targetROE: parseFloat(row.targetROE) || 15,
      operationalCostBps: parseFloat(row.operationalCostBps) || 40,
      status: (row.status as any) || 'Pending',
      businessLine: 'Imported',
      businessUnit: 'BU-001',
      fundingBusinessUnit: 'BU-900',
      transitionRisk: 'Neutral',
      physicalRisk: 'Low'
    }));

    setDeals(prev => [...newDeals, ...prev]);

    storage.addAuditEntry({
      userEmail: 'carlos.martin@nfq.es',
      userName: 'Carlos Martin',
      action: 'IMPORT_DEALS',
      module: 'BLOTTER',
      description: `Imported ${newDeals.length} deals from CSV batch.`
    });
    setIsImportOpen(false);
  };

  const filteredDeals = deals.filter(deal => {
    // Search now matches ID or Client ID
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

  const handleSaveEdit = () => {
    if (selectedDeal && selectedDeal.id) {
      setDeals(deals.map(d => d.id === selectedDeal.id ? selectedDeal as Transaction : d));
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

  const handleSaveNew = () => {
    if (selectedDeal && selectedDeal.clientId) {
      setDeals([selectedDeal as Transaction, ...deals]);
      setIsNewOpen(false);
    }
  };

  const handleDelete = (deal: Transaction) => {
    setSelectedDeal(deal);
    setIsDeleteOpen(true);
  }

  const confirmDelete = () => {
    if (selectedDeal && selectedDeal.id) {
      setDeals(deals.filter(d => d.id !== selectedDeal.id));
      setIsDeleteOpen(false);
    }
  }

  // Helper to render the full form inside drawers
  const renderDealForm = () => {
    if (!selectedDeal) return null;
    return (
      <div className="space-y-6">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Deal ID</div>
          <div className="text-sm font-mono text-cyan-400">{selectedDeal.id}</div>
        </div>

        {/* Client Section */}
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

        {/* Product Section */}
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

        {/* Advanced Section */}
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
    <Panel title="Transaction Deal Blotter" className="h-full">
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
              <input
                type="text"
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 w-64 transition-all"
              />
            </div>

            <div className="flex bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-700 p-0.5">
              {['All', 'Pending', 'Review', 'Booked', 'Rejected'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 text-[10px] uppercase font-bold rounded-sm transition-colors ${filterStatus === status
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleNewDeal}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 text-white rounded border border-cyan-500 text-xs hover:bg-cyan-500 transition-colors font-bold"
            >
              <Plus size={12} /> New Deal
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900 rounded text-xs hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition-colors"
            >
              <Upload size={12} /> Import
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 pl-4 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-200 dark:border-slate-800 w-32">Deal ID</th>
                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-200 dark:border-slate-800">Client ID</th>
                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-200 dark:border-slate-800 w-24">Product</th>
                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-200 dark:border-slate-800 w-24 text-right">Amount</th>
                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-200 dark:border-slate-800 w-20 text-right">Target Rate</th>
                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-200 dark:border-slate-800 w-28">Start Date</th>
                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800 w-28 text-center">Status</th>
                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs text-slate-700 dark:text-slate-300">
              {filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group transition-colors">
                  <td className="p-3 pl-4 border-r border-slate-100 dark:border-slate-800/50 font-mono text-cyan-600 dark:text-cyan-500/80 group-hover:text-cyan-500 dark:group-hover:text-cyan-400">
                    {deal.id}
                  </td>
                  <td className="p-3 border-r border-slate-100 dark:border-slate-800/50 font-medium text-slate-900 dark:text-slate-200">
                    {deal.clientId}
                  </td>
                  <td className="p-3 border-r border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2">
                      {deal.productType.includes('LOAN') ? <ArrowUpRight size={12} className="text-emerald-500" /> : <ArrowDownLeft size={12} className="text-amber-500" />}
                      {deal.productType}
                    </div>
                  </td>
                  <td className="p-3 border-r border-slate-100 dark:border-slate-800/50 text-right font-mono text-slate-900 dark:text-slate-200">
                    {fmtCurrency(deal.amount, deal.currency)}
                  </td>
                  <td className="p-3 border-r border-slate-100 dark:border-slate-800/50 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {(3.0 + deal.marginTarget).toFixed(2)}%
                  </td>
                  <td className="p-3 border-r border-slate-100 dark:border-slate-800/50 text-slate-500 dark:text-slate-400">
                    {deal.startDate}
                  </td>
                  <td className="p-3 border-r border-slate-100 dark:border-slate-800/50 text-center">
                    <Badge variant={
                      deal.status === 'Booked' ? 'success' :
                        deal.status === 'Pending' ? 'warning' :
                          deal.status === 'Rejected' ? 'danger' : 'default'
                    }>
                      {deal.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-center flex justify-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(deal)} className="text-slate-400 hover:text-cyan-500"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(deal)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No deals found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

        {/* Import Drawer (Replaced with FileUploadModal) */}
        <FileUploadModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onUpload={handleImport}
          title="Import Transaction Batch"
          templateName="deals_template.csv"
          templateContent={dealTemplate}
        />

        {/* Delete Confirmation Drawer (Mini) */}
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
