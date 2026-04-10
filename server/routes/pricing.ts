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

export default router;
