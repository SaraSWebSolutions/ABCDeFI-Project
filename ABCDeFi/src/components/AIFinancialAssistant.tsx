import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Loader2,
  User,
  RotateCcw,
  ChevronRight,
  Coins,
  CreditCard,
  BarChart2,
  Landmark,
} from 'lucide-react';
import { AIMessage, AISuggestion, AI_SUGGESTIONS, getAIResponse } from '../Services/aiAssistant';

// Simple markdown-like renderer (no external deps)
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <h2 key={i} className="text-sm font-black text-white mt-3 mb-1">{line.replace('## ', '')}</h2>;
        if (line.startsWith('### '))
          return <h3 key={i} className="text-xs font-bold text-cyan-300 mt-2 mb-0.5">{line.replace('### ', '')}</h3>;
        if (line.startsWith('#### '))
          return <h4 key={i} className="text-xs font-bold text-slate-200 mt-1.5">{line.replace('#### ', '')}</h4>;
        if (line.startsWith('> '))
          return <blockquote key={i} className="border-l-2 border-cyan-500/60 pl-3 text-cyan-300 italic bg-cyan-950/20 py-1 rounded-r-xl">{line.replace('> ', '')}</blockquote>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <div key={i} className="flex gap-2 text-slate-300"><span className="text-cyan-400 shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: line.replace(/^[-*] /, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} /></div>;
        if (line.startsWith('| '))
          return <div key={i} className="font-mono text-[10px] text-slate-300 border-b border-slate-800 pb-0.5">{line}</div>;
        if (line.startsWith('```'))
          return null;
        if (line.trim() === '' || line.startsWith('---'))
          return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-slate-300"
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>').replace(/`(.*?)`/g, '<code class="text-cyan-300 bg-slate-900 px-1 rounded text-[10px]">$1</code>') }}
          />
        );
      })}
    </div>
  );
}

const categoryColor = (cat?: AIMessage['category']) => {
  switch (cat) {
    case 'staking':    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'borrowing':  return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'portfolio':  return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    case 'loan':       return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    default:           return 'text-slate-300 bg-slate-800 border-slate-700';
  }
};

const suggestionIcon = (category: AISuggestion['category']) => {
  switch (category) {
    case 'staking':   return <Coins className="w-4 h-4 text-emerald-400" />;
    case 'borrowing': return <CreditCard className="w-4 h-4 text-amber-400" />;
    case 'portfolio': return <BarChart2 className="w-4 h-4 text-indigo-400" />;
    case 'loan':      return <Landmark className="w-4 h-4 text-purple-400" />;
  }
};

const WELCOME: AIMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `## 👋 Welcome to the ABCDeFi AI Financial Assistant!

I'm your intelligent on-chain financial guide, powered by the ABCDeFi knowledge base.

I can answer detailed questions about:
- 🥩 **Staking** — How to earn yield on ABCD tokens
- 💳 **Borrowing** — How to take ETH-collateralized loans
- 📊 **Portfolio** — Understanding your on-chain positions
- 🏦 **Loans** — EMI schedules, margin calls, Loan NFTs, and more

**Try one of the quick-start suggestions below, or type your own question!**`,
  timestamp: 'now',
  category: 'general',
};

export const AIFinancialAssistant: React.FC = () => {
  const [messages, setMessages] = useState<AIMessage[]>([WELCOME]);
  const [inputText, setInputText] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || isThinking) return;

    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    try {
      const { answer, category } = await getAIResponse(query);
      const assistantMsg: AIMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: answer,
        timestamp: new Date().toLocaleTimeString(),
        category,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toLocaleTimeString(),
          category: 'general',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handleReset = () => {
    setMessages([WELCOME]);
    setInputText('');
  };

  return (
    <div id="ai-financial-assistant" className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden font-mono" style={{ height: '82vh' }}>
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-800 shrink-0">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <span>Phase 5 — AI</span>
            <span className="text-slate-600">↓</span>
            <span>Step 14: AI Financial Assistant</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Bot className="w-5 h-5 text-cyan-400" />
            ABCDeFi AI Financial Assistant
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ask me anything about staking, borrowing, your portfolio, or loans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Knowledge Base Active
          </span>
          <button
            onClick={handleReset}
            className="p-2 rounded-xl text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition cursor-pointer"
            title="Reset conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK SUGGESTION CHIPS */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0">
        {AI_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => sendMessage(s.query)}
            disabled={isThinking}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-950 border border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-white transition cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {suggestionIcon(s.category)}
            <span>{s.label}</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </button>
        ))}
      </div>

      {/* MESSAGES FEED */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-cyan-500/20">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div className={`max-w-[85%] space-y-1 ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
              {msg.category && msg.role === 'assistant' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${categoryColor(msg.category)} uppercase`}>
                  {msg.category}
                </span>
              )}

              <div className={`rounded-3xl px-4 py-3 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>

              <div className="text-[10px] text-slate-600 px-1">{msg.timestamp}</div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-indigo-400" />
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-3xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Analyzing your question...</span>
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* INPUT BAR */}
      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-800 p-4 flex items-center gap-3">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask me about staking, borrowing, loans, or your portfolio..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isThinking}
          className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 flex items-center justify-center text-white transition cursor-pointer disabled:opacity-40 shadow-lg shadow-cyan-500/25"
        >
          {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>

    </div>
  );
};

export default AIFinancialAssistant;
