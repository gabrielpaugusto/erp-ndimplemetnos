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
  ShoppingCart,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';

type OrderStatus = 'RASCUNHO' | 'ENVIADA' | 'CONFIRMADA' | 'PARCIAL_RECEBIDA' | 'RECEBIDA' | 'CANCELADA';

interface PurchaseOrder {
  id: string;
  number: string;
  supplier: string;
  total: number;
  deliveryDate: string;
  status: OrderStatus;
  receivedPercent: number;
  createdAt: string;
}

const statusLabels: Record<OrderStatus, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada',
  CONFIRMADA: 'Confirmada',
  PARCIAL_RECEBIDA: 'Parcial Recebida',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<OrderStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  ENVIADA: 'bg-blue-100 text-blue-700',
  CONFIRMADA: 'bg-emerald-100 text-emerald-700',
  PARCIAL_RECEBIDA: 'bg-amber-100 text-amber-700',
  RECEBIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function PedidosCompraListPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ data: any[]; meta: { total: number; totalPages: number } }>(
        '/purchasing/orders',
        {
          params: {
            search: search || undefined,
            status: statusFilter || undefined,
            page,
            limit,
          },
        },
      );
      const mapped: PurchaseOrder[] = result.data.map((o) => {
        const totalQty = (o.items ?? []).reduce((s: number, i: any) => s + Number(i.quantity ?? 0), 0);
        const receivedQty = (o.items ?? []).reduce((s: number, i: any) => s + Number(i.quantityReceived ?? 0), 0);
        const receivedPercent = totalQty > 0 ? Math.round((receivedQty / totalQty) * 100) : 0;
        return {
          id: o.id,
          number: o.numero,
          supplier: o.supplier?.razaoSocial ?? o.supplier?.nomeFantasia ?? '',
          total: Number(o.totalValue ?? 0),
          deliveryDate: o.dataEntregaPrevista ?? o.dataEmissao ?? '',
          status: o.status as OrderStatus,
          receivedPercent,
          createdAt: o.createdAt ?? '',
        };
      });
      setOrders(mapped);
      setTotal(result.meta.total);
    } catch {
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || statusFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos de Compra</h1>
          <p className="text-slate-500 mt-1">Gerencie pedidos de compra enviados aos fornecedores</p>
        </div>
        <Link href="/compras/pedidos/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Novo Pedido
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por numero ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" /> Filtros
          </button>
          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700"><X className="w-4 h-4" /> Limpar</button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrega</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Recebimento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Carregando...</td></tr>
              ) : orders.map((order, index) => (
                <tr key={order.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{order.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{order.supplier}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${order.receivedPercent === 100 ? 'bg-emerald-500' : order.receivedPercent > 0 ? 'bg-amber-500' : 'bg-slate-200'}`} style={{ width: `${order.receivedPercent}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600 w-10 text-right">{order.receivedPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/compras/pedidos/${order.id}`} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Visualizar"><Eye className="w-4 h-4" /></Link>
                      <Link href={`/compras/pedidos/${order.id}`} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="Editar"><Edit className="w-4 h-4" /></Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum pedido encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">Mostrando <span className="font-medium">{orders.length}</span> de <span className="font-medium">{total}</span> registros</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" /> Anterior</button>
            <span className="text-sm text-slate-700">Pagina {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Proxima <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
