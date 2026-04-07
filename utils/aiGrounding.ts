import type {
  AIAction,
  AIGroundedContext,
  AIResponseTrace,
  AuditSubjectRef,
  MarketDataSource,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
  Transaction,
} from '../types';

function createTraceId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeText(value: string) {
  return value.trim().toUpperCase();
}

function createSubjectRef(subject: AuditSubjectRef): AuditSubjectRef {
  return subject;
}

function findMentionedDealId(input: string, deals: Transaction[], dossiers: PricingDossier[]) {
  const normalized = normalizeText(input);
  const matchedDeal = deals.find((deal) => deal.id && normalized.includes(deal.id.toUpperCase()));
  if (matchedDeal?.id) return matchedDeal.id;

  const matchedDossier = dossiers.find(
    (dossier) => normalized.includes(dossier.id.toUpperCase()) || normalized.includes(dossier.dealId.toUpperCase())
  );
  return matchedDossier?.dealId;
}

function getLatestMethodologyVersionId(methodologyVersions: MethodologyVersion[]) {
  return methodologyVersions[0]?.id;
}

export function resolveRelevantMarketDataSources(
  deal: Partial<Transaction> | undefined,
  sources: MarketDataSource[]
): MarketDataSource[] {
  const currency = deal?.currency?.toUpperCase();
  const yieldCurveSources = sources.filter((source) => source.sourceType === 'YieldCurve');
  const activeMatchingSources = yieldCurveSources.filter(
    (source) => source.status === 'Active' && (!currency || source.currencies.includes(currency))
  );

  if (activeMatchingSources.length > 0) return activeMatchingSources;

  const matchingSources = yieldCurveSources.filter((source) => !currency || source.currencies.includes(currency));
  if (matchingSources.length > 0) return matchingSources;

  return yieldCurveSources.filter((source) => source.status === 'Active');
}

