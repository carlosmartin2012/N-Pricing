/**
 * Ola 9 Bloque A — Admission router.
 *
 * Endpoints:
 *   POST /push                   → push pricing decision al sistema admisión
 *                                  (registry.admission().pushPricingDecision)
 *   GET  /context/:dealId        → fetch admission context
 *   GET  /reconciliation         → pull batch (pullReconciliation)
 *   GET  /health                 → status del adapter (kind + name + health)
 *
 * Tenancy-scoped por consistencia (aunque PUZZLE en sí es per-tenant en
 * el deployment, mantenemos el guard para defense-in-depth).
 */

import { Router } from 'express';
import { adapterRegistry } from '../../integrations/registry';
import { safeError } from '../middleware/errorHandler';
import type { AdmissionDecisionPush } from '../../integrations/types';

const router = Router();

function requireTenancy(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): { entityId: string; userEmail: string | null; role: string | null } | null {
  if (!req.tenancy) {
    res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
    return null;
  }
  return {
    entityId:  req.tenancy.entityId,
    userEmail: req.tenancy.userEmail ?? null,
    role:      req.tenancy.role ?? null,
  };
}

function requireRole(role: string | null, allowed: string[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

// Roles autorizados para empujar decisiones al sistema de admisión
// (PUZZLE en el deploy de Banca March). Una operación pushed materialia
// como decisión real en el sistema externo de riesgos del banco — no
// debe permitirse a roles meramente comerciales.
const PUSH_ALLOWED_ROLES = [
  'Admin', 'Risk_Manager', 'Director', 'Trader',
  'BranchManager', 'Compliance_Officer',
];

function isValidPushBody(body: unknown): body is AdmissionDecisionPush {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.dealId === 'string' &&
    typeof b.pricingSnapshotHash === 'string' &&
    (b.decision === 'approved' || b.decision === 'rejected' || b.decision === 'escalated') &&
    typeof b.decidedAt === 'string' &&
    typeof b.finalClientRateBps === 'number' &&
    typeof b.rarocPp === 'number'
  );
}

router.get('/health', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const adapter = adapterRegistry.admission();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No admission adapter registered' });
      return;
    }
    const health = await adapter.health();
    res.json({ kind: adapter.kind, name: adapter.name, health });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/push', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    if (!requireRole(tenancy.role, PUSH_ALLOWED_ROLES)) {
      res.status(403).json({
        code: 'forbidden',
        message: `Role '${tenancy.role ?? 'unknown'}' is not authorised to push admission decisions`,
      });
      return;
    }
    const adapter = adapterRegistry.admission();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No admission adapter registered' });
      return;
    }
    const body = req.body ?? {};
    if (!isValidPushBody(body)) {
      res.status(400).json({
        code: 'validation_error',
        message: 'dealId, pricingSnapshotHash, decision, decidedAt, finalClientRateBps and rarocPp are required',
      });
      return;
    }
    const result = await adapter.pushPricingDecision(body);
    if (!result.ok) {
      res.status(502).json({ code: result.error.code, message: result.error.message });
      return;
    }
    res.status(202).json({ accepted: true, externalId: result.value.externalId });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/context/:dealId', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const adapter = adapterRegistry.admission();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No admission adapter registered' });
      return;
    }
    const result = await adapter.fetchAdmissionContext(req.params.dealId);
    if (!result.ok) {
      res.status(502).json({ code: result.error.code, message: result.error.message });
      return;
    }
    if (result.value === null) {
      res.status(404).json({ code: 'not_found', message: 'Admission context not found' });
      return;
    }
    res.json(result.value);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/reconciliation', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const adapter = adapterRegistry.admission();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No admission adapter registered' });
      return;
    }
    if (!adapter.pullReconciliation) {
      res.status(501).json({ code: 'not_implemented', message: 'Adapter does not support reconciliation pull' });
      return;
    }
    const asOfDate = typeof req.query.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.as_of)
      ? req.query.as_of
      : new Date().toISOString().slice(0, 10);

    const result = await adapter.pullReconciliation(asOfDate);
    if (!result.ok) {
      res.status(502).json({ code: result.error.code, message: result.error.message });
      return;
    }
    const items = result.value;
    const summary = {
      total:           items.length,
      matched:         items.filter((i) => i.status === 'matched').length,
      mismatchRate:    items.filter((i) => i.status === 'mismatch_rate').length,
      mismatchMissing: items.filter((i) => i.status === 'mismatch_missing').length,
      unknown:         items.filter((i) => i.status === 'unknown_in_admission').length,
    };
    res.json({ asOfDate, items, summary });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
