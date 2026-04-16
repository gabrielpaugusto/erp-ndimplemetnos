'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Eye,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

type PayrollType = 'MENSAL' | 'FERIAS' | '13°' | 'RESCISAO' | 'ADIANTAMENTO';
type PayrollStatus = 'RASCUNHO' | 'CALCULADA' | 'APROVADA' | 'PAGA';

interface Payroll {
  id: string;
  periodo: string;
  tipo: PayrollType;
  status: PayrollStatus;
  bruto: number;
  descontos: number;
  liquido: number;
  encargos: number;
}

const tipoColors: Record<PayrollType, string> = {
  MENSAL: 'bg-sky-100 text-sky-700',
  FERIAS: 'bg-cyan-100 text-cyan-700',
  '13°': 'bg-purple-100 text-purple-700',
  RESCISAO: 'bg-red-100 text-red-700',
  ADIANTAMENTO: 'bg-amber-100 text-amber-700',
};

const statusColors: Record<PayrollStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  CALCULADA: 'bg-sky-100 text-sky-700',
  APROVADA: 'bg-amber-100 text-amber-700',
  PAGA: 'bg-emerald-100 text-emerald-700',
};

export default function FolhaPagamentoListPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: any[]; meta: any }>('/hr/payroll', { params: { limit: 50 } })
      .then((result) => {
        const mapped: Payroll[] = result.data.map((p) => ({
          id: p.id,
          periodo: p.periodoReferencia,
          tipo: (p.type ?? 'MENSAL') as PayrollType,
          status: p.status as PayrollStatus,
          bruto: Number(p.totalBruto ?? 0),
          descontos: Number(p.totalDescontos ?? 0),
          liquido: Number(p.totalLiquido ?? 0),
          encargos: Number(p.totalEncargos ?? 0),
        }));
        setPayrolls(mapped);
      })
      .catch(() => setPayrolls([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Folha de Pagamento</h1>
          <p className="text-slate-500 mt-1">Gerencie as folhas de pagamento por periodo</p>
        </div>
        <Link href="/rh/folha-pagamento/nova" className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Nova Folha
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Periodo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bruto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descontos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Liquido</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Encargos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Carregando...</td></tr>
              ) : payrolls.map((p, index) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{p.periodo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tipoColors[p.tipo] ?? 'bg-slate-100 text-slate-600'}`}>{p.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-700">{formatCurrency(p.bruto)}</td>
                  <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(p.descontos)}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">{formatCurrency(p.liquido)}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(p.encargos)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/rh/folha-pagamento/${p.id}`} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors inline-flex">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && payrolls.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma folha encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
