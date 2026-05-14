import express, { Router, Request, Response } from 'express';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('csp');

// Browsers send CSP reports with `application/csp-report` (legacy) or
// `application/reports+json` (Reporting API). The global express.json() only
// parses `application/json`, so we add a route-scoped parser that accepts
// these MIME types too. 64KB cap is generous — real reports are < 2KB.
router.use(express.json({
  type: ['application/json', 'application/csp-report', 'application/reports+json'],
  limit: '64kb',
}));

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

function normalize(body: unknown): {
  directive: string;
  blocked: string;
  source: string;
  documentUri: string;
} | null {
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

router.post('/', (req: Request, res: Response) => {
  const report = normalize(req.body);
  if (report) {
    logger.warn('violation', report as unknown as Record<string, unknown>);
  }
  res.status(204).end();
});

export default router;
