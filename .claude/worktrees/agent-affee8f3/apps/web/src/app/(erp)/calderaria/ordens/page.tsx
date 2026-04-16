'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Flame,
  Calendar,
} from 'lucide-react';

type CldStatus = 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA';
type ServiceType = 'CORTE' | 'DOBRA' | 'SOLDA' | 'CONFORMACAO' | 'USINAGEM' | 'TRATAMENTO_TERMICO' | 'JATEAMENTO' | 'MONTAGEM_ESTRUTURAL';

interface CalderariaOrder {
  id: string;
  number: string;
  serviceType: ServiceType;
  description: string;
  linkedRef: string;
  linkedRefType: string;
  status: CldStatus;
  estimatedTime: string;
  realTime: string;
  createdAt: string;
}

const statusLabels: Record<CldStatus, string> = {
  PENDENTE: 'Pendente',
  EM_EXECUCAO: 'Em Execução',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<CldStatus, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600',
  EM_EXECUCAO: 'bg-zinc-100 text-zinc-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const serviceTypeLabels: Record<ServiceType, string> = {
  CORTE: 'Corte',
  DOBRA: 'Dobra',
  SOLDA: 'Solda',
  CONFORMACAO: 'Conformação',
  USINAGEM: 'Usinagem',
  TRATAMENTO_TERMICO: 'Trat. Térmico',
  JATEAMENTO: 'Jateamento',
  MONTAGEM_ESTRUTURAL: 'Montagem Estrutural',
};

const serviceTypeColors: Record<ServiceType, string> = {
  CORTE: 'bg-zinc-100 text-zinc-700',
  DOBRA: 'bg-slate-100 text-slate-700',
  SOLDA: 'bg-zinc-200 text-zinc-800',
  CONFORMACAO: 'bg-slate-200 text-slate-700',
  USINAGEM: 'bg-zinc-50 text-zinc-600',
  TRATAMENTO_TERMICO: 'bg-amber-100 text-amber-700',
  JATEAMENTO: 'bg-slate-100 text-slate-600',
  MONTAGEM_ESTRUTURAL: 'bg-zinc-100 text-zinc-700',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(raw: any): CalderariaOrder {
  const linkedRef = raw.serviceOrder?.numero || raw.productionOrder?.numero || '';
  const linkedRefType = raw.serviceOrder ? 'OS' : raw.productionOrder ? 'OP' : '';
  const estimatedTime = raw.tempoEstimado != null ? `${raw.tempoEstimado}h` : '-';
  const realTime = raw.tempoReal != null ? `${raw.tempoReal}h` : '-';
  return {
    id: raw.id,
    number: raw.numero,
    serviceType: raw.serviceType as ServiceType,
    description: raw.description,
    linkedRef,
    linkedRefType,
    status: raw.status as CldStatus,
    estimatedTime,
    realTime,
    createdAt: raw.createdAt,
  };
}

export default function CalderariaOrdensListPage() {
  const [orders, setOrders] = useState<CalderariaOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (serviceTypeFilter) params.set('type', serviceTypeFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await apiFetch(`/api/calderaria?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar ordens');
      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setOrders((json.data || []).map((o: any) => mapOrder(o)));
      setTotal(json.meta?.total ?? 0);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, serviceTypeFilter, page, limit]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, serviceTypeFilter]);

  const paginatedItems = orders;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setServiceTypeFilter('');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter || serviceTypeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Calderaria</h1>
          <p className="text-slate-500 mt-1">
            Gerencie ordens de corte, solda, dobra e fabricacao pesada
          </p>
        </div>
        <Link
          href="/calderaria/ordens/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem de Calderaria
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por numero, descricao ou vinculo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-zinc-50 border-zinc-300 text-zinc-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-zinc-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Servico</label>
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(serviceTypeLabels).map(([key, label]) => (
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
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo Servico</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vinculo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Real</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.map((order, index) => (
                <tr
                  key={order.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{order.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${serviceTypeColors[order.serviceType]}`}>
                      {serviceTypeLabels[order.serviceType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{order.description}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-zinc-600">{order.linkedRef}</span>
                    <span className="text-xs text-slate-400 ml-1">({order.linkedRefType})</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center font-medium">{order.estimatedTime}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={`font-medium ${order.realTime === '-' ? 'text-slate-400' : 'text-zinc-700'}`}>
                      {order.realTime}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/calderaria/ordens/${order.id}`}
                        className="p-1.5 text-slate-400 hover:text-zinc-600 hover:bg-zinc-50 rounded transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/calderaria/ordens/${order.id}`}
                        className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhuma ordem de calderaria encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{paginatedItems.length}</span> de{' '}
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
              Pagina {page} de {totalPages}
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
