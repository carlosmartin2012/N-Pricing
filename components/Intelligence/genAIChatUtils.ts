import type { AIResponseTrace, Transaction } from '../../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  trace?: AIResponseTrace;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export const GENAI_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  content:
    'N-Pricing Copilot ready. I can explain pricing waterfalls, suggest counteroffers within delegation limits, analyze RAROC breakdowns, and review Anejo IX credit risk. Use the quick actions above or ask about any deal in the blotter.',
  timestamp: new Date().toLocaleTimeString(),
};

export function createWelcomeMessage(): ChatMessage {
  return {
    ...GENAI_WELCOME_MESSAGE,
    timestamp: new Date().toLocaleTimeString(),
  };
}

export function createDefaultChatSession(): ChatSession {
  return {
    id: `session-${Date.now()}`,
    title: 'New Session',
    messages: [createWelcomeMessage()],
  };
}

export function buildChatSystemPrompt(deals: Transaction[], marketSummary: string, groundingSummary = '') {
  const totalVolume = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const averageMargin = deals.length
    ? (deals.reduce((sum, deal) => sum + deal.marginTarget, 0) / deals.length).toFixed(2)
    : '0';
  const dealCount = deals.length;

  return `
    You are the N-Pricing Copilot, an expert in Funds Transfer Pricing for Spanish banks.

    When the user asks to explain pricing or "explain the waterfall":
    - Break down each component: Base Rate, Liquidity Premium, Strategic Spread, Credit Cost (Anejo IX), Capital Charge, ESG charges.
    - Explain WHY each value is what it is (e.g., "The base rate of 3.2% comes from the EUR yield curve interpolated at 60-month tenor").
    - Highlight if the deal is priced above or below the technical price.
    - Flag the RAROC level and approval implications.

    When the user asks for a counteroffer or "what rate should I offer":
    - Calculate the minimum rate needed to meet the hurdle rate.
    - Show the margin breakdown: minimum = floor price, recommended = technical price + target margin.
    - If the current margin is below hurdle, explain what needs to change (rate, tenor, collateral, etc.).

    When the user asks about Anejo IX or credit risk:
    - Explain the segment classification and why this deal falls into its segment.
    - Show the coverage percentage applied and how guarantees reduce it.
    - Explain the forward-looking scenario impact.

    When the user asks about RAROC:
    - Break down the RAROC formula: (Net Income - Expected Loss - Capital Charge) / Allocated Capital.
    - Explain how each input feeds into the result.
    - Show the approval level thresholds and where this deal lands.
    - Suggest levers to improve RAROC (margin, fees, collateral, tenor).

    Always use professional financial language. Format numbers with 2-3 decimal places. Reference regulatory sources (Circular 6/2021, CRR3, EBA GL) when relevant.

    GLOBAL DATA CONTEXT:
    - Total Booked Deals: ${dealCount}
    - Total Portfolio Volume (approx): $${(totalVolume / 1_000_000).toFixed(1)}M
    - Average Commercial Margin: ${averageMargin}%
    - Market Conditions: ${marketSummary}
    - Full Blotter JSON (Sample): ${JSON.stringify(deals.slice(0, 3))}... (and ${Math.max(0, deals.length - 3)} more)
    ${groundingSummary ? `\n${groundingSummary}\n` : ''}

    INSTRUCTIONS:
    - You are helpful, professional, and precise.
    - Answer general questions about FTP methodology (Matched Maturity, Curves).
    - Answer specific questions about the portfolio stats provided above.
    - When grounding artifacts are available, cite their IDs in your answer.
    - Do not imply certainty about a dossier, snapshot, or methodology version that was not provided in the grounding section.
    - When pricing result data is available in the grounding context, use the actual numbers to explain the waterfall breakdown.
    - If asked to write SQL or Code, provide it in a clean format.
    - Keep responses concise and industrial in tone.
  `;
}

export function buildChatContents(messages: ChatMessage[], input: string) {
  const contents = messages
    .filter((message) => message.id !== 'welcome')
    .map((message) => ({
      role: message.role,
      parts: [{ text: message.content }],
    }));

  contents.push({ role: 'user', parts: [{ text: input }] });
  return contents;
}

export function buildSessionTitle(input: string) {
  const normalized = input.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return 'New Session';
  }

  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
}

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('n_pricing_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function streamGeminiResponse(
  _apiKey: string,
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  signal?: AbortSignal,
  onChunk?: (text: string) => void
) {
  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      contents,
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.5 },
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Gemini API ${response.status}: ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Gemini API returned no response body');
  }

  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }

      const json = line.slice(6).trim();
      if (!json || json === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(json);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          fullResponse += text;
          onChunk?.(fullResponse);
        }
      } catch {
        // Ignore malformed SSE chunks and continue streaming.
      }
    }
  }

  return fullResponse;
}
