'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, X, ChevronLeft, ChevronRight,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface StockBalance {
  id: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity?: number;
  averageCost: number;
  avgCost?: number;
  totalCost: number;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  product?: {
    code: string; description: string; name?: string; unit: string;
    estoqueMinimo?: number; estoqueMaximo?: number;
  } | null;
  location?: { code: string; name: string } | null;
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function SaldosEstoquePage() {
  const [items, setItems] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [belowMin, setBelowMin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (belowMin) params.set('belowMinStock', 'true');

    const res = await apiFetch(`/api/inventory/balances?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data ?? data);
      setTotal(data.meta?.total ?? data.total ?? (data.data ?? data).length);
    }
    setLoading(false);
  }, [page, search, belowMin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, belowMin]);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = !!(search || belowMin);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saldos de Estoque</h1>
          <p className="text-slate-500 mt-1">Consulte saldos, custos e pontos de reposicao por produto e local</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por codigo ou nome do produto..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" /> Filtros
          </button>
          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setBelowMin(false); }} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={belowMin} onChange={(e) => setBelowMin(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500" />
              <span className="text-sm text-slate-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Somente abaixo do minimo
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Codigo', 'Produto', 'Local', 'Qtd', 'Reservado', 'Disponivel', 'Custo Medio', 'Custo Total', 'Min/Max/Rep'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i >= 3 && i <= 5 ? 'text-center' : i >= 6 && i <= 7 ? 'text-right' : i === 8 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum saldo encontrado.</td></tr>
              ) : items.map((b) => {
                const available = Number(b.availableQuantity ?? (Number(b.quantity) - Number(b.reservedQuantity)));
                const reorderPoint = Number(b.reorderPoint ?? 0);
                const isBelowReorder = reorderPoint > 0 && available < reorderPoint;
                const minStockVal = Number(b.minStock ?? b.product?.estoqueMinimo ?? 0);
                const maxStockVal = Number(b.maxStock ?? b.product?.estoqueMaximo ?? 0);
                return (
                  <tr key={b.id} className={`hover:bg-slate-50 transition-colors ${isBelowReorder ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{b.product?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                      <div className="flex items-center gap-1">
                        {isBelowReorder && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        {b.product?.description ?? b.product?.name ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-mono">{b.location?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">{Number(b.quantity)}</td>
                    <td className="px-4 py-3 text-sm text-amber-600 text-center font-medium">{Number(b.reservedQuantity)}</td>
                    <td className={`px-4 py-3 text-sm font-bold text-center ${isBelowReorder ? 'text-red-600' : 'text-emerald-700'}`}>{available}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">{fmt(Number(b.averageCost ?? b.avgCost ?? 0))}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{fmt(Number(b.totalCost))}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 text-center">
                      {minStockVal || '?'}/{maxStockVal || '?'}/{reorderPoint || '?'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">Total: <span className="font-medium">{total}</span> registros</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm text-slate-700">Pagina {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
              Proxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
