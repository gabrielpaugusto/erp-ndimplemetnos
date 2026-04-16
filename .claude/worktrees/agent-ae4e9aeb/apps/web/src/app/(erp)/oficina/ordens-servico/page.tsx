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
  Wrench,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type OSStatus = 'ABERTA' | 'AGUARDANDO_PECAS' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'ENTREGUE' | 'CANCELADA';
type OSType = 'MANUTENCAO' | 'REFORMA' | 'INSTALACAO' | 'GARANTIA' | 'ORCAMENTO';
type Priority = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

interface ServiceOrder {
  id: string;
  number: string;
  client: string;
  vehicleDescription: string;
  plate: string;
  type: OSType;
  status: OSStatus;
  priority: Priority;
  entryDate: string;
  expectedDate: string;
}

const statusLabels: Record<OSStatus, string> = {
  ABERTA: 'Aberta',
  AGUARDANDO_PECAS: 'Aguardando Pecas',
  EM_EXECUCAO: 'Em Execução',
  CONCLUIDA: 'Concluída',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<OSStatus, string> = {
  ABERTA: 'bg-slate-100 text-slate-600',
  AGUARDANDO_PECAS: 'bg-amber-100 text-amber-700',
  EM_EXECUCAO: 'bg-rose-100 text-rose-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  ENTREGUE: 'bg-blue-100 text-blue-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const typeLabels: Record<OSType, string> = {
  MANUTENCAO: 'Manutencao',
  REFORMA: 'Reforma',
  INSTALACAO: 'Instalacao',
  GARANTIA: 'Garantia',
  ORCAMENTO: 'Orcamento',
};

const priorityLabels: Record<Priority, string> = {
  URGENTE: 'URGENTE',
  ALTA: 'ALTA',
  NORMAL: 'NORMAL',
  BAIXA: 'BAIXA',
};

const priorityColors: Record<Priority, string> = {
  URGENTE: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  BAIXA: 'bg-gray-100 text-gray-600',
};

export default function OrdensServicoListPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await apiFetch(`/api/service-orders?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();

      const mapped: ServiceOrder[] = (json.data ?? []).map((o: any) => ({
        id: o.id,
        number: o.numero,
        client: o.person?.razaoSocial ?? '',
        vehicleDescription: o.veiculoDescricao ?? '',
        plate: o.veiculoPlaca ?? '',
        type: o.type as OSType,
        status: o.status as OSStatus,
        priority: o.priority as Priority,
        entryDate: o.dataEntrada ? o.dataEntrada.slice(0, 10) : '',
        expectedDate: o.dataPrevisao ? o.dataPrevisao.slice(0, 10) : '',
      }));

      setOrders(mapped);
      setTotal(json.meta?.total ?? mapped.length);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, priorityFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, priorityFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPriorityFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = search || statusFilter || typeFilter || priorityFilter || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Servico</h1>
          <p className="text-slate-500 mt-1">
            Gerencie e acompanhe todas as ordens de servico da oficina
          </p>
        </div>
        <Link
          href="/oficina/ordens-servico/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem de Servico
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por numero, cliente, veiculo ou placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-rose-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                {Object.entries(priorityLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Inicio</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Veiculo / Placa</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Periodo</th>
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
                  {orders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-900">{order.number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">{order.client}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-slate-900">{order.vehicleDescription}</p>
                          <p className="text-xs font-mono text-slate-500">{order.plate}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700">
                          {typeLabels[order.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${priorityColors[order.priority]}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {order.entryDate ? new Date(order.entryDate).toLocaleDateString('pt-BR') : '—'}
                          {order.expectedDate ? ` — ${new Date(order.expectedDate).toLocaleDateString('pt-BR')}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/oficina/ordens-servico/${order.id}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/oficina/ordens-servico/${order.id}`}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                        Nenhuma ordem de servico encontrada com os filtros selecionados.
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
            Mostrando <span className="font-medium">{orders.length}</span> de{' '}
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
