import { Router } from 'express';
import { query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { signDossier, verifyDossierSignature } from '../../utils/governance/dossierSigning';
import type {
  ModelInventoryEntry,
  ModelKind,
  ModelStatus,
  SignedDossier,
} from '../../types/governance';

const router = Router();

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

export default router;
