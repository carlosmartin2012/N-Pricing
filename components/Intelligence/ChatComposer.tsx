import React from 'react';
import { Send, Terminal, Trash2, Zap } from 'lucide-react';

interface Props {
  input: string;
  isThinking: boolean;
  onChangeInput: (value: string) => void;
  onSendMessage: () => void;
  onResetSession: () => void;
}

export const ChatComposer: React.FC<Props> = ({ input, isThinking, onChangeInput, onSendMessage, onResetSession }) => {
  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-cyan-900 bg-cyan-950">
            <Terminal size={16} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">N Pricing Chat</h3>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="font-mono text-[10px] text-emerald-500">ONLINE • GEMINI-2.0-FLASH</span>
            </div>
          </div>
        </div>
        <button
          onClick={onResetSession}
          className="p-2 text-slate-500 transition-colors hover:text-red-400"
          title="Clear Context"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="border-t border-slate-800 bg-slate-900 p-4">
        <div className="relative mx-auto max-w-4xl">
          <input
            type="text"
            value={input}
            onChange={(event) => onChangeInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onSendMessage()}
            placeholder="Ask N Pricing about portfolio risks, curves, or specific deal IDs..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-12 font-mono text-sm text-slate-200 placeholder-slate-600 shadow-inner transition-all focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            <Terminal size={18} />
          </div>
          <button
            onClick={onSendMessage}
            disabled={!input.trim() || isThinking}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-cyan-600 p-2 text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="font-mono text-[10px] text-slate-600">
            <Zap size={10} className="mr-1 inline text-amber-500" />
            AI processing may produce variable results. Validate financial data manually.
          </p>
        </div>
      </div>
    </>
  );
};
