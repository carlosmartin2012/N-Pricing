import React from 'react';
import { BarChart3, MessageSquareText, Send, Shield, Terminal, Trash2, TrendingUp, Zap } from 'lucide-react';

const QUICK_ACTIONS = [
  { label: 'Explain this pricing', prompt: 'Explain the pricing waterfall for this deal. Break down each component and why it has its current value.', icon: MessageSquareText },
  { label: 'Suggest counteroffer', prompt: 'Suggest an optimal counteroffer rate. What is the minimum rate to meet the hurdle, and what rate would you recommend?', icon: TrendingUp },
  { label: 'Why this RAROC?', prompt: 'Explain the RAROC breakdown for this deal. Why is it at this level and what are the approval implications?', icon: BarChart3 },
  { label: 'Credit risk analysis', prompt: 'Analyze the credit risk (Anejo IX) for this deal. Explain the segment classification, coverage, and guarantees.', icon: Shield },
] as const;

interface Props {
  input: string;
  isThinking: boolean;
  onChangeInput: (value: string) => void;
  onSendMessage: (overrideInput?: string) => void;
  onResetSession: () => void;
}

export const ChatComposer: React.FC<Props> = ({ input, isThinking, onChangeInput, onSendMessage, onResetSession }) => {
  const handleQuickAction = (prompt: string) => {
    if (isThinking) return;
    onSendMessage(prompt);
  };

  return (
    <>
      <div className="flex h-11 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-cyan-900 bg-cyan-950">
            <Terminal size={16} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">N Pricing Copilot</h3>
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
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isThinking}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/60 px-3 py-1.5 font-mono text-[11px] text-slate-400 transition-all hover:border-cyan-700/50 hover:bg-slate-800 hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <action.icon size={12} />
                {action.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(event) => onChangeInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onSendMessage()}
              placeholder="Ask about pricing, RAROC, credit risk, or specific deal IDs..."
              className="w-full rounded-[var(--nfq-radius-card)] border border-slate-700 bg-slate-950 py-4 pl-12 pr-12 font-mono text-sm text-slate-200 placeholder-slate-600 shadow-inner transition-all focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <Terminal size={18} />
            </div>
            <button
              onClick={() => onSendMessage()}
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
      </div>
    </>
  );
};
