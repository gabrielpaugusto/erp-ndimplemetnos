'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, User, Headphones, Clock } from 'lucide-react';

interface Message {
  id: string;
  sender: 'client' | 'support';
  senderName: string;
  content: string;
  timestamp: string;
}

const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'client',
    senderName: 'Logistica Express S/A',
    content: 'Boa tarde, gostaria de saber sobre a garantia da carroceria bau refrigerado modelo 2026. Qual e o prazo e o que esta coberto?',
    timestamp: '14/03/2026 14:30',
  },
  {
    id: '2',
    sender: 'support',
    senderName: 'Carlos — Suporte',
    content: 'Boa tarde! A garantia da carroceria bau refrigerado cobre defeitos de fabricacao por 12 meses ou 100.000 km, o que ocorrer primeiro. Isso inclui estrutura, sistema de refrigeracao e acabamentos. Nao cobre danos por mau uso ou acidentes.',
    timestamp: '14/03/2026 15:15',
  },
  {
    id: '3',
    sender: 'client',
    senderName: 'Logistica Express S/A',
    content: 'Entendi, obrigado! E como faco para acionar a garantia caso precise?',
    timestamp: '15/03/2026 09:00',
  },
  {
    id: '4',
    sender: 'support',
    senderName: 'Carlos — Suporte',
    content: 'Para acionar a garantia, basta abrir um chamado aqui no portal informando o numero de serie do produto e uma descricao do problema. Voce tambem pode trazer o veiculo diretamente em nossa oficina em Caxias do Sul. O prazo de analise e de ate 5 dias uteis.',
    timestamp: '15/03/2026 09:45',
  },
];

export default function PortalChamadoDetailPage() {
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState(mockMessages);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'client',
      senderName: 'Logistica Express S/A',
      content: reply.trim(),
      timestamp: new Date().toLocaleString('pt-BR'),
    };
    setMessages((prev) => [...prev, newMsg]);
    setReply('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/portal/chamados"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar aos Chamados
      </Link>

      {/* Ticket header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">#42 — Duvida sobre garantia da carroceria</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                Respondido
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600">
                Media
              </span>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">Duvida</span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Aberto em 14/03/2026
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'support' && (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                <Headphones className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div className={`max-w-[70%] rounded-xl px-4 py-3 ${
              msg.sender === 'client'
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
            }`}>
              <p className={`text-xs font-medium mb-1 ${msg.sender === 'client' ? 'text-blue-200' : 'text-slate-500'}`}>
                {msg.senderName}
              </p>
              <p className="text-sm whitespace-pre-line">{msg.content}</p>
              <p className={`text-[10px] mt-2 ${msg.sender === 'client' ? 'text-blue-200' : 'text-slate-400'}`}>
                {msg.timestamp}
              </p>
            </div>
            {msg.sender === 'client' && (
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply form */}
      <form onSubmit={handleSendReply} className="bg-white rounded-lg border border-slate-200 p-4">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Digite sua resposta..."
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-3"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!reply.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Enviar Resposta
          </button>
        </div>
      </form>
    </div>
  );
}
