import type { Transaction, FTPResult } from '../types';

/**
 * Waterfall explainer — generates structured natural-language explanations
 * of an FTP waterfall result suitable for the Gemini pricing copilot.
 */

export interface WaterfallExplanationOptions {
  /** Target language: 'es' or 'en' */
  language?: 'es' | 'en';
  /** Include numeric values */
  includeNumbers?: boolean;
  /** Include RAROC section */
  includeRaroc?: boolean;
}

function fmtPct(n: number): string {
  return `${n.toFixed(3)}%`;
}

const LABELS = {
  es: {
    intro: 'Desglose FTP de la operación',
    baseRate: 'Base rate',
    liquidity: 'Prima de liquidez',
    lcr: 'Carga LCR',
    nsfr: 'Carga NSFR',
    regulatory: 'Coste de crédito (Anejo IX)',
    operational: 'Coste operativo',
    capital: 'Carga de capital',
    esg: 'Ajustes ESG',
    strategic: 'Spread estratégico',
    totalFtp: 'Total FTP',
    finalRate: 'Tasa final cliente',
    raroc: 'RAROC',
    economicProfit: 'Beneficio económico',
    approval: 'Nivel de aprobación',
    summary: 'Resumen',
  },
  en: {
    intro: 'FTP Waterfall Breakdown',
    baseRate: 'Base rate',
    liquidity: 'Liquidity premium',
    lcr: 'LCR charge',
    nsfr: 'NSFR charge',
    regulatory: 'Credit cost (Anejo IX)',
    operational: 'Operational cost',
    capital: 'Capital charge',
    esg: 'ESG adjustments',
    strategic: 'Strategic spread',
    totalFtp: 'Total FTP',
    finalRate: 'Final client rate',
    raroc: 'RAROC',
    economicProfit: 'Economic profit',
    approval: 'Approval level',
    summary: 'Summary',
  },
};

/**
 * Build a structured, human-readable waterfall explanation suitable for
 * display in a chat UI or for grounding a Gemini copilot prompt.
 */
export function buildWaterfallExplanation(
  deal: Transaction,
  result: FTPResult,
  options: WaterfallExplanationOptions = {},
): string {
  const lang = options.language ?? 'es';
  const L = LABELS[lang];
  const lines: string[] = [];

  lines.push(`## ${L.intro}`);
  lines.push('');
  lines.push(
    `**Deal**: ${deal.productType} · ${deal.amount.toLocaleString()} ${deal.currency} · ${deal.durationMonths}M`,
  );
  lines.push('');
  lines.push(`| Componente | Valor |`);
  lines.push(`|------------|-------|`);
  lines.push(`| ${L.baseRate} | ${fmtPct(result.baseRate)} |`);
  lines.push(`| ${L.liquidity} | ${fmtPct(result.liquiditySpread)} |`);
  if (result.lcrCost != null) {
    lines.push(`| ${L.lcr} | ${fmtPct(result.lcrCost)} |`);
  }
  if (result.nsfrCost != null) {
    lines.push(`| ${L.nsfr} | ${fmtPct(result.nsfrCost)} |`);
  }
  lines.push(`| ${L.regulatory} | ${fmtPct(result.regulatoryCost)} |`);
  lines.push(`| ${L.operational} | ${fmtPct(result.operationalCost)} |`);
  lines.push(`| ${L.capital} | ${fmtPct(result.capitalCharge)} |`);
  lines.push(
    `| ${L.esg} | ${fmtPct(result.esgTransitionCharge + result.esgPhysicalCharge)} |`,
  );
  lines.push(`| ${L.strategic} | ${fmtPct(result.strategicSpread)} |`);
  lines.push(`| **${L.totalFtp}** | **${fmtPct(result.totalFTP)}** |`);
  lines.push(`| **${L.finalRate}** | **${fmtPct(result.finalClientRate)}** |`);

  if (options.includeRaroc !== false) {
    lines.push('');
    lines.push(`**${L.raroc}**: ${fmtPct(result.raroc)}`);
    lines.push(`**${L.economicProfit}**: ${result.economicProfit.toFixed(2)}`);
    lines.push(`**${L.approval}**: ${result.approvalLevel}`);
  }

  if (result.matchReason) {
    lines.push('');
    lines.push(`*Regla aplicada*: ${result.matchReason}`);
  }

  return lines.join('\n');
}

/**
 * Build a Gemini system prompt for the pricing copilot.
 * Gives the model context + instructions for explaining the waterfall.
 */
export function buildCopilotSystemPrompt(language: 'es' | 'en' = 'es'): string {
  if (language === 'es') {
    return `Eres un copiloto de pricing para una plataforma FTP bancaria. Tu trabajo es:
1. Explicar el waterfall de una operación en lenguaje claro, sin jerga innecesaria.
2. Destacar los componentes que más impactan el precio final.
3. Si el RAROC está por debajo del hurdle, sugerir ajustes (margen, plazo, garantía) dentro de lo razonable.
4. Nunca inventes números. Usa solo los que te den en el contexto.
5. Responde en español, con formato markdown claro y tablas cuando ayuden.
6. Si no tienes información suficiente, dilo — no alucines.`;
  }
  return `You are a pricing copilot for a banking FTP platform. Your job is to:
1. Explain the waterfall of a deal in clear, jargon-free language.
2. Highlight components that most impact the final price.
3. If RAROC is below hurdle, suggest reasonable adjustments (margin, tenor, collateral).
4. Never invent numbers. Use only those given in context.
5. Reply in English, markdown format with tables where helpful.
6. If information is insufficient, say so — don't hallucinate.`;
}

/**
 * Build a full Gemini user message: waterfall context + user question.
 */
export function buildCopilotUserMessage(
  deal: Transaction,
  result: FTPResult,
  userQuestion: string,
  language: 'es' | 'en' = 'es',
): string {
  const waterfall = buildWaterfallExplanation(deal, result, { language });
  const prefix = language === 'es' ? 'Contexto de la operación:' : 'Deal context:';
  const q = language === 'es' ? 'Pregunta del gestor:' : 'User question:';
  return `${prefix}\n\n${waterfall}\n\n${q}\n${userQuestion}`;
}
