/**
 * Bitemporal time-travel engine — spec §3 Data Layer
 *
 * Tracks parameters with two time dimensions:
 *   - Valid time: when the parameter was effectively in force
 *   - Transaction time: when the parameter was recorded in the system
 *
 * Enables:
 *   - As-of historical re-pricing (dispute resolution, audit)
 *   - Point-in-time parameter snapshots
 *   - Backtest against "what we knew then" or "what we know now"
 *   - Complete lineage from price → parameter → version → approver
 */

/** ISO 8601 date-time string (YYYY-MM-DDTHH:mm:ssZ) */
export type BitemporalDate = string;

/**
 * A bitemporal parameter record with full provenance.
 * Every parameter (yield curve point, rule, rate card, grid) is stored
 * as one or more bitemporal records.
 */
export interface BitemporalRecord<T> {
  /** Stable logical identifier (same across versions) */
  id: string;
  /** Monotonic version number per logical id */
  version: number;
  /** Parameter value for this version */
  value: T;
  /** Valid time: when this version took effect (business perspective) */
  validFrom: BitemporalDate;
  /** Valid time: when this version stops being valid (exclusive) */
  validTo: BitemporalDate | null;
  /** Transaction time: when this version was recorded in the system */
  txFrom: BitemporalDate;
  /** Transaction time: when this record was superseded (exclusive) */
  txTo: BitemporalDate | null;
  /** User who recorded this version */
  recordedBy: string;
  /** User who approved this version (null if unapproved) */
  approvedBy: string | null;
  /** Free-text change reason (for audit) */
  changeReason?: string;
  /** Previous version id (for lineage navigation) */
  supersededBy?: string;
}

export type QueryMode =
  | 'CURRENT' // Latest known state as of now
  | 'AS_OF_VALID' // Point-in-time on valid axis only (what should apply on date X)
  | 'AS_OF_SYSTEM' // Point-in-time on system axis only (what we knew at that moment)
  | 'BITEMPORAL'; // Both axes — "what we knew at time Y about date X" (audit replay)

export interface BitemporalQuery {
  mode: QueryMode;
  /** Valid-time target (required for AS_OF_VALID and BITEMPORAL) */
  validAt?: BitemporalDate;
  /** Transaction-time target (required for AS_OF_SYSTEM and BITEMPORAL) */
  systemAt?: BitemporalDate;
}

/**
 * Compare two ISO date strings lexicographically (works because ISO 8601
 * is lexicographically orderable in the same direction as chronological).
 */
function dateLte(a: BitemporalDate, b: BitemporalDate): boolean {
  return a <= b;
}

function dateLt(a: BitemporalDate, b: BitemporalDate): boolean {
  return a < b;
}

function inValidRange(record: BitemporalRecord<unknown>, target: BitemporalDate): boolean {
  if (!dateLte(record.validFrom, target)) return false;
  if (record.validTo !== null && !dateLt(target, record.validTo)) return false;
  return true;
}

function inSystemRange(record: BitemporalRecord<unknown>, target: BitemporalDate): boolean {
  if (!dateLte(record.txFrom, target)) return false;
  if (record.txTo !== null && !dateLt(target, record.txTo)) return false;
  return true;
}

/**
 * Query a list of bitemporal records and return the records matching the criteria.
 * Groups by logical id and returns one record per id (or none if nothing matches).
 */
export function queryBitemporal<T>(
  records: BitemporalRecord<T>[],
  query: BitemporalQuery,
): BitemporalRecord<T>[] {
  // Group by logical id
  const byId = new Map<string, BitemporalRecord<T>[]>();
  for (const r of records) {
    const list = byId.get(r.id) ?? [];
    list.push(r);
    byId.set(r.id, list);
  }

  const results: BitemporalRecord<T>[] = [];

  for (const [, versions] of byId.entries()) {
    let match: BitemporalRecord<T> | undefined;

    switch (query.mode) {
      case 'CURRENT':
        // Latest tx-time record with valid-time open (validTo === null)
        // OR the version with the latest txFrom that is still valid
        match = versions
          .filter((v) => v.txTo === null)
          .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
        break;

      case 'AS_OF_VALID':
        if (!query.validAt) throw new Error('validAt required for AS_OF_VALID query');
        // Latest version that was valid on validAt (ignoring tx time)
        match = versions
          .filter((v) => inValidRange(v, query.validAt!) && v.txTo === null)
          .sort((a, b) => b.txFrom.localeCompare(a.txFrom))[0];
        break;

      case 'AS_OF_SYSTEM':
        if (!query.systemAt) throw new Error('systemAt required for AS_OF_SYSTEM query');
        // Latest version known to the system at systemAt
        match = versions
          .filter((v) => inSystemRange(v, query.systemAt!))
          .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
        break;

      case 'BITEMPORAL':
        if (!query.validAt || !query.systemAt) {
          throw new Error('validAt and systemAt both required for BITEMPORAL query');
        }
        // What we knew at systemAt about the state on validAt
        match = versions.find(
          (v) => inValidRange(v, query.validAt!) && inSystemRange(v, query.systemAt!),
        );
        break;
    }

    if (match) results.push(match);
  }

  return results;
}

