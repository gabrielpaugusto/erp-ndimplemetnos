'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, X, Eye, Edit,
  ChevronLeft, ChevronRight, ClipboardList, Calendar,
} from 'lucide-react';
import { EmptyStateRow } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { fmtCurrency as formatCurrency } from '@/lib/format';

type RequestStatus = 'RASCUNHO' | 'SOLICITADA' | 'APROVADA' | 'COTADA' | 'PEDIDA' | 'RECEBIDA' | 'CANCELADA';

interface PurchaseRequest {
  id: string;
  number: string;
  requester: string;
  description: string;
  itemsCount: number;
  priority: number;
  status: RequestStatus;
  date: string;
  totalEstimated: number;
}

const statusLabels: Record<RequestStatus, string> = {
  RASCUNHO: 'Rascunho',
  SOLICITADA: 'Solicitada',
  APROVADA: 'Aprovada',
  COTADA: 'Cotada',
  PEDIDA: 'Pedida',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<RequestStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  SOLICITADA: 'bg-blue-100 text-blue-700',
  APROVADA: 'bg-emerald-100 text-emerald-700',
  COTADA: 'bg-purple-100 text-purple-700',
  PEDIDA: 'bg-indigo-100 text-indigo-700',
  RECEBIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

export default function SolicitacoesCompraListPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ data: any[]; meta: { total: number; totalPages: number } }>(
        '/purchasing/requests',
        {
          params: {
            search: search || undefined,
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            startDate: dateFrom || undefined,
            endDate: dateTo || undefined,
            page,
            limit,
          },
        },
      );
      const mapped: PurchaseRequest[] = result.data.map((r) => ({
        id: r.id,
        number: r.numero,
        requester: r.solicitante?.name ?? '',
        description: r.description ?? '',
        itemsCount: r._count?.items ?? 0,
        priority: r.priority ?? 5,
        status: r.status as RequestStatus,
        date: r.dataSolicitacao ?? r.createdAt ?? '',
        totalEstimated: Number(r.totalEstimated ?? 0),
      }));
      setRequests(mapped);
      setTotal(result.meta.total);
    } catch {
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = search || statusFilter || priorityFilter || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Solicitacoes de Compra</h1>
          <p className="text-slate-500 mt-1">
            Gerencie solicitacoes de compra de materiais e insumos
          </p>
        </div>
        <Link
          href="/compras/solicitacoes/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitacao
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por numero, solicitante ou descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-amber-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                !
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                <option value="">Todas</option>
                <option value="8">Urgente (8-10)</option>
                <option value="5">Normal (5-7)</option>
                <option value="1">Baixa (1-4)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data De</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Ate</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Itens</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Est.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">Carregando...</td></tr>
              ) : requests.map((req, index) => (
                <tr key={req.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{req.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{req.requester}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{req.description}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium text-center">{req.itemsCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      req.priority >= 8 ? 'bg-red-100 text-red-700' : req.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status]}`}>
                      {statusLabels[req.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(req.totalEstimated)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {req.date ? new Date(req.date).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/compras/solicitacoes/${req.id}`} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Visualizar">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link href={`/compras/solicitacoes/${req.id}`} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="Editar">
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && requests.length === 0 && (
                <EmptyStateRow colSpan={9} icon={ClipboardList} title="Nenhuma solicitação de compra" description="Solicite materiais para reposição de estoque." actionLabel="Nova Solicitação" actionHref="/compras/solicitacoes/nova" filtered={true} />
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{requests.length}</span> de{' '}
            <span className="font-medium">{total}</span> registros
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <span className="text-sm text-slate-700">Pagina {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Proxima
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
