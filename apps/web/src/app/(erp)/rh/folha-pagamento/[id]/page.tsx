'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Calculator,
  CheckCircle,
  CreditCard,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

interface PayrollItem {
  id: string;
  employeeId: string;
  salarioBase: number;
  horasExtras: number;
  valorHorasExtras: number;
  adicionalNoturno: number;
  periculosidade: number;
  insalubridade: number;
  outrosProventos: number;
  totalBruto: number;
  inss: number;
  irrf: number;
  valeTransporte: number;
  valeRefeicao: number;
  outrosDescontos: number;
  totalDescontos: number;
  totalLiquido: number;
  fgts: number;
  inssPatronal: number;
  employee?: {
    matricula: string;
    person?: { razaoSocial: string } | null;
  } | null;
}

interface Payroll {
  id: string;
  periodoReferencia: string;
  type: string;
  status: string;
  totalBruto: number;
  totalDescontos: number;
  totalLiquido: number;
  totalEncargos: number;
  items: PayrollItem[];
}

const statusLabels: Record<string, string> = {
  RASCUNHO:             'Rascunho',
  CALCULADA:            'Calculada',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  APROVADA:             'Aprovada',
  PAGA:                 'Paga',
};

const statusColors: Record<string, string> = {
  RASCUNHO:             'bg-slate-100 text-slate-600',
  CALCULADA:            'bg-sky-100 text-sky-700',
  AGUARDANDO_APROVACAO: 'bg-amber-100 text-amber-800',
  APROVADA:             'bg-amber-100 text-amber-700',
  PAGA:                 'bg-emerald-100 text-emerald-700',
};

const tipoColors: Record<string, string> = {
  MENSAL: 'bg-sky-100 text-sky-700',
  FERIAS: 'bg-cyan-100 text-cyan-700',
  '13_SALARIO': 'bg-purple-100 text-purple-700',
  RESCISAO: 'bg-red-100 text-red-700',
};

export default function FolhaDetailPage() {
  const toast = useToast();
  const params = useParams();
  const id = params.id as string;

  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  async function fetchPayroll() {
    try {
      const data = await api<Payroll>(`/hr/payroll/${id}`);
      setPayroll(data);
    } catch (err: any) {
      if (err?.message?.includes('not found') || err?.status === 404) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPayroll();
  }, [id]);

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleAction = async (action: 'calculate' | 'approve' | 'pay') => {
    setActionLoading(true);
    try {
      await api(`/hr/payroll/${id}/${action}`, { method: 'POST' });
      await fetchPayroll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao executar acao');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    );
  }

  if (notFound || !payroll) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-700 font-medium">Folha de pagamento nao encontrada</p>
        <Link href="/rh/folha-pagamento" className="text-sky-600 hover:underline text-sm">Voltar para lista</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/rh/folha-pagamento" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Folha {payroll.periodoReferencia}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoColors[payroll.type] || 'bg-slate-100 text-slate-600'}`}>{payroll.type}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[payroll.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabels[payroll.status] ?? payroll.status}</span>
            </div>
            <p className="text-slate-500 mt-0.5 text-sm">Detalhes e itens da folha de pagamento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {payroll.status === 'RASCUNHO' && (
            <button onClick={() => handleAction('calculate')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Calculator className="w-4 h-4" />
              {actionLoading ? 'Aguarde...' : 'Calcular'}
            </button>
          )}
          {payroll.status === 'CALCULADA' && (
            <button onClick={() => handleAction('approve')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle className="w-4 h-4" />
              {actionLoading ? 'Aguarde...' : 'Aprovar'}
            </button>
          )}
          {payroll.status === 'APROVADA' && (
            <button onClick={() => handleAction('pay')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <CreditCard className="w-4 h-4" />
              {actionLoading ? 'Aguarde...' : 'Pagar'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Bruto</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(Number(payroll.totalBruto))}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Descontos</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(Number(payroll.totalDescontos))}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Liquido</p>
          <p className="text-xl font-bold text-sky-700">{formatCurrency(Number(payroll.totalLiquido))}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Encargos Patronais</p>
          <p className="text-xl font-bold text-slate-700">{formatCurrency(Number(payroll.totalEncargos))}</p>
        </div>
      </div>

      {/* Employee Items */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Itens por Funcionario</h2>
        </div>
        {payroll.items.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">
            Nenhum item calculado. Clique em &quot;Calcular&quot; para processar a folha.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-10 px-3 py-3"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Matricula</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Funcionario</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Bruto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Descontos</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Liquido</th>
                </tr>
              </thead>
              <tbody>
                {payroll.items.map((item) => (
                  <>
                    <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-100 cursor-pointer" onClick={() => toggleRow(item.id)}>
                      <td className="px-3 py-3 text-center">
                        {expandedRows.has(item.id) ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.employee?.matricula ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.employee?.person?.razaoSocial ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-700 font-medium">{formatCurrency(Number(item.totalBruto))}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{formatCurrency(Number(item.totalDescontos))}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">{formatCurrency(Number(item.totalLiquido))}</td>
                    </tr>
                    {expandedRows.has(item.id) && (
                      <tr key={`${item.id}-detail`}>
                        <td colSpan={6} className="px-6 py-4 bg-slate-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Proventos</h4>
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm"><span className="text-slate-600">Salario Base</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.salarioBase))}</span></div>
                                {Number(item.valorHorasExtras) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Horas Extras</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.valorHorasExtras))}</span></div>}
                                {Number(item.adicionalNoturno) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Adicional Noturno</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.adicionalNoturno))}</span></div>}
                                {Number(item.periculosidade) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Periculosidade</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.periculosidade))}</span></div>}
                                {Number(item.insalubridade) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Insalubridade</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.insalubridade))}</span></div>}
                                {Number(item.outrosProventos) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Outros Proventos</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.outrosProventos))}</span></div>}
                                <div className="flex justify-between text-sm pt-1 border-t border-slate-200 mt-1">
                                  <span className="font-semibold text-emerald-700">Total Proventos</span>
                                  <span className="font-bold text-emerald-700">{formatCurrency(Number(item.totalBruto))}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Descontos</h4>
                              <div className="space-y-1">
                                {Number(item.inss) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">INSS</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.inss))}</span></div>}
                                {Number(item.irrf) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">IRRF</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.irrf))}</span></div>}
                                {Number(item.valeTransporte) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Vale Transporte</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.valeTransporte))}</span></div>}
                                {Number(item.valeRefeicao) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Vale Refeicao</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.valeRefeicao))}</span></div>}
                                {Number(item.outrosDescontos) > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Outros Descontos</span><span className="text-slate-900 font-medium">{formatCurrency(Number(item.outrosDescontos))}</span></div>}
                                <div className="flex justify-between text-sm pt-1 border-t border-slate-200 mt-1">
                                  <span className="font-semibold text-red-600">Total Descontos</span>
                                  <span className="font-bold text-red-600">{formatCurrency(Number(item.totalDescontos))}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
