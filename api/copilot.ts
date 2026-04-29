import { apiPost } from '../utils/apiFetch';
import type { CopilotAskRequest, CopilotAskResponse } from '../types/copilot';

/**
 * Cmd+K Copilot — client HTTP layer (Ola 7 Bloque C.3).
 *
 * Calls POST /api/copilot/ask. Throws on non-2xx so consumers can map
 * 429 (rate limit) and 503 (no API key) to friendly UI states.
 */
export async function askCopilot(request: CopilotAskRequest): Promise<CopilotAskResponse> {
  return apiPost<CopilotAskResponse>('/copilot/ask', request);
}
