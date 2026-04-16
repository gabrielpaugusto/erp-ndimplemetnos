'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Calculator } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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

interface TaxGroup {
  debitos: { base: number; imposto: number; count: number };
  creditos: { base: number; imposto: number; count: number };
  saldo: number;
  impostoAPagar: number;
  saldoCredor: number;
  status: string;
}

interface ApuracaoResult {
  periodoReferencia: string;
  pis: TaxGroup;
  cofins: TaxGroup;
  totalAPagar: number;
  totalLancamentos: number;
}

function TaxCard({ title, data, color }: { title: string; data: TaxGroup; color: string }) {
  return (
    <div className={`bg-white rounded-lg border-2 ${color} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          data.status === 'FECHADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>{data.status === 'FECHADA' ? 'Fechada' : 'Em aberto'}</span>
      </div>

      {/* Débitos */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-sm font-semibold text-red-600 mb-1">
          <TrendingUp className="w-4 h-4" /> Débitos (saídas)
        </div>
        <div className="flex justify-between text-sm text-slate-600 pl-5">
          <span>Base de Cálculo</span><span>{fmt(data.debitos.base)}</span>
        </div>
        <div className="flex justify-between text-sm font-medium text-red-700 pl-5">
          <span>Imposto ({data.debitos.count} lançamentos)</span>
          <span>{fmt(data.debitos.imposto)}</span>
        </div>
      </div>

      {/* Créditos */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600 mb-1">
          <TrendingDown className="w-4 h-4" /> Créditos (entradas)
        </div>
        <div className="flex justify-between text-sm text-slate-600 pl-5">
          <span>Base de Cálculo</span><span>{fmt(data.creditos.base)}</span>
        </div>
        <div className="flex justify-between text-sm font-medium text-emerald-700 pl-5">
          <span>Crédito ({data.creditos.count} lançamentos)</span>
          <span>({fmt(data.creditos.imposto)})</span>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        {data.impostoAPagar > 0 ? (
          <div className="flex justify-between text-base font-bold text-red-700">
            <span>Imposto a Pagar</span><span>{fmt(data.impostoAPagar)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-base font-bold text-emerald-700">
            <span>Saldo Credor</span><span>{fmt(data.saldoCredor)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApuracaoPisCofinsPage() {
  const [periodo, setPeriodo] = useState(MONTH_OPTIONS[0].value);
  const [result, setResult]   = useState<ApuracaoResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/api/fiscal/books/apuracao-pis-cofins?periodoReferencia=${periodo}`);
    if (res.ok) setResult(await res.json());
    else setResult(null);
    setLoading(false);
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const totalCreditos = result
    ? result.pis.creditos.imposto + result.cofins.creditos.imposto
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Apuração PIS/COFINS</h1>
          <p className="text-slate-500 text-sm mt-0.5">Regime não-cumulativo — Lucro Real</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button onClick={load} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : !result ? (
        <div className="text-center py-16 text-slate-400">Erro ao carregar apuração.</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Total Lançamentos</p>
              <p className="text-2xl font-bold text-slate-900">{result.totalLancamentos}</p>
            </div>
            <div className="bg-white rounded-lg border border-emerald-200 p-4">
              <p className="text-xs text-emerald-600">Total Créditos</p>
              <p className="text-lg font-bold text-emerald-700">{fmt(totalCreditos)}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">PIS a Pagar</p>
              <p className={`text-lg font-bold ${result.pis.impostoAPagar > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {result.pis.impostoAPagar > 0 ? fmt(result.pis.impostoAPagar) : `Credor ${fmt(result.pis.saldoCredor)}`}
              </p>
            </div>
            <div className={`bg-white rounded-lg border p-4 ${result.totalAPagar > 0 ? 'border-red-200' : 'border-emerald-200'}`}>
              <p className={`text-xs font-semibold ${result.totalAPagar > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {result.totalAPagar > 0 ? 'Total a Recolher (DARF)' : 'Saldo Credor Total'}
              </p>
              <p className={`text-xl font-bold ${result.totalAPagar > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {fmt(result.totalAPagar > 0 ? result.totalAPagar : result.pis.saldoCredor + result.cofins.saldoCredor)}
              </p>
            </div>
          </div>

          {/* Detail cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TaxCard title="PIS"    data={result.pis}    color="border-blue-200" />
            <TaxCard title="COFINS" data={result.cofins} color="border-indigo-200" />
          </div>

          {/* DARF info */}
          {result.totalAPagar > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">DARF a Recolher</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-amber-700 font-medium">PIS — Código 6912</p>
                  <p className="text-slate-700 font-bold">{fmt(result.pis.impostoAPagar)}</p>
                </div>
                <div>
                  <p className="text-amber-700 font-medium">COFINS — Código 5856</p>
                  <p className="text-slate-700 font-bold">{fmt(result.cofins.impostoAPagar)}</p>
                </div>
                <div>
                  <p className="text-amber-700 font-medium">Vencimento</p>
                  <p className="text-slate-700 font-bold">Último dia útil do mês seguinte</p>
                </div>
                <div>
                  <p className="text-amber-700 font-medium">Período de Apuração</p>
                  <p className="text-slate-700 font-bold">{result.periodoReferencia}</p>
                </div>
              </div>
            </div>
          )}

          {/* Regime info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4" />
              <p className="font-semibold">Regime Não-Cumulativo (Lucro Real)</p>
            </div>
            <p>PIS: alíquota 1,65% | COFINS: alíquota 7,6% — Créditos admissíveis: insumos (CST 50-56, 60-66), energia elétrica, aluguéis, depreciação de ativos, fretes de venda.</p>
          </div>
        </>
      )}
    </div>
  );
}
