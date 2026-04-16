'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Landmark,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  BarChart3,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface StatsData {
  byType: Record<string, { count: number; total: number }>;
  byStatus: Record<string, { count: number; total: number }>;
}

interface BankAccount {
  id: string;
  name: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  saldoAtual: number;
}

interface CashFlowRow {
  id: string;
  description: string;
  type: 'RECEITA' | 'DESPESA';
  valorPrevisto: number;
  valorRealizado: number;
  date: string;
}

export default function FinanceiroDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashFlowData, setCashFlowData] = useState<CashFlowRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // Build last-6-months date range for cash flow chart
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const dateFrom = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;

    const [statsRes, bankRes, cfRes] = await Promise.all([
      apiFetch('/api/financial/movements/stats'),
      apiFetch('/api/financial/bank-accounts?limit=10'),
      apiFetch(`/api/financial/cash-flow?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=100`),
    ]);

    if (statsRes.ok) setStats(await statsRes.json());
    if (bankRes.ok) {
      const d = await bankRes.json();
      setBankAccounts(d.data ?? d);
    }
    if (cfRes.ok) {
      const d = await cfRes.json();
      setCashFlowData(d.data ?? d);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aggregate cash flow by month for chart
  const monthlyMap: Record<string, { receitas: number; despesas: number }> = {};
  for (const row of cashFlowData) {
    const d = new Date(row.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[key]) monthlyMap[key] = { receitas: 0, despesas: 0 };
    if (row.type === 'RECEITA') monthlyMap[key].receitas += Number(row.valorRealizado ?? row.valorPrevisto ?? 0);
    else monthlyMap[key].despesas += Number(row.valorRealizado ?? row.valorPrevisto ?? 0);
  }
  const chartData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => {
      const [yr, mo] = key.split('-');
      return { month: `${mo}/${yr.slice(2)}`, ...vals };
    });

  const maxCashFlow = chartData.length > 0
    ? Math.max(...chartData.flatMap((d) => [d.receitas, d.despesas]), 1)
    : 1;

  const totalReceber = (stats?.byStatus?.PENDENTE?.total ?? 0);
  const totalPagar = 0; // stats are combined; separate by type in sub-pages
  const saldoBancario = bankAccounts.reduce((sum, acc) => sum + Number(acc.saldoAtual ?? 0), 0);
  const titulosVencidos = stats?.byStatus?.VENCIDO?.total ?? 0;

  // Aging data derived from stats
  const agingData = [
    { faixa: 'Pendente', aReceber: stats?.byStatus?.PENDENTE?.total ?? 0, aPagar: 0 },
    { faixa: 'Vencido', aReceber: stats?.byStatus?.VENCIDO?.total ?? 0, aPagar: 0 },
    { faixa: 'Pago', aReceber: stats?.byStatus?.PAGO?.total ?? stats?.byStatus?.RECEBIDO?.total ?? 0, aPagar: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-slate-500 mt-1">
            Painel de gestao financeira e fluxo de caixa
          </p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Atualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Total a Receber</h3>
          </div>
          <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalReceber)}</p>
          <p className="text-xs text-slate-500 mt-1">titulos em aberto</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Total a Pagar</h3>
          </div>
          <p className="text-lg font-bold text-red-700">{formatCurrency(totalPagar)}</p>
          <p className="text-xs text-slate-500 mt-1">titulos em aberto</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Landmark className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Saldo Bancario</h3>
          </div>
          <p className="text-lg font-bold text-green-700">{formatCurrency(saldoBancario)}</p>
          <p className="text-xs text-slate-500 mt-1">todas as contas</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Titulos Vencidos</h3>
          </div>
          <p className="text-lg font-bold text-amber-700">{formatCurrency(titulosVencidos)}</p>
          <p className="text-xs text-red-500 mt-1">requer atencao</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/financeiro/contas-pagar/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Conta a Pagar
        </Link>
        <Link
          href="/financeiro/contas-receber/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Conta a Receber
        </Link>
        <Link
          href="/financeiro/fluxo-caixa"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          Fluxo de Caixa
        </Link>
        <Link
          href="/financeiro/extrato"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <Receipt className="w-4 h-4" />
          Extrato Bancario
        </Link>
      </div>

      {/* Cash Flow Mini Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Fluxo de Caixa - Ultimos 6 Meses</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">Sem dados no periodo.</div>
        ) : (
          <>
            <div className="flex items-end gap-3 h-48">
              {chartData.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-1 h-40">
                    <div
                      className="flex-1 bg-emerald-400 rounded-t"
                      style={{ height: `${(d.receitas / maxCashFlow) * 100}%` }}
                      title={`Receitas: ${formatCurrency(d.receitas)}`}
                    />
                    <div
                      className="flex-1 bg-red-400 rounded-t"
                      style={{ height: `${(d.despesas / maxCashFlow) * 100}%` }}
                      title={`Despesas: ${formatCurrency(d.despesas)}`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{d.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-400 rounded" />
                <span className="text-xs text-slate-600">Receitas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded" />
                <span className="text-xs text-slate-600">Despesas</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank Accounts */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Contas Bancarias</h2>
            </div>
            <Link href="/financeiro/contas-bancarias" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Ver todas
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : bankAccounts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma conta cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{acc.banco ?? acc.name}</p>
                    <p className="text-xs text-slate-500">Ag. {acc.agencia} | Cc. {acc.conta}</p>
                  </div>
                  <p className={`text-sm font-bold ${Number(acc.saldoAtual) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(Number(acc.saldoAtual ?? 0))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats by Status */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Analise de Status</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Quantidade</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats && Object.entries(stats.byStatus).map(([status, vals]) => (
                    <tr key={status} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{status}</td>
                      <td className="px-3 py-2.5 text-sm text-right text-slate-700">{vals.count}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">{formatCurrency(vals.total)}</td>
                    </tr>
                  ))}
                  {!stats && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-400">Sem dados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
