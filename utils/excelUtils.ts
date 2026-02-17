import * as XLSX from 'xlsx';

export const EXCEL_TEMPLATES = {
    YIELD_CURVE: [
        { Tenor: '1D', Rate: 0.05 },
        { Tenor: '1M', Rate: 0.052 },
        { Tenor: '3M', Rate: 0.055 },
        { Tenor: '6M', Rate: 0.058 },
        { Tenor: '1Y', Rate: 0.06 }
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

export const downloadTemplate = (templateKey: keyof typeof EXCEL_TEMPLATES, fileName: string) => {
    const templateData = EXCEL_TEMPLATES[templateKey];
    const wb = XLSX.utils.book_new();

    const branding = [
        ["N PRICING SYSTEM - OFFICIAL TEMPLATE"],
        [`Generated on: ${new Date().toLocaleString()}`],
        []
    ];

    if (!Array.isArray(templateData)) {
        // Multi-sheet logic
        Object.entries(templateData).forEach(([sheetName, data]) => {
            const ws = XLSX.utils.aoa_to_sheet(branding);
            XLSX.utils.sheet_add_json(ws, data as any[], { origin: "A4" });

            // Basic column widths
            const maxWidths = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
            ws['!cols'] = maxWidths;

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
    } else {
        // Single sheet logic
        const ws = XLSX.utils.aoa_to_sheet(branding);
        XLSX.utils.sheet_add_json(ws, templateData, { origin: "A4" });

        const maxWidths = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
        ws['!cols'] = maxWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Template");
    }

    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });

            let allData: any[] = [];

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
                const json = XLSX.utils.sheet_to_json(worksheet, {
                    range: isBranded ? 3 : 0,
                    defval: null // Ensure missing cells don't shift data
                });

                if (json.length > 0) {
                    // Tag data with sheetName to help disambiguate if needed
                    const taggedData = json.map((item: any) => ({ ...item, _sheet: sheetName }));
                    allData = [...allData, ...taggedData];
                }
            });

            console.log(`Parsed ${allData.length} records from ${workbook.SheetNames.length} sheets.`);
            resolve(allData);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};
