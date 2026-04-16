'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  TrendingUp,
  AlertCircle,
  Plus,
  Eye,
  Calendar,
  ArrowRightLeft,
  BarChart3,
  Scale,
  BookOpen,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtPercent } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

type NFeStatus = 'RASCUNHO' | 'VALIDADA' | 'TRANSMITIDA' | 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA' | 'REJEITADA';

interface RecentNFe {
  id: string;
  numero: number | null;
  serie: number;
  type: 'ENTRADA' | 'SAIDA';
  person: { razaoSocial: string } | null;
  valorTotal: number;
  status: NFeStatus;
  dataEmissao: string | null;
  createdAt: string;
}

interface NFeStats {
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number; valorTotal: number }[];
  totals: {
    count: number;
    valorTotal: number;
    valorIcms: number;
    valorIpi: number;
    valorPis: number;
    valorCofins: number;
    valorIbs: number;
    valorCbs: number;
    valorIs: number;
  };
}

const statusColors: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  VALIDADA: 'bg-amber-100 text-amber-700',
  TRANSMITIDA: 'bg-blue-100 text-blue-700',
  AUTORIZADA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
  DENEGADA: 'bg-red-100 text-red-700',
  REJEITADA: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  VALIDADA: 'Validada',
  TRANSMITIDA: 'Transmitida',
  AUTORIZADA: 'Autorizada',
  CANCELADA: 'Cancelada',
  DENEGADA: 'Denegada',
  REJEITADA: 'Rejeitada',
};

const currentYear = new Date().getFullYear();
// Reforma Tributária 2026 = 90% atual / 10% IBS+CBS
const percAtual = 90;
const percReforma = 10;

// Período atual em pt-BR (ex: "Março/2026")
const periodoAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  .replace(/^./, (c) => c.toUpperCase());

