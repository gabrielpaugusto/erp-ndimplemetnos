'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CashFlowRow {
  id: string;
  descricao: string;
  tipo: 'ENTRADA' | 'SAIDA';
  valorPrevisto: number;
  valorRealizado: number;
  data: string;
  categoria?: string;
}

interface Projection {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAcumulado: number;
}

interface FluxoData {
  data: CashFlowRow[];
  total: number;
  projection?: Projection[];
}

const months = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function FluxoCaixaPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<FluxoData | null>(null);
  const [projection, setProjection] = useState<Projection[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mensal' | 'projecao'>('mensal');

  const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ dateFrom, dateTo });
    const [listRes, projRes] = await Promise.all([
      apiFetch(`/api/financial/cash-flow?${params}`),
      apiFetch('/api/financial/cash-flow/projection?months=6'),
    ]);
    if (listRes.ok) setData(await listRes.json());
    if (projRes.ok) {
      const p = await projRes.json();
      setProjection(Array.isArray(p) ? p : p.projection ?? []);
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handlePrev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const handleNext = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const rows = data?.data ?? [];
  const entradas = rows.filter(r => r.tipo === 'ENTRADA');
  const saidas = rows.filter(r => r.tipo === 'SAIDA');
  const totalEntradasPrev = entradas.reduce((s, r) => s + (r.valorPrevisto ?? 0), 0);
  const totalEntradasReal = entradas.reduce((s, r) => s + (r.valorRealizado ?? 0), 0);
  const totalSaidasPrev = saidas.reduce((s, r) => s + (r.valorPrevisto ?? 0), 0);
  const totalSaidasReal = saidas.reduce((s, r) => s + (r.valorRealizado ?? 0), 0);
  const saldoPrev = totalEntradasPrev - totalSaidasPrev;
  const saldoReal = totalEntradasReal - totalSaidasReal;
  const maxBar = Math.max(totalEntradasPrev, totalEntradasReal, totalSaidasPrev, totalSaidasReal, 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fluxo de Caixa</h1>
          <p className="text-slate-500 mt-1">Acompanhe as entradas e saidas previstas e realizadas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-slate-900 min-w-[150px] text-center">{months[month]} / {year}</span>
          <button onClick={handleNext} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg ml-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['mensal', 'projecao'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            {t === 'mensal' ? 'Mensal' : 'Projecao 6 Meses'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : tab === 'mensal' ? (
        <>
          {/* Visual */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Resumo Visual — {months[month]}/{year}</h2>
            </div>
            <div className="grid grid-cols-2 gap-8 h-48">
              {[
                { label: 'Entradas', prev: totalEntradasPrev, real: totalEntradasReal, color: 'emerald' },
                { label: 'Saidas', prev: totalSaidasPrev, real: totalSaidasReal, color: 'red' },
              ].map(({ label, prev, real, color }) => (
                <div key={label} className="flex flex-col items-center">
                  <p className="text-sm font-medium text-slate-700 mb-3">{label}</p>
                  <div className="flex items-end gap-4 h-32 w-full justify-center">
                    <div className="flex flex-col items-center gap-1 flex-1 max-w-20">
                      <span className="text-xs text-slate-500">{fmt(prev)}</span>
                      <div className="w-full bg-slate-300 rounded-t" style={{ height: `${(prev / maxBar) * 100}%` }} />
                      <span className="text-xs text-slate-500">Previsto</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 flex-1 max-w-20">
                      <span className={`text-xs text-${color}-600`}>{fmt(real)}</span>
                      <div className={`w-full bg-${color}-500 rounded-t`} style={{ height: `${(real / maxBar) * 100}%` }} />
                      <span className={`text-xs text-${color}-600`}>Realizado</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Descricao', 'Previsto', 'Realizado', 'Variacao'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum lancamento no periodo.</td></tr>
                ) : (
                  <>
                    {entradas.length > 0 && (
                      <>
                        <tr className="bg-emerald-50">
                          <td colSpan={4} className="px-4 py-2 text-sm font-bold text-emerald-800 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> ENTRADAS
                          </td>
                        </tr>
                        {entradas.map(r => {
                          const var_ = (r.valorRealizado ?? 0) - (r.valorPrevisto ?? 0);
                          return (
                            <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-100">
                              <td className="px-4 py-2.5 text-sm text-slate-700 pl-8">{r.descricao}</td>
                              <td className="px-4 py-2.5 text-sm text-right text-slate-600">{fmt(r.valorPrevisto ?? 0)}</td>
                              <td className="px-4 py-2.5 text-sm text-right font-medium">{fmt(r.valorRealizado ?? 0)}</td>
                              <td className={`px-4 py-2.5 text-sm text-right font-medium ${var_ >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {var_ >= 0 ? '+' : ''}{fmt(var_)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-emerald-50 border-b border-emerald-200">
                          <td className="px-4 py-2.5 text-sm font-bold text-emerald-800">Total Entradas</td>
                          <td className="px-4 py-2.5 text-sm text-right font-bold text-emerald-700">{fmt(totalEntradasPrev)}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-bold text-emerald-700">{fmt(totalEntradasReal)}</td>
                          <td className={`px-4 py-2.5 text-sm text-right font-bold ${totalEntradasReal - totalEntradasPrev >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {totalEntradasReal - totalEntradasPrev >= 0 ? '+' : ''}{fmt(totalEntradasReal - totalEntradasPrev)}
                          </td>
                        </tr>
                      </>
                    )}
                    {saidas.length > 0 && (
                      <>
                        <tr className="bg-red-50">
                          <td colSpan={4} className="px-4 py-2 text-sm font-bold text-red-800 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" /> SAIDAS
                          </td>
                        </tr>
                        {saidas.map(r => {
                          const var_ = (r.valorRealizado ?? 0) - (r.valorPrevisto ?? 0);
                          return (
                            <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-100">
                              <td className="px-4 py-2.5 text-sm text-slate-700 pl-8">{r.descricao}</td>
                              <td className="px-4 py-2.5 text-sm text-right text-slate-600">{fmt(r.valorPrevisto ?? 0)}</td>
                              <td className="px-4 py-2.5 text-sm text-right font-medium">{fmt(r.valorRealizado ?? 0)}</td>
                              <td className={`px-4 py-2.5 text-sm text-right font-medium ${var_ <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {var_ >= 0 ? '+' : ''}{fmt(var_)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-red-50 border-b border-red-200">
                          <td className="px-4 py-2.5 text-sm font-bold text-red-800">Total Saidas</td>
                          <td className="px-4 py-2.5 text-sm text-right font-bold text-red-700">{fmt(totalSaidasPrev)}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-bold text-red-700">{fmt(totalSaidasReal)}</td>
                          <td className={`px-4 py-2.5 text-sm text-right font-bold ${totalSaidasReal - totalSaidasPrev <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {totalSaidasReal - totalSaidasPrev >= 0 ? '+' : ''}{fmt(totalSaidasReal - totalSaidasPrev)}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">SALDO DO PERIODO</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${saldoPrev >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(saldoPrev)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${saldoReal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(saldoReal)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${saldoReal - saldoPrev >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {saldoReal - saldoPrev >= 0 ? '+' : ''}{fmt(saldoReal - saldoPrev)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Projecao */
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Projecao dos proximos 6 meses</h2>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Mes', 'Entradas', 'Saidas', 'Saldo', 'Saldo Acumulado'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projection.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Sem dados de projecao.</td></tr>
              ) : projection.map((p) => (
                <tr key={p.mes} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.mes}</td>
                  <td className="px-4 py-3 text-sm text-right text-emerald-700 font-medium">{fmt(p.entradas)}</td>
                  <td className="px-4 py-3 text-sm text-right text-red-700 font-medium">{fmt(p.saidas)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${p.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(p.saldo)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${p.saldoAcumulado >= 0 ? 'text-slate-900' : 'text-red-700'}`}>{fmt(p.saldoAcumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
