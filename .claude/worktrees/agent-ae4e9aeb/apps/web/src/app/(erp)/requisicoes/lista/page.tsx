'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type ReqType = 'INTERNA' | 'COMPRA' | 'TRANSFERENCIA';
type ReqStatus = 'RASCUNHO' | 'SOLICITADA' | 'APROVADA' | 'SEPARADA' | 'ENTREGUE' | 'CANCELADA';

interface Requisition {
  id: string;
  number: string;
  type: ReqType;
  status: ReqStatus;
  linkedRef: string;
  linkedRefType: string;
  solicitante: string;
  description: string;
  itemCount: number;
  date: string;
}

const statusLabels: Record<ReqStatus, string> = {
  RASCUNHO: 'Rascunho',
  SOLICITADA: 'Solicitada',
  APROVADA: 'Aprovada',
  SEPARADA: 'Separada',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<ReqStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  SOLICITADA: 'bg-cyan-100 text-cyan-700',
  APROVADA: 'bg-blue-100 text-blue-700',
  SEPARADA: 'bg-amber-100 text-amber-700',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const typeLabels: Record<ReqType, string> = {
  INTERNA: 'Interna',
  COMPRA: 'Compra',
  TRANSFERENCIA: 'Transferencia',
};

const typeColors: Record<ReqType, string> = {
  INTERNA: 'bg-teal-100 text-teal-700',
  COMPRA: 'bg-purple-100 text-purple-700',
  TRANSFERENCIA: 'bg-blue-100 text-blue-700',
};

function getLinkedRef(r: any): { ref: string; type: string } {
  if (r.serviceOrder) return { ref: r.serviceOrder.numero, type: 'OS' };
  if (r.calderariaOrder) return { ref: r.calderariaOrder.numero, type: 'CLD' };
  if (r.productionOrder) return { ref: r.productionOrder.numero, type: 'OP' };
  return { ref: '—', type: '' };
}

export default function RequisicoesListPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await apiFetch(`/api/requisitions?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();

      const mapped: Requisition[] = (json.data ?? []).map((r: any) => {
        const linked = getLinkedRef(r);
        return {
          id: r.id,
          number: r.numero,
          type: r.type as ReqType,
          status: r.status as ReqStatus,
          linkedRef: linked.ref,
          linkedRefType: linked.type,
          solicitante: r.solicitante?.name ?? '',
          description: r.justificativa ?? '',
          itemCount: r._count?.items ?? 0,
          date: r.createdAt ? r.createdAt.slice(0, 10) : '',
        };
      });

      setRequisitions(mapped);
      setTotal(json.meta?.total ?? mapped.length);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, page]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
  };

  const hasActiveFilters = search || typeFilter || statusFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requisicoes</h1>
          <p className="text-slate-500 mt-1">
            Gerencie requisicoes internas, compras e transferencias
          </p>
        </div>
        <Link
          href="/requisicoes/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Requisicao
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por numero, descricao, vinculo ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-teal-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                !
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vinculo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : (
                <>
                  {requisitions.map((req, index) => (
                    <tr
                      key={req.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-900">{req.number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[req.type]}`}>
                          {typeLabels[req.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{req.description}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-teal-600">{req.linkedRef}</span>
                        {req.linkedRefType && (
                          <span className="text-xs text-slate-400 ml-1">({req.linkedRefType})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{req.solicitante}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status]}`}>
                          {statusLabels[req.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {req.date ? new Date(req.date).toLocaleDateString('pt-BR') : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/requisicoes/${req.id}`}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/requisicoes/${req.id}`}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {requisitions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                        Nenhuma requisicao encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{requisitions.length}</span> de{' '}
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
            <span className="text-sm text-slate-700">
              Pagina {page} de {totalPages || 1}
            </span>
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
