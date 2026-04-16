'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';

type QuotationStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'EXPIRADA' | 'RECEBIDA';

interface Quotation {
  id: string;
  number: string;
  purchaseRequest: string;
  supplier: string;
  total: number;
  status: QuotationStatus;
  validUntil: string;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  EXPIRADA: 'Expirada',
  RECEBIDA: 'Recebida',
};

const statusColors: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-700',
  APROVADA: 'bg-emerald-100 text-emerald-700',
  REJEITADA: 'bg-red-100 text-red-700',
  EXPIRADA: 'bg-slate-100 text-slate-600',
  RECEBIDA: 'bg-blue-100 text-blue-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function CotacoesListPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api<{ data: Array<Record<string, unknown>>; meta: { total: number } }>('/purchasing/quotations', {
      params: {
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      },
    })
      .then((res) => {
        const mapped: Quotation[] = (res.data ?? []).map((q) => {
          const supplier = (q.supplier as Record<string, unknown>) ?? {};
          const purchaseRequest = (q.purchaseRequest as Record<string, unknown>) ?? {};
          return {
            id: q.id as string,
            number: q.numero as string,
            purchaseRequest: purchaseRequest.numero as string ?? '—',
            supplier: (supplier.razaoSocial ?? supplier.nomeFantasia) as string ?? '—',
            total: Number(q.totalValue) || 0,
            status: q.status as QuotationStatus,
            validUntil: (q.dataValidade as string) ?? '',
            createdAt: (q.createdAt as string) ?? '',
          };
        });
        setQuotations(mapped);
        setTotal(res.meta?.total ?? 0);
      })
      .catch(() => {
        setQuotations([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [search, statusFilter, page]);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleStatus = (val: string) => { setStatusFilter(val); setPage(1); };
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setPage(1); };

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || statusFilter;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cotacoes de Fornecedores</h1>
          <p className="text-slate-500 mt-1">Gerencie cotacoes recebidas dos fornecedores</p>
        </div>
        <Link href="/compras/cotacoes/nova" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Nova Cotacao
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por numero, fornecedor ou solicitacao..." value={search} onChange={(e) => handleSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" />
            Filtros
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
              <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitacao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Validade</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Carregando...</td></tr>
              )}
              {!loading && quotations.map((q) => {
                const validDate = q.validUntil ? new Date(q.validUntil) : null;
                const todayDate = new Date(today);
                const daysUntilExpiry = validDate
                  ? Math.ceil((validDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const isExpiring = daysUntilExpiry !== null && daysUntilExpiry <= 3 && daysUntilExpiry > 0 && q.status === 'PENDENTE';
                const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0 && q.status === 'PENDENTE';

                return (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{q.number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-amber-600 font-medium">{q.purchaseRequest}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{q.supplier}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(q.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[q.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabels[q.status] ?? q.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {validDate ? (
                        <div className="flex items-center gap-1">
                          {(isExpiring || isExpired) && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          <span className={`text-sm ${isExpired ? 'text-red-600 font-semibold' : isExpiring ? 'text-amber-600 font-medium' : 'text-slate-700'}`}>
                            {validDate.toLocaleDateString('pt-BR')}
                          </span>
                          {isExpiring && <span className="text-xs text-amber-500 ml-1">({daysUntilExpiry}d)</span>}
                          {isExpired && <span className="text-xs text-red-500 ml-1">(expirada)</span>}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/compras/cotacoes/${q.id}`} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && quotations.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma cotacao encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">Mostrando <span className="font-medium">{quotations.length}</span> de <span className="font-medium">{total}</span> registros</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm text-slate-700">Pagina {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Proxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
