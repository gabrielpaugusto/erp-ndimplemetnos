'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, X, Edit, ChevronLeft, ChevronRight,
  Zap, Info, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface TaxRule {
  id: string;
  name: string;
  description?: string;
  ncmCode?: string;
  cfopCode?: string;
  operation?: string;
  cstIcms?: string;
  aliqIcms?: number;
  reducaoBcIcms?: number;
  cstIpi?: string;
  aliqIpi?: number;
  cstPis?: string;
  aliqPis?: number;
  cstCofins?: string;
  aliqCofins?: number;
  aliqIbs?: number;
  aliqCbs?: number;
  aliqIs?: number;
  priority: number;
  active: boolean;
}

const operationLabels: Record<string, string> = {
  SAIDA_VENDA_PRODUCAO: 'Venda de Produção',
  SAIDA_VENDA_MERCADORIA: 'Venda Mercadoria',
  SAIDA_VENDA_PECA: 'Venda de Peça',
  SAIDA_SERVICO: 'Serviço',
  SAIDA_DEVOLUCAO_COMPRA: 'Devolução Compra',
  SAIDA_REMESSA_INDUSTRIA: 'Remessa Industria',
  SAIDA_REMESSA_CONSERTO: 'Remessa Conserto',
  SAIDA_TRANSFERENCIA: 'Transferência',
  ENTRADA_COMPRA_INDUSTRIA: 'Compra Industria',
  ENTRADA_COMPRA_COMERCIO: 'Compra Comercio',
  ENTRADA_DEVOLUCAO_VENDA: 'Devolução Venda',
  ENTRADA_RETORNO_INDUSTRIA: 'Retorno Industria',
  ENTRADA_RETORNO_CONSERTO: 'Retorno Conserto',
  ENTRADA_TRANSFERENCIA: 'Receb. Transferência',
};

const fmt = (v?: number | null) =>
  v != null ? `${Number(v).toFixed(2)}%` : '-';

export default function RegrasPage() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('true');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) p.set('search', search);
      if (operationFilter) p.set('operation', operationFilter);
      if (activeFilter !== '') p.set('active', activeFilter);
      const res = await apiFetch(`/api/fiscal/tax-rules?${p}`);
      if (res.ok) {
        const json = await res.json();
        setRules(json.data ?? json);
        setTotal(json.meta?.total ?? (json.data ?? json).length);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, operationFilter, activeFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (rule: TaxRule) => {
    await apiFetch(`/api/fiscal/tax-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    });
    load();
  };

  const clearFilters = () => { setSearch(''); setOperationFilter(''); setActiveFilter('true'); setPage(1); };
  const hasActiveFilters = search || operationFilter || activeFilter !== 'true';
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Regras Tributárias</h1>
          <p className="text-slate-500 mt-1">
            Regras aplicadas automaticamente na emissão de NF-e, orçamentos e pedidos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/fiscal/regras/simulador"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition-colors"
          >
            <Zap className="w-4 h-4" /> Simulador Fiscal
          </Link>
          <Link
            href="/fiscal/regras/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Regra
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Como funciona a automação fiscal</p>
          <p>
            O motor fiscal resolve automaticamente <strong>CFOP, CST/CSOSN e alíquotas</strong> para cada item
            com base no NCM, tipo de operação e UF de destino. As regras abaixo são priorizadas por
            especificidade — <em>NCM+CFOP+Operação</em> tem maior prioridade que regras genéricas.
            Quando nenhuma regra for encontrada, os padrões do NCM são usados.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, NCM ou CFOP..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            <Filter className="w-4 h-4" /> Filtros
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Operação</label>
              <select
                value={operationFilter}
                onChange={(e) => { setOperationFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todas</option>
                {Object.entries(operationLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={activeFilter}
                onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todas</option>
                <option value="true">Ativas</option>
                <option value="false">Inativas</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Prioridade</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Nome / Escopo</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Operação</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">CST ICMS</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">ICMS</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">CST PIS/COF</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">PIS</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">COFINS</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-teal-600 uppercase">IBS</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-teal-600 uppercase">CBS</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Ativo</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-400">Carregando...</td></tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center">
                    <div className="space-y-2">
                      <p className="text-slate-500">Nenhuma regra tributária cadastrada.</p>
                      <Link href="/fiscal/regras/nova" className="text-emerald-600 hover:underline text-sm">
                        + Cadastrar primeira regra
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : rules.map((rule, i) => (
                <tr key={rule.id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${rule.priority >= 80 ? 'bg-red-100 text-red-700' : rule.priority >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {rule.priority}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{rule.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {rule.ncmCode ? `NCM: ${rule.ncmCode}` : 'NCM: qualquer'}
                      {rule.cfopCode ? ` · CFOP: ${rule.cfopCode}` : ' · CFOP: qualquer'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {rule.operation ? (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${rule.operation.startsWith('SAIDA') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {operationLabels[rule.operation] ?? rule.operation}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">qualquer</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-slate-700">{rule.cstIcms ?? '-'}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{fmt(rule.aliqIcms)}</td>
                  <td className="px-3 py-3 text-center font-mono text-slate-700">{rule.cstPis ?? '-'}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{fmt(rule.aliqPis)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{fmt(rule.aliqCofins)}</td>
                  <td className="px-3 py-3 text-right text-teal-700 font-medium">{fmt(rule.aliqIbs)}</td>
                  <td className="px-3 py-3 text-right text-teal-700 font-medium">{fmt(rule.aliqCbs)}</td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => toggleActive(rule)} title={rule.active ? 'Desativar' : 'Ativar'}>
                      {rule.active
                        ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                        : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/fiscal/regras/${rule.id}`} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Editar">
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{rules.length}</span> de <span className="font-medium">{total}</span> regras
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm text-slate-700">Página {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
