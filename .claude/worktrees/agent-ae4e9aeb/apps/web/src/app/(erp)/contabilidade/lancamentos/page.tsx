'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, X, Eye, ChevronLeft, ChevronRight,
  BookOpen, Calendar, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type EntryStatus = 'RASCUNHO' | 'LANCADO' | 'ESTORNADO';

interface JournalEntry {
  id: string;
  numero?: string;
  number?: string;
  date: string;
  description: string;
  totalValue?: number;
  totalDebito?: number;
  status: EntryStatus;
}

const statusLabels: Record<EntryStatus, string> = {
  RASCUNHO: 'Rascunho', LANCADO: 'Lançado', ESTORNADO: 'Estornado',
};
const statusColors: Record<EntryStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  LANCADO: 'bg-emerald-100 text-emerald-700',
  ESTORNADO: 'bg-red-100 text-red-700',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');

export default function LancamentosListPage() {
  const [items, setItems] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    const res = await apiFetch(`/api/accounting/journal?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data ?? data);
      setTotal(data.meta?.total ?? data.total ?? (data.data ?? data).length);
    }
    setLoading(false);
  }, [page, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / limit);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); };
  const hasActiveFilters = !!(search || statusFilter || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lancamentos Contabeis</h1>
          <p className="text-slate-500 mt-1">Gerencie os lancamentos do diario contabil</p>
        </div>
        <Link href="/contabilidade/lancamentos/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Lancamento
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por numero ou descricao..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" /> Filtros
            {hasActiveFilters && <span className="bg-violet-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Inicio</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Numero', 'Data', 'Descricao', 'Valor', 'Status', 'Acoes'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 3 ? 'text-right' : i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum lancamento encontrado.</td></tr>
              ) : items.map((entry, index) => (
                <tr key={entry.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{entry.numero ?? entry.number ?? entry.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {fmtDate(entry.date)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{entry.description}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                    {fmt(entry.totalValue ?? entry.totalDebito ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusLabels[entry.status] ?? entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/contabilidade/lancamentos/${entry.id}`} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors inline-flex">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
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
