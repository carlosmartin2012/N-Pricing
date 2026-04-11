import type { FTPResult, Transaction } from '../types';

type ExcelCellValue = string | number | boolean | null | undefined;
type ExcelRow = Record<string, ExcelCellValue>;
type ParsedExcelRow = Record<string, unknown>;
type ExcelTemplateData = ExcelRow[] | Record<string, ExcelRow[]>;
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMPORT_EXTENSIONS = new Set(['xlsx', 'xls', 'csv']);

function validateImportFile(file: File): void {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_IMPORT_EXTENSIONS.has(extension)) {
        throw new Error('Unsupported file type. Use .xlsx, .xls, or .csv.');
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
        throw new Error('File too large. Maximum supported size is 5 MB.');
    }
}

export const EXCEL_TEMPLATES = {
    YIELD_CURVE: [
        { Currency: 'USD', Tenor: '1D', Rate: 0.05, Prev: 0.048 },
        { Currency: 'USD', Tenor: '1M', Rate: 0.052, Prev: 0.051 },
        { Currency: 'USD', Tenor: '1Y', Rate: 0.06, Prev: 0.059 },
        { Currency: 'EUR', Tenor: '1M', Rate: 0.035, Prev: 0.034 }
    ],
    BEHAVIOURAL: {
        "NMD Models": [
            { Name: 'Retail CASA', Type: 'NMD_Replication', Method: 'Caterpillar', CoreRatio: 80, BetaFactor: 0.5, Description: 'Standard savings account' },
            { Name: 'Corporate Current', Type: 'NMD_Replication', Method: 'Caterpillar', CoreRatio: 40, BetaFactor: 0.8, Description: 'Operating accounts' }
        ],
        "Prepayment Models": [
            { Name: 'SME Loans Std', Type: 'Prepayment_CPR', CPR: 5.0, PenaltyExempt: 10, Description: 'Standard SME prepay' },
            { Name: 'Mortgages Fixed', Type: 'Prepayment_CPR', CPR: 8.0, PenaltyExempt: 0, Description: 'Fixed rate mortgages' }
        ]
    },
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

export const REQUIRED_HEADERS = {
    YIELD_CURVES: ['Tenor', 'Rate'],
    METHODOLOGY: ['BusinessUnit', 'Product', 'Segment', 'Tenor', 'BaseMethod'],
    BEHAVIOURAL: ['Name', 'Type', 'Description'],
    SHOCKS: ['InterestRateShock', 'LiquiditySpreadShock'],
    DEALS: ['Amount', 'Currency', 'Product']
};

export const downloadTemplate = async (
    templateKey: keyof typeof EXCEL_TEMPLATES | string,
    fileName: string,
    liveData?: ExcelTemplateData,
) => {
    const XLSX = await import('xlsx');
    const templateData = liveData || EXCEL_TEMPLATES[templateKey as keyof typeof EXCEL_TEMPLATES];
    const wb = XLSX.utils.book_new();

    if (!templateData) {
        console.error("No template data found for:", templateKey);
        return;
    }

    // 1. Create Instructions Sheet
    const instructions = [
        ["N PRICING SYSTEM - DATA IMPORT GUIDE"],
        [""],
        ["INSTRUCTIONS:"],
        ["1. Use the 'Data' sheet to enter your records."],
        ["2. Ensure all mandatory columns (Row 4) are filled."],
        ["3. Do not modify the headers in Row 4."],
        ["4. For Yield Curves, you can include multiple currencies (USD, EUR, etc.) in the 'Currency' column."],
        ["5. Save as .xlsx or .xls before importing."],
        [""],
        ["Module Reference:", templateKey],
        ["Generated on:", new Date().toLocaleString()]
    ];
    const wsIn = XLSX.utils.aoa_to_sheet(instructions);
    wsIn['!cols'] = [{ wch: 50 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsIn, "READ_ME_FIRST");

    // 2. Create Data Sheets
    const branding = [
        ["N PRICING SYSTEM - OFFICIAL TEMPLATE"],
        ["STATUS: OFFICIAL | MODULE: " + templateKey],
        []
    ];

    if (!Array.isArray(templateData)) {
        Object.entries(templateData).forEach(([sheetName, data]) => {
            const ws = XLSX.utils.aoa_to_sheet(branding);
            XLSX.utils.sheet_add_json(ws, data, { origin: "A4" });
            ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
    } else {
        const ws = XLSX.utils.aoa_to_sheet(branding);
        XLSX.utils.sheet_add_json(ws, templateData, { origin: "A4" });
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, "Data");
    }

    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/**
 * Export deals to a formatted Excel file with FTP results.
 */
export const exportDealsToExcel = async (deals: Transaction[], results?: Map<string, FTPResult>) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = deals.map(d => {
        const r = d.id ? results?.get(d.id) : undefined;
        return {
            'Deal ID': d.id,
            'Client': d.clientId,
            'Type': d.clientType,
            'Product': d.productType,
            'Category': d.category,
            'Amount': d.amount,
            'Currency': d.currency,
            'Tenor (M)': d.durationMonths,
            'Start Date': d.startDate,
            'Margin Target': d.marginTarget,
            'Status': d.status || 'Draft',
            'BU': d.businessUnit,
            'Risk Weight': d.riskWeight,
            'Capital Ratio': d.capitalRatio,
            'Target ROE': d.targetROE,
            'Transition Risk': d.transitionRisk,
            'Physical Risk': d.physicalRisk,
            // FTP Results (if available)
            ...(r ? {
                'Base Rate': r.baseRate?.toFixed(4),
                'Liquidity Spread': r.liquiditySpread?.toFixed(4),
                'Total FTP': r.totalFTP?.toFixed(4),
                'Final Client Rate': r.finalClientRate?.toFixed(4),
                'RAROC': r.raroc?.toFixed(2),
                'Economic Profit': r.economicProfit?.toFixed(0),
                'Approval Level': r.approvalLevel,
                'Methodology': r.matchedMethodology,
            } : {}),
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = rows.length > 0 ? Object.keys(rows[0]).map(() => ({ wch: 16 })) : [];
    XLSX.utils.book_append_sheet(wb, ws, 'Deals');
    XLSX.writeFile(wb, `N-Pricing_Portfolio_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const parseExcel = async (file: File): Promise<ParsedExcelRow[]> => {
    validateImportFile(file);
    const XLSX = await import('xlsx');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, {
                type: 'array',
                dense: true,
                raw: true,
                cellFormula: false,
                cellHTML: false,
                cellText: false,
            });

            let allData: ParsedExcelRow[] = [];

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) return;

                // Robust branding detection: Check first few cells for our branding string
                let isBranded = false;
                const brandingMarkers = ['A1', 'A2', 'B1', 'B2'];
                for (const marker of brandingMarkers) {
                    const val = worksheet[marker]?.v;
                    if (typeof val === 'string' && val.includes('N PRICING SYSTEM')) {
                        isBranded = true;
                        break;
                    }
                }

                // If branded, headers are in row 4 (offset 3). Otherwise row 1 (offset 0).
                const json = XLSX.utils.sheet_to_json<ParsedExcelRow>(worksheet, {
                    range: isBranded ? 3 : 0,
                    defval: null // Ensure missing cells don't shift data
                });

                if (json.length > 0) {
                    // Tag data with sheetName to help disambiguate if needed
                    const taggedData = json.map((item) => ({ ...item, _sheet: sheetName }));
                    allData = [...allData, ...taggedData];
                }
            });
            resolve(allData);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};
