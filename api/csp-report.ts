/**
 * Vercel Serverless Function — CSP violation receiver.
 *
 * In deployments where the Express server is co-located (Replit, self-hosted),
 * `server/routes/cspReport.ts` handles `/api/csp-report`. In Vercel-only
 * deploys the SPA is static and `/api/*` does not reach Express, so this
 * file is the receiver. The logic mirrors the Express router but writes to
 * stdout/stderr (Vercel captures both into the Function logs).
 *
 * Browsers post CSP reports with two MIME types:
 * - `application/csp-report` (legacy `report-uri` directive)
 * - `application/reports+json` (Reporting API `report-to`)
 *
 * Vercel auto-parses JSON when `content-type: application/json`, but does
 * not parse the other two. We read the raw body for both.
 */

export const config = {
  runtime: 'nodejs',
  maxDuration: 5,
};

type LegacyCspReport = {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'blocked-uri'?: string;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
    'status-code'?: number;
    referrer?: string;
  };
};

type ReportingApiEntry = {
  type?: string;
  age?: number;
  url?: string;
  body?: {
    documentURL?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    sample?: string;
  };
};

type Normalized = {
  directive: string;
  blocked: string;
  source: string;
  documentUri: string;
};

function normalize(body: unknown): Normalized | null {
  if (Array.isArray(body)) {
    const csp = (body as ReportingApiEntry[]).find((r) => r?.type === 'csp-violation');
    if (!csp?.body) return null;
    return {
      directive: csp.body.effectiveDirective ?? 'unknown',
      blocked: csp.body.blockedURL ?? 'unknown',
      source: `${csp.body.sourceFile ?? ''}:${csp.body.lineNumber ?? ''}`,
      documentUri: csp.body.documentURL ?? '',
    };
  }
  const legacy = (body as LegacyCspReport)?.['csp-report'];
  if (!legacy) return null;
  return {
    directive: legacy['effective-directive'] ?? legacy['violated-directive'] ?? 'unknown',
    blocked: legacy['blocked-uri'] ?? 'unknown',
    source: `${legacy['source-file'] ?? ''}:${legacy['line-number'] ?? ''}`,
    documentUri: legacy['document-uri'] ?? '',
  };
}

async function readRawBody(req: { on: (e: string, cb: (chunk: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const LIMIT = 64 * 1024;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > LIMIT) {
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on: (event: string, cb: (chunk: Buffer) => void) => void;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  end: (body?: string) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  let body: unknown = req.body;
  if (body === undefined || (typeof body === 'string' && body.length === 0)) {
    try {
      const raw = await readRawBody(req);
      body = raw ? JSON.parse(raw) : null;
    } catch {
      res.status(204).end();
      return;
    }
  }

  const report = normalize(body);
  if (report) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        scope: 'csp',
        event: 'violation',
        ...report,
      }),
    );
  }
  res.status(204).end();
}
