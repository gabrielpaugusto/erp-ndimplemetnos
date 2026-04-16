'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingDown, Factory, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtPercent, fmtNumber } from '@/lib/format';

const fmtPct = (v: number) => fmtPercent(v);

const fmtNum = (v: number) => fmtNumber(v, 4);

type AbcClass = 'A' | 'B' | 'C';

const classColors: Record<AbcClass, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-amber-100 text-amber-700',
  C: 'bg-red-100 text-red-700',
};

interface AbcItem {
  rank: number;
  productId: string;
  code: string;
  description: string;
  unit: string;
  group?: { code: string; name: string } | null;
  quantidade?: number;
  quantidadeTotal?: number;
  custoMedio?: number;
  valorTotal: number;
  percentualValor: number;
  percentualAcumulado: number;
  classe: AbcClass;
  ocorrencias?: number;
}

interface GGFItem {
  productId: string;
  code: string;
  description: string;
  unit: string;
  quantidadeTotal: number;
  valorTotal: number;
}

interface GGFReport {
  periodo: { ano: number; mes: number; inicio: string; fim: string };
  totalGGF: number;
  quantidadeItens: number;
  quantidadeMovimentos: number;
  itens: GGFItem[];
  observacao: string;
}

interface SemMovItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  group?: { code: string; name: string } | null;
  saldoAtual: number;
  valorEstoque: number;
  diasSemMovimento: number | null;
  dataUltimaMovimentacao: string | null;
}

type TabKey = 'abc-estoque' | 'abc-consumo' | 'ggf' | 'sem-movimentacao';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'abc-estoque', label: 'Curva ABC — Estoque', icon: BarChart2 },
  { key: 'abc-consumo', label: 'Curva ABC — Consumo', icon: TrendingDown },
  { key: 'ggf', label: 'GGF Mensal', icon: Factory },
  { key: 'sem-movimentacao', label: 'Sem Movimentacao', icon: Clock },
];

