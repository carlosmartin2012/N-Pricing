import { useMutation } from '@tanstack/react-query';
import * as copilotApi from '../../api/copilot';
import type { CopilotAskRequest, CopilotAskResponse } from '../../types/copilot';

/**
 * useCopilotAsk — React Query mutation wrapper for the Cmd+K Ask
 * flow (Ola 7 Bloque C.3).
 *
 * Returns the standard mutation surface (mutate, mutateAsync, isPending,
 * isError, data). The CommandPalette consumer triggers `mutate` on
 * submit and renders the response inline. Errors are bubbled — the
 * UI shows different copy for 429/503 vs generic errors based on the
 * Error message thrown by `apiFetch`.
 */
export function useCopilotAsk() {
  return useMutation<CopilotAskResponse, Error, CopilotAskRequest>({
    mutationFn: (request) => copilotApi.askCopilot(request),
    retry: false,
  });
}
