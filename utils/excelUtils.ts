import * as XLSX from 'xlsx';

export const EXCEL_TEMPLATES = {
    YIELD_CURVE: [
        { Tenor: '1D', Rate: 0.05 },
        { Tenor: '1M', Rate: 0.052 },
        { Tenor: '3M', Rate: 0.055 },
        { Tenor: '6M', Rate: 0.058 },
        { Tenor: '1Y', Rate: 0.06 }
    ],
    BEHAVIOURAL: [
        { Name: 'Retail CASA', Type: 'NMD_Replication', Method: 'Parametric', CoreRatio: 0.8, DecayRate: 0.05, BetaFactor: 0.5 },
        { Name: 'SME Loans', Type: 'Prepayment_CPR', CPR: 0.1, PenaltyExempt: 0.2 }
    ],
    METHODOLOGY: [
        { BusinessUnit: 'Retail Banking', Product: 'Mortgage', Segment: 'All', Tenor: 'Fixed', BaseMethod: 'Matched Maturity', BaseReference: 'USD-SOFR', SpreadMethod: 'Curve Lookup', StrategicSpread: 5 }
    ],
    DEAL_BLOTTER_IDS: [
        { ID: 'DEAL-001', NewID: 'DL-2024-001' },
        { ID: 'DEAL-002', NewID: 'DL-2024-002' }
    ],
    STRESS_TESTING: [
        { Scenario: 'Interest Rate Spike', InterestRateShock: 100, LiquiditySpreadShock: 20 },
        { Scenario: 'Liquidity Crunch', InterestRateShock: 50, LiquiditySpreadShock: 150 }
    ]
};

export const downloadTemplate = (templateKey: keyof typeof EXCEL_TEMPLATES, fileName: string) => {
    const data = EXCEL_TEMPLATES[templateKey];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            resolve(json);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};