export default function EstoqueRelatoriosPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('abc-estoque');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ABC Estoque
  const [abcEstoque, setAbcEstoque] = useState<AbcItem[]>([]);
  const [locationIdFilter, setLocationIdFilter] = useState('');

  // ABC Consumo
  const [abcConsumo, setAbcConsumo] = useState<AbcItem[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // GGF
  const [ggfReport, setGgfReport] = useState<GGFReport | null>(null);
  const [ggfAno, setGgfAno] = useState(new Date().getFullYear());
  const [ggfMes, setGgfMes] = useState(new Date().getMonth() + 1);

  // Sem Movimentacao
  const [semMov, setSemMov] = useState<SemMovItem[]>([]);
  const [diasSemMov, setDiasSemMov] = useState(90);

  const loadAbcEstoque = useCallback(async () => {
    setLoading(true);
    setError('');
    const url = `/api/inventory/reports/abc-estoque${locationIdFilter ? `?locationId=${locationIdFilter}` : ''}`;
    const res = await apiFetch(url);
    if (res.ok) setAbcEstoque(await res.json());
    else setError('Erro ao carregar Curva ABC de Estoque');
    setLoading(false);
  }, [locationIdFilter]);

  const loadAbcConsumo = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await apiFetch(`/api/inventory/reports/abc-consumo?startDate=${startDate}&endDate=${endDate}`);
    if (res.ok) setAbcConsumo(await res.json());
    else setError('Erro ao carregar Curva ABC de Consumo');
    setLoading(false);
  }, [startDate, endDate]);

  const loadGGF = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await apiFetch(`/api/inventory/reports/ggf-mensal?ano=${ggfAno}&mes=${ggfMes}`);
    if (res.ok) setGgfReport(await res.json());
    else setError('Erro ao carregar relatorio GGF');
    setLoading(false);
  }, [ggfAno, ggfMes]);

  const loadSemMov = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await apiFetch(`/api/inventory/reports/sem-movimentacao?dias=${diasSemMov}`);
    if (res.ok) setSemMov(await res.json());
    else setError('Erro ao carregar itens sem movimentacao');
    setLoading(false);
  }, [diasSemMov]);

  useEffect(() => {
    if (activeTab === 'abc-estoque') loadAbcEstoque();
    else if (activeTab === 'abc-consumo') loadAbcConsumo();
    else if (activeTab === 'ggf') loadGGF();
    else if (activeTab === 'sem-movimentacao') loadSemMov();
  }, [activeTab, loadAbcEstoque, loadAbcConsumo, loadGGF, loadSemMov]);

  const abcTotals = (items: AbcItem[]) => {
    const total = items.reduce((s, i) => s + i.valorTotal, 0);
    const grouped = { A: 0, B: 0, C: 0 };
    const count = { A: 0, B: 0, C: 0 };
    items.forEach((i) => { grouped[i.classe] += i.valorTotal; count[i.classe]++; });
    return { total, grouped, count };
  };

  const meses = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatorios de Estoque</h1>
          <p className="text-slate-500 mt-1">Curva ABC, GGF mensal e analise de itens sem movimentacao</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ==================== ABC ESTOQUE ==================== */}
      {activeTab === 'abc-estoque' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={locationIdFilter}
              onChange={(e) => setLocationIdFilter(e.target.value)}
              placeholder="ID do local (opcional)"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={loadAbcEstoque}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {abcEstoque.length > 0 && (() => {
            const { total, grouped, count } = abcTotals(abcEstoque);
            return (
              <div className="grid grid-cols-3 gap-4">
                {(['A', 'B', 'C'] as AbcClass[]).map((cls) => (
                  <div key={cls} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${classColors[cls]}`}>Classe {cls}</span>
                      <span className="text-xs text-slate-500">{count[cls]} itens</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 mt-2">{fmtCurrency(grouped[cls])}</p>
                    <p className="text-xs text-slate-500">{fmtPct(total > 0 ? (grouped[cls] / total) * 100 : 0)} do total</p>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-12">Rank</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Classe</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Codigo</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Descricao</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Un</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Quantidade</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Valor Total</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">% Total</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">% Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></td></tr>
                  ) : abcEstoque.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">Nenhum dado encontrado.</td></tr>
                  ) : abcEstoque.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-400 text-center">{item.rank}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${classColors[item.classe]}`}>{item.classe}</span>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{item.code}</td>
                      <td className="px-3 py-2 text-sm text-slate-900 max-w-xs truncate">{item.description}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 text-center">{item.unit}</td>
                      <td className="px-3 py-2 text-sm text-right">{fmtNum(item.quantidade ?? 0)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-right">{fmtCurrency(item.valorTotal)}</td>
                      <td className="px-3 py-2 text-sm text-right">{fmtPct(item.percentualValor)}</td>
                      <td className="px-3 py-2 text-sm text-right">{fmtPct(item.percentualAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ABC CONSUMO ==================== */}
      {activeTab === 'abc-consumo' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">De:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Ate:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={loadAbcConsumo}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {abcConsumo.length > 0 && (() => {
            const { total, grouped, count } = abcTotals(abcConsumo);
            return (
              <div className="grid grid-cols-3 gap-4">
                {(['A', 'B', 'C'] as AbcClass[]).map((cls) => (
                  <div key={cls} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${classColors[cls]}`}>Classe {cls}</span>
                      <span className="text-xs text-slate-500">{count[cls]} itens</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 mt-2">{fmtCurrency(grouped[cls])}</p>
                    <p className="text-xs text-slate-500">{fmtPct(total > 0 ? (grouped[cls] / total) * 100 : 0)} do total</p>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-12">Rank</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Classe</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Codigo</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Descricao</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Un</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Qtd Consumida</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Ocorrencias</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Valor Total</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">% Total</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">% Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></td></tr>
                  ) : abcConsumo.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">Nenhum dado encontrado para o periodo.</td></tr>
                  ) : abcConsumo.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-400 text-center">{item.rank}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${classColors[item.classe]}`}>{item.classe}</span>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{item.code}</td>
                      <td className="px-3 py-2 text-sm text-slate-900 max-w-xs truncate">{item.description}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 text-center">{item.unit}</td>
                      <td className="px-3 py-2 text-sm text-right">{fmtNum(item.quantidadeTotal ?? 0)}</td>
                      <td className="px-3 py-2 text-sm text-right">{item.ocorrencias ?? 0}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-right">{fmtCurrency(item.valorTotal)}</td>
                      <td className="px-3 py-2 text-sm text-right">{fmtPct(item.percentualValor)}</td>
                      <td className="px-3 py-2 text-sm text-right">{fmtPct(item.percentualAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== GGF MENSAL ==================== */}
      {activeTab === 'ggf' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Mes:</label>
              <select
                value={ggfMes}
                onChange={(e) => setGgfMes(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {meses.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Ano:</label>
              <input
                type="number"
                value={ggfAno}
                onChange={(e) => setGgfAno(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={loadGGF}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {ggfReport && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-teal-200 p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total GGF do Mes</p>
                  <p className="text-3xl font-bold text-teal-700 mt-2">{fmtCurrency(ggfReport.totalGGF)}</p>
                  <p className="text-xs text-slate-500 mt-1">{meses[ggfReport.periodo.mes - 1]} / {ggfReport.periodo.ano}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Itens Consumidos</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{ggfReport.quantidadeItens}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Movimentacoes</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{ggfReport.quantidadeMovimentos}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                {ggfReport.observacao}
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Codigo</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Descricao</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Un</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Quantidade</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Valor Total</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">% do GGF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></td></tr>
                      ) : ggfReport.itens.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma requisicao GGF no periodo.</td></tr>
                      ) : ggfReport.itens.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-xs font-mono text-slate-500">{item.code}</td>
                          <td className="px-3 py-2 text-sm text-slate-900 max-w-xs truncate">{item.description}</td>
                          <td className="px-3 py-2 text-xs text-slate-500 text-center">{item.unit}</td>
                          <td className="px-3 py-2 text-sm text-right">{fmtNum(item.quantidadeTotal)}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-right">{fmtCurrency(item.valorTotal)}</td>
                          <td className="px-3 py-2 text-sm text-right">
                            {fmtPct(ggfReport.totalGGF > 0 ? (item.valorTotal / ggfReport.totalGGF) * 100 : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!ggfReport && !loading && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center text-slate-500 text-sm">
              Selecione o mes e ano e clique em Atualizar.
            </div>
          )}
        </div>
      )}

      {/* ==================== SEM MOVIMENTACAO ==================== */}
      {activeTab === 'sem-movimentacao' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Periodo:</label>
              <select
                value={diasSemMov}
                onChange={(e) => setDiasSemMov(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value={90}>Ultimos 90 dias</option>
                <option value={180}>Ultimos 180 dias</option>
                <option value={365}>Ultimos 365 dias</option>
              </select>
            </div>
            <button
              onClick={loadSemMov}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {semMov.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-4 py-3 flex gap-6 text-sm">
              <span className="text-slate-600">{semMov.length} itens sem movimentacao ha mais de {diasSemMov} dias</span>
              <span className="text-slate-600">Valor imobilizado: <strong>{fmtCurrency(semMov.reduce((s, i) => s + i.valorEstoque, 0))}</strong></span>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Codigo</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Descricao</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Grupo</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Un</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Saldo</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Valor Estoque</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Dias sem Mov.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></td></tr>
                  ) : semMov.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Nenhum item encontrado.</td></tr>
                  ) : semMov.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{item.code}</td>
                      <td className="px-3 py-2 text-sm text-slate-900 max-w-xs truncate">{item.description}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{item.group?.name ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 text-center">{item.unit}</td>
                      <td className="px-3 py-2 text-sm text-right">{fmtNum(item.saldoAtual)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-right">{fmtCurrency(item.valorEstoque)}</td>
                      <td className="px-3 py-2 text-right">
                        {item.diasSemMovimento !== null ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.diasSemMovimento > 365 ? 'bg-red-100 text-red-700' :
                            item.diasSemMovimento > 180 ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {item.diasSemMovimento}d
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Nunca</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
