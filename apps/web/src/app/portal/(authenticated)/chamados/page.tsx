'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { portalFetch } from '@/lib/api';

type TicketStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'RESPONDIDO' | 'FECHADO';
type Priority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<TicketStatus, { label: string; color: string }> = {
  ABERTO: { label: 'Aberto', color: 'bg-blue-100 text-blue-700' },
  EM_ANDAMENTO: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  RESPONDIDO: { label: 'Respondido', color: 'bg-emerald-100 text-emerald-700' },
  FECHADO: { label: 'Fechado', color: 'bg-slate-100 text-slate-600' },
};

const priorityConfig: Record<Priority, { label: string; color: string }> = {
  BAIXA: { label: 'Baixa', color: 'bg-slate-100 text-slate-600' },
  MEDIA: { label: 'Media', color: 'bg-blue-100 text-blue-600' },
  ALTA: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  URGENTE: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
};

export default function PortalChamadosPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (statusFilter) params.set('status', statusFilter);
    portalFetch(`/api/portal/tickets?${params}`)
      .then(r => r.json())
      .then(d => setTickets(d.data ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = tickets;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Chamados</h1>
          <p className="text-slate-500 mt-1 text-sm">Acompanhe seus chamados e solicitacoes.</p>
        </div>
        <Link
          href="/portal/chamados/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Chamado
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !statusFilter ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todos ({tickets.length})
        </button>
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = tickets.filter((t) => t.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === key ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tickets list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-500">Carregando...</div>
        ) : filtered.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/portal/chamados/${ticket.id}`}
            className="block bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">#{ticket.id.slice(-6)} — {ticket.subject}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[ticket.status]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusConfig[ticket.status]?.label ?? ticket.status}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityConfig[ticket.priority]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                      {priorityConfig[ticket.priority]?.label ?? ticket.priority}
                    </span>
                    {ticket.category && (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                        {ticket.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Aberto em {new Date(ticket.createdAt).toLocaleDateString('pt-BR')} — Atualizado em {new Date(ticket.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 mt-2" />
            </div>
          </Link>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-500">
            Nenhum chamado encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
