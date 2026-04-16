'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type PointingType = 'MAO_DE_OBRA' | 'MATERIAL' | 'SETUP' | 'PARADA';

interface Pointing {
  id: string;
  productionOrder: { id: string; numero: string } | null;
  workCenter: { code: string; name: string } | null;
  type: PointingType;
  dataInicio: string;
  dataFim: string | null;
  quantityProduced: number | null;
  quantityRejected: number | null;
  user: { name: string } | null;
  observations: string | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const typeLabels: Record<PointingType, string> = {
  MAO_DE_OBRA: 'Mão de Obra',
  MATERIAL: 'Material',
  SETUP: 'Setup',
  PARADA: 'Parada',
};

const typeColors: Record<PointingType, string> = {
  MAO_DE_OBRA: 'bg-blue-100 text-blue-700',
  MATERIAL: 'bg-emerald-100 text-emerald-700',
  SETUP: 'bg-amber-100 text-amber-700',
  PARADA: 'bg-red-100 text-red-700',
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return '-';
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs <= 0) return '-';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
}

function formatTime(dt: string): string {
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ApontamentosListPage() {
  const [pointings, setPointings] = useState<Pointing[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const fetchPointings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await apiFetch(`/api/production/pointing?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let items: Pointing[] = data.data || [];

        // Client-side filter for search (by order number, operator, observation)
        if (search) {
          const q = search.toLowerCase();
          items = items.filter(
            (p) =>
              (p.productionOrder?.numero || '').toLowerCase().includes(q) ||
              (p.user?.name || '').toLowerCase().includes(q) ||
              (p.observations || '').toLowerCase().includes(q)
          );
        }

        setPointings(items);
        setMeta(data.meta || { total: items.length, page, limit: 20, totalPages: 1 });
      }
    } catch (err) {
      console.error('Erro ao carregar apontamentos:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, page, search]);

  useEffect(() => {
    fetchPointings();
  }, [fetchPointings]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setPage(1);
  };

  const hasActiveFilters = search || typeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Apontamentos de Produção</h1>
          <p className="text-slate-500 mt-1">
            Registro de tempo, materiais e paradas nas ordens de produção
          </p>
        </div>
        <Link
          href="/producao/apontamentos/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Apontamento
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ordem, operador ou observação..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-sky-50 border-sky-300 text-sky-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-sky-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ordem</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro Trabalho</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Período</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duração</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produzido</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejeitado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Operador</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : pointings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhum apontamento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                pointings.map((pt, index) => (
                  <tr
                    key={pt.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(pt.dataInicio).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {pt.productionOrder ? (
                        <Link
                          href={`/producao/ordens/${pt.productionOrder.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          {pt.productionOrder.numero}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {pt.workCenter ? `${pt.workCenter.code} — ${pt.workCenter.name}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[pt.type] || 'bg-slate-100 text-slate-600'}`}>
                        {typeLabels[pt.type] || pt.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 text-center font-mono">
                      {formatTime(pt.dataInicio)} — {pt.dataFim ? formatTime(pt.dataFim) : '...'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 text-center">
                      {formatDuration(pt.dataInicio, pt.dataFim)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {pt.quantityProduced && pt.quantityProduced > 0 ? (
                        <span className="font-semibold text-emerald-700">{pt.quantityProduced}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {pt.quantityRejected && pt.quantityRejected > 0 ? (
                        <span className="font-semibold text-red-600">{pt.quantityRejected}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{pt.user?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {pt.productionOrder && (
                          <Link
                            href={`/producao/ordens/${pt.productionOrder.id}`}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                            title="Ver Ordem"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
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
            Mostrando <span className="font-medium">{pointings.length}</span> de{' '}
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
