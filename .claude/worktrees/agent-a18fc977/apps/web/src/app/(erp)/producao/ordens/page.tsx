'use client';

import { useState, useEffect } from 'react';
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
  ClipboardList,
  Calendar, Factory,
} from 'lucide-react';

type OrderStatus = 'PLANEJADA' | 'LIBERADA' | 'EM_PRODUCAO' | 'CONCLUIDA' | 'CANCELADA';
type Strategy = 'ATO' | 'MTO' | 'MTS';
type OrderType = 'NORMAL' | 'RETRABALHO' | 'PROTOTIPO';

interface ProductionOrder {
  id: string;
  number: string;
  product: string;
  strategy: Strategy;
  type: OrderType;
  quantity: number;
  produced: number;
  status: OrderStatus;
  priority: number;
  startDate: string;
  endDate: string;
  saleOrder: string | null;
}

const statusLabels: Record<OrderStatus, string> = {
  PLANEJADA: 'Planejada',
  LIBERADA: 'Liberada',
  EM_PRODUCAO: 'Em Produção',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<OrderStatus, string> = {
  PLANEJADA: 'bg-slate-100 text-slate-600',
  LIBERADA: 'bg-sky-100 text-sky-700',
  EM_PRODUCAO: 'bg-blue-100 text-blue-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const strategyColors: Record<Strategy, string> = {
  ATO: 'bg-sky-100 text-sky-700',
  MTO: 'bg-blue-100 text-blue-700',
  MTS: 'bg-indigo-100 text-indigo-700',
};

const typeLabels: Record<OrderType, string> = {
  NORMAL: 'Normal',
  RETRABALHO: 'Retrabalho',
  PROTOTIPO: 'Protótipo',
};

export default function OrdensProducaoListPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (strategyFilter) params.set('strategy', strategyFilter);
    if (typeFilter) params.set('type', typeFilter);
    params.set('page', String(page));
    params.set('limit', String(limit));

    apiFetch(`/api/production/orders?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then((d: any) => {
        const rows = Array.isArray(d) ? d : (d.data ?? []);
        setOrders(rows.map((o: any) => ({
          id: o.id,
          number: o.numero ?? o.number ?? '',
          product: o.product?.description ?? o.product?.descricao ?? o.productName ?? '',
          strategy: o.strategy,
          type: o.type,
          quantity: o.quantity ?? o.quantidade ?? 0,
          produced: o.quantityProduced ?? o.produced ?? o.quantidadeProduzida ?? 0,
          status: o.status,
          priority: o.priority ?? o.prioridade ?? 5,
          startDate: o.dataInicioPrevista ?? o.startDate ?? o.plannedStartDate ?? '',
          endDate: o.dataFimPrevista ?? o.endDate ?? o.plannedEndDate ?? '',
          saleOrder: o.saleOrder?.numero ?? o.saleOrder?.number ?? o.saleOrderNumber ?? null,
        })));
        setTotal(d.meta?.total ?? d.total ?? (Array.isArray(d) ? d.length : 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [search, statusFilter, strategyFilter, typeFilter, page, limit]);

  const totalPages = Math.ceil(total / limit);
  const paginatedItems = orders;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setStrategyFilter('');
    setTypeFilter('');
  };

  const hasActiveFilters = search || statusFilter || strategyFilter || typeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Produção</h1>
          <p className="text-slate-500 mt-1">
            Gerencie e acompanhe todas as ordens de produção da fábrica
          </p>
        </div>
        <Link
          href="/producao/ordens/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem de Produção
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número ou produto..."
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
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estratégia</label>
              <select
                value={strategyFilter}
                onChange={(e) => setStrategyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                <option value="ATO">ATO — Assemble to Order</option>
                <option value="MTO">MTO — Make to Order</option>
                <option value="MTS">MTS — Make to Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-12 text-slate-400">Carregando...</div>}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estratégia</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progresso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Período</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">PV</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.map((order, index) => {
                const progress = order.quantity > 0 ? Math.round((order.produced / order.quantity) * 100) : 0;
                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{order.number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{order.product}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${strategyColors[order.strategy]}`}>
                        {order.strategy}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        order.priority >= 8 ? 'bg-red-100 text-red-700' : order.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px]">
                          <div
                            className={`h-2 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                          {order.produced}/{order.quantity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(order.startDate).toLocaleDateString('pt-BR')} — {new Date(order.endDate).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-600 font-medium">
                      {order.saleOrder || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/producao/ordens/${order.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/producao/ordens/${order.id}`}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhuma ordem de produção encontrada com os filtros selecionados.
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
              Página {page} de {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
