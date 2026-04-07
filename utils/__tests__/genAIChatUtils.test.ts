import { describe, expect, it } from 'vitest';
import {
  buildChatContents,
  buildChatSystemPrompt,
  buildSessionTitle,
  createDefaultChatSession,
} from '../../components/Intelligence/genAIChatUtils';

describe('genAIChatUtils', () => {
  it('creates a default session with a welcome message', () => {
    const session = createDefaultChatSession();

    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].role).toBe('model');
    expect(session.messages[0].content).toContain('N-Pricing Copilot ready');
  });

  it('builds compact session titles from the first prompt', () => {
    expect(buildSessionTitle('  Explain EUR liquidity stress  ')).toBe('Explain EUR liquidity stress');
    expect(buildSessionTitle('')).toBe('New Session');
  });

  it('omits the welcome message from chat history contents', () => {
    const session = createDefaultChatSession();
    const contents = buildChatContents(session.messages, 'How many approved deals do we have?');

    expect(contents).toEqual([{ role: 'user', parts: [{ text: 'How many approved deals do we have?' }] }]);
  });

  it('injects grounding instructions into the system prompt when available', () => {
    const prompt = buildChatSystemPrompt([], 'USD curve stable', 'GROUNDING CONTEXT:\n- Pricing Dossier: DOS-1');

    expect(prompt).toContain('GROUNDING CONTEXT');
    expect(prompt).toContain('cite their IDs');
  });
});
