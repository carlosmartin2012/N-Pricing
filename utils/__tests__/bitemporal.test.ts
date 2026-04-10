import { describe, it, expect } from 'vitest';
import {
  queryBitemporal,
  appendVersion,
  getLineage,
  buildSnapshot,
  buildLineageReport,
  type BitemporalRecord,
} from '../pricing/bitemporal';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * Yield curve point EUR_2Y with 3 versions:
 *  - v1: 3.5% recorded 2025-01-01, superseded 2025-03-15 (was wrong)
 *  - v2: 3.6% recorded 2025-03-15, correction still in force for H1 2025
 *  - v3: 3.8% recorded 2025-05-20, takes effect 2025-06-01 onward
 *
 * Plus a second parameter EUR_5Y with a single version for multi-id tests.
 */
const fixtures: BitemporalRecord<number>[] = [
  {
    id: 'EUR_2Y',
    version: 1,
    value: 3.5,
    validFrom: '2025-01-01',
    validTo: '2025-06-01',
    txFrom: '2025-01-01',
    txTo: '2025-03-15',
    recordedBy: 'alice',
    approvedBy: 'bob',
  },
  {
    id: 'EUR_2Y',
    version: 2,
    value: 3.6,
    validFrom: '2025-01-01',
    validTo: '2025-06-01',
    txFrom: '2025-03-15',
    txTo: null,
    recordedBy: 'alice',
    approvedBy: 'bob',
    changeReason: 'Corrected source',
  },
  {
    id: 'EUR_2Y',
    version: 3,
    value: 3.8,
    validFrom: '2025-06-01',
    validTo: null,
    txFrom: '2025-05-20',
    txTo: null,
    recordedBy: 'carol',
    approvedBy: 'bob',
  },
  {
    id: 'EUR_5Y',
    version: 1,
    value: 4.1,
    validFrom: '2025-01-01',
    validTo: null,
    txFrom: '2025-01-01',
    txTo: null,
    recordedBy: 'alice',
    approvedBy: 'bob',
  },
];

// ---------------------------------------------------------------------------
// queryBitemporal — CURRENT
// ---------------------------------------------------------------------------

