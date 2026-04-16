'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, Filter, X, Eye, Trash2,
  ChevronLeft, ChevronRight, FileText, RefreshCw, ArrowRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { EmptyStateRow } from '@/components/ui/empty-state';
import { fmtCurrency } from '@/lib/format';

type QuotationStatus = 'RASCUNHO' | 'ENVIADO' | 'ACEITO' | 'RECUSADO' | 'EXPIRADO';

interface Quotation {
  id: string;
  numero: number;
  createdAt: string;
  status: QuotationStatus;
  saleType: string;
  total: number;
  person: { id: string; razaoSocial: string; nomeFantasia: string | null } | null;
  vendedor: { id: string; name: string } | null;
  _count: { items: number };
}

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADO:  'Enviado',
  ACEITO:   'Aceito',
  RECUSADO: 'Recusado',
  EXPIRADO: 'Expirado',
};

const statusColors: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  ENVIADO:  'bg-blue-100 text-blue-700',
  ACEITO:   'bg-emerald-100 text-emerald-700',
  RECUSADO: 'bg-red-100 text-red-700',
  EXPIRADO: 'bg-yellow-100 text-yellow-700',
};

const saleTypeLabels: Record<string, string> = {
  ESTOQUE_PROPRIO:  'Estoque Próprio',
  VENDA_DIRETA:     'Venda Direta',
  PRODUCAO_PROPRIA: 'Produção Própria',
  VENDA_PECA:       'Venda de Peça',
  SERVICO_OFICINA:  'Serviço Oficina',
  FI_CONSORCIO:     'Consórcio',
  FI_FINANCIAMENTO: 'Financiamento',
  FI_SEGURO:        'Seguro',
  // legacy aliases
  ESTOQUE:  'Estoque Próprio',
  DIRETA:   'Venda Direta',
  PRODUCAO: 'Produção Própria',
};

const saleTypeColors: Record<string, string> = {
  ESTOQUE_PROPRIO:  'bg-blue-100 text-blue-700',
  VENDA_DIRETA:     'bg-purple-100 text-purple-700',
  PRODUCAO_PROPRIA: 'bg-orange-100 text-orange-700',
  VENDA_PECA:       'bg-cyan-100 text-cyan-700',
  SERVICO_OFICINA:  'bg-green-100 text-green-700',
  FI_CONSORCIO:     'bg-pink-100 text-pink-700',
  FI_FINANCIAMENTO: 'bg-indigo-100 text-indigo-700',
  FI_SEGURO:        'bg-rose-100 text-rose-700',
  // legacy aliases
  ESTOQUE:  'bg-blue-100 text-blue-700',
  DIRETA:   'bg-purple-100 text-purple-700',
  PRODUCAO: 'bg-orange-100 text-orange-700',
};

const fmt = (v: number) => fmtCurrency(v);

export default function OrcamentosPage() {
  const toast = useToast();
  const router = useRouter();

  const [quotations, setQuotations]   = useState<Quotation[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage]               = useState(1);
  const [converting, setConverting]   = useState<string | null>(null);
  const limit = 20;

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search)          params.set('search',   search);
      if (statusFilter)    params.set('status',   statusFilter);
      if (saleTypeFilter)  params.set('saleType', saleTypeFilter);

      const res = await apiFetch(`/api/sales/quotations?${params}`);
      if (res.ok) {
        const json = await res.json();
        setQuotations(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, saleTypeFilter]);

  useEffect(() => { loadQuotations(); }, [loadQuotations]);
  useEffect(() => { setPage(1); }, [search, statusFilter, saleTypeFilter]);

  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setSaleTypeFilter('');
  };
  const hasActiveFilters = search || statusFilter || saleTypeFilter;

  /** Converter orçamento em pedido de venda */
  async function handleConverter(quotation: Quotation) {
    if (quotation.status === 'ACEITO') {
      toast.error('Este orçamento já foi convertido em pedido de venda.');
      return;
    }
    if (!confirm(`Confirma a conversão do orçamento ORC-${String(quotation.numero).padStart(4,'0')} em Pedido de Venda?\n\nIsso irá criar um novo Pedido de Venda com todos os itens do orçamento.`)) return;

    setConverting(quotation.id);
    try {
      const res  = await apiFetch(`/api/sales/quotations/${quotation.id}/convert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Erro ao converter orçamento');
        return;
      }
      // data is the new SaleOrder
      router.push(`/comercial/pedidos/${data.id}`);
    } catch {
      toast.error('Erro de conexão ao converter orçamento');
    } finally {
      setConverting(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Confirma a exclusão deste orçamento?')) return;
    await apiFetch(`/api/sales/quotations/${id}`, { method: 'DELETE' });
    loadQuotations();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orçamentos</h1>
          <p className="text-slate-500 mt-1">Gerencie propostas e converta em pedidos de venda</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadQuotations()}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/comercial/orcamentos/novo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Orçamento
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>
            )}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Venda</label>
              <select
                value={saleTypeFilter}
                onChange={(e) => setSaleTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(saleTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Nenhum orçamento encontrado</p>
                    <Link href="/comercial/orcamentos/novo" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      <Plus className="w-4 h-4" /> Criar primeiro orçamento
                    </Link>
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          ORC-{String(q.numero).padStart(4, '0')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 max-w-[200px] truncate">
                      {q.person?.razaoSocial ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${saleTypeColors[q.saleType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {saleTypeLabels[q.saleType] ?? q.saleType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-center">{q._count.items}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {fmt(Number(q.total))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[q.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/comercial/orcamentos/${q.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {/* Converter em Pedido — só para não ACEITO/RECUSADO/EXPIRADO */}
                        {q.status !== 'ACEITO' && q.status !== 'RECUSADO' && q.status !== 'EXPIRADO' && (
                          <button
                            onClick={() => handleConverter(q)}
                            disabled={converting === q.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Converter em Pedido de Venda"
                          >
                            {converting === q.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowRight className="w-3.5 h-3.5" />
                            )}
                            {converting === q.id ? 'Convertendo...' : 'Converter'}
                          </button>
                        )}

                        {q.status !== 'ACEITO' && (
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
            <span className="font-medium">{total}</span> orçamento{total !== 1 ? 's' : ''} no total
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
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
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
