'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Brain, Bot, Plus, ChevronDown, User, Wrench, MessageSquare } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolBadge?: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  date: Date;
}

const mockConversations: Conversation[] = [
  { id: '1', title: 'Contas a receber e estoque', lastMessage: 'Sugiro criar uma solicitação de compra.', date: new Date('2026-03-15T10:30:00') },
  { id: '2', title: 'Relatório de produção mensal', lastMessage: 'O relatório foi gerado com sucesso.', date: new Date('2026-03-14T16:00:00') },
  { id: '3', title: 'Status das ordens de serviço', lastMessage: 'Existem 3 OS abertas com prazo esta semana.', date: new Date('2026-03-13T09:15:00') },
  { id: '4', title: 'Análise de vendas Q1', lastMessage: 'As vendas do Q1 totalizam R$ 2,4M.', date: new Date('2026-03-12T14:20:00') },
];

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Qual o total de contas a receber vencidas?',
    timestamp: new Date('2026-03-15T10:25:00'),
  },
  {
    id: '2',
    role: 'assistant',
    content: 'Encontrei 12 titulos vencidos totalizando R$ 45.230,00. Os principais sao:\n\n1. Transportadora Rodoviaria Ltda — R$ 18.500,00 (42 dias)\n2. Logistica Express S/A — R$ 15.230,00 (28 dias)\n3. Agropecuaria Tres Irmaos — R$ 11.500,00 (15 dias)\n\nRecomendo acao imediata nos titulos acima de 30 dias.',
    toolBadge: 'Analisando financeiro...',
    timestamp: new Date('2026-03-15T10:25:15'),
  },
  {
    id: '3',
    role: 'user',
    content: 'E o estoque de chapas de aco?',
    timestamp: new Date('2026-03-15T10:28:00'),
  },
  {
    id: '4',
    role: 'assistant',
    content: 'O estoque atual de chapas de aco esta em 45 unidades, abaixo do ponto de reposicao (50). Detalhes:\n\n- Chapa aco 2mm: 15 un (minimo: 20) — CRITICO\n- Chapa aco 3mm: 18 un (minimo: 15) — OK\n- Chapa aco 5mm: 12 un (minimo: 15) — BAIXO\n\nSugiro criar uma solicitacao de compra para os itens criticos.',
    toolBadge: 'Consultando estoque...',
    timestamp: new Date('2026-03-15T10:28:20'),
  },
];

const contextOptions = [
  { value: 'geral', label: 'Geral' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'producao', label: 'Producao' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'rh', label: 'RH' },
];

export function AiChat() {
  const aiChatOpen = useUiStore((s) => s.aiChatOpen);
  const toggleAiChat = useUiStore((s) => s.toggleAiChat);

  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [input, setInput] = useState('');
  const [context, setContext] = useState('geral');
  const [isTyping, setIsTyping] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string>('1');
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showConvDropdown, setShowConvDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Entendido! Estou processando sua solicitacao. Em um ambiente de producao, esta resposta viria da API de IA integrada ao sistema ERP.',
        toolBadge: 'Processando consulta...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setSelectedConversation('');
    setShowConversations(false);
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setShowConvDropdown(false);
    if (id === '1') {
      setMessages(mockMessages);
    } else {
      setMessages([
        {
          id: 'placeholder',
          role: 'assistant',
          content: 'Conversa anterior carregada. Como posso ajudar?',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const currentConv = mockConversations.find((c) => c.id === selectedConversation);

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-30 w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl transition-transform duration-300',
        aiChatOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Assistente IA</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Nova Conversa"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowConversations(!showConversations)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              showConversations ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            )}
            title="Conversas"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={toggleAiChat}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversation selector */}
      <div className="px-3 py-2 border-b border-slate-100 shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowConvDropdown(!showConvDropdown)}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="truncate">{currentConv?.title || 'Nova Conversa'}</span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>
          {showConvDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {mockConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors',
                    selectedConversation === conv.id && 'bg-blue-50 text-blue-700'
                  )}
                >
                  <p className="font-medium truncate">{conv.title}</p>
                  <p className="text-xs text-slate-400 truncate">{conv.lastMessage}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Conversations sidebar */}
        {showConversations && (
          <div className="w-48 border-r border-slate-100 overflow-y-auto shrink-0 bg-slate-50">
            <div className="p-2">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mb-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Conversa
              </button>
              {mockConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-0.5',
                    selectedConversation === conv.id
                      ? 'bg-white border border-slate-200 shadow-sm'
                      : 'hover:bg-white'
                  )}
                >
                  <p className="font-medium text-slate-700 truncate">{conv.title}</p>
                  <p className="text-slate-400 truncate mt-0.5">{conv.date.toLocaleDateString('pt-BR')}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                <Bot className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-700 mb-1">Nova Conversa</h3>
              <p className="text-xs text-slate-400 max-w-[220px]">
                Pergunte sobre financeiro, estoque, producao, vendas ou qualquer modulo do ERP.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'assistant' && msg.toolBadge && (
                <div className="flex items-center gap-1.5 mb-1 ml-9">
                  <Wrench className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                    {msg.toolBadge}
                  </span>
                </div>
              )}
              <div className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                  <p className={cn(
                    'text-[10px] mt-1',
                    msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                  )}>
                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-slate-500" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 p-3 shrink-0">
        {/* Context selector */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Contexto:</span>
          <div className="relative">
            <button
              onClick={() => setShowContextDropdown(!showContextDropdown)}
              className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600 hover:bg-slate-200 transition-colors"
            >
              {contextOptions.find((c) => c.value === context)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showContextDropdown && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                {contextOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setContext(opt.value);
                      setShowContextDropdown(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors',
                      context === opt.value && 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma pergunta..."
            rows={1}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-24"
            style={{ minHeight: '38px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
          Powered by IA — Assistente ERP Implementos
        </p>
      </div>
    </div>
  );
}
