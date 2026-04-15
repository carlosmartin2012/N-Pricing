import { Router } from 'express';
import { pool, query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { signDossier, verifyDossierSignature } from '../../utils/governance/dossierSigning';
import { recorderFromPool } from '../../utils/metering/usageRecorder';
import {
  evaluateEscalation,
  sweepEscalations,
  computeDueAt,
} from '../../utils/governance/escalationEvaluator';
import type {
  ApprovalEscalation,
  ApprovalEscalationConfig,
  EscalationLevel,
  EscalationStatus,
  ModelInventoryEntry,
  ModelKind,
  ModelStatus,
  SignedDossier,
} from '../../types/governance';

const router = Router();
const meter = recorderFromPool(pool);

// ---------- Model inventory ----------

interface ModelRow {
  id: string;
  entity_id: string | null;
  kind: ModelKind;
  name: string;
  version: string;
  status: ModelStatus;
  owner_email: string | null;
  validation_doc_url: string | null;
  validated_at: string | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapModel(r: ModelRow): ModelInventoryEntry {
  return {
    id: r.id, entityId: r.entity_id, kind: r.kind, name: r.name, version: r.version,
    status: r.status, ownerEmail: r.owner_email, validationDocUrl: r.validation_doc_url,
    validatedAt: r.validated_at, effectiveFrom: r.effective_from, effectiveTo: r.effective_to,
    notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

router.get('/models', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const kind = typeof req.query.kind === 'string' ? req.query.kind : null;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const conditions = ['(entity_id IS NULL OR entity_id = $1)'];
    const params: unknown[] = [req.tenancy.entityId];
    if (kind)   { params.push(kind);   conditions.push(`kind = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const rows = await query<ModelRow>(
      `SELECT * FROM model_inventory
       WHERE ${conditions.join(' AND ')}
       ORDER BY status ASC, kind ASC, name ASC, effective_from DESC LIMIT 500`,
      params,
    );
    res.json(rows.map(mapModel));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/models', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (!body?.kind || !body?.name || !body?.version) {
      res.status(400).json({ code: 'invalid_payload', message: 'kind, name, version required' });
      return;
    }
    const row = await queryOne<ModelRow>(
      `INSERT INTO model_inventory (
         entity_id, kind, name, version, status, owner_email,
         validation_doc_url, validated_at, effective_from, effective_to, notes
       ) VALUES ($1, $2, $3, $4, COALESCE($5, 'candidate'), $6, $7, $8, COALESCE($9, CURRENT_DATE), $10, $11)
       RETURNING *`,
      [
        body.entityScope === 'global' ? null : req.tenancy.entityId,
        body.kind, body.name, body.version,
        body.status ?? null, body.ownerEmail ?? req.tenancy.userEmail,
        body.validationDocUrl ?? null, body.validatedAt ?? null,
        body.effectiveFrom ?? null, body.effectiveTo ?? null, body.notes ?? null,
      ],
    );
    res.status(201).json(row ? mapModel(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/models/:id/status', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const status = String(req.body?.status ?? '');
    if (!['candidate', 'active', 'retired', 'rejected'].includes(status)) {
      res.status(400).json({ code: 'invalid_status' });
      return;
    }
    const row = await queryOne<ModelRow>(
      `UPDATE model_inventory
       SET status = $2, updated_at = NOW()
       WHERE id = $1 AND (entity_id IS NULL OR entity_id = $3)
       RETURNING *`,
      [req.params.id, status, req.tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(mapModel(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------- Signed committee dossiers ----------

interface DossierRow {
  id: string;
  entity_id: string;
  deal_id: string | null;
  pricing_snapshot_id: string | null;
  dossier_payload: Record<string, unknown>;
  payload_hash: string;
  signature_hex: string;
  signed_by_email: string;
  signed_at: string;
}

function mapDossier(r: DossierRow): SignedDossier {
  return {
    id: r.id, entityId: r.entity_id, dealId: r.deal_id,
    pricingSnapshotId: r.pricing_snapshot_id,
    dossierPayload: r.dossier_payload,
    payloadHash: r.payload_hash, signatureHex: r.signature_hex,
    signedByEmail: r.signed_by_email, signedAt: r.signed_at,
  };
}

router.post('/dossiers', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (!body?.payload || typeof body.payload !== 'object') {
      res.status(400).json({ code: 'invalid_payload', message: 'payload object required' });
      return;
    }
    const { payloadHash, signatureHex } = signDossier(body.payload);
    const row = await queryOne<DossierRow>(
      `INSERT INTO signed_committee_dossiers (
         entity_id, deal_id, pricing_snapshot_id,
         dossier_payload, payload_hash, signature_hex, signed_by_email
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING *`,
      [
        req.tenancy.entityId,
        body.dealId ?? null,
        body.pricingSnapshotId ?? null,
        JSON.stringify(body.payload),
        payloadHash,
        signatureHex,
        req.tenancy.userEmail,
      ],
    );
    if (row && req.tenancy?.entityId) {
      void meter.insert(req.tenancy.entityId, 'dossier_sign', 1, { dealId: row.deal_id });
    }
    res.status(201).json(row ? mapDossier(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/dossiers/:id/verify', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const row = await queryOne<DossierRow>(
      'SELECT * FROM signed_committee_dossiers WHERE id = $1 AND entity_id = $2',
      [req.params.id, req.tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    const verification = verifyDossierSignature(row.dossier_payload, row.payload_hash, row.signature_hex);
    res.json({ dossier: mapDossier(row), verification });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------- Approval escalation workflow ----------

interface EscalationRow {
  id: string;
  entity_id: string;
  deal_id: string | null;
  exception_id: string | null;
  level: EscalationLevel;
  due_at: string;
  status: EscalationStatus;
  notified_at: string | null;
  resolved_at: string | null;
  created_at: string;
  opened_by: string | null;
  current_notes: string | null;
  escalated_from_id: string | null;
}

function mapEscalation(r: EscalationRow): ApprovalEscalation {
  return {
    id: r.id, entityId: r.entity_id, dealId: r.deal_id, exceptionId: r.exception_id,
    level: r.level, dueAt: r.due_at, status: r.status,
    notifiedAt: r.notified_at, resolvedAt: r.resolved_at, createdAt: r.created_at,
    openedBy: r.opened_by, currentNotes: r.current_notes, escalatedFromId: r.escalated_from_id,
  };
}

interface EscalationConfigRow {
  id: string;
  entity_id: string;
  level: EscalationLevel;
  timeout_hours: string | number;
  notify_before_hours: string | number;
  channel_type: ApprovalEscalationConfig['channelType'];
  channel_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapEscalationConfig(r: EscalationConfigRow): ApprovalEscalationConfig {
  return {
    id: r.id, entityId: r.entity_id, level: r.level,
    timeoutHours: Number(r.timeout_hours),
    notifyBeforeHours: Number(r.notify_before_hours),
    channelType: r.channel_type, channelConfig: r.channel_config,
    isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function loadConfigsForEntity(
  entityId: string,
): Promise<Partial<Record<EscalationLevel, ApprovalEscalationConfig>>> {
  const rows = await query<EscalationConfigRow>(
    'SELECT * FROM approval_escalation_configs WHERE entity_id = $1 AND is_active = TRUE',
    [entityId],
  );
  const byLevel: Partial<Record<EscalationLevel, ApprovalEscalationConfig>> = {};
  for (const r of rows) byLevel[r.level] = mapEscalationConfig(r);
  return byLevel;
}

router.get('/escalations', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const conditions = ['entity_id = $1'];
    const params: unknown[] = [req.tenancy.entityId];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const rows = await query<EscalationRow>(
      `SELECT * FROM approval_escalations
       WHERE ${conditions.join(' AND ')}
       ORDER BY due_at ASC LIMIT 500`,
      params,
    );
    res.json({ escalations: rows.map(mapEscalation) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/escalations', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = (req.body ?? {}) as {
      dealId?: string | null;
      exceptionId?: string | null;
      level?: EscalationLevel;
      notes?: string | null;
      openedBy?: string | null;
    };
    if (!body.dealId && !body.exceptionId) {
      res.status(400).json({ code: 'missing_target', message: 'dealId or exceptionId required' });
      return;
    }
    const level: EscalationLevel = body.level ?? 'L1';
    const configs = await loadConfigsForEntity(req.tenancy.entityId);
    const cfg = configs[level];
    const dueAt = computeDueAt(new Date(), cfg?.timeoutHours ?? 24);

    const row = await queryOne<EscalationRow>(
      `INSERT INTO approval_escalations
         (entity_id, deal_id, exception_id, level, due_at, status, opened_by, current_notes)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
       RETURNING *`,
      [
        req.tenancy.entityId,
        body.dealId ?? null,
        body.exceptionId ?? null,
        level,
        dueAt,
        body.openedBy ?? null,
        body.notes ?? null,
      ],
    );
    if (!row) {
      res.status(500).json({ code: 'insert_failed' });
      return;
    }
    await meter.insert(req.tenancy.entityId, 'escalation_opened', 1, {
      level,
      dealId: body.dealId ?? null,
    });
    res.status(201).json({ escalation: mapEscalation(row) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/escalations/:id/resolve', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const row = await queryOne<EscalationRow>(
      `UPDATE approval_escalations
         SET status = 'resolved', resolved_at = NOW(), current_notes = COALESCE($3, current_notes)
       WHERE id = $1 AND entity_id = $2 AND status = 'open'
       RETURNING *`,
      [req.params.id, req.tenancy.entityId, req.body?.notes ?? null],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found_or_not_open' });
      return;
    }
    res.json({ escalation: mapEscalation(row) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * Admin endpoint to run the sweeper on-demand. Evaluates every open
 * escalation for this entity, applies notify/escalate/expire transitions,
 * and returns a summary. The worker loop consumes the same primitive.
 */
router.post('/escalations/sweep', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const rows = await query<EscalationRow>(
      "SELECT * FROM approval_escalations WHERE entity_id = $1 AND status = 'open' LIMIT 1000",
      [req.tenancy.entityId],
    );
    const configs = await loadConfigsForEntity(req.tenancy.entityId);
    const now = new Date();
    const plans = sweepEscalations(
      rows.map(mapEscalation),
      { [req.tenancy.entityId]: configs },
      now,
    );

    const summary = { notified: 0, escalated: 0, expired: 0, untouched: 0 };

    for (const { escalation, action } of plans) {
      if (action.kind === 'notify') {
        await query(
          "UPDATE approval_escalations SET notified_at = $2 WHERE id = $1",
          [escalation.id, now.toISOString()],
        );
        summary.notified += 1;
      } else if (action.kind === 'escalate') {
        await query(
          "UPDATE approval_escalations SET status = 'escalated', resolved_at = $2 WHERE id = $1",
          [escalation.id, now.toISOString()],
        );
        await query(
          `INSERT INTO approval_escalations
             (entity_id, deal_id, exception_id, level, due_at, status, opened_by, current_notes, escalated_from_id)
           VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8)`,
          [
            escalation.entityId,
            escalation.dealId,
            escalation.exceptionId,
            action.toLevel,
            action.newDueAt,
            escalation.openedBy,
            escalation.currentNotes,
            escalation.id,
          ],
        );
        summary.escalated += 1;
      } else if (action.kind === 'expire') {
        await query(
          "UPDATE approval_escalations SET status = 'expired', resolved_at = $2 WHERE id = $1",
          [escalation.id, now.toISOString()],
        );
        summary.expired += 1;
      } else {
        summary.untouched += 1;
      }
    }

    res.json({ summary, evaluatedAt: now.toISOString() });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------- Escalation configs ----------

router.get('/escalation-configs', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const configs = await loadConfigsForEntity(req.tenancy.entityId);
    res.json({ configs });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.put('/escalation-configs/:level', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const level = req.params.level as EscalationLevel;
    if (!['L1', 'L2', 'Committee'].includes(level)) {
      res.status(400).json({ code: 'invalid_level' });
      return;
    }
    const body = (req.body ?? {}) as Partial<ApprovalEscalationConfig>;
    const row = await queryOne<EscalationConfigRow>(
      `INSERT INTO approval_escalation_configs
         (entity_id, level, timeout_hours, notify_before_hours, channel_type, channel_config, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE))
       ON CONFLICT (entity_id, level) DO UPDATE SET
         timeout_hours       = EXCLUDED.timeout_hours,
         notify_before_hours = EXCLUDED.notify_before_hours,
         channel_type        = EXCLUDED.channel_type,
         channel_config      = EXCLUDED.channel_config,
         is_active           = EXCLUDED.is_active,
         updated_at          = NOW()
       RETURNING *`,
      [
        req.tenancy.entityId,
        level,
        body.timeoutHours ?? 24,
        body.notifyBeforeHours ?? 0,
        body.channelType ?? 'email',
        body.channelConfig ?? {},
        body.isActive ?? true,
      ],
    );
    if (!row) {
      res.status(500).json({ code: 'upsert_failed' });
      return;
    }
    res.json({ config: mapEscalationConfig(row) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Quick single-row evaluator endpoint (no writes) — useful for dashboards
// that want to render the next expected transition without triggering it.
router.get('/escalations/:id/evaluate', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const row = await queryOne<EscalationRow>(
      'SELECT * FROM approval_escalations WHERE id = $1 AND entity_id = $2',
      [req.params.id, req.tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    const configs = await loadConfigsForEntity(req.tenancy.entityId);
    const action = evaluateEscalation({
      escalation: mapEscalation(row),
      configs,
      now: new Date(),
    });
    res.json({ escalation: mapEscalation(row), action });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
