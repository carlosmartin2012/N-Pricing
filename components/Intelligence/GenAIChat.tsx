import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../ui/LayoutComponents';
import type { Transaction } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { createLogger } from '../../utils/logger';
import { appendAITraceToPricingDossier, buildAIResponseTrace, resolveChatGrounding } from '../../utils/aiGrounding';
import { supabaseService } from '../../utils/supabaseService';
import { ChatComposer } from './ChatComposer';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { ChatMessageList } from './ChatMessageList';
import {
  buildChatContents,
  buildChatSystemPrompt,
  buildSessionTitle,
  createDefaultChatSession,
  createWelcomeMessage,
  streamGeminiResponse,
  type ChatMessage,
  type ChatSession,
} from './genAIChatUtils';

interface Props {
  deals: Transaction[];
  marketSummary: string;
}

const log = createLogger('GenAIChat');

const GenAIChat: React.FC<Props> = ({ deals, marketSummary }) => {
  const data = useData();
  const { currentUser } = useAuth();
  const initialSessionRef = useRef<ChatSession | null>(null);
  if (!initialSessionRef.current) {
    initialSessionRef.current = createDefaultChatSession();
  }

  const [sessions, setSessions] = useState<ChatSession[]>(() => [initialSessionRef.current!]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => initialSessionRef.current!.id);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  // Auto-scroll to bottom — block:'nearest' prevents scrolling the outer page
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSession?.messages, isThinking]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
    };
  }, []);

  function updateActiveSession(updater: (session: ChatSession) => ChatSession) {
    setSessions((previousSessions) =>
      previousSessions.map((session) => (session.id === activeSessionId ? updater(session) : session))
    );
  }

  function resetSession(sessionId: string) {
    setSessions((previousSessions) =>
      previousSessions.map((session) =>
        session.id === sessionId ? { ...session, title: 'New Session', messages: [createWelcomeMessage()] } : session
      )
    );
  }

  const handleCreateSession = () => {
    requestAbortRef.current?.abort();
    const newSession = createDefaultChatSession();
    setSessions((previousSessions) => [newSession, ...previousSessions].slice(0, 8));
    setActiveSessionId(newSession.id);
    setInput('');
    setIsThinking(false);
  };

  const handleSelectSession = (sessionId: string) => {
    requestAbortRef.current?.abort();
    setActiveSessionId(sessionId);
    setInput('');
    setIsThinking(false);
  };

  const handleResetSession = () => {
    requestAbortRef.current?.abort();
    if (activeSession) {
      resetSession(activeSession.id);
    }
    setInput('');
    setIsThinking(false);
  };

  const handleSendMessage = async (overrideInput?: string) => {
    const trimmedInput = (overrideInput ?? input).trim();
    if (!trimmedInput || !activeSession) {
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      updateActiveSession((session) => ({
        ...session,
        messages: [
          ...session.messages,
          {
            id: Date.now().toString(),
            role: 'model',
            content: 'Error: VITE_GEMINI_API_KEY not configured',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      }));
      setInput('');
      return;
    }

    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    requestAbortRef.current = abortController;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date().toLocaleTimeString(),
    };
    const modelMessageId = `${Date.now() + 1}`;
    const pendingModelMessage: ChatMessage = {
      id: modelMessageId,
      role: 'model',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
    };

    const grounding = resolveChatGrounding({
      input: trimmedInput,
      deals,
      pricingDossiers: data.pricingDossiers,
      methodologyVersions: data.methodologyVersions,
      marketDataSources: data.marketDataSources,
      portfolioSnapshots: data.portfolioSnapshots,
    });
    const nextMessages = [...activeSession.messages, userMessage, pendingModelMessage];
    const systemPrompt = buildChatSystemPrompt(deals, marketSummary, grounding.summary);
    const contents = buildChatContents(activeSession.messages, trimmedInput);
    const modelName = 'gemini-2.0-flash';

    updateActiveSession((session) => ({
      ...session,
      title: session.messages.length > 1 ? session.title : buildSessionTitle(trimmedInput),
      messages: nextMessages,
    }));
    setInput('');
    setIsThinking(true);

    try {
      const fullResponse = await streamGeminiResponse(
        apiKey,
        systemPrompt,
        contents,
        abortController.signal,
        (partialResponse) => {
          setSessions((previousSessions) =>
            previousSessions.map((session) =>
              session.id === activeSession.id
                ? {
                    ...session,
                    messages: session.messages.map((message) =>
                      message.id === modelMessageId ? { ...message, content: partialResponse } : message
                    ),
                  }
                : session
            )
          );
        }
      );

      if (!fullResponse) {
        setSessions((previousSessions) =>
          previousSessions.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  messages: session.messages.map((message) =>
                    message.id === modelMessageId ? { ...message, content: 'No response returned by Gemini.' } : message
                  ),
                }
              : session
          )
        );
      } else {
        const trace = buildAIResponseTrace({
          model: modelName,
          groundedContext: grounding.groundedContext,
          sources: grounding.sources,
          prompt: trimmedInput,
          response: fullResponse,
          dossier: grounding.dossier,
          portfolioSnapshots: data.portfolioSnapshots,
        });

        setSessions((previousSessions) =>
          previousSessions.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  messages: session.messages.map((message) =>
                    message.id === modelMessageId ? { ...message, content: fullResponse, trace } : message
                  ),
                }
              : session
          )
        );

        if (grounding.dossier && currentUser) {
          const nextDossiers = data.pricingDossiers.map((dossier) =>
            dossier.id === grounding.dossier?.id
              ? appendAITraceToPricingDossier(dossier, trace, currentUser.email, currentUser.name)
              : dossier
          );

          data.setPricingDossiers(nextDossiers);
          await supabaseService.savePricingDossiers(nextDossiers);
          await supabaseService.addAuditEntry({
            userEmail: currentUser.email,
            userName: currentUser.name,
            action: 'GENERATE_AI_TRACE',
            module: 'INTELLIGENCE',
            description: `Generated grounded AI trace for dossier ${grounding.dossier.dealId}`,
            details: {
              dossierId: grounding.dossier.id,
              traceId: trace.id,
              methodologyVersionId: trace.groundedContext.methodologyVersionId,
              portfolioSnapshotId: trace.groundedContext.portfolioSnapshotId,
              marketDataSourceIds: trace.groundedContext.marketDataSourceIds || [],
            },
          });
        }
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      log.error('Gemini request failed', {}, error instanceof Error ? error : undefined);
      const message = error instanceof Error ? error.message : 'Neural Link Interrupted. Connection to Core AI Failed.';

      setSessions((previousSessions) =>
        previousSessions.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                messages: session.messages.map((chatMessage) =>
                  chatMessage.id === modelMessageId ? { ...chatMessage, content: `Error: ${message}` } : chatMessage
                ),
              }
            : session
        )
      );
    } finally {
      if (requestAbortRef.current === abortController) {
        requestAbortRef.current = null;
      }
      setIsThinking(false);
    }
  };

  if (!activeSession) {
    return null;
  }

  return (
    <Panel className="h-full overflow-hidden border-0 bg-slate-950 p-0">
      <div className="flex h-full">
        <ChatHistoryPanel
          sessions={sessions}
          activeSessionId={activeSession.id}
          onCreateSession={handleCreateSession}
          onSelectSession={handleSelectSession}
        />

        <div className="relative flex flex-1 flex-col bg-slate-950">
          <ChatComposer
            input={input}
            isThinking={isThinking}
            onChangeInput={setInput}
            onSendMessage={handleSendMessage}
            onResetSession={handleResetSession}
          />

          <ChatMessageList messages={activeSession.messages} isThinking={isThinking} scrollRef={scrollRef} />
        </div>
      </div>
    </Panel>
  );
};

export default GenAIChat;
