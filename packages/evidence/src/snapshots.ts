import { verifySnapshotChain, type ChainVerificationResult, type SnapshotChainLink } from '../../../utils/snapshotHash';
import type { QueryOneReader, QueryReader } from '@npricing/data-access';

export type SnapshotQueryReader = QueryReader;

export type SnapshotOneReader = QueryOneReader;

export interface SnapshotSummaryRow {
  id: string;
  entity_id: string;
  deal_id: string | null;
  pricing_result_id?: string | null;
  request_id: string;
  engine_version: string;
  as_of_date: string;
  used_mock_for: string[];
  input_hash: string;
  output_hash: string;
  created_at: string;
}

export interface SnapshotDetailRow extends SnapshotSummaryRow {
  pricing_result_id: string | null;
  input: Record<string, unknown>;
  context: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface SnapshotListArgs {
  entityId: string;
  dealId?: string | null;
  limit: number;
}

export interface SnapshotChainVerifyArgs {
  entityId: string;
  from?: string | null;
  to?: string | null;
}

export type SnapshotChainVerification = ChainVerificationResult & {
  entityId: string;
  from: string | null;
  to: string | null;
  count: number;
};

const SNAPSHOT_DETAIL_COLUMNS = `
  id, entity_id, deal_id, pricing_result_id, request_id, engine_version,
  as_of_date, used_mock_for, input, context, output, input_hash, output_hash, created_at
`;

const SNAPSHOT_SUMMARY_COLUMNS = `
  id, entity_id, deal_id, pricing_result_id, request_id, engine_version,
  as_of_date, used_mock_for, input_hash, output_hash, created_at
`;

export async function loadSnapshotDetail(
  reader: SnapshotOneReader,
  entityId: string,
  snapshotId: string
): Promise<SnapshotDetailRow | null> {
  return reader.queryOne<SnapshotDetailRow>(
    `SELECT ${SNAPSHOT_DETAIL_COLUMNS}
     FROM pricing_snapshots
     WHERE id = $1 AND entity_id = $2
     LIMIT 1`,
    [snapshotId, entityId]
  );
}

export async function listSnapshotSummaries(
  reader: SnapshotQueryReader,
  args: SnapshotListArgs
): Promise<SnapshotSummaryRow[]> {
  if (args.dealId) {
    return reader.query<SnapshotSummaryRow>(
      `SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
       FROM pricing_snapshots
       WHERE entity_id = $1 AND deal_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [args.entityId, args.dealId, args.limit]
    );
  }

  return reader.query<SnapshotSummaryRow>(
    `SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
     FROM pricing_snapshots
     WHERE entity_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [args.entityId, args.limit]
  );
}

export async function verifySnapshotChainForEntity(
  reader: SnapshotQueryReader,
  args: SnapshotChainVerifyArgs
): Promise<SnapshotChainVerification> {
  const filters = ['entity_id = $1'];
  const params: string[] = [args.entityId];
  if (args.from) {
    params.push(args.from);
    filters.push(`created_at >= $${params.length}`);
  }
  if (args.to) {
    params.push(args.to);
    filters.push(`created_at <= $${params.length}`);
  }

  const rows = await reader.query<{ id: string; output_hash: string; prev_output_hash: string | null }>(
    `SELECT id, output_hash, prev_output_hash
     FROM pricing_snapshots
     WHERE ${filters.join(' AND ')}
     ORDER BY created_at ASC, id ASC`,
    params
  );
  const links: SnapshotChainLink[] = rows.map((row) => ({
    id: row.id,
    outputHash: row.output_hash,
    prevOutputHash: row.prev_output_hash,
  }));
  return {
    entityId: args.entityId,
    from: args.from ?? null,
    to: args.to ?? null,
    count: links.length,
    ...verifySnapshotChain(links),
  };
}

export function snapshotDetailToDto(row: SnapshotDetailRow): Record<string, unknown> {
  return {
    id: row.id,
    entityId: row.entity_id,
    dealId: row.deal_id,
    pricingResultId: row.pricing_result_id,
    requestId: row.request_id,
    engineVersion: row.engine_version,
    asOfDate: row.as_of_date,
    usedMockFor: row.used_mock_for,
    input: row.input,
    context: row.context,
    output: row.output,
    inputHash: row.input_hash,
    outputHash: row.output_hash,
    createdAt: row.created_at,
  };
}

export function snapshotSummaryToDto(row: SnapshotSummaryRow): Record<string, unknown> {
  return {
    id: row.id,
    dealId: row.deal_id,
    requestId: row.request_id,
    engineVersion: row.engine_version,
    asOfDate: row.as_of_date,
    usedMockFor: row.used_mock_for,
    inputHash: row.input_hash,
    outputHash: row.output_hash,
    createdAt: row.created_at,
  };
}
