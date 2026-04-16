'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, Brain, User, Wrench, Loader2, Zap, BookOpen, Search, BarChart2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: any[];
  createdAt: string;
}

const SUGESTOES = [
  'Como devo classificar a compra de aço de um fornecedor de MG?',
  'Qual CFOP uso para venda de semirreboque para cliente no Pará?',
  'Quando devo usar CST 10 no ICMS?',
  'Explica o que é DIFAL e quando se aplica para nós',
  'Quais CFOPs cobrem nossas operações de entrada?',
];

function ToolBadge({ tool }: { tool: any }) {
  const icons: Record<string, any> = {
    adicionar_legislacao: BookOpen,
    buscar_base_conhecimento: Search,
    consultar_decisoes: BarChart2,
    classificar_operacao: Zap,
  };
  const labels: Record<string, string> = {
    adicionar_legislacao: 'Adicionou à base',
    buscar_base_conhecimento: 'Consultou base',
    consultar_decisoes: 'Consultou decisões',
    classificar_operacao: 'Simulou classificação',
  };
  const Icon = icons[tool.ferramenta] ?? Wrench;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
      <Icon className="w-3 h-3" />
      {labels[tool.ferramenta] ?? tool.ferramenta}
    </span>
  );
}

export default function FiscalBrainChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch('/api/fiscal-brain/chat/historico');
      if (res.ok) setMessages(await res.json());
    } catch {} finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  const send = async (text?: string) => {
    const mensagem = (text ?? input).trim();
    if (!mensagem || loading) return;
    setInput('');

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, role: 'user', content: mensagem, createdAt: new Date().toISOString(),
    }]);
    setLoading(true);
    scrollToBottom();

    try {
      const res = await apiFetch('/api/fiscal-brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempId),
          { id: `u-${Date.now()}`, role: 'user', content: mensagem, createdAt: new Date().toISOString() },
          { id: `a-${Date.now()}`, role: 'assistant', content: data.resposta, toolsUsed: data.toolsUsed, createdAt: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setLoading(false);
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const limpar = async () => {
    if (!confirm('Limpar todo o histórico da conversa?')) return;
    await apiFetch('/api/fiscal-brain/chat/sessao', { method: 'DELETE' });
    setMessages([]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">FiscalBrain</h1>
            <p className="text-slate-500 text-xs mt-0.5">Consultor fiscal inteligente — ND Implementos</p>
          </div>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">● online</span>
        </div>
        <button onClick={limpar} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors">
          <Trash2 className="w-4 h-4" /> Limpar
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-10">
            <div className="p-4 bg-violet-50 rounded-2xl">
              <Brain className="w-10 h-10 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700 text-lg">Olá! Sou o FiscalBrain.</p>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">Seu consultor fiscal especializado em implementos rodoviários. Pode me perguntar sobre CFOP, CST, alíquotas ou me ensinar regras da sua operação.</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-lg">
              <p className="text-xs text-slate-400 text-center font-medium uppercase tracking-wide">Sugestões para começar</p>
              {SUGESTOES.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="text-left px-4 py-2.5 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-violet-700 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-100' : 'bg-violet-100'}`}>
                  {msg.role === 'user'
                    ? <User className="w-4 h-4 text-blue-600" />
                    : <Brain className="w-4 h-4 text-violet-600" />}
                </div>
                <div className={`max-w-[75%] space-y-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {msg.toolsUsed.map((t, i) => <ToolBadge key={i} tool={t} />)}
                    </div>
                  )}
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-slate-400 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-violet-600" />
                </div>
                <div className="px-4 py-3 bg-slate-100 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-violet-500">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte sobre CFOP, CST, alíquotas ou ensine uma nova regra... (Enter para enviar)"
            className="w-full px-4 py-3 text-sm resize-none focus:outline-none text-slate-800 placeholder-slate-400"
            disabled={loading}
          />
        </div>
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="p-3.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white rounded-xl transition-colors"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-center">
        Enter para enviar · Shift+Enter para nova linha · As regras que você ensinar são salvas automaticamente
      </p>
    </div>
  );
}
