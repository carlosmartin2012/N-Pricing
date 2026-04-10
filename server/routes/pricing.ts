import { Router } from 'express';
import { safeError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/pricing/inverse-optimize
 *
 * Given a deal + target RAROC, find the minimum marginTarget that achieves it.
 * Uses bisection on the pricing engine.
 *
 * Body: {
 *   deal: Transaction,
 *   targetRaroc: number,
 *   context?: PricingContext,
 *   approvalMatrix?: ApprovalMatrixConfig,
 *   shocks?: PricingShocks,
 *   marginBounds?: [number, number],
 *   precision?: number,
 * }
 */
router.post('/inverse-optimize', async (req, res) => {
  try {
    const { optimizeMarginForTargetRaroc } = await import(
      '../../utils/pricing/inverseOptimizer'
    );
    const {
      deal,
      targetRaroc,
      context,
      approvalMatrix,
      shocks,
      marginBounds,
      precision,
    } = req.body ?? {};

    if (!deal || typeof targetRaroc !== 'number') {
      return res.status(400).json({ error: 'deal and targetRaroc required' });
    }

    const defaultApproval = approvalMatrix ?? {
      autoApprovalThreshold: 15,
      l1Threshold: 10,
      l2Threshold: 5,
    };

    const result = optimizeMarginForTargetRaroc({
      deal,
      targetRaroc,
      approvalMatrix: defaultApproval,
      context,
      shocks,
      marginBounds,
      precision,
    });

    res.json(result);
  } catch (err) {
    console.error('[pricing] inverse-optimize error', err);
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * GET /api/pricing/macro-scenarios
 *
 * Returns the list of available EBA-style macro stress scenarios.
 */
router.get('/macro-scenarios', async (_req, res) => {
  try {
    const { MACRO_SCENARIOS } = await import(
      '../../utils/pricing/macroStressScenarios'
    );
    res.json(Object.values(MACRO_SCENARIOS));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * POST /api/pricing/explain-waterfall
 *
 * Builds a markdown-formatted waterfall explanation for a given deal+result.
 * Used by the Gemini copilot to ground its responses.
 *
 * Body: { deal: Transaction, result: FTPResult, language?: 'es'|'en' }
 */
router.post('/explain-waterfall', async (req, res) => {
  try {
    const { buildWaterfallExplanation, buildCopilotSystemPrompt } = await import(
      '../../utils/waterfallExplainer'
    );
    const { deal, result, language } = req.body ?? {};

    if (!deal || !result) {
      return res.status(400).json({ error: 'deal and result required' });
    }

    const lang = language === 'en' ? 'en' : 'es';
    const markdown = buildWaterfallExplanation(deal, result, { language: lang });
    const systemPrompt = buildCopilotSystemPrompt(lang);

    res.json({ markdown, systemPrompt });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * POST /api/pricing/delegation-check
 *
 * Runs the multi-dimensional delegation engine against a deal input
 * without requiring a full pricing run. Useful for pre-flight approval checks.
 *
 * Body: { input: DelegationInput, matrix?: DelegationRule[] }
 */
router.post('/delegation-check', async (req, res) => {
  try {
    const { resolveDelegation } = await import(
      '../../utils/pricing/delegationEngine'
    );
    const { input, matrix } = req.body ?? {};

    if (!input || typeof input.amount !== 'number' || typeof input.raroc !== 'number') {
      return res.status(400).json({ error: 'input with amount and raroc required' });
    }

    const result = resolveDelegation(input, matrix);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Phase 2 endpoints ────────────────────────────────────────────────

/**
 * POST /api/pricing/fit-nss-curve
 *
 * Fit a Nelson-Siegel-Svensson model to observed (t, rate) points.
 * Body: { observations: Array<{t, rate}>, tau1?, tau2?, evaluateAt?: number[] }
 * Returns: { params, rmse, converged, evaluated?: Array<{t, rate}> }
 */
router.post('/fit-nss-curve', async (req, res) => {
  try {
    const { fitNSSLinear, nssYield } = await import(
      '../../utils/pricing/nelsonSiegelSvensson'
    );
    const { observations, tau1, tau2, evaluateAt } = req.body ?? {};

    if (!Array.isArray(observations)) {
      return res.status(400).json({ error: 'observations array required' });
    }

    const fit = fitNSSLinear(observations, tau1, tau2);
    const evaluated = Array.isArray(evaluateAt)
      ? evaluateAt.map((t: number) => ({ t, rate: nssYield(fit.params, t) }))
      : undefined;

    res.json({ ...fit, evaluated });
  } catch (err) {
    console.error('[pricing] fit-nss-curve error', err);
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * POST /api/pricing/expost-compare
 *
 * Compare expected vs realized RAROC with full P&L attribution.
 * Body: { expected: ExpectedRaroc, performance: RealizedPerformance, threshold?: number }
 */
router.post('/expost-compare', async (req, res) => {
  try {
    const { compareExpectedVsRealized } = await import(
      '../../utils/pricing/expostRaroc'
    );
    const { expected, performance, threshold } = req.body ?? {};

    if (!expected || !performance) {
      return res.status(400).json({ error: 'expected and performance required' });
    }

    const result = compareExpectedVsRealized(expected, performance, threshold);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * POST /api/pricing/expost-systematic
 *
 * Detect systematic underpricing in a list of comparisons.
 * Body: { comparisons: ExPostComparisonResult[], minObservations?: number }
 */
router.post('/expost-systematic', async (req, res) => {
  try {
    const { detectSystematicUnderpricing } = await import(
      '../../utils/pricing/expostRaroc'
    );
    const { comparisons, minObservations } = req.body ?? {};

    if (!Array.isArray(comparisons)) {
      return res.status(400).json({ error: 'comparisons array required' });
    }

    const alerts = detectSystematicUnderpricing(comparisons, minObservations);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * POST /api/pricing/portfolio-review
 *
 * Run the full portfolio review agent over a list of deals+results.
 * Body: { portfolio: Array<{deal, result}>, asOfDate?: string }
 */
router.post('/portfolio-review', async (req, res) => {
  try {
    const { runPortfolioReview } = await import(
      '../../utils/pricing/portfolioReviewAgent'
    );
    const { portfolio, asOfDate } = req.body ?? {};

    if (!Array.isArray(portfolio)) {
      return res.status(400).json({ error: 'portfolio array required' });
    }

    const result = runPortfolioReview(portfolio, asOfDate);
    res.json(result);
  } catch (err) {
    console.error('[pricing] portfolio-review error', err);
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * POST /api/pricing/mrm-backtest
 *
 * Run a backtest for a model (PD/LGD/behavioral).
 * Body: { category: 'PD'|'LGD'|'BEHAVIORAL', modelId: string, observations: BacktestObservation[] }
 */
router.post('/mrm-backtest', async (req, res) => {
  try {
    const { backtestPDModel, backtestLGDModel, backtestBehavioralModel } =
      await import('../../utils/pricing/modelInventory');
    const { category, modelId, observations } = req.body ?? {};

    if (!modelId || !Array.isArray(observations)) {
      return res.status(400).json({ error: 'modelId and observations required' });
    }

    let result;
    if (category === 'PD') {
      result = backtestPDModel(modelId, observations);
    } else if (category === 'LGD') {
      result = backtestLGDModel(modelId, observations);
    } else {
      result = backtestBehavioralModel(modelId, category ?? 'OTHER', observations);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
