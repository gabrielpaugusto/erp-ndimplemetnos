'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Factory,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type WorkCenterType = 'FABRICACAO' | 'MONTAGEM' | 'PINTURA' | 'CALDERARIA' | 'ACABAMENTO' | 'INSPECAO';

interface WorkCenter {
  id: string;
  code: string;
  name: string;
  type: WorkCenterType;
  capacidadeHora: number;
  custoHora: number;
  active: boolean;
  description?: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const typeLabels: Record<WorkCenterType, string> = {
  FABRICACAO: 'Fabricação',
  MONTAGEM: 'Montagem',
  PINTURA: 'Pintura',
  CALDERARIA: 'Calderaria',
  ACABAMENTO: 'Acabamento',
  INSPECAO: 'Inspeção',
};

const typeColors: Record<WorkCenterType, string> = {
  FABRICACAO: 'bg-amber-100 text-amber-700',
  MONTAGEM: 'bg-orange-100 text-orange-700',
  PINTURA: 'bg-yellow-100 text-yellow-700',
  CALDERARIA: 'bg-red-100 text-red-700',
  ACABAMENTO: 'bg-cyan-100 text-cyan-700',
  INSPECAO: 'bg-emerald-100 text-emerald-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto" />
        </td>
      ))}
    </tr>
  );
}

export default function CentrosTrabalhoListPage() {
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (typeFilter) params.set('type', typeFilter);

      const res = await apiFetch(`/api/pcp/work-centers?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar centros de trabalho');
      const data = await res.json();
      setWorkCenters(data.data);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  const toggleActive = async (wc: WorkCenter) => {
    setTogglingId(wc.id);
    try {
      const res = await apiFetch(`/api/pcp/work-centers/${wc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !wc.active }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar status');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (wc: WorkCenter) => {
    if (!confirm(`Deseja excluir o centro de trabalho "${wc.name}" (${wc.code})?`)) return;
    setDeletingId(wc.id);
    try {
      const res = await apiFetch(`/api/pcp/work-centers/${wc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir centro de trabalho');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
  };

  const hasActiveFilters = search || typeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Centros de Trabalho</h1>
          <p className="text-slate-500 mt-1">
            Gerencie os centros de trabalho da fábrica e suas capacidades
          </p>
        </div>
        <Link
          href="/pcp/centros-trabalho/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Centro de Trabalho
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, nome ou descrição..."
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacidade/h</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo/Hora</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ativo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : workCenters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Factory className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Nenhum centro de trabalho encontrado.</p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-sm text-amber-600 hover:text-amber-700 underline"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                workCenters.map((wc, index) => (
                  <tr
                    key={wc.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Factory className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 font-mono">{wc.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-slate-900">{wc.name}</span>
                        {wc.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{wc.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[wc.type]}`}>
                        {typeLabels[wc.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">{wc.capacidadeHora} un/h</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {formatCurrency(wc.custoHora)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(wc)}
                        disabled={togglingId === wc.id}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                          wc.active
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {wc.active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                        {wc.active ? 'Sim' : 'Não'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/pcp/centros-trabalho/${wc.id}`}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Visualizar / Editar"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(wc)}
                          disabled={deletingId === wc.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{workCenters.length}</span> de{' '}
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