export default function FiscalDashboardPage() {
  const [recentNFes, setRecentNFes] = useState<RecentNFe[]>([]);
  const [stats, setStats]           = useState<NFeStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    try {
      // Use first day of current month for period stats
      const now    = new Date();
      const start  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const [statsRes, recentRes] = await Promise.all([
        apiFetch(`/api/fiscal/nfe/stats?startDate=${start}&endDate=${end}`),
        apiFetch(`/api/fiscal/nfe?limit=5`),
      ]);

      if (statsRes.ok)  setStats(await statsRes.json());
      if (recentRes.ok) {
        const json = await recentRes.json();
        setRecentNFes(json.data ?? []);
      }
    } catch {
      // silently fail — show empty/zero state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Compute KPIs from stats
  const nfesEmitidas     = stats?.byStatus.find((s) => s.status === 'AUTORIZADA')?.count ?? 0;
  const valorFaturado    = stats?.totals.valorTotal ?? 0;
  const nfesPendentes    = (stats?.byStatus.find((s) => s.status === 'RASCUNHO')?.count ?? 0)
                         + (stats?.byStatus.find((s) => s.status === 'VALIDADA')?.count  ?? 0);
  const totalICMS        = Number(stats?.totals.valorIcms ?? 0);
  const totalPIS         = Number(stats?.totals.valorPis  ?? 0);
  const totalCOFINS      = Number(stats?.totals.valorCofins ?? 0);
  const totalIPI         = Number(stats?.totals.valorIpi  ?? 0);
  const totalIBS         = Number(stats?.totals.valorIbs  ?? 0);
  const totalCBS         = Number(stats?.totals.valorCbs  ?? 0);
  const totalIS          = Number(stats?.totals.valorIs   ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fiscal — NF-e e Motor Tributário</h1>
          <p className="text-slate-500 mt-1">
            Emissão de notas fiscais, apuração de impostos e gestão tributária
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">NF-es Autorizadas</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Mês atual</span>
            {loading ? (
              <div className="h-7 w-10 bg-slate-200 animate-pulse rounded" />
            ) : (
              <span className="text-2xl font-bold text-emerald-700">{nfesEmitidas}</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Valor Total Faturado</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Mês atual</span>
            {loading ? (
              <div className="h-7 w-24 bg-slate-200 animate-pulse rounded" />
            ) : (
              <span className="text-2xl font-bold text-green-700">{formatCurrency(valorFaturado)}</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">NF-es Pendentes</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Aguardando ação</span>
            {loading ? (
              <div className="h-7 w-10 bg-slate-200 animate-pulse rounded" />
            ) : (
              <span className="text-2xl font-bold text-amber-600">{nfesPendentes}</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Total de NF-es</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Mês atual</span>
            {loading ? (
              <div className="h-7 w-10 bg-slate-200 animate-pulse rounded" />
            ) : (
              <span className="text-2xl font-bold text-teal-700">
                {stats?.byStatus.reduce((s, b) => s + b.count, 0) ?? 0}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/fiscal/nfe/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova NF-e
        </Link>
        <Link
          href="/fiscal/nfe"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 text-sm font-medium transition-colors"
        >
          <FileText className="w-4 h-4" />
          Todas as NF-es
        </Link>
        <Link
          href="/fiscal/apuracao"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          Apuração
        </Link>
        <Link
          href="/fiscal/regras"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Regras Tributárias
        </Link>
      </div>

      {/* Apuração do Mês + Reforma Tributária */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Apuração do Mês */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Apuração — {periodoAtual}</h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-slate-100 animate-pulse rounded" />
              ))}
            </div>
          ) : stats?.totals.count === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma NF-e autorizada no período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tributo</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor NF-es</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { label: 'ICMS', valor: totalICMS },
                    { label: 'IPI',  valor: totalIPI  },
                    { label: 'PIS',  valor: totalPIS  },
                    { label: 'COFINS', valor: totalCOFINS },
                    { label: 'IBS (Reforma)', valor: totalIBS },
                    { label: 'CBS (Reforma)', valor: totalCBS },
                  ].map(({ label, valor }) => (
                    <tr key={label} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">{label}</td>
                      <td className="px-3 py-2 text-sm text-slate-700 text-right">{formatCurrency(valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                    <td className="px-3 py-2 text-sm font-bold text-emerald-900">Total de Tributos</td>
                    <td className="px-3 py-2 text-sm font-bold text-emerald-900 text-right">
                      {formatCurrency(totalICMS + totalIPI + totalPIS + totalCOFINS + totalIBS + totalCBS + totalIS)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="text-xs text-slate-400 mt-2">* Valores calculados sobre NF-es AUTORIZADAS no período</p>
            </div>
          )}
        </div>

        {/* Reforma Tributária */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Reforma Tributária — Transição</h2>
          </div>

          <div className="mb-4">
            <p className="text-sm text-slate-600 mb-3">
              Período de transição {currentYear}: proporção entre tributos atuais e novos (IBS + CBS).
            </p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold text-emerald-700">{currentYear}</span>
              <span className="text-sm text-slate-500">Ano fiscal vigente</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Tributos Atuais (ICMS, PIS, COFINS, IPI)</span>
                <span className="text-sm font-bold text-emerald-700">{fmtPercent(percAtual, 0)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4">
                <div className="h-4 rounded-full bg-emerald-500" style={{ width: `${percAtual}%` }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Novos Tributos (IBS + CBS)</span>
                <span className="text-sm font-bold text-teal-700">{fmtPercent(percReforma, 0)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4">
                <div className="h-4 rounded-full bg-teal-500" style={{ width: `${percReforma}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs text-emerald-800 font-medium">
              {currentYear}: {fmtPercent(percAtual, 0)} tributos atuais / {fmtPercent(percReforma, 0)} IBS+CBS
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              Transição gradual de 2026 a 2033. O motor tributário calcula ambos os regimes automaticamente.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-1">
            {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((year) => (
              <div
                key={year}
                className={`flex-1 text-center py-1 rounded text-[10px] font-bold ${
                  year === currentYear
                    ? 'bg-emerald-600 text-white'
                    : year < currentYear
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {year}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent NF-es */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">NF-es Recentes</h2>
          </div>
          <Link href="/fiscal/nfe" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            Ver todas
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />
            ))}
          </div>
        ) : recentNFes.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma NF-e encontrada</p>
            <Link href="/fiscal/nfe/nova" className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              <Plus className="w-4 h-4" /> Criar primeira NF-e
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pessoa</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Emissão</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentNFes.map((nfe) => (
                  <tr key={nfe.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {nfe.numero ? `${String(nfe.numero).padStart(6, '0')}-${nfe.serie}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        nfe.type === 'SAIDA' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {nfe.type === 'SAIDA' ? 'Saída' : 'Entrada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-[180px] truncate">
                      {nfe.person?.razaoSocial ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {formatCurrency(nfe.valorTotal)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[nfe.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[nfe.status] ?? nfe.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {nfe.dataEmissao
                          ? new Date(nfe.dataEmissao).toLocaleDateString('pt-BR')
                          : new Date(nfe.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/fiscal/nfe/${nfe.id}`}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
