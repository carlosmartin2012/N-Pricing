import React, { useState, useMemo } from 'react';
import {
    Calculator, TrendingUp, DollarSign, PieChart, Shield,
    Zap, Info, Settings
} from 'lucide-react';
import { Panel, Badge } from '../ui/LayoutComponents';

interface RAROCInputs {
    transactionId: string;
    loanAmt: number;
    osAmt: number;
    ead: number;
    interestRate: number;
    interestSpread: number;
    cofRate: number;
    rwa: number;
    ecl: number;
    feeIncome: number;
    operatingCostPct: number;
    riskFreeRate: number;
    opRiskCapitalCharge: number;
    minRegCapitalReq: number;
    hurdleRate: number;
    pillar2CapitalCharge: number;
}

const INITIAL_INPUTS: RAROCInputs = {
    transactionId: 'DEAL-RAROC-001',
    loanAmt: 1000000,
    osAmt: 1000000,
    ead: 1000000,
    interestRate: 6.5,
    interestSpread: 2.5,
    cofRate: 3.5,
    rwa: 600000,
    ecl: 5000,
    feeIncome: 10000,
    operatingCostPct: 0.5,
    riskFreeRate: 2.5,
    opRiskCapitalCharge: 0.2,
    minRegCapitalReq: 8,
    hurdleRate: 12,
    pillar2CapitalCharge: 1.5
};