export function findLatestPortfolioSnapshotForDeal(
  dealId: string | undefined,
  snapshots: PortfolioSnapshot[]
): PortfolioSnapshot | undefined {
  if (!dealId) return undefined;

  return [...snapshots]
    .filter((snapshot) => snapshot.dealIds.includes(dealId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

export function buildDossierGroundedContext({
  dossier,
  methodologyVersions,
  marketDataSources,
  portfolioSnapshots,
}: {
  dossier: PricingDossier;
  methodologyVersions: MethodologyVersion[];
  marketDataSources: MarketDataSource[];
  portfolioSnapshots: PortfolioSnapshot[];
}): AIGroundedContext {
  const relevantSources = resolveRelevantMarketDataSources(dossier.dealSnapshot, marketDataSources);
  const snapshot = findLatestPortfolioSnapshotForDeal(dossier.dealId, portfolioSnapshots);
  const methodologyVersionId = dossier.methodologyVersionId || getLatestMethodologyVersionId(methodologyVersions);

  return {
    subjectRefs: [
      createSubjectRef({ type: 'DEAL', id: dossier.dealId, label: dossier.dealId }),
      createSubjectRef({ type: 'DOSSIER', id: dossier.id, label: dossier.title }),
      ...(snapshot ? [createSubjectRef({ type: 'PORTFOLIO_SNAPSHOT', id: snapshot.id, label: snapshot.name })] : []),
      ...relevantSources.map((source) =>
        createSubjectRef({
          type: 'MARKET_DATA_SOURCE',
          id: source.id,
          label: `${source.name} (${source.provider})`,
        })
      ),
    ],
    methodologyVersionId,
    dossierId: dossier.id,
    dealId: dossier.dealId,
    portfolioSnapshotId: snapshot?.id,
    evidenceIds: dossier.evidence.map((evidence) => evidence.id),
    marketDataSourceIds: relevantSources.map((source) => source.id),
  };
}

function formatPct(value: number | undefined): string {
  return value != null ? `${value.toFixed(3)}%` : 'N/A';
}

function buildPricingResultSummary(dossier: PricingDossier): string {
  const r = dossier.pricingResult;
  const deal = dossier.dealSnapshot;
  if (!r) return '';

  const lines = [
    '',
    'PRICING RESULT (Waterfall Breakdown):',
    `- Base Rate (IRRBB): ${formatPct(r.baseRate)}`,
    `- Liquidity Spread (total): ${formatPct(r.liquiditySpread)}`,
    `  - Liquidity Premium: ${formatPct(r._liquidityPremiumDetails)}`,
    `  - CLC/LCR Charge: ${formatPct(r._clcChargeDetails)}`,
    `  - NSFR Charge: ${formatPct(r.nsfrCost)}`,
    `- Strategic Spread: ${formatPct(r.strategicSpread)}`,
    `- Credit Cost (Anejo IX): ${formatPct(r.regulatoryCost)}`,
    `- Operational Cost: ${formatPct(r.operationalCost)}`,
    `- Capital Charge: ${formatPct(r.capitalCharge)}`,
    `- ESG Transition Charge: ${formatPct(r.esgTransitionCharge)}`,
    `- ESG Physical Charge: ${formatPct(r.esgPhysicalCharge)}`,
    r.esgGreeniumAdj ? `- ESG Greenium Discount: ${formatPct(r.esgGreeniumAdj)}` : '',
    r.esgDnshCapitalAdj ? `- DNSH Capital Discount: ${formatPct(r.esgDnshCapitalAdj)}` : '',
    r.esgPillar1Adj ? `- ISF Pillar I Adjustment: ${formatPct(r.esgPillar1Adj)}` : '',
    `- Floor Price: ${formatPct(r.floorPrice)}`,
    `- Technical Price: ${formatPct(r.technicalPrice)}`,
    `- Target Price: ${formatPct(r.targetPrice)}`,
    `- Total FTP: ${formatPct(r.totalFTP)}`,
    `- Final Client Rate: ${formatPct(r.finalClientRate)}`,
    `- Commercial Margin Target: ${formatPct(deal.marginTarget)}`,
    '',
    'RAROC & APPROVAL:',
    `- RAROC: ${r.raroc != null ? `${(r.raroc * 100).toFixed(2)}%` : 'N/A'}`,
    `- Economic Profit: ${r.economicProfit != null ? r.economicProfit.toFixed(0) : 'N/A'}`,
    `- Approval Level: ${r.approvalLevel}`,
    `- Matched Methodology: ${r.matchedMethodology}`,
    r.formulaUsed ? `- Formula Used: ${r.formulaUsed}` : '',
    r.behavioralMaturityUsed ? `- Behavioral Maturity Used: ${r.behavioralMaturityUsed.toFixed(1)} months` : '',
    r.incentivisationAdj ? `- Incentivisation Adjustment: ${formatPct(r.incentivisationAdj)}` : '',
    '',
    'CREDIT RISK (Anejo IX):',
    `- Anejo Segment: ${r.anejoSegment || 'Not classified'}`,
    `- Regulatory Cost (annual): ${formatPct(r.regulatoryCost)}`,
    '',
    'DEAL PARAMETERS:',
    `- Product: ${deal.productType} (${deal.category})`,
    `- Client Type: ${deal.clientType}`,
    `- Amount: ${deal.amount?.toLocaleString('es-ES')} ${deal.currency}`,
    `- Duration: ${deal.durationMonths} months`,
    `- Repricing: ${deal.repricingFreq}`,
    `- Risk Weight: ${deal.riskWeight}%`,
    `- Collateral: ${deal.collateralType || 'None'}`,
    `- ESG Transition: ${deal.transitionRisk}, Physical: ${deal.physicalRisk}${deal.greenFormat && deal.greenFormat !== 'None' ? `, Green Format: ${deal.greenFormat}` : ''}${deal.dnshCompliant ? ', DNSH: Compliant' : ''}${deal.isfEligible ? ', ISF: Eligible' : ''}`,
  ];

  return lines.filter(Boolean).join('\n');
}

export function buildGroundingSummary({
  groundedContext,
  dossier,
  methodologyVersions,
  marketDataSources,
  portfolioSnapshots,
}: {
  groundedContext: AIGroundedContext;
  dossier?: PricingDossier;
  methodologyVersions: MethodologyVersion[];
  marketDataSources: MarketDataSource[];
  portfolioSnapshots: PortfolioSnapshot[];
}) {
  const methodologyLabel =
    methodologyVersions.find((version) => version.id === groundedContext.methodologyVersionId)?.label ||
    groundedContext.methodologyVersionId ||
    'Live methodology';
  const snapshot = portfolioSnapshots.find((item) => item.id === groundedContext.portfolioSnapshotId);
  const sources = marketDataSources.filter((source) => groundedContext.marketDataSourceIds?.includes(source.id));

  const lines = [
    'GROUNDING CONTEXT:',
    `- Methodology Version: ${methodologyLabel}`,
    dossier ? `- Pricing Dossier: ${dossier.id} (${dossier.status})` : '- Pricing Dossier: none resolved',
    groundedContext.dealId ? `- Deal ID: ${groundedContext.dealId}` : '- Deal ID: none resolved',
    snapshot ? `- Portfolio Snapshot: ${snapshot.name} (${snapshot.id})` : '- Portfolio Snapshot: none resolved',
    sources.length
      ? `- Market Data Sources: ${sources.map((source) => `${source.name} [${source.provider}]`).join(', ')}`
      : '- Market Data Sources: live market state only',
    groundedContext.evidenceIds.length
      ? `- Evidence IDs: ${groundedContext.evidenceIds.join(', ')}`
      : '- Evidence IDs: none',
  ];

  if (dossier?.pricingResult) {
    lines.push(buildPricingResultSummary(dossier));
  }

  lines.push(
    'INSTRUCTIONS:',
    '- Explain pricing and risk only using the grounded artifacts above when applicable.',
    '- If the prompt asks for facts outside that grounding, say which artifact is missing.',
    '- When you reference a governed artifact, cite its ID inline.',
    '- When pricing result data is available, use actual numbers to explain the waterfall, RAROC, and approval level.',
    '- For counteroffer suggestions, use the floor price and technical price as reference bounds.',
  );

  return lines.join('\n');
}

export function resolveChatGrounding({
  input,
  deals,
  pricingDossiers,
  methodologyVersions,
  marketDataSources,
  portfolioSnapshots,
}: {
  input: string;
  deals: Transaction[];
  pricingDossiers: PricingDossier[];
  methodologyVersions: MethodologyVersion[];
  marketDataSources: MarketDataSource[];
  portfolioSnapshots: PortfolioSnapshot[];
}) {
  if (!deals.length && !pricingDossiers.length && !methodologyVersions.length) {
    return {
      dossier: undefined,
      groundedContext: {
        subjectRefs: [],
        evidenceIds: [],
        marketDataSourceIds: [],
      },
      summary:
        'GROUNDING CONTEXT:\n- No pricing data available. Responses will use general knowledge only.\nINSTRUCTIONS:\n- Indicate that no grounded artifacts are loaded for this query.',
      sources: [],
    };
  }

  const mentionedDealId = findMentionedDealId(input, deals, pricingDossiers);
  const dossier = mentionedDealId ? pricingDossiers.find((item) => item.dealId === mentionedDealId) : undefined;
  const existingGroundedContext = dossier?.groundedContext;
  const groundedContext =
    existingGroundedContext ||
    (dossier
      ? buildDossierGroundedContext({
          dossier,
          methodologyVersions,
          marketDataSources,
          portfolioSnapshots,
        })
      : {
          subjectRefs: portfolioSnapshots[0]
            ? [
                createSubjectRef({
                  type: 'PORTFOLIO_SNAPSHOT',
                  id: portfolioSnapshots[0].id,
                  label: portfolioSnapshots[0].name,
                }),
              ]
            : [],
          methodologyVersionId: getLatestMethodologyVersionId(methodologyVersions),
          evidenceIds: [],
          marketDataSourceIds: deals.length
            ? resolveRelevantMarketDataSources(deals[0], marketDataSources).map((source) => source.id)
            : [],
          portfolioSnapshotId: portfolioSnapshots[0]?.id,
        });

  return {
    dossier,
    groundedContext,
    summary: buildGroundingSummary({
      groundedContext,
      dossier,
      methodologyVersions,
      marketDataSources,
      portfolioSnapshots,
    }),
    sources: groundedContext.subjectRefs,
  };
}

function buildSuggestedActions({
  dossier,
  snapshot,
}: {
  dossier?: PricingDossier;
  snapshot?: PortfolioSnapshot;
}): AIAction[] {
  const actions: AIAction[] = [];

  if (dossier) {
    actions.push({
      id: createTraceId('ACT'),
      type: 'EXPLAIN_PRICING',
      label: `Explain ${dossier.dealId}`,
      subject: { type: 'DOSSIER', id: dossier.id, label: dossier.title },
      enabled: true,
    });
    actions.push({
      id: createTraceId('ACT'),
      type: 'SUMMARIZE_DOSSIER',
      label: `Summarize dossier ${dossier.dealId}`,
      subject: { type: 'DOSSIER', id: dossier.id, label: dossier.title },
      enabled: true,
    });
  }

  if (snapshot) {
    actions.push({
      id: createTraceId('ACT'),
      type: 'COMPARE_SCENARIOS',
      label: `Compare snapshot ${snapshot.name}`,
      subject: { type: 'PORTFOLIO_SNAPSHOT', id: snapshot.id, label: snapshot.name },
      enabled: true,
    });
  }

  if (dossier?.status === 'Pending_Approval') {
    actions.push({
      id: createTraceId('ACT'),
      type: 'DETECT_ANOMALY',
      label: `Review approval blockers for ${dossier.dealId}`,
      subject: { type: 'DOSSIER', id: dossier.id, label: dossier.title },
      enabled: true,
    });
  }

  return actions;
}

export function buildAIResponseTrace({
  model,
  groundedContext,
  sources,
  prompt,
  response,
  dossier,
  portfolioSnapshots,
}: {
  model: string;
  groundedContext: AIGroundedContext;
  sources: AuditSubjectRef[];
  prompt: string;
  response: string;
  dossier?: PricingDossier;
  portfolioSnapshots: PortfolioSnapshot[];
}): AIResponseTrace {
  const snapshot = portfolioSnapshots.find((item) => item.id === groundedContext.portfolioSnapshotId);

  return {
    id: createTraceId('AIT'),
    generatedAt: new Date().toISOString(),
    model,
    groundedContext,
    sources,
    suggestedActions: buildSuggestedActions({ dossier, snapshot }),
    promptPreview: prompt.trim().slice(0, 180),
    responsePreview: response.trim().slice(0, 280),
  };
}

export function appendAITraceToPricingDossier(
  dossier: PricingDossier,
  trace: AIResponseTrace,
  actorEmail: string,
  actorName: string
): PricingDossier {
  const existingEvidence = dossier.evidence.find(
    (evidence) =>
      evidence.type === 'AI_TRACE' && (evidence.metadata as Record<string, unknown> | undefined)?.traceId === trace.id
  );
  const aiEvidence = existingEvidence || {
    id: createTraceId('EVD'),
    type: 'AI_TRACE' as const,
    label: `AI trace for ${dossier.dealId}`,
    format: 'json' as const,
    createdAt: trace.generatedAt,
    createdByEmail: actorEmail,
    createdByName: actorName,
    status: 'Generated' as const,
    metadata: {
      traceId: trace.id,
      model: trace.model,
      methodologyVersionId: trace.groundedContext.methodologyVersionId,
      portfolioSnapshotId: trace.groundedContext.portfolioSnapshotId,
    },
  };

  return {
    ...dossier,
    updatedAt: new Date().toISOString(),
    groundedContext: trace.groundedContext,
    evidence: existingEvidence ? dossier.evidence : [...dossier.evidence, aiEvidence],
    aiResponseTraces: [...(dossier.aiResponseTraces || []), trace],
  };
}
