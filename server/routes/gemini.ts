import { Router } from 'express';

const router = Router();

// Allowlist of Gemini model ids we are willing to proxy. Anything not in this
// list is rejected — the raw model name is interpolated into the Gemini URL
// path, so without this guard a caller could steer the request to arbitrary
// endpoints under generativelanguage.googleapis.com.
const ALLOWED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);
const DEFAULT_MODEL = 'gemini-2.0-flash';
const GEMINI_TIMEOUT_MS = 30_000;

router.post('/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Gemini API key not configured' });
  }

  const body = req.body ?? {};
  const contents = body.contents;
  const rawModel = typeof body.model === 'string' ? body.model : DEFAULT_MODEL;
  const model = ALLOWED_MODELS.has(rawModel) ? rawModel : DEFAULT_MODEL;

  if (!Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ error: 'contents array required' });
  }

  // Timeout so a hung upstream does not pin our connection indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass the key in a header — never in the URL — so it is not logged
        // by upstream proxies or preserved in any request history.
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Gemini API error',
        details: data?.error?.message,
      });
    }
    res.json(data);
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    console.error('[gemini] proxy error', err);
    res
      .status(aborted ? 504 : 500)
      .json({ error: aborted ? 'Gemini proxy timeout' : 'Gemini proxy error' });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