/**
 * Insert a new version of a parameter into the bitemporal store,
 * automatically closing the previous version's valid/tx ranges.
 *
 * Returns the updated records array (pure — does not mutate input).
 */
export function appendVersion<T>(
  records: BitemporalRecord<T>[],
  logicalId: string,
  value: T,
  metadata: {
    validFrom: BitemporalDate;
    validTo?: BitemporalDate | null;
    txAt: BitemporalDate;
    recordedBy: string;
    approvedBy?: string | null;
    changeReason?: string;
  },
): BitemporalRecord<T>[] {
  const existing = records.filter((r) => r.id === logicalId);
  const others = records.filter((r) => r.id !== logicalId);

  // Close the latest open record (if any) on tx axis
  const latest = existing
    .filter((v) => v.txTo === null)
    .sort((a, b) => b.txFrom.localeCompare(a.txFrom))[0];

  const updatedExisting = existing.map((v) =>
    latest && v.version === latest.version && v.txTo === null
      ? { ...v, txTo: metadata.txAt }
      : v,
  );

  const maxVersion = existing.reduce((max, r) => Math.max(max, r.version), 0);

  const newRecord: BitemporalRecord<T> = {
    id: logicalId,
    version: maxVersion + 1,
    value,
    validFrom: metadata.validFrom,
    validTo: metadata.validTo ?? null,
    txFrom: metadata.txAt,
    txTo: null,
    recordedBy: metadata.recordedBy,
    approvedBy: metadata.approvedBy ?? null,
    changeReason: metadata.changeReason,
    supersededBy: latest ? `${latest.id}@v${latest.version}` : undefined,
  };

  return [...others, ...updatedExisting, newRecord];
}

/**
 * Lineage: walk the version chain for a parameter and return the full history
 * sorted from earliest to latest by tx time.
 */
export function getLineage<T>(
  records: BitemporalRecord<T>[],
  logicalId: string,
): BitemporalRecord<T>[] {
  return records
    .filter((r) => r.id === logicalId)
    .sort((a, b) => a.txFrom.localeCompare(b.txFrom));
}

/**
 * Given a set of records and a bitemporal query, build a "parameter snapshot"
 * — a Map of logicalId → value — suitable for feeding into calculatePricing
 * to replay a historical price.
 */
export function buildSnapshot<T>(
  records: BitemporalRecord<T>[],
  query: BitemporalQuery,
): Map<string, T> {
  const results = queryBitemporal(records, query);
  const snapshot = new Map<string, T>();
  for (const r of results) {
    snapshot.set(r.id, r.value);
  }
  return snapshot;
}

/**
 * Lineage metadata for displaying the path from a price component to its
 * source parameter, version, and approver.
 */
export interface LineageEntry {
  parameterId: string;
  parameterName: string;
  version: number;
  value: unknown;
  validFrom: BitemporalDate;
  validTo: BitemporalDate | null;
  recordedBy: string;
  approvedBy: string | null;
  changeReason?: string;
}

/**
 * Build lineage entries for a set of parameter IDs at a given point in time.
 * Used by the UI to render the "click on any number → see its source" navigation.
 */
export function buildLineageReport<T>(
  records: BitemporalRecord<T>[],
  parameterIds: string[],
  query: BitemporalQuery,
  nameLookup?: (id: string) => string,
): LineageEntry[] {
  const entries: LineageEntry[] = [];

  for (const pid of parameterIds) {
    const filtered = records.filter((r) => r.id === pid);
    const matches = queryBitemporal(filtered, query);
    if (matches.length === 0) continue;

    const match = matches[0];
    entries.push({
      parameterId: pid,
      parameterName: nameLookup ? nameLookup(pid) : pid,
      version: match.version,
      value: match.value,
      validFrom: match.validFrom,
      validTo: match.validTo,
      recordedBy: match.recordedBy,
      approvedBy: match.approvedBy,
      changeReason: match.changeReason,
    });
  }

  return entries;
}
