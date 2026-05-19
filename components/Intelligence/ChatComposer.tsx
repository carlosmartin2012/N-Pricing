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
      <div className="flex h-11 items-center justify-between border-b border-slate-800 bg-[var(--nfq-bg-elevated)]/50 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-[color:var(--nfq-accent)]/30 bg-[var(--nfq-accent)]/10">
            <Terminal size={16} className="text-[color:var(--nfq-accent)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[color:var(--nfq-text-secondary)]">N Pricing Copilot</h3>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--nfq-success)]" />
              <span className="font-mono text-[10px] text-[color:var(--nfq-success)]">ONLINE • GEMINI-2.0-FLASH</span>
            </div>
          </div>
        </div>
        <button
          onClick={onResetSession}
          className="p-2 text-[color:var(--nfq-text-faint)] transition-colors hover:text-[color:var(--nfq-danger)]"
          title="Clear Context"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="border-t border-slate-800 bg-[var(--nfq-bg-elevated)] p-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isThinking}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)]/60 px-3 py-1.5 font-mono text-[11px] text-[color:var(--nfq-text-muted)] transition-all hover:border-[color:var(--nfq-accent)]/50 hover:bg-[var(--nfq-bg-highest)] hover:text-[color:var(--nfq-accent)] disabled:cursor-not-allowed disabled:opacity-40"
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
              className="w-full rounded-[var(--nfq-radius-card)] border border-slate-700 bg-[var(--nfq-bg-root)] py-4 pl-12 pr-12 font-mono text-sm text-[color:var(--nfq-text-secondary)] placeholder-slate-600 shadow-inner transition-all focus:border-[color:var(--nfq-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--nfq-accent)]/20"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--nfq-text-faint)]">
              <Terminal size={18} />
            </div>
            <button
              onClick={() => onSendMessage()}
              disabled={!input.trim() || isThinking}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--nfq-accent)] p-2 text-[color:var(--nfq-text-primary)] transition-colors hover:bg-[var(--nfq-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="mt-2 text-center">
            <p className="font-mono text-[10px] text-[color:var(--nfq-text-faint)]">
              <Zap size={10} className="mr-1 inline text-[color:var(--nfq-warning)]" />
              AI processing may produce variable results. Validate financial data manually.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