const RAROCCalculator: React.FC = () => {
    const [inputs, setInputs] = useState<RAROCInputs>(INITIAL_INPUTS);

    const handleInputChange = (key: keyof RAROCInputs, value: any) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    const results = useMemo(() => {
        // Calculations
        const grossRevenue = (inputs.ead * (inputs.interestRate / 100)) + inputs.feeIncome;
        const costOfFunds = inputs.ead * (inputs.cofRate / 100);
        const operatingCost = (inputs.operatingCostPct / 100) * inputs.osAmt;

        const creditRiskRegCapital = inputs.rwa * (inputs.minRegCapitalReq / 100);
        const incomeFromCapital = inputs.rwa * (inputs.minRegCapitalReq / 100) * (inputs.riskFreeRate / 100);

        const totalRegCapital = creditRiskRegCapital +
            (inputs.pillar2CapitalCharge / 100 * inputs.ead) +
            (inputs.opRiskCapitalCharge / 100 * inputs.ead);

        const riskAdjustedReturn = grossRevenue - inputs.ecl - costOfFunds - operatingCost + incomeFromCapital;

        const raroc = totalRegCapital > 0 ? (riskAdjustedReturn / totalRegCapital) * 100 : 0;
        const eva = raroc - inputs.hurdleRate;

        return {
            grossRevenue,
            costOfFunds,
            operatingCost,
            incomeFromCapital,
            creditRiskRegCapital,
            totalRegCapital,
            riskAdjustedReturn,
            raroc,
            eva
        };
    }, [inputs]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

    const formatPct = (val: number) => `${val.toFixed(2)}%`;

    return (
        <div className="flex flex-col gap-6 p-2 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex items-center justify-between bg-slate-900/40 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-500/20 rounded-xl">
                        <Calculator className="text-cyan-400 w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">RAROC Advanced Terminal</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 font-mono">MODEL_v4.2.X</span>
                            <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-400">BASIL III COMPLIANT</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Transaction Context</span>
                    <span className="text-lg font-mono font-bold text-cyan-400">{inputs.transactionId}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Inputs Column */}
                <div className="xl:col-span-4 space-y-6">
                    <Panel title="Configuration Inputs" icon={<Settings size={18} className="text-cyan-500" />}>
                        <div className="space-y-6 p-2">
                            {/* Exposure Section */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Exposure & Notionals</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <InputGroup label="LOAN AMOUNT (Original)" value={inputs.loanAmt} onChange={v => handleInputChange('loanAmt', v)} type="currency" />
                                    <InputGroup label="OUTSTANDING AMOUNT" value={inputs.osAmt} onChange={v => handleInputChange('osAmt', v)} type="currency" />
                                    <InputGroup label="EXPOSURE AT DEFAULT (EAD)" value={inputs.ead} onChange={v => handleInputChange('ead', v)} type="currency" />
                                </div>
                            </div>

                            {/* Rates Section */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Interest & Funding</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="CLIENT RATE (%)" value={inputs.interestRate} onChange={v => handleInputChange('interestRate', v)} type="percent" />
                                    <InputGroup label="COF RATE (%)" value={inputs.cofRate} onChange={v => handleInputChange('cofRate', v)} type="percent" />
                                    <InputGroup label="FEE INCOME ($)" value={inputs.feeIncome} onChange={v => handleInputChange('feeIncome', v)} type="currency" />
                                    <InputGroup label="OP. COST (%)" value={inputs.operatingCostPct} onChange={v => handleInputChange('operatingCostPct', v)} type="percent" />
                                </div>
                            </div>

                            {/* Risk Section */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Risk & Capital</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <InputGroup label="RISK WEIGHTED ASSETS (RWA)" value={inputs.rwa} onChange={v => handleInputChange('rwa', v)} type="currency" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label="EXPECTED LOSS (ECL)" value={inputs.ecl} onChange={v => handleInputChange('ecl', v)} type="currency" />
                                        <InputGroup label="MIN REG CAP (%)" value={inputs.minRegCapitalReq} onChange={v => handleInputChange('minRegCapitalReq', v)} type="percent" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label="HURDLE RATE (%)" value={inputs.hurdleRate} onChange={v => handleInputChange('hurdleRate', v)} type="percent" />
                                        <InputGroup label="RISK FREE (%)" value={inputs.riskFreeRate} onChange={v => handleInputChange('riskFreeRate', v)} type="percent" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label="PILLAR 2 (%)" value={inputs.pillar2CapitalCharge} onChange={v => handleInputChange('pillar2CapitalCharge', v)} type="percent" />
                                        <InputGroup label="OP. RISK CAP (%)" value={inputs.opRiskCapitalCharge} onChange={v => handleInputChange('opRiskCapitalCharge', v)} type="percent" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Dashboard / Analytics Column */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ResultCard
                            title="RAROC"
                            value={formatPct(results.raroc)}
                            subtext={`Hurdle: ${inputs.hurdleRate}%`}
                            icon={<TrendingUp className="text-cyan-400" />}
                            trend={results.raroc >= inputs.hurdleRate ? 'positive' : 'negative'}
                        />
                        <ResultCard
                            title="ECONOMIC PROFIT (EVA)"
                            value={formatPct(results.eva)}
                            subtext="Excess Return"
                            icon={<Shield className="text-emerald-400" />}
                            trend={results.eva >= 0 ? 'positive' : 'negative'}
                        />
                        <ResultCard
                            title="NET ADJUSTED RETURN"
                            value={formatCurrency(results.riskAdjustedReturn)}
                            subtext="Annualized"
                            icon={<DollarSign className="text-amber-400" />}
                            trend="neutral"
                        />
                    </div>

                    {/* Calculation Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Panel title="Revenue & Costs" icon={<Zap size={16} className="text-amber-500" />}>
                            <div className="p-4 space-y-4">
                                <BreakdownRow label="Gross Revenue" value={formatCurrency(results.grossRevenue)} sub="Interest + Fees" />
                                <BreakdownRow label="Cost of Funds" value={formatCurrency(results.costOfFunds)} sub="Exposure * COF" negative />
                                <BreakdownRow label="Expected Loss (ECL)" value={formatCurrency(inputs.ecl)} sub="Credit Provision" negative />
                                <BreakdownRow label="Operating Costs" value={formatCurrency(results.operatingCost)} sub="Operational Exp." negative />
                                <BreakdownRow label="Cap. Reinvestment" value={formatCurrency(results.incomeFromCapital)} sub="Risk-Free Return" positive />
                                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-xs font-bold text-white uppercase">Risk Adjusted Return</span>
                                    <span className="text-lg font-mono font-bold text-cyan-400">{formatCurrency(results.riskAdjustedReturn)}</span>
                                </div>
                            </div>
                        </Panel>

                        <Panel title="Capital Structure" icon={<PieChart size={16} className="text-purple-500" />}>
                            <div className="p-4 space-y-4">
                                <BreakdownRow label="Credit Risk Capital" value={formatCurrency(results.creditRiskRegCapital)} sub={`${inputs.minRegCapitalReq}% * RWA`} />
                                <BreakdownRow label="Pillar 2 Charge" value={formatCurrency(inputs.pillar2CapitalCharge / 100 * inputs.ead)} sub={`${inputs.pillar2CapitalCharge}% * EAD`} />
                                <BreakdownRow label="Op. Risk Capital" value={formatCurrency(inputs.opRiskCapitalCharge / 100 * inputs.ead)} sub={`${inputs.opRiskCapitalCharge}% * EAD`} />
                                <div className="h-20" /> {/* Spacer */}
                                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-xs font-bold text-white uppercase">Total Regulatory Capital</span>
                                    <span className="text-lg font-mono font-bold text-purple-400">{formatCurrency(results.totalRegCapital)}</span>
                                </div>
                            </div>
                        </Panel>
                    </div>

                    {/* Formula Hint */}
                    <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-2xl p-6 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-cyan-500">
                            <Info size={16} />
                            <h5 className="text-xs font-bold uppercase tracking-wider">Methodology Note</h5>
                        </div>
                        <p className="text-xs text-slate-400 font-mono italic leading-relaxed">
                            RAROC = (Gross Revenue - ECL - COF - OpCost + CapIncome) / (CreditCap + Pillar2Cap + OpRiskCap)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Internal Helper Components
const InputGroup: React.FC<{ label: string, value: number, onChange: (v: number) => void, type: 'currency' | 'percent' }> = ({ label, value, onChange, type }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        <div className="relative group">
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition-all group-hover:border-white/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 uppercase">
                {type === 'currency' ? '$' : '%'}
            </span>
        </div>
    </div>
);

const ResultCard: React.FC<{ title: string, value: string, subtext: string, icon: React.ReactNode, trend: 'positive' | 'negative' | 'neutral' }> = ({ title, value, subtext, icon, trend }) => (
    <div className="bg-slate-900/40 border border-white/10 p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            {icon}
        </div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{title}</div>
        <div className="flex items-baseline gap-2">
            <div className={`text-3xl font-mono font-bold ${trend === 'positive' ? 'text-emerald-400 hover:text-emerald-300' : trend === 'negative' ? 'text-rose-400 hover:text-rose-300' : 'text-white'}`}>
                {value}
            </div>
            {trend !== 'neutral' && (
                <div className={`text-[10px] font-bold ${trend === 'positive' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trend === 'positive' ? '↑ PASS' : '↓ FAIL'}
                </div>
            )}
        </div>
        <div className="text-[9px] text-slate-600 font-bold mt-1 uppercase italic">{subtext}</div>
    </div>
);

const BreakdownRow: React.FC<{ label: string, value: string, sub: string, positive?: boolean, negative?: boolean }> = ({ label, value, sub, positive, negative }) => (
    <div className="flex items-center justify-between group">
        <div>
            <div className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase">{label}</div>
            <div className="text-[9px] text-slate-600 font-mono italic">{sub}</div>
        </div>
        <div className={`text-sm font-mono font-bold ${positive ? 'text-emerald-400' : negative ? 'text-rose-400' : 'text-slate-300'}`}>
            {negative && '-'} {value}
        </div>
    </div>
);

export default RAROCCalculator;
