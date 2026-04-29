import { describe, expect, it } from 'vitest';
import {
  extractValidatedCitations,
  filterValidCitations,
} from '../copilot/citationValidator';

describe('extractValidatedCitations', () => {
  it('extracts EBA GL refs with section', () => {
    const out = extractValidatedCitations('Per EBA GL 2018/02 §3.4 the shock is parallel.');
    expect(out.map((c) => c.label)).toEqual(['EBA GL 2018/02 §3.4']);
  });

  it('extracts EBA GL refs without section', () => {
    const out = extractValidatedCitations('See EBA GL 2018/02 for the shocks.');
    expect(out[0]?.label).toBe('EBA GL 2018/02');
  });

  it('extracts CRR Art. references with article+subsection', () => {
    const out = extractValidatedCitations('CRR3 Art. 501a(1) introduces the ISF.');
    expect(out.map((c) => c.label)).toEqual(['CRR3 Art. 501a(1)']);
  });

  it('accepts the Spanish "Artículo" alias', () => {
    const out = extractValidatedCitations('CRR3 Artículo 501a aplica.');
    expect(out.map((c) => c.label)).toEqual(['CRR3 Artículo 501a']);
  });

  it('extracts Anejo IX with section', () => {
    const out = extractValidatedCitations('Para Corporates ver Anejo IX §3.1.');
    expect(out[0]?.label).toBe('Anejo IX §3.1');
  });

  it('extracts SR 11-7, IFRS 9 and BCBS refs', () => {
    const out = extractValidatedCitations('Per SR 11-7 and IFRS 9 §5.5 we follow BCBS 239.');
    expect(out.map((c) => c.label)).toEqual([
      'SR 11-7',
      'IFRS 9 §5.5',
      'BCBS 239',
    ]);
  });

  it('dedupes repeated references', () => {
    const out = extractValidatedCitations('EBA GL 2018/02 says X. Again, EBA GL 2018/02 says Y.');
    expect(out).toHaveLength(1);
  });

  it('returns empty array for non-regulatory text', () => {
    const out = extractValidatedCitations('Bajar el margen 5 bps mejora la conversion.');
    expect(out).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(extractValidatedCitations('')).toEqual([]);
  });

  it('normalizes whitespace inside extracted labels', () => {
    const out = extractValidatedCitations('See   EBA   GL   2018/02   §3.4 carefully.');
    expect(out[0]?.label).toBe('EBA GL 2018/02 §3.4');
  });
});

describe('filterValidCitations', () => {
  it('keeps valid candidates and rejects free-form text', () => {
    const out = filterValidCitations([
      'EBA GL 2018/02 §3.4',
      'Some random sentence',
      'CRR3 Art. 501a',
      '',
      'Made-up Reg ABC-123',
    ]);
    expect(out.map((c) => c.label)).toEqual([
      'EBA GL 2018/02 §3.4',
      'CRR3 Art. 501a',
    ]);
  });

  it('dedupes equivalent candidates after whitespace normalization', () => {
    const out = filterValidCitations([
      'EBA   GL 2018/02',
      'EBA GL 2018/02',
    ]);
    expect(out).toHaveLength(1);
  });

  it('returns empty array on empty input', () => {
    expect(filterValidCitations([])).toEqual([]);
  });
});
