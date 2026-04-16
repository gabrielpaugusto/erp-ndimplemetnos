'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Users,
  Shield,
  Plus,
  Eye,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface RecentFinancing {
  id: string;
  number: string;
  client: string;
  type: string;
  value: number;
  status: string;
  statusColor: string;
}

interface RecentConsortium {
  id: string;
  groupQuota: string;
  client: string;
  admin: string;
  creditValue: number;
  status: string;
  statusColor: string;
}

interface RecentInsurance {
  id: string;
  policy: string;
  client: string;
  type: string;
  premium: number;
  expiry: string;
  status: string;
  statusColor: string;
  expiringAlert: boolean;
}

const financingStatusColor: Record<string, string> = {
  SIMULACAO: 'bg-slate-100 text-slate-600',
  PROPOSTA: 'bg-amber-100 text-amber-700',
  ANALISE: 'bg-yellow-100 text-yellow-700',
  APROVADO: 'bg-emerald-100 text-emerald-700',
  CONTRATADO: 'bg-blue-100 text-blue-700',
  LIBERADO: 'bg-indigo-100 text-indigo-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

const financingStatusLabel: Record<string, string> = {
  SIMULACAO: 'Simulação',
  PROPOSTA: 'Proposta',
  ANALISE: 'Em Análise',
  APROVADO: 'Aprovado',
  CONTRATADO: 'Contratado',
  LIBERADO: 'Liberado',
  CANCELADO: 'Cancelado',
};

const consortiumStatusColor: Record<string, string> = {
  ATIVO: 'bg-blue-100 text-blue-700',
  CONTEMPLADO: 'bg-emerald-100 text-emerald-700',
  ENCERRADO: 'bg-slate-100 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-700',
};

const consortiumStatusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  CONTEMPLADO: 'Contemplado',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
};

const insuranceStatusColor: Record<string, string> = {
  VIGENTE: 'bg-emerald-100 text-emerald-700',
  VENCIDO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-slate-100 text-slate-600',
  EM_ANALISE: 'bg-yellow-100 text-yellow-700',
};

const insuranceStatusLabel: Record<string, string> = {
  VIGENTE: 'Vigente',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
  EM_ANALISE: 'Em Análise',
};

