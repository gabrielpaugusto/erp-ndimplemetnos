'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, X, ChevronLeft, ChevronRight,
  Calendar, RefreshCw, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, SlidersHorizontal,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

type MoveType = 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'CONSUMO_INTERNO' | 'DEVOLUCAO';

interface Movement {
  id: string;
  type: MoveType;
  source?: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  date: string;
  createdAt?: string;
  product?: { code: string; description: string; name?: string } | null;
  location?: { name: string; code: string } | null;
  locationDestination?: { name: string; code: string } | null;
  destinationLocation?: { name: string; code: string } | null;
  user?: { name: string } | null;
}

const typeLabels: Record<MoveType, string> = {
  ENTRADA: 'Entrada', SAIDA: 'Saida', TRANSFERENCIA: 'Transferencia',
  AJUSTE_POSITIVO: 'Ajuste Positivo', AJUSTE_NEGATIVO: 'Ajuste Negativo',
  CONSUMO_INTERNO: 'Consumo Interno', DEVOLUCAO: 'Devolucao',
};
const typeColors: Record<MoveType, string> = {
  ENTRADA: 'bg-emerald-100 text-emerald-700',
  SAIDA: 'bg-red-100 text-red-700',
  TRANSFERENCIA: 'bg-blue-100 text-blue-700',
  AJUSTE_POSITIVO: 'bg-emerald-100 text-emerald-700',
  AJUSTE_NEGATIVO: 'bg-orange-100 text-orange-700',
  CONSUMO_INTERNO: 'bg-purple-100 text-purple-700',
  DEVOLUCAO: 'bg-cyan-100 text-cyan-700',
};
const typeIcons: Record<MoveType, React.ReactNode> = {
  ENTRADA: <ArrowDownToLine className="w-3.5 h-3.5" />,
  SAIDA: <ArrowUpFromLine className="w-3.5 h-3.5" />,
  TRANSFERENCIA: <ArrowLeftRight className="w-3.5 h-3.5" />,
  AJUSTE_POSITIVO: <ArrowDownToLine className="w-3.5 h-3.5" />,
  AJUSTE_NEGATIVO: <ArrowUpFromLine className="w-3.5 h-3.5" />,
  CONSUMO_INTERNO: <SlidersHorizontal className="w-3.5 h-3.5" />,
  DEVOLUCAO: <ArrowLeftRight className="w-3.5 h-3.5" />,
};

const fmt = (v: number) => fmtCurrency(v);
const fmtDate = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function MovimentacoesEstoquePage() {
  const [items, setItems] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (typeFilter) params.set('type', typeFilter);
    if (dateFrom) params.set('startDate', dateFrom);
    if (dateTo) params.set('endDate', dateTo);
    if (search) params.set('search', search);

    const res = await apiFetch(`/api/inventory/movements?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data ?? data);
      setTotal(data.meta?.total ?? data.total ?? (data.data ?? data).length);
    }
    setLoading(false);
  }, [page, typeFilter, dateFrom, dateTo, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [typeFilter, dateFrom, dateTo, search]);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = !!(search || typeFilter || dateFrom || dateTo);
  const clearFilters = () => { setSearch(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Movimentacoes de Estoque</h1>
          <p className="text-slate-500 mt-1">Historico de entradas, saidas, transferencias e ajustes</p>
        </div>
        <Link href="/estoque/movimentacoes/nova" className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nova Movimentacao
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por produto, codigo ou origem..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" /> Filtros
          </button>
          <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Todos</option>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data De</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Ate</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Data', 'Produto', 'Local', 'Tipo', 'Origem', 'Qtd', 'Custo Unit.', 'Usuario'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 5 ? 'text-center' : i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma movimentacao encontrada.</td></tr>
              ) : items.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" />{fmtDate(mov.date ?? mov.createdAt ?? '')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{mov.product?.description ?? mov.product?.name ?? '—'}</div>
                    <div className="text-xs text-slate-500 font-mono">{mov.product?.code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-mono">
                    {mov.location?.code ?? '—'}
                    {(mov.locationDestination ?? mov.destinationLocation) && ` → ${(mov.locationDestination ?? mov.destinationLocation)!.code}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[mov.type]}`}>
                      {typeIcons[mov.type]} {typeLabels[mov.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{mov.source ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">{mov.quantity}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 text-right">{mov.unitCost != null ? fmt(mov.unitCost) : '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{mov.user?.name ?? '—'}</td>
                </tr>
              ))}
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
