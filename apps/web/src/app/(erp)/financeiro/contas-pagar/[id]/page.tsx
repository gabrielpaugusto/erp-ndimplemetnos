'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  ArrowDownRight,
  Calendar,
  DollarSign,
  FileText,
  CreditCard,
  XCircle,
  CheckCircle,
  Landmark,
  Save,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

const statusLabels: Record<string, string> = {
  PENDENTE:             'Pendente',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  VENCIDO:              'Vencido',
  PAGO:                 'Pago',
  CANCELADO:            'Cancelado',
};

const statusColors: Record<string, string> = {
  PENDENTE:             'bg-yellow-100 text-yellow-700',
  AGUARDANDO_APROVACAO: 'bg-amber-100 text-amber-800',
  VENCIDO:              'bg-red-100 text-red-700',
  PAGO:                 'bg-emerald-100 text-emerald-700',
  CANCELADO:            'bg-slate-100 text-slate-600',
};

interface Movement {
  id: string;
  numero: string;
  description: string;
  valor: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string | null;
  valorPago?: number | null;
  paymentMethod?: string | null;
  status: string;
  observations?: string | null;
  person?: { id: string; razaoSocial: string; cpfCnpj?: string | null } | null;
  bankAccount?: { id: string; name: string } | null;
  category?: { id: string; code: string; name: string } | null;
  costCenter?: { id: string; code: string; name: string } | null;
}

export default function ContaPagarDetailPage() {
  const toast = useToast();
  const params = useParams();
  const id = params.id as string;

  const [payable, setPayable] = useState<Movement | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [valorPago, setValorPago] = useState('');
  const [metodoPag, setMetodoPag] = useState('');
  const [contaBanc, setContaBanc] = useState('');
  const [paying, setPaying] = useState(false);

  async function fetchPayable() {
    try {
      const data = await api<Movement>(`/financial/movements/${id}`);
      setPayable(data);
      setValorPago(String(data.valor));
    } catch (err: any) {
      if (err?.message?.includes('not found') || err?.status === 404) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPayable();
  }, [id]);

  const handlePay = async () => {
    setPaying(true);
    try {
      await api(`/financial/movements/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          dataPagamento,
          valorPago: parseFloat(valorPago),
          paymentMethod: metodoPag,
          bankAccountId: contaBanc || undefined,
        }),
      });
      setShowPaymentForm(false);
      await fetchPayable();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar pagamento');
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Tem certeza que deseja cancelar este titulo?')) {
      toast.error('Para cancelar um titulo utilize a funcao de cancelamento no modulo financeiro.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    );
  }

  if (notFound || !payable) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-700 font-medium">Titulo nao encontrado</p>
        <Link href="/financeiro/contas-pagar" className="text-sky-600 hover:underline text-sm">Voltar para lista</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/financeiro/contas-pagar" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{payable.numero}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[payable.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {statusLabels[payable.status] ?? payable.status}
              </span>
            </div>
            <p className="text-slate-500 mt-0.5 text-sm">Detalhes do titulo a pagar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {payable.status === 'PENDENTE' && (
            <>
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Registrar Pagamento
              </button>
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-700">Informacoes do Titulo</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Fornecedor</span><span className="text-sm font-medium text-slate-900">{payable.person?.razaoSocial ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Descricao</span><span className="text-sm font-medium text-slate-900 text-right max-w-[200px]">{payable.description}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Centro de Custo</span><span className="text-sm font-medium text-slate-900">{payable.costCenter?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Categoria</span><span className="text-sm font-medium text-slate-900">{payable.category ? `${payable.category.code} - ${payable.category.name}` : '—'}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-700">Valores e Datas</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Valor</span><span className="text-sm font-bold text-slate-900">{formatCurrency(Number(payable.valor))}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Emissao</span><span className="text-sm font-medium text-slate-900">{new Date(payable.dataEmissao).toLocaleDateString('pt-BR')}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Vencimento</span><span className="text-sm font-medium text-slate-900">{new Date(payable.dataVencimento).toLocaleDateString('pt-BR')}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Metodo</span><span className="text-sm font-medium text-slate-900">{payable.paymentMethod ?? '—'}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-700">Conta Bancaria</h3>
          </div>
          {payable.bankAccount ? (
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm text-slate-500">Conta</span><span className="text-sm font-medium text-slate-900">{payable.bankAccount.name}</span></div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nenhuma conta vinculada</p>
          )}
        </div>
      </div>

      {/* Observacoes */}
      {payable.observations && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Observacoes</h3>
          <p className="text-sm text-slate-600">{payable.observations}</p>
        </div>
      )}

      {/* Payment Form */}
      {showPaymentForm && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Registrar Pagamento</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data do Pagamento *</label>
              <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Pago *</label>
              <input type="number" value={valorPago} onChange={(e) => setValorPago(e.target.value)} step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Metodo de Pagamento *</label>
              <select value={metodoPag} onChange={(e) => setMetodoPag(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                <option value="">Selecione...</option>
                <option value="BOLETO">Boleto Bancario</option>
                <option value="PIX">Transferencia/PIX</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DINHEIRO">Dinheiro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancaria</label>
              <input type="text" value={contaBanc} onChange={(e) => setContaBanc(e.target.value)} placeholder="ID da conta bancaria (opcional)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-4">
            <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
            <button
              onClick={handlePay}
              disabled={!dataPagamento || !valorPago || !metodoPag || paying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {paying ? 'Aguarde...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      )}

      {/* Payment Info (if paid) */}
      {payable.status === 'PAGO' && payable.dataPagamento && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-semibold text-emerald-800">Pagamento Realizado</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><span className="text-xs text-emerald-600">Data</span><p className="text-sm font-medium text-slate-900">{new Date(payable.dataPagamento).toLocaleDateString('pt-BR')}</p></div>
            <div><span className="text-xs text-emerald-600">Valor Pago</span><p className="text-sm font-medium text-slate-900">{payable.valorPago != null ? formatCurrency(Number(payable.valorPago)) : '—'}</p></div>
            <div><span className="text-xs text-emerald-600">Metodo</span><p className="text-sm font-medium text-slate-900">{payable.paymentMethod ?? '—'}</p></div>
            <div><span className="text-xs text-emerald-600">Conta</span><p className="text-sm font-medium text-slate-900">{payable.bankAccount?.name ?? '—'}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
