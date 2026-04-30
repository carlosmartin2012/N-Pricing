/**
 * Ola 10 Bloque C — Dispatcher: cuando una decisión cae como
 * 'escalated' al nivel L, dispara push notifications a los usuarios
 * cuyo `rbac_role` matchea con el level.rbac_role.
 *
 * Pure de side-effects: el caller (router de attributions) lo invoca
 * después de insertar la decision. Failure aquí NO debe abortar la
 * decisión (la fila ya está commit-eada) — sólo se logue.
 *
 * Lógica:
 *   1. Buscar el level por requiredLevelId → leer rbac_role.
 *   2. Buscar usuarios con ese role en esta entity.
 *   3. Para cada usuario, sus push_subscriptions activas.
 *   4. Enviar payload con dealId + URL deep-link a /approvals.
 *   5. Purgar suscripciones stale.
 *
 * Idempotencia: el `tag` del payload incluye dealId+decisionId para
 * que el navegador deduplique si llegaran dos mismas notifs.
 */

import { query } from '../db';
import { isWebPushConfigured, sendPushToMany } from './webPushSender';
import type { AttributionRoutingMetadata } from '../../types/attributions';

interface LevelLookupRow {
  rbac_role: string;
  name: string;
}

interface UserForPushRow {
  email: string;
}

interface SubscriptionRow {
  endpoint:    string;
  keys_p256dh: string;
  keys_auth:   string;
}

export interface DispatchInput {
  entityId: string;
  dealId: string;
  decisionId: string;
  requiredLevelId: string;
  routingMetadata: AttributionRoutingMetadata;
}

export interface DispatchReport {
  notified: number;
  staleEndpointsPurged: number;
  skipped: 'no_vapid' | 'no_users' | 'no_subscriptions' | null;
  errors: string[];
}

const LEVEL_ROLE_TABLE = `attribution_levels`;

/**
 * Disparo idempotente. Si VAPID no está configurado o no hay usuarios
 * suscritos, devuelve un report con `skipped='no_vapid'|'no_users'`
 * sin lanzar.
 */
export async function dispatchEscalationPush(input: DispatchInput): Promise<DispatchReport> {
  const report: DispatchReport = {
    notified: 0,
    staleEndpointsPurged: 0,
    skipped: null,
    errors: [],
  };

  if (!isWebPushConfigured()) {
    report.skipped = 'no_vapid';
    return report;
  }

  let levelRows: LevelLookupRow[];
  try {
    levelRows = await query<LevelLookupRow>(
      `SELECT rbac_role, name FROM ${LEVEL_ROLE_TABLE}
       WHERE id = $1 AND entity_id = $2 AND active = TRUE`,
      [input.requiredLevelId, input.entityId],
    );
  } catch (err) {
    report.errors.push(`level lookup: ${(err as Error).message}`);
    return report;
  }
  const level = levelRows[0];
  if (!level) {
    report.errors.push(`level ${input.requiredLevelId} not found / not active`);
    return report;
  }

  let userRows: UserForPushRow[];
  try {
    // El rol AUTORITATIVO por tenant es `entity_users.role`, no `users.role`.
    // La tabla `users` es global y un mismo usuario puede tener distintos
    // roles en bancos distintos. Filtrar solo por `users.role` rompía el
    // contrato de tenancy: un email candidato podía pertenecer a otro
    // banco aunque la query siguiente sí scope-ara las suscripciones.
    userRows = await query<UserForPushRow>(
      `SELECT DISTINCT u.email
         FROM entity_users eu
         JOIN users u ON u.id = eu.user_id
        WHERE eu.entity_id = $1
          AND eu.role      = $2`,
      [input.entityId, level.rbac_role],
    );
  } catch (err) {
    report.errors.push(`users lookup: ${(err as Error).message}`);
    return report;
  }
  if (userRows.length === 0) {
    report.skipped = 'no_users';
    return report;
  }

  const userEmails = userRows.map((u) => u.email);
  let subscriptions: SubscriptionRow[];
  try {
    subscriptions = await query<SubscriptionRow>(
      `SELECT endpoint, keys_p256dh, keys_auth
       FROM push_subscriptions
       WHERE entity_id = $1 AND user_email = ANY($2::text[])`,
      [input.entityId, userEmails],
    );
  } catch (err) {
    report.errors.push(`subscription fetch: ${(err as Error).message}`);
    return report;
  }
  if (subscriptions.length === 0) {
    report.skipped = 'no_subscriptions';
    return report;
  }

  const driftBps = input.routingMetadata.deviationBps ?? 0;
  const driftLabel = driftBps >= 0 ? `+${driftBps.toFixed(1)}` : driftBps.toFixed(1);
  const sendReport = await sendPushToMany(
    subscriptions.map((s) => ({
      endpoint:    s.endpoint,
      keysP256dh:  s.keys_p256dh,
      keysAuth:    s.keys_auth,
    })),
    {
      title: `Pending approval · ${input.dealId}`,
      body:  `${level.name} required · drift ${driftLabel} bps`,
      url:   `/approvals?focus=${encodeURIComponent(input.dealId)}`,
      tag:   `attribution-${input.decisionId}`,
      data:  {
        kind: 'attribution-escalation',
        dealId: input.dealId,
        decisionId: input.decisionId,
        requiredLevelId: input.requiredLevelId,
      },
    },
  );

  report.notified = sendReport.delivered;

  if (sendReport.staleEndpoints.length > 0) {
    try {
      await query(
        `DELETE FROM push_subscriptions
         WHERE entity_id = $1 AND endpoint = ANY($2::text[])`,
        [input.entityId, sendReport.staleEndpoints],
      );
      report.staleEndpointsPurged = sendReport.staleEndpoints.length;
    } catch (err) {
      report.errors.push(`stale purge: ${(err as Error).message}`);
    }
  }

  for (const failure of sendReport.failures) {
    if (failure.reason !== 'stale') {
      report.errors.push(
        `send to ${failure.endpoint.slice(0, 32)}…: ${failure.statusCode ?? '?'} (${failure.reason})`,
      );
    }
  }

  return report;
}
