'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Eye,
  TrendingUp,
  TrendingDown,
  FileText,
  List,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface RecentEntry {
  id: string;
  numero: string;
  date: string;
  description: string;
  totalValue: number;
  status: 'RASCUNHO' | 'LANCADO' | 'ESTORNADO';
}

const statusColors: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  LANCADO: 'bg-emerald-100 text-emerald-700',
  ESTORNADO: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  LANCADO: 'Lançado',
  ESTORNADO: 'Estornado',
};

export default function ContabilidadeDashboardPage() {
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLancamentos, setTotalLancamentos] = useState(0);
  const [contasAtivas, setContasAtivas] = useState(0);
  const [saldoDebitos] = useState(0);
  const [saldoCreditos] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [entriesRes, totalRes, contasRes] = await Promise.all([
          apiFetch('/api/accounting/journal?limit=5&page=1'),
          apiFetch('/api/accounting/journal?limit=1'),
          apiFetch('/api/accounting/chart?limit=1&active=true'),
        ]);

        if (entriesRes.ok) {
          const entriesData = await entriesRes.json();
          const entries: RecentEntry[] = (entriesData.data ?? []).map((e: {
            id: string;
            numero: string;
            date: string;
            description: string;
            totalValue: number;
            status: 'RASCUNHO' | 'LANCADO' | 'ESTORNADO';
          }) => ({
            id: e.id,
            numero: e.numero,
            date: e.date,
            description: e.description,
            totalValue: e.totalValue,
            status: e.status,
          }));
          setRecentEntries(entries);
        }

        if (totalRes.ok) {
          const totalData = await totalRes.json();
          setTotalLancamentos(totalData.meta?.total ?? 0);
        }

        if (contasRes.ok) {
          const contasData = await contasRes.json();
          setContasAtivas(contasData.meta?.total ?? 0);
        }
      } catch {
        // silently handle errors
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contabilidade</h1>
          <p className="text-slate-500 mt-1">
            Painel de gestao contabil e lancamentos
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Total Lancamentos</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{loading ? '—' : totalLancamentos}</p>
          <p className="text-xs text-slate-500 mt-1">no periodo atual</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Saldo Debitos</h3>
          </div>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(saldoDebitos)}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Saldo Creditos</h3>
          </div>
          <p className="text-lg font-bold text-purple-700">{formatCurrency(saldoCreditos)}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <List className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Contas Ativas</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{loading ? '—' : contasAtivas}</p>
          <p className="text-xs text-slate-500 mt-1">no plano de contas</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/contabilidade/lancamentos/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Lancamento
        </Link>
        <Link
          href="/contabilidade/plano-contas"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Plano de Contas
        </Link>
      </div>

      {/* Recent Journal Entries */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-slate-900">Lancamentos Recentes</h2>
          </div>
          <Link href="/contabilidade/lancamentos" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Carregando...</p>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Nenhum lancamento encontrado.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{entry.numero}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(entry.date).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.description}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(entry.totalValue)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[entry.status] ?? entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/contabilidade/lancamentos/${entry.id}`}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
