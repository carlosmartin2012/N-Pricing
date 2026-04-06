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
    <div className="hidden w-64 flex-col border-r border-slate-800 bg-slate-900 md:flex">
      <div className="border-b border-slate-800 p-4">
        <button
          onClick={onCreateSession}
          className="flex w-full items-center justify-center gap-2 rounded border border-cyan-800 bg-cyan-900/20 py-2 text-xs font-bold text-cyan-400 transition-colors hover:bg-cyan-900/40"
        >
          <Bot size={14} /> New Session
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        <div className="px-2 py-2 text-[10px] font-bold uppercase text-slate-500">
          Recent Inquiries
        </div>
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={`group flex w-full items-center gap-3 rounded px-3 py-2 text-left text-xs transition-colors ${
              session.id === activeSessionId
                ? 'bg-slate-800 text-cyan-400'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <History
              size={12}
              className={
                session.id === activeSessionId
                  ? 'text-cyan-500'
                  : 'text-slate-600 group-hover:text-cyan-500'
              }
            />
            <span className="truncate">{session.title}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-slate-800 p-4 text-center font-mono text-[10px] text-slate-600">
        N Pricing v2.5.1
      </div>
    </div>
  );
};
