'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  DollarSign,
  UserPlus,
  Cake,
  Plus,
  FileText,
  Gift,
  Eye,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

const statusColors: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  CALCULADA: 'bg-sky-100 text-sky-700',
  APROVADA: 'bg-amber-100 text-amber-700',
  PAGA: 'bg-emerald-100 text-emerald-700',
};

const tipoColors: Record<string, string> = {
  MENSAL: 'bg-sky-100 text-sky-700',
  FERIAS: 'bg-cyan-100 text-cyan-700',
  '13°': 'bg-purple-100 text-purple-700',
  RESCISAO: 'bg-red-100 text-red-700',
};

interface DeptEntry { name: string; count: number }
interface RecentPayroll { id: string; periodo: string; tipo: string; status: string; bruto: number; liquido: number }

export default function RHDashboardPage() {
  const [funcionariosAtivos, setFuncionariosAtivos] = useState(0);
  const [custoFolha, setCustoFolha] = useState(0);
  const [admissoesMes, setAdmissoesMes] = useState(0);
  const [aniversariantesMes] = useState(0);
  const [departments, setDepartments] = useState<DeptEntry[]>([]);
  const [recentPayrolls, setRecentPayrolls] = useState<RecentPayroll[]>([]);

  useEffect(() => {
    // Fetch employee stats
    api<{ total: number; byStatus: Record<string, number>; byDepartamento: Record<string, number> }>('/hr/employees/stats')
      .then((stats) => {
        setFuncionariosAtivos(stats.byStatus?.ATIVO ?? 0);
        setAdmissoesMes(0); // not provided by stats endpoint directly
        const depts: DeptEntry[] = Object.entries(stats.byDepartamento ?? {}).map(([name, count]) => ({ name, count }));
        setDepartments(depts);
      })
      .catch(() => {});

    // Fetch payroll list for recent payrolls and cost
    api<{ data: any[]; meta: any }>('/hr/payroll', { params: { limit: 5 } })
      .then((result) => {
        const mapped: RecentPayroll[] = result.data.map((p: any) => ({
          id: p.id,
          periodo: p.periodoReferencia,
          tipo: p.type ?? 'MENSAL',
          status: p.status,
          bruto: Number(p.totalBruto ?? 0),
          liquido: Number(p.totalLiquido ?? 0),
        }));
        setRecentPayrolls(mapped);
        // Use most recent payroll's bruto as custo folha
        if (mapped.length > 0) setCustoFolha(mapped[0].bruto);
      })
      .catch(() => {});
  }, []);

  const maxDeptCount = departments.length > 0 ? Math.max(...departments.map((d) => d.count)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recursos Humanos</h1>
          <p className="text-slate-500 mt-1">Painel de gestao de pessoas e folha de pagamento</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Funcionarios Ativos</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{funcionariosAtivos}</p>
          <p className="text-xs text-slate-500 mt-1">em todos os departamentos</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-cyan-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Custo Folha Mensal</h3>
          </div>
          <p className="text-lg font-bold text-cyan-700">{formatCurrency(custoFolha)}</p>
          <p className="text-xs text-slate-500 mt-1">bruto competencia atual</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Admissoes no Mes</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{admissoesMes}</p>
          <p className="text-xs text-slate-500 mt-1">Marco/2026</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Cake className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Aniversariantes</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{aniversariantesMes}</p>
          <p className="text-xs text-slate-500 mt-1">neste mes</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/rh/funcionarios/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Novo Funcionario
        </Link>
        <Link href="/rh/folha-pagamento/nova" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium transition-colors">
          <FileText className="w-4 h-4" />
          Nova Folha
        </Link>
        <Link href="/rh/beneficios" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <Gift className="w-4 h-4" />
          Beneficios
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-slate-900">Distribuicao por Departamento</h2>
            </div>
            <Link href="/rh/funcionarios" className="text-sm text-sky-600 hover:text-sky-700 font-medium">Ver todos</Link>
          </div>
          <div className="space-y-3">
            {departments.length === 0 ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : departments.map((dept) => (
              <div key={dept.name} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 w-28 shrink-0">{dept.name}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(dept.count / maxDeptCount) * 100}%` }}
                  >
                    <span className="text-xs font-medium text-white">{dept.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payrolls */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-slate-900">Folhas Recentes</h2>
            </div>
            <Link href="/rh/folha-pagamento" className="text-sm text-sky-600 hover:text-sky-700 font-medium">Ver todas</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Periodo</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Liquido</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayrolls.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">Carregando...</td></tr>
                ) : recentPayrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{p.periodo}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tipoColors[p.tipo] || 'bg-slate-100 text-slate-600'}`}>{p.tipo}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-900 text-right">{formatCurrency(p.liquido)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/rh/folha-pagamento/${p.id}`} className="p-1 text-slate-400 hover:text-sky-600 inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
