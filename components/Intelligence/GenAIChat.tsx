
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Transaction } from '../../types';
import { Panel, Badge } from '../ui/LayoutComponents';
import { MessageSquare, Send, Bot, User, BrainCircuit, Terminal, Zap, Trash2, History } from 'lucide-react';

interface Props {
  deals: Transaction[];
  marketSummary: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

const GenAIChat: React.FC<Props> = ({ deals, marketSummary }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      id: 'welcome', 
      role: 'model', 
      content: 'Nexus Prime Neural Link Established. I have full read access to the deal blotter and yield curve definitions. How can I assist with your portfolio analysis today?',
      timestamp: new Date().toLocaleTimeString() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatHistory] = useState(['Portfolio Risk Q3', 'EUR Liquidity Stress', 'Green Bond Impact']); // Mock history

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Calculate some quick stats to feed the context
      const totalVolume = deals.reduce((acc, d) => acc + d.amount, 0);
      const avgMargin = (deals.reduce((acc, d) => acc + d.marginTarget, 0) / deals.length).toFixed(2);
      const dealCount = deals.length;

      const systemPrompt = `
        You are 'Nexus Prime', a sophisticated Banking AI Chatbot.
        
        GLOBAL DATA CONTEXT:
        - Total Booked Deals: ${dealCount}
        - Total Portfolio Volume (approx): $${(totalVolume / 1000000).toFixed(1)}M
        - Average Commercial Margin: ${avgMargin}%
        - Market Conditions: ${marketSummary}
        - Full Blotter JSON (Sample): ${JSON.stringify(deals.slice(0, 3))}... (and ${deals.length - 3} more)

        INSTRUCTIONS:
        - You are helpful, professional, and precise.
        - Answer general questions about FTP methodology (Matched Maturity, Curves).
        - Answer specific questions about the portfolio stats provided above.
        - If asked to write SQL or Code, provide it in a clean format.
        - Keep responses concise and industrial in tone.
      `;

      // Create a chat session (Gemini 2.5 Flash)
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.5, // Lower temperature for more analytical answers
        }
      });

      // We need to replay history to the model to maintain context, 
      // but for this implementation we'll just send the new message with the system prompt context.
      // In a full implementation, we would map `messages` to `Content` objects.
      
      const responseStream = await chat.sendMessageStream({ message: input });
      
      const modelMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { 
          id: modelMsgId, 
          role: 'model', 
          content: '', 
          timestamp: new Date().toLocaleTimeString() 
      }]);

      let fullResponse = "";
      for await (const chunk of responseStream) {
        const text = (chunk as GenerateContentResponse).text;
        if (text) {
          fullResponse += text;
          setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, content: fullResponse } : m));
        }
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'model', 
          content: 'Error: Neural Link Interrupted. Connection to Core AI Failed.', 
          timestamp: new Date().toLocaleTimeString() 
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <Panel className="h-full bg-slate-950 border-0 p-0 overflow-hidden">
      <div className="flex h-full">
        
        {/* Sidebar (History) */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col">
           <div className="p-4 border-b border-slate-800">
              <button className="w-full flex items-center justify-center gap-2 bg-cyan-900/20 border border-cyan-800 text-cyan-400 py-2 rounded text-xs font-bold hover:bg-cyan-900/40 transition-colors">
                  <Bot size={14} /> New Session
              </button>
           </div>
           <div className="flex-1 p-2 space-y-1 overflow-y-auto">
               <div className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase">Recent Inquiries</div>
               {chatHistory.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 rounded cursor-pointer group text-xs">
                      <History size={12} className="text-slate-600 group-hover:text-cyan-500" />
                      <span className="truncate">{h}</span>
                  </div>
               ))}
           </div>
           <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600 font-mono text-center">
               Nexus Prime v2.5.1
           </div>
        </div>

        {/* Main Chat Interface */}
        <div className="flex-1 flex flex-col relative bg-slate-950">
           
           {/* Top Bar */}
           <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
               <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-cyan-950 rounded flex items-center justify-center border border-cyan-900">
                       <BrainCircuit size={16} className="text-cyan-400" />
                   </div>
                   <div>
                       <h3 className="text-sm font-bold text-slate-200">Nexus Prime Chat</h3>
                       <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                           <span className="text-[10px] text-emerald-500 font-mono">ONLINE • GEMINI-2.5-FLASH</span>
                       </div>
                   </div>
               </div>
               <div className="flex gap-2">
                   <button onClick={() => setMessages([])} className="p-2 text-slate-500 hover:text-red-400 transition-colors" title="Clear Context">
                       <Trash2 size={16} />
                   </button>
               </div>
           </div>

           {/* Messages Area */}
           <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {messages.map((msg) => (
                   <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       
                       {msg.role === 'model' && (
                           <div className="w-8 h-8 rounded-lg bg-cyan-900/20 border border-cyan-800 flex items-center justify-center shrink-0 mt-1">
                               <Bot size={16} className="text-cyan-400" />
                           </div>
                       )}

                       <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                           <div className={`px-4 py-3 rounded-lg text-sm leading-relaxed shadow-sm ${
                               msg.role === 'user' 
                               ? 'bg-slate-800 text-slate-200 border border-slate-700' 
                               : 'bg-slate-900 text-slate-300 border border-slate-800'
                           }`}>
                               {/* Simple formatting for code blocks if needed, otherwise plain text */}
                               <span className="whitespace-pre-wrap font-sans">{msg.content}</span>
                           </div>
                           <span className="text-[10px] text-slate-600 mt-1 font-mono">{msg.timestamp}</span>
                       </div>

                       {msg.role === 'user' && (
                           <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-1">
                               <User size={16} className="text-slate-400" />
                           </div>
                       )}
                   </div>
               ))}

               {isThinking && (
                   <div className="flex gap-4 justify-start animate-pulse">
                       <div className="w-8 h-8 rounded-lg bg-cyan-900/20 border border-cyan-800 flex items-center justify-center shrink-0">
                           <Bot size={16} className="text-cyan-400" />
                       </div>
                       <div className="flex items-center gap-1 bg-slate-900 px-4 py-3 rounded-lg border border-slate-800">
                           <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></div>
                           <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce delay-75"></div>
                           <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce delay-150"></div>
                       </div>
                   </div>
               )}
               <div ref={scrollRef} />
           </div>

           {/* Input Area */}
           <div className="p-4 border-t border-slate-800 bg-slate-900">
               <div className="max-w-4xl mx-auto relative">
                   <input
                       type="text"
                       value={input}
                       onChange={(e) => setInput(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                       placeholder="Ask Nexus Prime about portfolio risks, curves, or specific deal IDs..."
                       className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-12 py-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 shadow-inner font-mono transition-all"
                   />
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                       <Terminal size={18} />
                   </div>
                   <button 
                       onClick={handleSendMessage}
                       disabled={!input.trim() || isThinking}
                       className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                   >
                       <Send size={16} />
                   </button>
               </div>
               <div className="text-center mt-2">
                   <p className="text-[10px] text-slate-600 font-mono">
                       <Zap size={10} className="inline mr-1 text-amber-500" />
                       AI processing may produce variable results. Validate financial data manually.
                   </p>
               </div>
           </div>

        </div>
      </div>
    </Panel>
  );
};

export default GenAIChat;
