'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtPercent } from '@/lib/format';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Landmark,
} from 'lucide-react';

type FinancingType = 'FINAME' | 'CDC' | 'LEASING' | 'CONSORCIO' | 'DIRETO';
type FinancingStatus = 'SIMULACAO' | 'PROPOSTA' | 'ANALISE' | 'APROVADO' | 'CONTRATADO' | 'LIBERADO' | 'CANCELADO';

interface Financing {
  id: string;
  number: string;
  clientName: string;
  type: FinancingType;
  financeira: string;
  valorFinanciado: number;
  parcelas: number;
  taxa: number;
  status: FinancingStatus;
}

const typeLabels: Record<FinancingType, string> = {
  FINAME: 'FINAME',
  CDC: 'CDC',
  LEASING: 'Leasing',
  CONSORCIO: 'Consórcio',
  DIRETO: 'Direto',
};

const typeColors: Record<FinancingType, string> = {
  FINAME: 'bg-green-100 text-green-700',
  CDC: 'bg-blue-100 text-blue-700',
  LEASING: 'bg-purple-100 text-purple-700',
  CONSORCIO: 'bg-yellow-100 text-yellow-700',
  DIRETO: 'bg-orange-100 text-orange-700',
};

const statusLabels: Record<FinancingStatus, string> = {
  SIMULACAO: 'Simulação',
  PROPOSTA: 'Proposta',
  ANALISE: 'Em Análise',
  APROVADO: 'Aprovado',
  CONTRATADO: 'Contratado',
  LIBERADO: 'Liberado',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<FinancingStatus, string> = {
  SIMULACAO: 'bg-slate-100 text-slate-600',
  PROPOSTA: 'bg-amber-100 text-amber-700',
  ANALISE: 'bg-yellow-100 text-yellow-700',
  APROVADO: 'bg-emerald-100 text-emerald-700',
  CONTRATADO: 'bg-blue-100 text-blue-700',
  LIBERADO: 'bg-indigo-100 text-indigo-700',
  CANCELADO: 'bg-red-100 text-red-700',
};


const formatCurrency = (value: number) => fmtCurrency(value);

export default function FinanciamentoListPage() {
  const [financings, setFinancings] = useState<Financing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      apiFetch(`/api/fi/financing?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          const mapped: Financing[] = (json.data ?? []).map((item: any) => ({
            id: item.id,
            number: item.numero ?? '',
            clientName: item.person?.razaoSocial ?? item.person?.nomeFantasia ?? '',
            type: item.type as FinancingType,
            financeira: item.financeira?.nomeFantasia ?? item.financeira?.razaoSocial ?? '',
            valorFinanciado: item.valorFinanciado ?? 0,
            parcelas: item.parcelas ?? 0,
            taxa: item.taxaJuros ?? 0,
            status: item.status as FinancingStatus,
          }));
          setFinancings(mapped);
          setTotal(json.meta?.total ?? mapped.length);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
  }, [search, typeFilter, statusFilter, page]);

  const totalPages = Math.ceil(total / limit);
  const paginatedFinancings = financings;

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = search || typeFilter || statusFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financiamentos</h1>
          <p className="text-slate-500 mt-1">
            Gerencie financiamentos e acompanhe o status das operações
          </p>
        </div>
        <Link
          href="/fi/financiamento/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Financiamento
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, cliente ou financeira..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Financeira</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Financiado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Parcelas</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Taxa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedFinancings.map((fin, index) => (
                <tr
                  key={fin.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{fin.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{fin.clientName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[fin.type]}`}>
                      {typeLabels[fin.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fin.financeira}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                    {formatCurrency(fin.valorFinanciado)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center">{fin.parcelas}x</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center">{fmtPercent(fin.taxa)} a.m.</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[fin.status]}`}>
                      {statusLabels[fin.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/fi/financiamento/${fin.id}`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/fi/financiamento/${fin.id}`}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedFinancings.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhum financiamento encontrado com os filtros selecionados.
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
              <>Mostrando <span className="font-medium">{paginatedFinancings.length}</span> de{' '}
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
