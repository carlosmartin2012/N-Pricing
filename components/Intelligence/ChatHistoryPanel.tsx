import React from 'react';
import { Bot, History } from 'lucide-react';
import type { ChatSession } from './genAIChatUtils';

interface Props {
  sessions: ChatSession[];
  activeSessionId: string;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
}

export const ChatHistoryPanel: React.FC<Props> = ({
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
}) => {
  return (
    <div className="hidden w-64 flex-col border-r border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] md:flex">
      <div className="border-b border-[color:var(--nfq-border-ghost)] p-4">
        <button
          onClick={onCreateSession}
          className="flex w-full items-center justify-center gap-2 rounded border border-[color:var(--nfq-accent)] bg-[var(--nfq-accent)]/20 py-2 text-xs font-bold text-[color:var(--nfq-accent)] transition-colors hover:bg-[var(--nfq-accent)]/40"
        >
          <Bot size={14} /> New Session
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        <div className="px-2 py-2 text-[10px] font-bold uppercase text-[color:var(--nfq-text-faint)]">
          Recent Inquiries
        </div>
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={`group flex w-full items-center gap-3 rounded px-3 py-2 text-left text-xs transition-colors ${
              session.id === activeSessionId
                ? 'bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-accent)]'
                : 'text-[color:var(--nfq-text-muted)] hover:bg-[var(--nfq-bg-highest)]'
            }`}
          >
            <History
              size={12}
              className={
                session.id === activeSessionId
                  ? 'text-[color:var(--nfq-accent)]'
                  : 'text-[color:var(--nfq-text-faint)] group-hover:text-[color:var(--nfq-accent)]'
              }
            />
            <span className="truncate">{session.title}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-[color:var(--nfq-border-ghost)] p-4 text-center font-mono text-[10px] text-[color:var(--nfq-text-faint)]">
        N Pricing v2.5.1
      </div>
    </div>
  );
};
