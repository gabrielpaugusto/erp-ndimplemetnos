'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ArrowLeft,
  Send,
  User,
  Headphones,
  Clock,
  Building2,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';

type TicketStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'RESPONDIDO' | 'FECHADO';

interface Message {
  id: string;
  sender: 'client' | 'support' | 'internal';
  senderName: string;
  content: string;
  timestamp: string;
}

const statusConfig: Record<TicketStatus, { label: string; color: string }> = {
  ABERTO: { label: 'Aberto', color: 'bg-blue-100 text-blue-700' },
  EM_ANDAMENTO: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  RESPONDIDO: { label: 'Respondido', color: 'bg-emerald-100 text-emerald-700' },
  FECHADO: { label: 'Fechado', color: 'bg-slate-100 text-slate-600' },
};

interface TicketDetail {
  id: string;
  numero: number;
  title: string;
  status: TicketStatus;
  priority: string;
  category: string;
  openedAt: string;
  client: {
    name: string;
    cnpj: string;
    email: string;
    phone: string;
  } | null;
  assignee: string;
  sla: {
    responseTime: string;
    resolutionTime: string;
    withinSla: boolean;
  } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessage(raw: any): Message {
  let sender: Message['sender'] = 'support';
  if (raw.sender === 'client' || raw.type === 'CLIENT') sender = 'client';
  else if (raw.isInternal || raw.internal || raw.sender === 'internal') sender = 'internal';

  const senderName = raw.senderName || raw.authorName || raw.user?.name || 'Suporte';
  const timestamp = raw.createdAt
    ? new Date(raw.createdAt).toLocaleString('pt-BR')
    : raw.timestamp || '';

  return {
    id: raw.id,
    sender,
    senderName,
    content: raw.content || raw.body || raw.message || '',
    timestamp,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicket(raw: any): TicketDetail {
  return {
    id: raw.id,
    numero: raw.numero || raw.number || raw.id,
    title: raw.title || raw.subject || '',
    status: (raw.status as TicketStatus) || 'ABERTO',
    priority: raw.priority || raw.prioridade || 'Media',
    category: raw.category || raw.tipo || raw.type || 'Geral',
    openedAt: raw.createdAt || raw.openedAt || '',
    client: raw.client || raw.person
      ? {
          name: raw.client?.name || raw.person?.razaoSocial || raw.person?.name || '',
          cnpj: raw.client?.cnpj || raw.person?.cpfCnpj || '',
          email: raw.client?.email || raw.person?.email || '',
          phone: raw.client?.phone || raw.person?.phone || '',
        }
      : null,
    assignee: raw.assignee?.name || raw.responsavel?.name || '',
    sla: null,
  };
}

const assignees = ['Carlos Silva', 'Ana Souza', 'Pedro Lima', 'Julia Santos'];

export default function ChamadoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [reply, setReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  const [status, setStatus] = useState<TicketStatus>('ABERTO');
  const [assignee, setAssignee] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/tickets/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error('Erro ao carregar chamado');
        const json = await res.json();
        const mapped = mapTicket(json);
        setTicket(mapped);
        setStatus(mapped.status);
        setAssignee(mapped.assignee);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMessages((json.messages || []).map((m: any) => mapMessage(m)));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSendingReply(true);
    try {
      const res = await apiFetch(`/api/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: reply.trim(),
          isInternal: isInternalNote,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao enviar mensagem');
      }
      const json = await res.json();
      setMessages((prev) => [...prev, mapMessage(json)]);
      setReply('');
    } catch (err: unknown) {
      // Fallback: append locally if API failed but we want to keep UI responsive
      alert(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
    } finally {
      setSendingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (status === 'FECHADO') return;
    setClosingTicket(true);
    try {
      const res = await apiFetch(`/api/tickets/${id}/close`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao fechar chamado');
      }
      setStatus('FECHADO');
      if (ticket) setTicket({ ...ticket, status: 'FECHADO' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao fechar chamado');
    } finally {
      setClosingTicket(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (notFound || !ticket) {
    return (
      <div className="space-y-4">
        <Link href="/chamados" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <ArrowLeft className="w-4 h-4" />
          Voltar aos Chamados
        </Link>
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">Chamado nao encontrado.</p>
          <button
            onClick={() => router.push('/chamados')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Ver todos os chamados
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/chamados"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar aos Chamados
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ticket header */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  #{ticket.numero} — {ticket.title}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[status]?.color || 'bg-slate-100 text-slate-600'}`}>
                    {statusConfig[status]?.label || status}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600">
                    {ticket.priority}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{ticket.category}</span>
                  {ticket.openedAt && (
                    <span className="text-xs text-slate-400">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Aberto em {new Date(ticket.openedAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
              {/* Status buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {status !== 'FECHADO' && (
                  <button
                    onClick={handleCloseTicket}
                    disabled={closingTicket}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {closingTicket ? 'Fechando...' : 'Fechar'}
                  </button>
                )}
                {status === 'ABERTO' && (
                  <button
                    onClick={() => setStatus('EM_ANDAMENTO')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Iniciar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {messages.map((msg) => {
              const isInternal = msg.sender === 'internal';
              const isClient = msg.sender === 'client';
              return (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 ${
                    isInternal
                      ? 'bg-yellow-50 border-yellow-200'
                      : isClient
                      ? 'bg-white border-slate-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isInternal ? 'bg-yellow-200' : isClient ? 'bg-slate-200' : 'bg-blue-200'
                    }`}>
                      {isInternal ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-700" />
                      ) : isClient ? (
                        <User className="w-3.5 h-3.5 text-slate-600" />
                      ) : (
                        <Headphones className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${
                      isInternal ? 'text-yellow-700' : isClient ? 'text-slate-700' : 'text-blue-700'
                    }`}>
                      {msg.senderName}
                    </span>
                    {isInternal && (
                      <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-medium">
                        NOTA INTERNA
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto">{msg.timestamp}</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-line ml-9">{msg.content}</p>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-400">
                Nenhuma mensagem neste chamado.
              </div>
            )}
          </div>

          {/* Reply form */}
          <form onSubmit={handleSendReply} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="rounded border-slate-300 text-yellow-600 focus:ring-yellow-500"
                />
                <span className={`font-medium ${isInternalNote ? 'text-yellow-700' : 'text-slate-600'}`}>
                  {isInternalNote ? 'Nota Interna (nao visivel ao cliente)' : 'Resposta ao cliente'}
                </span>
              </label>
            </div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={isInternalNote ? 'Escreva uma nota interna...' : 'Digite sua resposta...'}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none mb-3 ${
                isInternalNote
                  ? 'border-yellow-300 focus:ring-yellow-500 bg-yellow-50'
                  : 'border-slate-300 focus:ring-blue-500'
              }`}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!reply.trim() || sendingReply}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isInternalNote
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Send className="w-4 h-4" />
                {sendingReply ? 'Enviando...' : isInternalNote ? 'Salvar Nota' : 'Enviar Resposta'}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client info */}
          {ticket.client && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                Informacoes do Cliente
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Razao Social</p>
                  <p className="font-medium text-slate-700">{ticket.client.name}</p>
                </div>
                {ticket.client.cnpj && (
                  <div>
                    <p className="text-xs text-slate-400">CNPJ</p>
                    <p className="font-medium text-slate-700">{ticket.client.cnpj}</p>
                  </div>
                )}
                {ticket.client.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs">{ticket.client.email}</span>
                  </div>
                )}
                {ticket.client.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs">{ticket.client.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              Responsavel
            </h3>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sem responsavel</option>
              {assignees.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Status change */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              Alterar Status
            </h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          {/* SLA info */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              SLA
            </h3>
            {ticket.sla ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Tempo resposta</span>
                  <span className="text-xs font-medium text-emerald-600">{ticket.sla.responseTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Tempo resolucao</span>
                  <span className="text-xs font-medium text-amber-600">{ticket.sla.resolutionTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Status SLA</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ticket.sla.withinSla ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {ticket.sla.withinSla ? 'Dentro do prazo' : 'Fora do prazo'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Informacoes de SLA nao disponiveis.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
