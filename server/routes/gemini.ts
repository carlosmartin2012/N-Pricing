import { Router } from 'express';

const router = Router();

router.post('/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Gemini API key not configured' });
  }
  try {
    const { contents, model = 'gemini-2.0-flash' } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Gemini API error', details: data.error?.message });
    }
    res.json(data);
  } catch (err) {
    console.error('[gemini] proxy error', err);
    res.status(500).json({ error: 'Gemini proxy error' });
  }
});

export default router;
