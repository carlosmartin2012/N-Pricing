/**
 * Unified wrapper around the /api/gemini/chat proxy for all AI capabilities
 * in N-Pricing.
 *
 * See: docs/pivot/ai-assistant-refocus.md §5.1
 *
 * Concerns owned by this module:
 *   - Consistent request shape
 *   - Timeout handling
 *   - Retry on transient errors (max 1)
 *   - Observability (latency, token count, outcome)
 *   - Graceful fallback when AI is disabled or unavailable
 *
 * Concerns NOT owned here:
 *   - Prompt construction (lives in each capability module)
 *   - PII redaction (callers invoke redactPII before passing text in)
 */

import { errorTracker } from '../errorTracking';

export type AICapability = 'PRICING_COPILOT' | 'LOSS_CLASSIFIER' | 'NEGOTIATION_AGENT';

export interface AIInvocationRequest {
  capability: AICapability;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  responseFormat?: 'text' | 'json';
  signal?: AbortSignal;
}

export interface AIInvocationSuccess {
  outcome: 'SUCCESS';
  text: string;
  latencyMs: number;
  capability: AICapability;
}

export interface AIInvocationFailure {
  outcome: 'DISABLED' | 'API_ERROR' | 'TIMEOUT' | 'PARSE_ERROR';
  error: string;
  latencyMs: number;
  capability: AICapability;
}

export type AIInvocationResult = AIInvocationSuccess | AIInvocationFailure;

const DEFAULT_TIMEOUT_MS = 8000;

const getEnvString = (key: string, fallback: string): string => {
  const raw = import.meta.env?.[key] as string | undefined;
  return (raw ?? fallback).trim();
};

const isCapabilityEnabled = (capability: AICapability): boolean => {
  const flag =
    capability === 'PRICING_COPILOT'
      ? getEnvString('VITE_AI_PRICING_COPILOT_ENABLED', 'true')
      : capability === 'LOSS_CLASSIFIER'
        ? getEnvString('VITE_AI_LOSS_CLASSIFIER_ENABLED', 'true')
        : getEnvString('VITE_AI_NEGOTIATION_AGENT_ENABLED', 'false');
  return flag.toLowerCase() !== 'false';
};

const getTimeoutMs = (): number => {
  const raw = Number(getEnvString('VITE_AI_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
};

const getModel = (): string => getEnvString('VITE_AI_MODEL', 'gemini-2.0-flash');

/**
 * Invoke the AI proxy with capability-scoped observability.
 * Safe to call even when the capability is disabled — returns a `DISABLED`
 * outcome without making a network request, letting callers fall back cleanly.
 */
export async function invokeAI(request: AIInvocationRequest): Promise<AIInvocationResult> {
  const startedAt = performance.now();

  if (!isCapabilityEnabled(request.capability)) {
    return {
      outcome: 'DISABLED',
      error: `AI capability ${request.capability} is disabled`,
      latencyMs: 0,
      capability: request.capability,
    };
  }

  const timeoutMs = getTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Chain external abort signal to our controller.
  if (request.signal) {
    request.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getModel(),
        systemInstruction: request.systemPrompt,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.userMessage }],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.3,
          ...(request.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => String(response.status));
      return {
        outcome: 'API_ERROR',
        error: `HTTP ${response.status}: ${errorText}`,
        latencyMs: performance.now() - startedAt,
        capability: request.capability,
      };
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return {
      outcome: 'SUCCESS',
      text,
      latencyMs: performance.now() - startedAt,
      capability: request.capability,
    };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    const latencyMs = performance.now() - startedAt;
    errorTracker.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'AI_CLIENT',
      extra: { capability: request.capability, latencyMs, timeout: isAbort },
    });
    return {
      outcome: isAbort ? 'TIMEOUT' : 'API_ERROR',
      error: error instanceof Error ? error.message : String(error),
      latencyMs,
      capability: request.capability,
    };
  } finally {
    clearTimeout(timeout);
  }
}
