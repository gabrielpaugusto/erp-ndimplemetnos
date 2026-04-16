'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';

type ConsortiumStatus = 'ATIVO' | 'CONTEMPLADO' | 'ENCERRADO' | 'CANCELADO';

interface Consortium {
  id: string;
  grupo: string;
  cota: string;
  clientName: string;
  administradora: string;
  valorCredito: number;
  parcelasPagas: number;
  parcelasTotal: number;
  status: ConsortiumStatus;
}

const statusLabels: Record<ConsortiumStatus, string> = {
  ATIVO: 'Ativo',
  CONTEMPLADO: 'Contemplado',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<ConsortiumStatus, string> = {
  ATIVO: 'bg-blue-100 text-blue-700',
  CONTEMPLADO: 'bg-emerald-100 text-emerald-700',
  ENCERRADO: 'bg-slate-100 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-700',
};


const formatCurrency = (value: number) => fmtCurrency(value);

export default function ConsorcioListPage() {
  const [consortia, setConsortia] = useState<Consortium[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      apiFetch(`/api/fi/consortium?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          const mapped: Consortium[] = (json.data ?? []).map((item: any) => ({
            id: item.id,
            grupo: item.grupo ?? '',
            cota: item.cota ?? '',
            clientName: item.person?.razaoSocial ?? item.person?.nomeFantasia ?? '',
            administradora: item.administradora?.nomeFantasia ?? item.administradora?.razaoSocial ?? '',
            valorCredito: item.valorCredito ?? 0,
            parcelasPagas: item.parcelasPagas ?? 0,
            parcelasTotal: item.parcelasMensais ?? 0,
            status: item.status as ConsortiumStatus,
          }));
          setConsortia(mapped);
          setTotal(json.meta?.total ?? mapped.length);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
  }, [search, statusFilter, page]);

  const totalPages = Math.ceil(total / limit);
  const paginatedConsortia = consortia;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consórcios</h1>
          <p className="text-slate-500 mt-1">
            Gerencie cotas de consórcio e acompanhe contemplações
          </p>
        </div>
        <Link
          href="/fi/consorcio/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Cota Consórcio
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, grupo, cota ou administradora..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-violet-50 border-violet-300 text-violet-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-violet-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grupo/Cota</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administradora</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Crédito</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Parcelas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedConsortia.map((con, index) => {
                const progressPct = Math.round((con.parcelasPagas / con.parcelasTotal) * 100);
                return (
                  <tr
                    key={con.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 font-mono">{con.grupo} / {con.cota}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{con.clientName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{con.administradora}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {formatCurrency(con.valorCredito)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-slate-600">{con.parcelasPagas}/{con.parcelasTotal}</span>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              progressPct >= 100 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-violet-500' : 'bg-violet-400'
                            }`}
                            style={{ width: `${Math.min(progressPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[con.status]}`}>
                        {statusLabels[con.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/fi/consorcio/${con.id}`}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/fi/consorcio/${con.id}`}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedConsortia.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhum consórcio encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            {loading ? 'Carregando...' : (
              <>Mostrando <span className="font-medium">{paginatedConsortia.length}</span> de{' '}
              <span className="font-medium">{total}</span> registros</>
            )}
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
