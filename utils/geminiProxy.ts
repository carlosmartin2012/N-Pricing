/**
 * Gemini proxy utility — routes all Gemini AI calls through the server proxy
 * at `/api/gemini/chat` instead of calling the Gemini SDK directly.
 *
 * This keeps the API key server-side and never exposes it in the client bundle.
 */

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('n_pricing_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Simple non-streaming call to the Gemini server proxy.
 */
export async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
  };

  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini proxy error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Streaming call to the Gemini server proxy. Returns the full accumulated
 * response and fires `onChunk` with the growing text after each SSE chunk.
 */
export async function streamGemini(
  prompt: string,
  opts?: {
    systemInstruction?: string;
    conversationHistory?: Array<{ role: string; parts: Array<{ text: string }> }>;
    model?: string;
    temperature?: number;
    signal?: AbortSignal;
    onChunk?: (accumulated: string) => void;
  },
): Promise<string> {
  const contents = [
    ...(opts?.conversationHistory ?? []),
    { role: 'user', parts: [{ text: prompt }] },
  ];

  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      contents,
      model: opts?.model ?? 'gemini-2.0-flash',
      ...(opts?.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
      generationConfig: { temperature: opts?.temperature ?? 0.5 },
      stream: true,
    }),
    signal: opts?.signal,
  });

  if (!res.ok) {
    throw new Error(`Gemini proxy error: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Gemini proxy returned no response body');
  }

  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (!json || json === '[DONE]') continue;
      try {
        const parsed = JSON.parse(json);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          fullResponse += text;
          opts?.onChunk?.(fullResponse);
        }
      } catch {
        // Ignore malformed SSE chunks
      }
    }
  }

  return fullResponse;
}
