import React from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatMessage } from './genAIChatUtils';

interface Props {
  messages: ChatMessage[];
  isThinking: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatMessageList: React.FC<Props> = ({ messages, isThinking, scrollRef }) => {
  return (
    <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-6">
      {messages.map((message) => (
        <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {message.role === 'model' && (
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-800 bg-cyan-900/20">
              <Bot size={16} className="text-cyan-400" />
            </div>
          )}

          <div className={`flex max-w-[80%] flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`rounded-lg px-4 py-3 text-sm leading-relaxed shadow-sm ${
                message.role === 'user'
                  ? 'border border-slate-700 bg-slate-800 text-slate-200'
                  : 'border border-slate-800 bg-slate-900 text-slate-300'
              }`}
            >
              <span className="whitespace-pre-wrap font-sans">{message.content}</span>
            </div>
            <span className="mt-1 font-mono text-[10px] text-slate-600">{message.timestamp}</span>
            {message.role === 'model' && message.trace && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.trace.groundedContext.dossierId && (
                  <span className="rounded-full border border-cyan-800/60 bg-cyan-950/40 px-2 py-1 font-mono text-[10px] text-cyan-300">
                    DOS {message.trace.groundedContext.dossierId}
                  </span>
                )}
                {message.trace.groundedContext.methodologyVersionId && (
                  <span className="rounded-full border border-emerald-800/60 bg-emerald-950/30 px-2 py-1 font-mono text-[10px] text-emerald-300">
                    METH {message.trace.groundedContext.methodologyVersionId}
                  </span>
                )}
                {message.trace.groundedContext.portfolioSnapshotId && (
                  <span className="rounded-full border border-amber-800/60 bg-amber-950/30 px-2 py-1 font-mono text-[10px] text-amber-300">
                    SNAP {message.trace.groundedContext.portfolioSnapshotId}
                  </span>
                )}
                {!!message.trace.groundedContext.marketDataSourceIds?.length && (
                  <span className="rounded-full border border-violet-800/60 bg-violet-950/30 px-2 py-1 font-mono text-[10px] text-violet-300">
                    SOURCES {message.trace.groundedContext.marketDataSourceIds.length}
                  </span>
                )}
              </div>
            )}
          </div>

          {message.role === 'user' && (
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
              <User size={16} className="text-slate-400" />
            </div>
          )}
        </div>
      ))}

      {isThinking && (
        <div className="flex animate-pulse justify-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-800 bg-cyan-900/20">
            <Bot size={16} className="text-cyan-400" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500 delay-75" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500 delay-150" />
          </div>
        </div>
      )}

    </div>
  );
};
