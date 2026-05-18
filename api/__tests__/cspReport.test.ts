import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import handler from '../csp-report';

type FakeReq = {
  method?: string;
  headers: Record<string, string>;
  body?: unknown;
  on: (event: string, cb: (chunk: Buffer) => void) => void;
};

type FakeRes = {
  statusCode: number;
  ended: boolean;
  endedBody?: string;
  status: (code: number) => FakeRes;
  end: (body?: string) => void;
};

function makeReq(method: string, body?: unknown): FakeReq {
  return {
    method,
    headers: {},
    body,
    on: (event, cb) => {
      if (event === 'end') {
        queueMicrotask(() => cb(Buffer.alloc(0)));
      }
    },
  };
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    end(body) {
      this.ended = true;
      this.endedBody = body;
    },
  };
  return res;
}

describe('api/csp-report serverless handler', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns 405 for non-POST', async () => {
    const req = makeReq('GET');
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs a normalized legacy csp-report payload', async () => {
    const req = makeReq('POST', {
      'csp-report': {
        'document-uri': 'https://app.example.com/page',
        'violated-directive': 'script-src',
        'effective-directive': 'script-src',
        'blocked-uri': 'https://evil.example.com/x.js',
        'source-file': 'inline',
        'line-number': 42,
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(warnSpy.mock.calls[0]?.[0] as string);
    expect(payload).toMatchObject({
      level: 'warn',
      scope: 'csp',
      event: 'violation',
      directive: 'script-src',
      blocked: 'https://evil.example.com/x.js',
      source: 'inline:42',
      documentUri: 'https://app.example.com/page',
    });
  });

  it('logs a normalized Reporting API payload', async () => {
    const req = makeReq('POST', [
      {
        type: 'csp-violation',
        body: {
          documentURL: 'https://app.example.com/page',
          effectiveDirective: 'connect-src',
          blockedURL: 'https://disallowed.example.com/endpoint',
          sourceFile: 'main.js',
          lineNumber: 7,
        },
      },
    ]);
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(warnSpy.mock.calls[0]?.[0] as string);
    expect(payload).toMatchObject({
      directive: 'connect-src',
      blocked: 'https://disallowed.example.com/endpoint',
      source: 'main.js:7',
    });
  });

  it('returns 204 silently on unrecognized payload', async () => {
    const req = makeReq('POST', { something: 'else' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
