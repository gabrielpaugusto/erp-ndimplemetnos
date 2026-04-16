'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { EmptyStateRow } from '@/components/ui/empty-state';
import { fmtCurrency } from '@/lib/format';

type OrderStatus =
  | 'RASCUNHO'
  | 'PENDENTE_APROVACAO'
  | 'APROVADO'
  | 'FATURADO'
  | 'ENTREGUE'
  | 'CANCELADO';

type SaleType =
  | 'ESTOQUE_PROPRIO'
  | 'VENDA_DIRETA'
  | 'PRODUCAO_PROPRIA'
  | 'VENDA_PECA'
  | 'SERVICO_OFICINA'
  | 'FI_CONSORCIO'
  | 'FI_FINANCIAMENTO'
  | 'FI_SEGURO';

interface SaleOrder {
  id: string;
  numero: number;
  createdAt: string;
  person: { id: string; razaoSocial: string; nomeFantasia?: string } | null;
  saleType: SaleType;
  _count: { items: number };
  total: number | string;
  status: OrderStatus;
  vendedor?: { id: string; name: string } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const statusLabels: Record<OrderStatus, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE_APROVACAO: 'Pend. Aprovação',
  APROVADO: 'Aprovado',
  FATURADO: 'Faturado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<OrderStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  PENDENTE_APROVACAO: 'bg-yellow-100 text-yellow-700',
  APROVADO: 'bg-emerald-100 text-emerald-700',
  FATURADO: 'bg-blue-100 text-blue-700',
  ENTREGUE: 'bg-teal-100 text-teal-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

const saleTypeLabels: Record<SaleType, string> = {
  ESTOQUE_PROPRIO: 'Estoque Próprio',
  VENDA_DIRETA: 'Venda Direta',
  PRODUCAO_PROPRIA: 'Produção Própria',
  VENDA_PECA: 'Venda de Peça',
  SERVICO_OFICINA: 'Serviço Oficina',
  FI_CONSORCIO: 'Consórcio',
  FI_FINANCIAMENTO: 'Financiamento',
  FI_SEGURO: 'Seguro',
};

const saleTypeColors: Record<SaleType, string> = {
  ESTOQUE_PROPRIO: 'bg-blue-100 text-blue-700',
  VENDA_DIRETA: 'bg-purple-100 text-purple-700',
  PRODUCAO_PROPRIA: 'bg-orange-100 text-orange-700',
  VENDA_PECA: 'bg-cyan-100 text-cyan-700',
  SERVICO_OFICINA: 'bg-green-100 text-green-700',
  FI_CONSORCIO: 'bg-pink-100 text-pink-700',
  FI_FINANCIAMENTO: 'bg-indigo-100 text-indigo-700',
  FI_SEGURO: 'bg-rose-100 text-rose-700',
};

const formatCurrency = (value: number | string) => fmtCurrency(Number(value));

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 rounded" />
        </td>
      ))}
    </tr>
  );
}

export default function PedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (saleTypeFilter) params.set('saleType', saleTypeFilter);

      const res = await apiFetch(`/api/sales/orders?${params}`);
      if (!res.ok) throw new Error('Falha ao carregar pedidos');
      const json = await res.json();
      setOrders(json.data || []);
      setMeta(json.meta || { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, saleTypeFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchOrders, search]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSaleTypeFilter('');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter || saleTypeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos de Venda</h1>
          <p className="text-slate-500 mt-1">
            Gerencie pedidos de venda e acompanhe o status de faturamento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/comercial/pedidos/novo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número ou cliente..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Venda</label>
              <select
                value={saleTypeFilter}
                onChange={(e) => { setSaleTypeFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {Object.entries(saleTypeLabels).map(([key, label]) => (
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Itens</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <ShoppingCart className="w-10 h-10" />
                      <p className="text-sm font-medium">Nenhum pedido encontrado</p>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="text-blue-600 text-xs hover:underline">
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const saleType = order.saleType as SaleType;
                  const status = order.status as OrderStatus;
                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-900">
                            PV-{String(order.numero).padStart(4, '0')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {order.person?.razaoSocial || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            saleTypeColors[saleType] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {saleTypeLabels[saleType] || saleType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-center">
                        {order._count?.items ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            statusColors[status] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabels[status] || status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/comercial/pedidos/${order.id}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Visualizar pedido"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {status === 'FATURADO' && (
                            <span
                              className="p-1.5 text-emerald-400"
                              title="Pedido faturado"
                            >
                              <FileText className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando{' '}
            <span className="font-medium">{orders.length}</span> de{' '}
            <span className="font-medium">{meta.total}</span> registros
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <span className="text-sm text-slate-700">
              Página {meta.page} de {meta.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages || loading}
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
