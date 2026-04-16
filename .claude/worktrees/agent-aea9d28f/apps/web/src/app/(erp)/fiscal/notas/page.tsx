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
  FileText,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type NFeStatus = 'RASCUNHO' | 'VALIDADA' | 'TRANSMITIDA' | 'AUTORIZADA' | 'CANCELADA' | 'REJEITADA';
type NFeTipo = 'ENTRADA' | 'SAIDA';

interface NFe {
  id: string;
  numero: string;
  serie: string;
  chave: string;
  tipo: NFeTipo;
  operacao: string;
  pessoa: string;
  valor: number;
  status: NFeStatus;
  dataEmissao: string;
}

const statusLabels: Record<NFeStatus, string> = {
  RASCUNHO: 'Rascunho',
  VALIDADA: 'Validada',
  TRANSMITIDA: 'Transmitida',
  AUTORIZADA: 'Autorizada',
  CANCELADA: 'Cancelada',
  REJEITADA: 'Rejeitada',
};

const statusColors: Record<NFeStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  VALIDADA: 'bg-amber-100 text-amber-700',
  TRANSMITIDA: 'bg-blue-100 text-blue-700',
  AUTORIZADA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
  REJEITADA: 'bg-red-100 text-red-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function NotasFiscaisListPage() {
  const [nfes, setNfes] = useState<NFe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [operacaoFilter, setOperacaoFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchNFes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (tipoFilter) params.set('type', tipoFilter);
      if (operacaoFilter) params.set('operation', operacaoFilter);

      const res = await apiFetch(`/api/fiscal/nfe?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.data ?? data;
      const meta = data.meta;

      setNfes(
        list.map((n: any) => ({
          id: n.id,
          numero: n.numero ? String(n.numero) : '—',
          serie: n.serie ? String(n.serie) : '1',
          chave: n.chaveAcesso ?? '',
          tipo: n.type as NFeTipo,
          operacao: n.naturezaOperacao ?? n.operation ?? '',
          pessoa: n.person?.razaoSocial ?? n.person?.nomeFantasia ?? '',
          valor: Number(n.valorTotal ?? 0),
          status: n.status as NFeStatus,
          dataEmissao: n.dataEmissao ?? n.createdAt ?? '',
        }))
      );
      setTotal(meta?.total ?? list.length);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tipoFilter, operacaoFilter]);

  useEffect(() => {
    fetchNFes();
  }, [fetchNFes]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, tipoFilter, operacaoFilter]);

  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTipoFilter('');
    setOperacaoFilter('');
  };

  const hasActiveFilters = search || statusFilter || tipoFilter || operacaoFilter;

  const truncateChave = (chave: string) => {
    if (chave.length > 20) {
      return chave.substring(0, 10) + '...' + chave.substring(chave.length - 10);
    }
    return chave;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notas Fiscais Eletrônicas</h1>
          <p className="text-slate-500 mt-1">
            Gerencie todas as NF-es de entrada e saída da empresa
          </p>
        </div>
        <Link
          href="/fiscal/notas/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova NF-e
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, chave de acesso ou pessoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Operação</label>
              <select
                value={operacaoFilter}
                onChange={(e) => setOperacaoFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                <option value="Venda de produção">Venda de produção</option>
                <option value="Compra">Compra</option>
                <option value="Remessa">Remessa</option>
                <option value="Devolução">Devolução</option>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Chave</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Operação</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pessoa</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Emissão</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : nfes.map((nfe, index) => (
                <tr
                  key={nfe.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{nfe.numero}-{nfe.serie}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-slate-500" title={nfe.chave}>
                      {nfe.chave ? truncateChave(nfe.chave) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      nfe.tipo === 'SAIDA' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {nfe.tipo === 'SAIDA' ? 'Saída' : 'Entrada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{nfe.operacao}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{nfe.pessoa}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(nfe.valor)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[nfe.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusLabels[nfe.status] ?? nfe.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {nfe.dataEmissao ? new Date(nfe.dataEmissao).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/fiscal/notas/${nfe.id}`}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {nfe.status === 'RASCUNHO' && (
                        <Link
                          href={`/fiscal/notas/${nfe.id}`}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && nfes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhuma NF-e encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{nfes.length}</span> de{' '}
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
