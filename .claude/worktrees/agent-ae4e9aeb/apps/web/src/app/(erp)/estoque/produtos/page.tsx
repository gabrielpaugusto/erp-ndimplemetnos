'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, ChevronLeft, ChevronRight,
  Edit, Trash2, Eye, Filter, X, Package,
} from 'lucide-react';
import { EmptyStateRow } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api';

interface Product {
  id: string;
  code: string;
  description: string;
  type: string;
  unit: string;
  ncm?: { code: string } | null;
  precoVenda?: number | null;
  estoqueAtual?: number;
  active: boolean;
}

const productTypes = [
  { value: '', label: 'Todos' },
  { value: 'PRODUTO_ACABADO', label: 'Produto Acabado' },
  { value: 'MATERIA_PRIMA', label: 'Matéria Prima' },
  { value: 'COMPONENTE', label: 'Componente / Peça Fabricada' },
  { value: 'PECA_REPOSICAO', label: 'Peça de Reposição' },
  { value: 'CONSUMIVEL', label: 'Consumível' },
  { value: 'SERVICO', label: 'Serviço / Mão de Obra' },
];

const typeLabels: Record<string, string> = {
  PRODUTO_ACABADO: 'Produto Acabado',
  MATERIA_PRIMA: 'Matéria Prima',
  COMPONENTE: 'Componente',
  PECA_REPOSICAO: 'Peça de Reposição',
  CONSUMIVEL: 'Consumível',
  SERVICO: 'Serviço',
};

const formatCurrency = (v?: number | null) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)) : '-';

const formatNumber = (v?: number) =>
  v != null ? new Intl.NumberFormat('pt-BR').format(Number(v)) : '0';

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(20);

  const getCompanyId = () => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}');
      return u?.company?.id ?? u?.companyId ?? '';
    } catch { return ''; }
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = getCompanyId();
      const params = new URLSearchParams({ companyId, page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (activeFilter !== '') params.set('active', activeFilter);

      const res = await apiFetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data ?? json);
        setTotal(json.meta?.total ?? (json.data ?? json).length);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, search, typeFilter, activeFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Confirma a desativação deste produto?')) return;
    await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    loadProducts();
  };

  const clearFilters = () => { setSearch(''); setTypeFilter(''); setActiveFilter(''); setPage(1); };
  const hasActiveFilters = search || typeFilter || activeFilter !== '';
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Produtos</h1>
          <p className="text-slate-500 mt-1">Gerencie produtos, matérias-primas e serviços</p>
        </div>
        <Link href="/estoque/produtos/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Produto
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por código, descrição ou NCM..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" /> Filtros
            {hasActiveFilters && <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {productTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
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
                {['Código','Descrição','Tipo','Un.','NCM','Preço Venda','Estoque Atual','Status','Ações'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i >= 5 && i <= 6 ? 'text-right' : i === 8 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">Carregando...</td></tr>
              ) : products.length === 0 ? (
                <EmptyStateRow colSpan={9} icon={Package} title="Nenhum produto cadastrado ainda" description="Comece adicionando o primeiro produto ao catálogo." actionLabel="Cadastrar Produto" actionHref="/estoque/produtos/novo" filtered={!!hasActiveFilters} />
              ) : products.map((p, i) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900">{p.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{p.description}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {typeLabels[p.type] || p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{p.unit}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-mono">{p.ncm?.code || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">{formatCurrency(p.precoVenda)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 text-right">
                    {p.type === 'MAO_DE_OBRA' || p.type === 'SERVICO' ? '-' : formatNumber(p.estoqueAtual)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${p.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/estoque/produtos/${p.id}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Visualizar"><Eye className="w-4 h-4" /></Link>
                      <Link href={`/estoque/produtos/${p.id}`} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Editar"><Edit className="w-4 h-4" /></Link>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Desativar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{products.length}</span> de <span className="font-medium">{total}</span> registros
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Por página:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm text-slate-700">Página {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
