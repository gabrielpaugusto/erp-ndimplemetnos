'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  X,
  Eye,
  UserPlus,
  Clock,
  CheckCircle,
  MessageSquare,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type TicketStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'RESPONDIDO' | 'FECHADO';
type Priority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

interface Ticket {
  id: string;
  subject: string;
  portalUser?: { id: string; name: string; email: string } | null;
  category: string | null;
  status: TicketStatus;
  priority: Priority;
  assignedTo?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalOpen: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
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

export default function ChamadosPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const [ticketsRes, statsRes] = await Promise.all([
        apiFetch(`/api/tickets?${params}`),
        apiFetch('/api/tickets/stats'),
      ]);
      if (ticketsRes.ok) {
        const json = await ticketsRes.json();
        setTickets(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      // silently keep previous state
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { setPage(1); }, [search, statusFilter, priorityFilter]);

  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); };
  const hasActiveFilters = search || statusFilter || priorityFilter;

  // KPI from stats
  const getStatusCount = (s: string) => stats?.byStatus.find((b) => b.status === s)?.count ?? 0;
  const abertos = getStatusCount('ABERTO');
  const emAndamento = getStatusCount('EM_ANDAMENTO');
  const respondidos = getStatusCount('RESPONDIDO');
  const urgentes = stats?.byPriority.find((b) => b.priority === 'URGENTE')?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestao de Chamados</h1>
          <p className="text-slate-500 mt-1">
            {loading ? 'Carregando...' : `${total} chamado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchTickets}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{abertos}</p>
              <p className="text-xs text-slate-500">Abertos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{emAndamento}</p>
              <p className="text-xs text-slate-500">Em Andamento</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{respondidos}</p>
              <p className="text-xs text-slate-500">Respondidos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{urgentes}</p>
              <p className="text-xs text-slate-500">Prioridade Urgente</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por assunto, cliente ou numero..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Todos</option>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Todas</option>
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assunto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitante</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsavel</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhum chamado encontrado.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-500">#{ticket.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[250px]">{ticket.subject}</p>
                        <p className="text-xs text-slate-400">{ticket.category ?? '—'} — {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {ticket.portalUser?.name ?? <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityConfig[ticket.priority]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                        {priorityConfig[ticket.priority]?.label ?? ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[ticket.status]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusConfig[ticket.status]?.label ?? ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ticket.assignedTo ? (
                        <span className="text-sm text-slate-700">{ticket.assignedTo.name}</span>
                      ) : (
                        <button className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                          <UserPlus className="w-3.5 h-3.5" />
                          Atribuir
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/chamados/${ticket.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            <span className="font-medium">{total}</span> registros
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <span className="text-sm text-slate-700">Pagina {page} de {totalPages || 1}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Proxima
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
