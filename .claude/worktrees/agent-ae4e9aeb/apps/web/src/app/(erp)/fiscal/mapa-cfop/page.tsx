'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, Filter, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const BOOK_TYPES = [
  { value: '', label: 'Entradas + Saídas' },
  { value: 'ENTRADAS', label: 'Livro de Entradas' },
  { value: 'SAIDAS', label: 'Livro de Saídas' },
];

interface CfopRow {
  cfop: string;
  naturezaOperacao: string | null;
  bookType: string;
  count: number;
  entradas: number;
  saidas: number;
  totalValorContabil: number;
  totalBaseCalculo: number;
  totalImposto: number;
  byTax: Record<string, number>;
}

interface Totais {
  totalEntries: number;
  totalValorContabil: number;
  totalBaseCalculo: number;
  totalImposto: number;
}

type SortKey = 'cfop' | 'count' | 'totalValorContabil' | 'totalBaseCalculo' | 'totalImposto';

// Generate month options (current month and past 11 months)
function getMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

const MONTH_OPTIONS = getMonthOptions();

export default function MapaCfopPage() {
  const [rows, setRows]      = useState<CfopRow[]>([]);
  const [totais, setTotais]  = useState<Totais | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(MONTH_OPTIONS[0].value);
  const [bookType, setBookType] = useState('');
  const [sortKey, setSortKey]   = useState<SortKey>('cfop');
  const [sortAsc, setSortAsc]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (periodo) params.set('periodoReferencia', periodo);
    if (bookType) params.set('bookType', bookType);

    const res = await apiFetch(`/api/fiscal/books/mapa-cfop?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.data ?? []);
      setTotais(data.totais ?? null);
    }
    setLoading(false);
  }, [periodo, bookType]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />;
  };

  const th = (label: string, k: SortKey) => (
    <th
      key={k}
      onClick={() => toggleSort(k)}
      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
    >
      <div className="flex items-center gap-1">{label}<SortIcon k={k} /></div>
    </th>
  );

  // Collect all tax types present in data
  const allTaxTypes = Array.from(new Set(rows.flatMap(r => Object.keys(r.byTax)))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mapa Resumo por CFOP</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Consolidado das entradas fiscais agrupadas por código CFOP
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-3 flex-wrap items-center">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todos os períodos</option>
            {MONTH_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={bookType}
            onChange={(e) => setBookType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            {BOOK_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <button
            onClick={load}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {totais && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total Lançamentos</p>
            <p className="text-2xl font-bold text-slate-900">{totais.totalEntries}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Valor Contábil</p>
            <p className="text-lg font-bold text-slate-900">{fmt(totais.totalValorContabil)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Base de Cálculo</p>
            <p className="text-lg font-bold text-slate-900">{fmt(totais.totalBaseCalculo)}</p>
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 p-4">
            <p className="text-xs text-emerald-600">Total Impostos</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(totais.totalImposto)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Calculando mapa CFOP...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum lançamento encontrado</p>
            <p className="text-slate-400 text-sm mt-1">Ajuste o período ou o livro fiscal selecionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {th('CFOP', 'cfop')}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Natureza</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Livro</th>
                  {th('Qtd.', 'count')}
                  {th('Vl. Contábil', 'totalValorContabil')}
                  {th('Base Cálculo', 'totalBaseCalculo')}
                  {th('Impostos', 'totalImposto')}
                  {allTaxTypes.map(tax => (
                    <th key={tax} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {tax}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-900">{row.cfop}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                      {row.naturezaOperacao ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.bookType === 'ENTRADAS'
                          ? 'bg-blue-100 text-blue-700'
                          : row.bookType === 'SAIDAS'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {row.bookType === 'ENTRADAS' ? 'Entradas' : row.bookType === 'SAIDAS' ? 'Saídas' : row.bookType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium">{row.count}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{fmt(row.totalValorContabil)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(row.totalBaseCalculo)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{fmt(row.totalImposto)}</td>
                    {allTaxTypes.map(tax => (
                      <td key={tax} className="px-4 py-3 text-sm text-slate-600">
                        {row.byTax[tax] != null ? fmt(row.byTax[tax]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              {totais && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 uppercase" colSpan={3}>Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{totais.totalEntries}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(totais.totalValorContabil)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(totais.totalBaseCalculo)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-emerald-700">{fmt(totais.totalImposto)}</td>
                    {allTaxTypes.map(tax => (
                      <td key={tax} className="px-4 py-3 text-sm font-bold text-emerald-700">
                        {fmt(sorted.reduce((s, r) => s + (r.byTax[tax] ?? 0), 0))}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Sobre o Mapa CFOP</p>
        <p>O mapa agrupa todos os lançamentos do Livro Fiscal (entradas e saídas) por CFOP para o período selecionado. As colunas de impostos são dinâmicas — aparecem apenas os tributos com lançamentos no período. Colunas clicáveis para ordenação.</p>
      </div>
    </div>
  );
}
