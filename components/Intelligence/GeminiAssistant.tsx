
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Transaction } from '../../types';
import { Panel } from '../ui/LayoutComponents';
import { Sparkles, Send, X, Bot, User, RefreshCw, Cpu, Maximize2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullChat: () => void;
  contextData: {
    activeDeal: Transaction;
    marketContext: string; // Brief description or JSON string of current curve
  };
}

const GeminiAssistant: React.FC<Props> = ({ isOpen, onClose, onOpenFullChat, contextData }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'model', text: 'Nexus Intelligence Online. I have access to your current deal parameters and market curves. How can I assist with your pricing strategy?' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: "AIzaSyDLrMQyW7N8u01xtwCRWHZHCQa5136ejmY" });

      // Construct a context-aware system instruction
      const systemInstruction = `
        You are 'Nexus AI', a specialized Funds Transfer Pricing (FTP) and Quantitative Risk Analyst assistant.
        
        CURRENT APP CONTEXT:
        You are looking at the following active transaction deal structure:
        ${JSON.stringify(contextData.activeDeal, null, 2)}
        
        MARKET CONTEXT:
        ${contextData.marketContext}

        YOUR GOAL:
        Provide concise, high-precision financial advice. 
        - If the user asks about RAROC, analyze the current risk weight (${contextData.activeDeal.riskWeight}%) vs the margin (${contextData.activeDeal.marginTarget}%).
        - If the user asks about Duration, mention the ${contextData.activeDeal.durationMonths} month term.
        - Explain FTP concepts (Liquidity Premium, Option Costs) clearly.
        - Be professional, industrial, and concise. Do not use markdown headers, just plain text or bullet points.
      `;

      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: input }] }
        ],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      let fullText = "";
      const modelMsgId = (Date.now() + 1).toString();

      // Add placeholder for streaming
      setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '' }]);

      for await (const chunk of response) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          setMessages(prev =>
            prev.map(msg => msg.id === modelMsgId ? { ...msg, text: fullText } : msg)
          );
        }
      }

    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Error: Unable to connect to Neural Net. Please check API Key configuration." }]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 w-96 h-[600px] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right-10 fade-in duration-300">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-lg shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="h-12 border-b border-cyan-900/50 bg-cyan-950/20 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 text-cyan-400">
            <Sparkles size={16} className="animate-pulse" />
            <span className="font-bold text-sm tracking-wider uppercase">Gemini Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
              <Cpu size={10} className="text-emerald-500" />
              <span className="text-[9px] font-mono text-emerald-500">CONNECTED</span>
            </div>
            {/* Open Full Lab Button */}
            <button onClick={onOpenFullChat} className="text-slate-500 hover:text-cyan-400 transition-colors" title="Launch Nexus Prime Lab">
              <Maximize2 size={16} />
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'model'
                ? 'bg-slate-900 border-cyan-900 text-cyan-400'
                : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`p-3 rounded-lg text-xs leading-relaxed max-w-[80%] ${msg.role === 'model'
                ? 'bg-slate-900/50 border border-slate-800 text-slate-200'
                : 'bg-cyan-950/30 border border-cyan-900/50 text-cyan-100'
                }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-cyan-900 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-cyan-400" />
              </div>
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Nexus AI about this deal..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-4 pr-10 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-cyan-900/30 text-cyan-400 rounded hover:bg-cyan-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
          <div className="text-[9px] text-slate-600 mt-2 text-center font-mono">
            Powered by Gemini 2.5 Flash • Context: Active Deal {contextData.activeDeal.id || 'NEW'}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GeminiAssistant;