export default function FIDashboardPage() {
  const [recentFinancings, setRecentFinancings] = useState<RecentFinancing[]>([]);
  const [recentConsortia, setRecentConsortia] = useState<RecentConsortium[]>([]);
  const [recentInsurances, setRecentInsurances] = useState<RecentInsurance[]>([]);

  const [activeFinancings, setActiveFinancings] = useState(0);
  const [totalFinanciado, setTotalFinanciado] = useState(0);
  const [activeConsortia, setActiveConsortia] = useState(0);
  const [totalCredito, setTotalCredito] = useState(0);
  const [vigentInsurances, setVigentInsurances] = useState(0);
  const [expiringInsurances, setExpiringInsurances] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      try {
        const [
          financingsRes,
          consortiaRes,
          insurancesRes,
          finStatsRes,
          consStatsRes,
          insStatsRes,
        ] = await Promise.all([
          apiFetch('/api/fi/financing?limit=5'),
          apiFetch('/api/fi/consortium?limit=5'),
          apiFetch('/api/fi/insurance?limit=5'),
          apiFetch('/api/fi/financing/stats'),
          apiFetch('/api/fi/consortium/stats'),
          apiFetch('/api/fi/insurance/stats'),
        ]);

        if (financingsRes.ok) {
          const data = await financingsRes.json();
          const items = data.data ?? [];
          setRecentFinancings(
            items.map((f: any) => ({
              id: f.id,
              number: f.numero ?? f.id,
              client: f.person?.razaoSocial ?? f.person?.nomeFantasia ?? '—',
              type: f.type,
              value: Number(f.valorFinanciado ?? 0),
              status: f.status,
              statusColor: financingStatusColor[f.status] ?? 'bg-slate-100 text-slate-600',
            }))
          );
        }

        if (consortiaRes.ok) {
          const data = await consortiaRes.json();
          const items = data.data ?? [];
          setRecentConsortia(
            items.map((c: any) => ({
              id: c.id,
              groupQuota: `${c.grupo ?? ''} / ${c.cota ?? ''}`,
              client: c.person?.razaoSocial ?? c.person?.nomeFantasia ?? '—',
              admin: c.administradora?.razaoSocial ?? c.administradora?.nomeFantasia ?? '—',
              creditValue: Number(c.valorCredito ?? 0),
              status: c.status,
              statusColor: consortiumStatusColor[c.status] ?? 'bg-slate-100 text-slate-600',
            }))
          );
        }

        if (insurancesRes.ok) {
          const data = await insurancesRes.json();
          const items = data.data ?? [];
          const hoje = new Date();
          const em30Dias = new Date();
          em30Dias.setDate(em30Dias.getDate() + 30);
          setRecentInsurances(
            items.map((i: any) => {
              const fim = i.dataFim ? new Date(i.dataFim) : null;
              const expiringAlert =
                i.status === 'VIGENTE' && fim !== null && fim <= em30Dias && fim >= hoje;
              return {
                id: i.id,
                policy: i.numeroApolice ?? i.id,
                client: i.person?.razaoSocial ?? i.person?.nomeFantasia ?? '—',
                type: i.type,
                premium: Number(i.premio ?? 0),
                expiry: i.dataFim ?? '',
                status: i.status,
                statusColor: insuranceStatusColor[i.status] ?? 'bg-slate-100 text-slate-600',
                expiringAlert,
              };
            })
          );
        }

        if (finStatsRes.ok) {
          const stats = await finStatsRes.json();
          const byStatus: { status: string; count: number }[] = stats.byStatus ?? [];
          const byType: { type: string; count: number; totalFinanciado: number | null }[] = stats.byType ?? [];
          const active = byStatus
            .filter((s) => !['CANCELADO', 'LIBERADO'].includes(s.status))
            .reduce((acc, s) => acc + s.count, 0);
          const total = byType.reduce((acc, t) => acc + Number(t.totalFinanciado ?? 0), 0);
          setActiveFinancings(active);
          setTotalFinanciado(total);
        }

        if (consStatsRes.ok) {
          const stats = await consStatsRes.json();
          const byStatus: { status: string; count: number; totalCredito: number | null }[] = stats.byStatus ?? [];
          const active = byStatus
            .filter((s) => s.status === 'ATIVO')
            .reduce((acc, s) => acc + s.count, 0);
          const total = Number(stats.totalCredito ?? 0);
          setActiveConsortia(active);
          setTotalCredito(total);
        }

        if (insStatsRes.ok) {
          const stats = await insStatsRes.json();
          const byStatus: { status: string; count: number }[] = stats.byStatus ?? [];
          const vigent = byStatus
            .filter((s) => s.status === 'VIGENTE')
            .reduce((acc, s) => acc + s.count, 0);
          setVigentInsurances(vigent);
        }

        // Count expiring insurances separately from the recent list
        const expRes = await apiFetch('/api/fi/insurance?status=VIGENTE&limit=200');
        if (expRes.ok) {
          const expData = await expRes.json();
          const hoje = new Date();
          const em30Dias = new Date();
          em30Dias.setDate(em30Dias.getDate() + 30);
          const expCount = (expData.data ?? []).filter((i: any) => {
            const fim = i.dataFim ? new Date(i.dataFim) : null;
            return fim !== null && fim <= em30Dias && fim >= hoje;
          }).length;
          setExpiringInsurances(expCount);
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard F&I', err);
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">F&I — Financiamento, Consórcio e Seguro</h1>
          <p className="text-slate-500 mt-1">
            Painel de gestão de produtos financeiros e seguros
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Financiamentos */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Landmark className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Financiamentos</h3>
            </div>
            <Link href="/fi/financiamento" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Ativos</span>
              <span className="text-lg font-bold text-slate-900">{loading ? '—' : activeFinancings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total Financiado</span>
              <span className="text-sm font-semibold text-indigo-700">{loading ? '—' : formatCurrency(totalFinanciado)}</span>
            </div>
          </div>
        </div>

        {/* Consórcios */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Consórcios</h3>
            </div>
            <Link href="/fi/consorcio" className="text-xs text-violet-600 hover:text-violet-700 font-medium">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Ativos</span>
              <span className="text-lg font-bold text-slate-900">{loading ? '—' : activeConsortia}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total Crédito</span>
              <span className="text-sm font-semibold text-violet-700">{loading ? '—' : formatCurrency(totalCredito)}</span>
            </div>
          </div>
        </div>

        {/* Seguros */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Seguros</h3>
            </div>
            <Link href="/fi/seguro" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Vigentes</span>
              <span className="text-lg font-bold text-slate-900">{loading ? '—' : vigentInsurances}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Vencem em 30 dias</span>
              <span className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {loading ? '—' : expiringInsurances}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/fi/financiamento/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Financiamento
        </Link>
        <Link
          href="/fi/consorcio/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Cota Consórcio
        </Link>
        <Link
          href="/fi/seguro/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Apólice
        </Link>
      </div>

      {/* Recent Financings */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Financiamentos Recentes</h2>
          </div>
          <Link href="/fi/financiamento" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Carregando...</td>
                </tr>
              ) : recentFinancings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Nenhum financiamento encontrado</td>
                </tr>
              ) : (
                recentFinancings.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{f.number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{f.client}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        {f.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(f.value)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${f.statusColor}`}>
                        {financingStatusLabel[f.status] ?? f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/fi/financiamento/${f.id}`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Consortia */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-slate-900">Consórcios Recentes</h2>
          </div>
          <Link href="/fi/consorcio" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grupo/Cota</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administradora</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Crédito</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Carregando...</td>
                </tr>
              ) : recentConsortia.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Nenhum consórcio encontrado</td>
                </tr>
              ) : (
                recentConsortia.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 font-mono">{c.groupQuota}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.client}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.admin}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(c.creditValue)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.statusColor}`}>
                        {consortiumStatusLabel[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/fi/consorcio/${c.id}`}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Insurances */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Seguros Recentes</h2>
          </div>
          <Link href="/fi/seguro" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Apólice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prêmio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vigência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Carregando...</td>
                </tr>
              ) : recentInsurances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Nenhum seguro encontrado</td>
                </tr>
              ) : (
                recentInsurances.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {i.expiringAlert && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {i.policy}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{i.client}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                        {i.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(i.premium)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {i.expiry ? new Date(i.expiry).toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${i.statusColor}`}>
                        {insuranceStatusLabel[i.status] ?? i.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/fi/seguro/${i.id}`}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