describe('queryBitemporal — CURRENT mode', () => {
  it('returns the latest open version per logical id', () => {
    const results = queryBitemporal(fixtures, { mode: 'CURRENT' });
    const eur2y = results.find((r) => r.id === 'EUR_2Y');
    const eur5y = results.find((r) => r.id === 'EUR_5Y');
    expect(eur2y?.version).toBe(3);
    expect(eur2y?.value).toBeCloseTo(3.8, 4);
    expect(eur5y?.version).toBe(1);
    expect(eur5y?.value).toBeCloseTo(4.1, 4);
  });

  it('ignores records with closed txTo', () => {
    const results = queryBitemporal(fixtures, { mode: 'CURRENT' });
    for (const r of results) {
      expect(r.txTo).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// queryBitemporal — AS_OF_VALID
// ---------------------------------------------------------------------------

describe('queryBitemporal — AS_OF_VALID mode', () => {
  it('returns the version valid at a given business date (H1 2025)', () => {
    const results = queryBitemporal(fixtures, {
      mode: 'AS_OF_VALID',
      validAt: '2025-04-15',
    });
    const eur2y = results.find((r) => r.id === 'EUR_2Y');
    expect(eur2y?.version).toBe(2); // corrected value still in force H1
    expect(eur2y?.value).toBeCloseTo(3.6, 4);
  });

  it('returns the version valid at a later business date (H2 2025)', () => {
    const results = queryBitemporal(fixtures, {
      mode: 'AS_OF_VALID',
      validAt: '2025-07-01',
    });
    const eur2y = results.find((r) => r.id === 'EUR_2Y');
    expect(eur2y?.version).toBe(3);
    expect(eur2y?.value).toBeCloseTo(3.8, 4);
  });

  it('throws when validAt is not provided', () => {
    expect(() => queryBitemporal(fixtures, { mode: 'AS_OF_VALID' })).toThrow(/validAt required/);
  });
});

// ---------------------------------------------------------------------------
// queryBitemporal — AS_OF_SYSTEM
// ---------------------------------------------------------------------------

describe('queryBitemporal — AS_OF_SYSTEM mode', () => {
  it('returns what the system knew at a past moment (before correction)', () => {
    const results = queryBitemporal(fixtures, {
      mode: 'AS_OF_SYSTEM',
      systemAt: '2025-02-01',
    });
    const eur2y = results.find((r) => r.id === 'EUR_2Y');
    expect(eur2y?.version).toBe(1); // v1 was the only known record at that time
    expect(eur2y?.value).toBeCloseTo(3.5, 4);
  });

  it('returns latest known state after the correction', () => {
    const results = queryBitemporal(fixtures, {
      mode: 'AS_OF_SYSTEM',
      systemAt: '2025-06-15',
    });
    const eur2y = results.find((r) => r.id === 'EUR_2Y');
    // Latest by validFrom is v3 (valid from 2025-06-01), and v3 was known since 2025-05-20
    expect(eur2y?.version).toBe(3);
  });

  it('throws when systemAt is not provided', () => {
    expect(() => queryBitemporal(fixtures, { mode: 'AS_OF_SYSTEM' })).toThrow(
      /systemAt required/,
    );
  });
});

// ---------------------------------------------------------------------------
// queryBitemporal — BITEMPORAL
// ---------------------------------------------------------------------------

describe('queryBitemporal — BITEMPORAL mode', () => {
  it('audit replay: what we knew on 2025-02-01 about the H1 rate', () => {
    const results = queryBitemporal(fixtures, {
      mode: 'BITEMPORAL',
      validAt: '2025-04-15',
      systemAt: '2025-02-01',
    });
    const eur2y = results.find((r) => r.id === 'EUR_2Y');
    // On 2025-02-01 the system still had the wrong value v1 as the H1 rate
    expect(eur2y?.version).toBe(1);
    expect(eur2y?.value).toBeCloseTo(3.5, 4);
  });

  it('audit replay: what we knew on 2025-04-01 about the H1 rate (post-correction)', () => {
    const results = queryBitemporal(fixtures, {
      mode: 'BITEMPORAL',
      validAt: '2025-04-15',
      systemAt: '2025-04-01',
    });
    const eur2y = results.find((r) => r.id === 'EUR_2Y');
    expect(eur2y?.version).toBe(2);
    expect(eur2y?.value).toBeCloseTo(3.6, 4);
  });

  it('throws when validAt or systemAt are missing', () => {
    expect(() =>
      queryBitemporal(fixtures, { mode: 'BITEMPORAL', validAt: '2025-04-15' }),
    ).toThrow(/validAt and systemAt both required/);
    expect(() =>
      queryBitemporal(fixtures, { mode: 'BITEMPORAL', systemAt: '2025-04-15' }),
    ).toThrow(/validAt and systemAt both required/);
  });
});

// ---------------------------------------------------------------------------
// appendVersion
// ---------------------------------------------------------------------------

describe('appendVersion', () => {
  it('closes the previous open tx range and assigns next version number', () => {
    const updated = appendVersion(fixtures, 'EUR_2Y', 3.9, {
      validFrom: '2025-06-01',
      validTo: null,
      txAt: '2025-07-10',
      recordedBy: 'dave',
      approvedBy: 'bob',
      changeReason: 'Re-correction',
    });

    const eur2yVersions = updated.filter((r) => r.id === 'EUR_2Y');
    expect(eur2yVersions).toHaveLength(4);

    // The previously-open v3 should now be closed with txTo = 2025-07-10
    const v3After = eur2yVersions.find((r) => r.version === 3);
    expect(v3After?.txTo).toBe('2025-07-10');

    // The new version is v4 with txTo still null
    const v4 = eur2yVersions.find((r) => r.version === 4);
    expect(v4?.value).toBeCloseTo(3.9, 4);
    expect(v4?.txTo).toBeNull();
    expect(v4?.supersededBy).toBe('EUR_2Y@v3');
  });

  it('does not mutate the input array', () => {
    const snapshot = JSON.parse(JSON.stringify(fixtures));
    appendVersion(fixtures, 'EUR_2Y', 4.0, {
      validFrom: '2025-06-01',
      txAt: '2025-07-10',
      recordedBy: 'dave',
    });
    expect(fixtures).toEqual(snapshot);
  });

  it('supports creating the first version of a brand new parameter', () => {
    const updated = appendVersion(fixtures, 'EUR_10Y', 4.5, {
      validFrom: '2025-01-01',
      txAt: '2025-01-01',
      recordedBy: 'alice',
      approvedBy: 'bob',
    });

    const eur10y = updated.filter((r) => r.id === 'EUR_10Y');
    expect(eur10y).toHaveLength(1);
    expect(eur10y[0].version).toBe(1);
    expect(eur10y[0].supersededBy).toBeUndefined();
    expect(eur10y[0].value).toBeCloseTo(4.5, 4);
  });

  it('defaults approvedBy to null and validTo to null when omitted', () => {
    const updated = appendVersion([], 'NEW_ID', 1.0, {
      validFrom: '2025-01-01',
      txAt: '2025-01-01',
      recordedBy: 'alice',
    });
    expect(updated[0].approvedBy).toBeNull();
    expect(updated[0].validTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLineage
// ---------------------------------------------------------------------------

describe('getLineage', () => {
  it('returns the full history sorted by txFrom ascending', () => {
    const lineage = getLineage(fixtures, 'EUR_2Y');
    expect(lineage).toHaveLength(3);
    expect(lineage.map((r) => r.version)).toEqual([1, 2, 3]);
    // Ensure sorted by txFrom
    for (let i = 1; i < lineage.length; i += 1) {
      expect(lineage[i].txFrom >= lineage[i - 1].txFrom).toBe(true);
    }
  });

  it('returns an empty array for an unknown logical id', () => {
    expect(getLineage(fixtures, 'UNKNOWN_ID')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildSnapshot
// ---------------------------------------------------------------------------

describe('buildSnapshot', () => {
  it('returns a Map keyed by logical id with the matching values', () => {
    const snapshot = buildSnapshot(fixtures, { mode: 'CURRENT' });
    expect(snapshot.size).toBe(2);
    expect(snapshot.get('EUR_2Y')).toBeCloseTo(3.8, 4);
    expect(snapshot.get('EUR_5Y')).toBeCloseTo(4.1, 4);
  });

  it('returns an empty Map when no records match', () => {
    const snapshot = buildSnapshot(fixtures, {
      mode: 'AS_OF_SYSTEM',
      systemAt: '2020-01-01', // before any record exists
    });
    expect(snapshot.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildLineageReport
// ---------------------------------------------------------------------------

describe('buildLineageReport', () => {
  it('returns provenance entries for the requested parameter ids', () => {
    const entries = buildLineageReport(fixtures, ['EUR_2Y', 'EUR_5Y'], { mode: 'CURRENT' });
    expect(entries).toHaveLength(2);

    const eur2y = entries.find((e) => e.parameterId === 'EUR_2Y')!;
    expect(eur2y.version).toBe(3);
    expect(eur2y.recordedBy).toBe('carol');
    expect(eur2y.approvedBy).toBe('bob');
  });

  it('uses the provided nameLookup for human-readable labels', () => {
    const entries = buildLineageReport(
      fixtures,
      ['EUR_2Y'],
      { mode: 'CURRENT' },
      (id) => `Curve point ${id}`,
    );
    expect(entries[0].parameterName).toBe('Curve point EUR_2Y');
  });

  it('skips parameter ids with no matching records', () => {
    const entries = buildLineageReport(fixtures, ['EUR_2Y', 'GHOST_ID'], { mode: 'CURRENT' });
    expect(entries).toHaveLength(1);
    expect(entries[0].parameterId).toBe('EUR_2Y');
  });
});

// ---------------------------------------------------------------------------
// Date range edge cases
// ---------------------------------------------------------------------------

describe('date range edge cases', () => {
  const edgeFixtures: BitemporalRecord<number>[] = [
    {
      id: 'RATE',
      version: 1,
      value: 1.0,
      validFrom: '2025-01-01',
      validTo: '2025-02-01',
      txFrom: '2025-01-01',
      txTo: null,
      recordedBy: 'alice',
      approvedBy: 'bob',
    },
    {
      id: 'RATE',
      version: 2,
      value: 2.0,
      validFrom: '2025-02-01',
      validTo: null,
      txFrom: '2025-01-15',
      txTo: null,
      recordedBy: 'alice',
      approvedBy: 'bob',
    },
  ];

  it('validFrom is inclusive', () => {
    const results = queryBitemporal(edgeFixtures, {
      mode: 'AS_OF_VALID',
      validAt: '2025-01-01',
    });
    expect(results[0].version).toBe(1);
    expect(results[0].value).toBeCloseTo(1.0, 4);
  });

  it('validTo is exclusive — boundary date falls into next version', () => {
    const results = queryBitemporal(edgeFixtures, {
      mode: 'AS_OF_VALID',
      validAt: '2025-02-01',
    });
    expect(results[0].version).toBe(2);
    expect(results[0].value).toBeCloseTo(2.0, 4);
  });
});
