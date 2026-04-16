'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package, FileStack, Route, Building2, AlertTriangle,
  CheckCircle, Search, ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kpis {
  totalProdutos: number;
  totalBoms: number;
  totalRoteiros: number;
  totalCentros: number;
  produtosSemBom: number;
  coberturaBom: number;
}

interface ProdutoPorTipo { tipo: string; total: number; }

interface BomRecente {
  id: string;
  version: number;
  description?: string;
  produto?: { code: string; description: string; unit: string } | null;
  totalItens: number;
  updatedAt: string;
}

interface ProdutoEng {
  id: string;
  code: string;
  description: string;
  type: string;
  unit: string;
  temBom: boolean;
  temRoteiro: boolean;
  versaoBom?: number | null;
  versaoRoteiro?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const typeLabel: Record<string, string> = {
  PRODUTO_ACABADO:  'Produto Acabado',
  MATERIA_PRIMA:    'Matéria Prima',
  INSUMO:           'Insumo',
  SERVICO:          'Serviço',
  MAO_DE_OBRA:      'Mão de Obra',
  EMBALAGEM:        'Embalagem',
  REVENDA:          'Revenda',
  USO_CONSUMO:      'Uso e Consumo',
  ATIVO_IMOBILIZADO:'Ativo Imobilizado',
};

const typeColors: Record<string, string> = {
  PRODUTO_ACABADO: 'bg-blue-100 text-blue-700',
  MATERIA_PRIMA:   'bg-amber-100 text-amber-700',
  INSUMO:          'bg-cyan-100 text-cyan-700',
  SERVICO:         'bg-violet-100 text-violet-700',
  MAO_DE_OBRA:     'bg-orange-100 text-orange-700',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function EngenhariaPage() {
  const [kpis, setKpis]               = useState<Kpis | null>(null);
  const [tiposDados, setTiposDados]   = useState<ProdutoPorTipo[]>([]);
  const [bomsRecentes, setBomsRecentes] = useState<BomRecente[]>([]);
  const [produtos, setProdutos]       = useState<ProdutoEng[]>([]);
  const [total, setTotal]             = useState(0);
  const [loadingDash, setLoadingDash] = useState(true);
  const [loadingProd, setLoadingProd] = useState(true);
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [page, setPage]               = useState(1);
  const limit = 15;

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    try {
      const res = await apiFetch('/api/engineering/dashboard');
      if (res.ok) {
        const json = await res.json();
        setKpis(json.kpis);
        setTiposDados(json.produtosPorTipo ?? []);
        setBomsRecentes(json.bomsRecentes ?? []);
      }
    } catch { /**/ } finally { setLoadingDash(false); }
  }, []);

  // ── Produtos com status de BOM ─────────────────────────────────────────────
  const loadProdutos = useCallback(async () => {
    setLoadingProd(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      const res = await apiFetch(`/api/engineering/products?${params}`);
      if (res.ok) {
        const json = await res.json();
        setProdutos(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
      }
    } catch { /**/ } finally { setLoadingProd(false); }
  }, [page, search, typeFilter]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadProdutos(); }, [loadProdutos]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Engenharia</h1>
          <p className="text-slate-500 mt-1">Visão consolidada de produtos, BOMs e roteiros de produção</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pcp/bom/novo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
            <FileStack className="w-4 h-4" /> Nova BOM
          </Link>
          <button onClick={loadDashboard}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loadingDash ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {loadingDash ? (
        <div className="text-center text-sm text-slate-400 py-4">Carregando indicadores...</div>
      ) : kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: 'Produtos Ativos',   value: kpis.totalProdutos,   icon: Package,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'BOMs Ativas',       value: kpis.totalBoms,       icon: FileStack,   color: 'text-emerald-600', bg: 'bg-emerald-50'},
            { label: 'Roteiros Ativos',   value: kpis.totalRoteiros,   icon: Route,       color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: 'Centros Trabalho',  value: kpis.totalCentros,    icon: Building2,   color: 'text-amber-600',  bg: 'bg-amber-50'  },
            { label: 'Sem BOM',           value: kpis.produtosSemBom,  icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50'   },
            { label: 'Cobertura BOM',     value: `${kpis.coberturaBom}%`, icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-50' },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className={`${k.bg} w-9 h-9 rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dois painéis lado a lado ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Produtos por Tipo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Produtos por Tipo</h2>
          {tiposDados.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum produto cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {tiposDados.sort((a, b) => b.total - a.total).map((t) => {
                const pct = kpis ? Math.round((t.total / kpis.totalProdutos) * 100) : 0;
                return (
                  <div key={t.tipo}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{typeLabel[t.tipo] || t.tipo}</span>
                      <span className="font-medium text-slate-900">{t.total} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOMs Recentes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">BOMs Recentes</h2>
            <Link href="/pcp/bom" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
          </div>
          {bomsRecentes.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma BOM cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {bomsRecentes.map((b) => (
                <Link key={b.id} href={`/pcp/bom/${b.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {b.produto?.code} — {b.produto?.description ?? b.description ?? 'BOM sem produto'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Rev. {b.version} · {b.totalItens} {b.totalItens === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-3">
                    {new Date(b.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabela de Produtos com status BOM/Roteiro ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900 flex-1">Status de Engenharia por Produto</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
          </div>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os tipos</option>
            {Object.entries(typeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">BOM</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Roteiro</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingProd ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Carregando...</td></tr>
              ) : produtos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Nenhum produto encontrado.</td></tr>
              ) : produtos.map((p, i) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900">{p.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{p.description}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[p.type] || 'bg-slate-100 text-slate-700'}`}>
                      {typeLabel[p.type] || p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.temBom ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Rev.{p.versaoBom}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-500">
                        <AlertTriangle className="w-3.5 h-3.5" /> Sem BOM
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.temRoteiro ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Rev.{p.versaoRoteiro}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        — Sem roteiro
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/estoque/produtos/${p.id}`}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors">
                        Produto
                      </Link>
                      <Link href="/pcp/bom/novo"
                        className="px-2.5 py-1 text-xs border border-blue-200 rounded hover:bg-blue-50 text-blue-600 transition-colors">
                        {p.temBom ? 'Ver BOM' : '+ BOM'}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{produtos.length}</span> de <span className="font-medium">{total}</span> produtos
          </p>
          <div className="flex items-center gap-2">
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
