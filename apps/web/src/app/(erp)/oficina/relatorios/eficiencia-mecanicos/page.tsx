'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  ChevronDown,
  ChevronRight,
  Calendar,
  Search,
  BarChart3,
  Award,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApontamentoDetalhe {
  apontamentoId: string;
  osId: string | null;
  osNumero: string | null;
  tarefaTitulo: string | null;
  subtarefaNome: string | null;
  horasPadrao: number;
  horasReais: number;
  eficiencia: number | null;
  inicio: string;
  fim: string | null;
}

interface MecanicoEficiencia {
  employeeId: string;
  nome: string;
  matricula: string;
  cargo: string;
  apontamentoRole: string;
  totalHorasReais: number;
  totalHorasPadrao: number;
  eficiencia: number | null;
  qtdApontamentos: number;
  qtdSubtarefasConcluidas: number;
  qtdOS: number;
  detalhe: ApontamentoDetalhe[];
}

interface RelatorioData {
  periodo: { dataInicio: string | null; dataFim: string | null };
  resumo: {
    totalMecanicos: number;
    totalHorasReais: number;
    totalHorasPadrao: number;
    eficienciaGeral: number | null;
  };
  mecanicos: MecanicoEficiencia[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFirstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eficienciaBadge(ef: number | null): { label: string; bg: string; text: string; icon: React.ReactNode } {
  if (ef === null) return { label: 'Sem dados', bg: 'bg-slate-100', text: 'text-slate-500', icon: null };
  if (ef >= 100) return { label: `${ef}%`, bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <TrendingUp className="w-3.5 h-3.5" /> };
  if (ef >= 80)  return { label: `${ef}%`, bg: 'bg-sky-100',     text: 'text-sky-700',     icon: <TrendingUp className="w-3.5 h-3.5" /> };
  if (ef >= 60)  return { label: `${ef}%`, bg: 'bg-amber-100',   text: 'text-amber-700',   icon: <TrendingDown className="w-3.5 h-3.5" /> };
  return             { label: `${ef}%`, bg: 'bg-red-100',    text: 'text-red-700',    icon: <TrendingDown className="w-3.5 h-3.5" /> };
}

function eficienciaBarColor(ef: number | null): string {
  if (ef === null) return 'bg-slate-300';
  if (ef >= 100) return 'bg-emerald-500';
  if (ef >= 80)  return 'bg-sky-500';
  if (ef >= 60)  return 'bg-amber-400';
  return 'bg-red-500';
}

function rankMedal(pos: number): string {
  if (pos === 0) return '🥇';
  if (pos === 1) return '🥈';
  if (pos === 2) return '🥉';
  return `${pos + 1}º`;
}

function fmtDuration(start: string, end: string | null): string {
  if (!end) return '-';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return '-';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EficienciaMecanicosPage() {
  const [dataInicio, setDataInicio] = useState(getFirstDayOfMonth());
  const [dataFim, setDataFim]       = useState(getToday());
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState<RelatorioData | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch]         = useState('');

  const fetchRelatorio = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ dataInicio, dataFim });
      const res = await apiFetch(`/api/workshop/apontamentos/relatorios/mecanicos?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Erro ao carregar relatório:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega automaticamente ao montar
  useEffect(() => { fetchRelatorio(); }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!data) return;
    setExpandedIds(new Set(data.mecanicos.map((m) => m.employeeId)));
  };

  const collapseAll = () => setExpandedIds(new Set());

  const filteredMecanicos = (data?.mecanicos ?? []).filter((m) =>
    search === '' ||
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.matricula.toLowerCase().includes(search.toLowerCase())
  );

  const resumo = data?.resumo;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Eficiência por Mecânico
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Análise de horas padrão vs. horas reais por colaborador no período selecionado
          </p>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período — Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período — Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Atalhos de período */}
          <div className="flex gap-1.5">
            {[
              { label: 'Esta semana', fn: () => {
                const now = new Date();
                const day = now.getDay();
                const seg = new Date(now); seg.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                setDataInicio(`${seg.getFullYear()}-${String(seg.getMonth()+1).padStart(2,'0')}-${String(seg.getDate()).padStart(2,'0')}`);
                setDataFim(getToday());
              }},
              { label: 'Este mês', fn: () => { setDataInicio(getFirstDayOfMonth()); setDataFim(getToday()); }},
              { label: 'Mês anterior', fn: () => {
                const d = new Date();
                d.setDate(1); d.setMonth(d.getMonth() - 1);
                const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                setDataInicio(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`);
                setDataFim(`${fim.getFullYear()}-${String(fim.getMonth()+1).padStart(2,'0')}-${String(fim.getDate()).padStart(2,'0')}`);
              }},
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.fn}
                className="px-2.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchRelatorio}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 ml-auto"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Gerar Relatório
          </button>
        </div>
      </div>

      {/* ── KPIs Resumo ── */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Eficiência Geral */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Eficiência Geral</span>
            </div>
            <p className={`text-3xl font-bold ${
              resumo.eficienciaGeral === null ? 'text-slate-400'
              : resumo.eficienciaGeral >= 100 ? 'text-emerald-600'
              : resumo.eficienciaGeral >= 80  ? 'text-sky-600'
              : resumo.eficienciaGeral >= 60  ? 'text-amber-600'
              : 'text-red-600'
            }`}>
              {resumo.eficienciaGeral !== null ? `${resumo.eficienciaGeral}%` : '-'}
            </p>
            <p className="text-xs text-slate-400 mt-1">meta: ≥ 100%</p>
          </div>

          {/* Mecânicos */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-violet-600" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mecânicos</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{resumo.totalMecanicos}</p>
            <p className="text-xs text-slate-400 mt-1">com apontamentos no período</p>
          </div>

          {/* Horas Reais */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Horas Reais</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{resumo.totalHorasReais.toFixed(1)}h</p>
            <p className="text-xs text-slate-400 mt-1">total apontado no período</p>
          </div>

          {/* Horas Padrão */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Horas Padrão</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{resumo.totalHorasPadrao.toFixed(1)}h</p>
            <p className="text-xs text-slate-400 mt-1">total previsto no período</p>
          </div>
        </div>
      )}

      {/* ── Sem dados ── */}
      {!loading && data && data.mecanicos.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">Nenhum apontamento concluído no período selecionado.</p>
          <p className="text-slate-400 text-sm mt-1">Ajuste o intervalo de datas e tente novamente.</p>
        </div>
      )}

      {/* ── Ranking de Mecânicos ── */}
      {data && data.mecanicos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header da tabela */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900">
                Ranking de Eficiência
              </h2>
              <span className="text-xs text-slate-400">ordenado por eficiência (maior → menor)</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar mecânico..."
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
              </div>
              <button
                onClick={expandAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Expandir todos
              </button>
              <button
                onClick={collapseAll}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                Recolher
              </button>
            </div>
          </div>

          {/* Legenda de cores */}
          <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <span className="font-medium">Eficiência:</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />≥ 100% Excelente</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />80–99% Bom</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />60–79% Atenção</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />&lt; 60% Crítico</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {filteredMecanicos.map((mec, idx) => {
              const badge = eficienciaBadge(mec.eficiencia);
              const barPct = mec.eficiencia !== null ? Math.min(mec.eficiencia, 120) : 0; // cap em 120%
              const isExpanded = expandedIds.has(mec.employeeId);

              return (
                <div key={mec.employeeId} className="group">
                  {/* Linha principal */}
                  <button
                    onClick={() => toggleExpand(mec.employeeId)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    {/* Posição / Medalha */}
                    <div className="w-10 text-center text-sm font-bold text-slate-500 shrink-0">
                      {rankMedal(idx)}
                    </div>

                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 w-48 shrink-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                        mec.eficiencia !== null && mec.eficiencia >= 100 ? 'bg-emerald-500'
                        : mec.eficiencia !== null && mec.eficiencia >= 80 ? 'bg-sky-500'
                        : mec.eficiencia !== null && mec.eficiencia >= 60 ? 'bg-amber-400'
                        : mec.eficiencia !== null ? 'bg-red-500'
                        : 'bg-slate-300'
                      }`}>
                        {mec.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{mec.nome}</p>
                        <p className="text-xs text-slate-400 font-mono">{mec.matricula}</p>
                      </div>
                    </div>

                    {/* Barra de Eficiência */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all ${eficienciaBarColor(mec.eficiencia)}`}
                            style={{ width: `${(barPct / 120) * 100}%` }}
                          />
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text} shrink-0 min-w-[70px] justify-center`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                        <span>
                          <span className="font-medium text-slate-700">{mec.totalHorasReais.toFixed(1)}h</span>
                          {' '}reais
                        </span>
                        <span>
                          <span className="font-medium text-slate-700">{mec.totalHorasPadrao.toFixed(1)}h</span>
                          {' '}padrão
                        </span>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">OS atendidas</p>
                        <p className="text-sm font-bold text-slate-900">{mec.qtdOS}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Subtarefas</p>
                        <p className="text-sm font-bold text-slate-900">{mec.qtdSubtarefasConcluidas}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Apontamentos</p>
                        <p className="text-sm font-bold text-slate-900">{mec.qtdApontamentos}</p>
                      </div>
                      <div className="w-5 shrink-0 text-slate-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Detalhe expandido */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-slate-50/60 border-t border-slate-100">
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-white border border-slate-200 rounded-lg">
                              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">OS</th>
                              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Tarefa</th>
                              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Subtarefa</th>
                              <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Início</th>
                              <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Duração</th>
                              <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">H. Padrão</th>
                              <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">H. Real</th>
                              <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Eficiência</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {mec.detalhe.map((det) => {
                              const detBadge = eficienciaBadge(det.eficiencia);
                              return (
                                <tr key={det.apontamentoId} className="bg-white hover:bg-blue-50/30 transition-colors">
                                  <td className="px-3 py-2.5">
                                    {det.osNumero ? (
                                      <Link
                                        href={`/oficina/ordens-servico/${det.osId}`}
                                        className="inline-flex items-center gap-1 font-mono text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {det.osNumero}
                                        <ExternalLink className="w-3 h-3 opacity-60" />
                                      </Link>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700 max-w-[140px] truncate" title={det.tarefaTitulo ?? ''}>
                                    {det.tarefaTitulo ?? '-'}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-600 max-w-[140px] truncate" title={det.subtarefaNome ?? ''}>
                                    {det.subtarefaNome ?? '-'}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-slate-500 whitespace-nowrap">
                                    {new Date(det.inicio).toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-medium text-slate-700 whitespace-nowrap">
                                    {fmtDuration(det.inicio, det.fim)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-medium text-slate-700">
                                    {det.horasPadrao > 0 ? `${det.horasPadrao.toFixed(2)}h` : <span className="text-slate-300">-</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-semibold text-slate-900">
                                    {det.horasReais.toFixed(2)}h
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${detBadge.bg} ${detBadge.text}`}>
                                      {detBadge.icon}
                                      {detBadge.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Subtotal do mecânico */}
                          <tfoot>
                            <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
                              <td colSpan={5} className="px-3 py-2.5 text-slate-600 text-right">
                                Total {mec.nome.split(' ')[0]}:
                              </td>
                              <td className="px-3 py-2.5 text-center text-slate-800">
                                {mec.totalHorasPadrao.toFixed(2)}h
                              </td>
                              <td className="px-3 py-2.5 text-center text-slate-800">
                                {mec.totalHorasReais.toFixed(2)}h
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                                  {badge.icon}
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredMecanicos.length === 0 && search && (
            <div className="text-center py-8 text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum mecânico encontrado para &ldquo;{search}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* ── Nota de rodapé ── */}
      {data && data.mecanicos.length > 0 && (
        <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Como a eficiência é calculada:</p>
            <p className="mt-0.5 text-amber-700">
              Eficiência = (Σ Horas Padrão das subtarefas) ÷ (Σ Horas Reais apontadas) × 100.
              Valores acima de 100% indicam que o mecânico concluiu mais rápido que o previsto.
              Subtarefas sem tempo padrão definido no catálogo não entram no cálculo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
