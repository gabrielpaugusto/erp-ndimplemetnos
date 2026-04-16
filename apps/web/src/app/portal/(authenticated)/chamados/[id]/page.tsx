'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, User, Headphones, Clock } from 'lucide-react';
import { portalFetch, getPortalUser } from '@/lib/api';

interface Message {
  id: string;
  sender: 'client' | 'support';
  senderName: string;
  content: string;
  timestamp: string;
}

interface Ticket {
  id: string;
  subject: string;
  category?: string;
  status: string;
  priority: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
  RESPONDIDO: 'bg-emerald-100 text-emerald-700',
  FECHADO: 'bg-slate-100 text-slate-600',
};

const statusLabels: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em Andamento',
  RESPONDIDO: 'Respondido',
  FECHADO: 'Fechado',
};

const priorityLabels: Record<string, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Media',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

const priorityColors: Record<string, string> = {
  BAIXA: 'bg-slate-100 text-slate-600',
  MEDIA: 'bg-blue-100 text-blue-600',
  ALTA: 'bg-orange-100 text-orange-700',
  URGENTE: 'bg-red-100 text-red-700',
};

export default function PortalChamadoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const portalUser = getPortalUser();

  useEffect(() => {
    portalFetch(`/api/portal/tickets/${id}`)
      .then(r => r.json())
      .then(data => {
        setTicket(data);
        const msgs: Message[] = (data.messages ?? []).map((m: any) => ({
          id: m.id,
          sender: m.isInternal ? 'support' : (m.senderType === 'SUPPORT' ? 'support' : 'client'),
          senderName: m.authorName ?? m.author?.name ?? (m.senderType === 'SUPPORT' ? 'Suporte' : (portalUser?.person?.razaoSocial ?? 'Voce')),
          content: m.content ?? m.message ?? '',
          timestamp: new Date(m.createdAt).toLocaleString('pt-BR'),
        }));
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await portalFetch(`/api/portal/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (res.ok) {
        const m = await res.json();
        const newMsg: Message = {
          id: m.id ?? Date.now().toString(),
          sender: 'client',
          senderName: portalUser?.person?.razaoSocial ?? portalUser?.name ?? 'Voce',
          content: reply.trim(),
          timestamp: new Date().toLocaleString('pt-BR'),
        };
        setMessages((prev) => [...prev, newMsg]);
        setReply('');
      }
    } catch { /* silencioso */ } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link href="/portal/chamados" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mb-4">
          <ArrowLeft className="w-4 h-4" />Voltar aos Chamados
        </Link>
        <div className="text-center py-12 text-sm text-slate-500">Carregando chamado...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link href="/portal/chamados" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mb-4">
          <ArrowLeft className="w-4 h-4" />Voltar aos Chamados
        </Link>
        <div className="text-center py-12 text-sm text-slate-500">Chamado nao encontrado.</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/portal/chamados" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mb-4">
        <ArrowLeft className="w-4 h-4" />
        Voltar aos Chamados
      </Link>

      {/* Ticket header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">#{ticket.id.slice(-6)} — {ticket.subject}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {statusLabels[ticket.status] ?? ticket.status}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityColors[ticket.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                {priorityLabels[ticket.priority] ?? ticket.priority}
              </span>
              {ticket.category && (
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{ticket.category}</span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Aberto em {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
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
        <div ref={bottomRef} />
      </div>

      {/* Reply form */}
      {ticket.status !== 'FECHADO' && (
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
              disabled={!reply.trim() || sending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Enviando...' : 'Enviar Resposta'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
