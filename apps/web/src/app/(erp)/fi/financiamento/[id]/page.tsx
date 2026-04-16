'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Landmark,
  Building2,
  DollarSign,
  Calendar,
  CreditCard,
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  Send,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtPercent } from '@/lib/format';

type FinancingType = 'FINAME' | 'CDC' | 'LEASING' | 'CONSORCIO' | 'DIRETO';
type FinancingStatus = 'SIMULACAO' | 'PROPOSTA' | 'ANALISE' | 'APROVADO' | 'CONTRATADO' | 'LIBERADO' | 'CANCELADO';

const typeLabels: Record<string, string> = {
  FINAME: 'FINAME',
  CDC: 'CDC',
  LEASING: 'Leasing',
  CONSORCIO: 'Consórcio',
  DIRETO: 'Direto',
};

const typeColors: Record<string, string> = {
  FINAME: 'bg-green-100 text-green-700',
  CDC: 'bg-blue-100 text-blue-700',
  LEASING: 'bg-purple-100 text-purple-700',
  CONSORCIO: 'bg-yellow-100 text-yellow-700',
  DIRETO: 'bg-orange-100 text-orange-700',
};

const statusLabels: Record<string, string> = {
  SIMULACAO: 'Simulação',
  PROPOSTA: 'Proposta',
  ANALISE: 'Em Análise',
  APROVADO: 'Aprovado',
  CONTRATADO: 'Contratado',
  LIBERADO: 'Liberado',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<string, string> = {
  SIMULACAO: 'bg-slate-100 text-slate-600',
  PROPOSTA: 'bg-amber-100 text-amber-700',
  ANALISE: 'bg-yellow-100 text-yellow-700',
  APROVADO: 'bg-emerald-100 text-emerald-700',
  CONTRATADO: 'bg-blue-100 text-blue-700',
  LIBERADO: 'bg-indigo-100 text-indigo-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

const formatCurrency = (value: number) => fmtCurrency(value);

interface FinancingDetail {
  id: string;
  numero: string;
  status: string;
  type: string;
  createdAt: string;
  person: {
    id: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    cpfCnpj?: string;
    cidade?: string;
    estado?: string;
  };
  financeira?: {
    id: string;
    razaoSocial?: string;
    nomeFantasia?: string;
  } | null;
  saleOrder?: { id: string; numero: string; status: string } | null;
  valorBem: number;
  valorEntrada?: number | null;
  valorFinanciado: number;
  taxaJuros?: number | null;
  parcelas?: number | null;
  valorParcela?: number | null;
  codigoFiname?: string | null;
  linhaCredito?: string | null;
  carencia?: number | null;
  comissaoPercent?: number | null;
  observacoes?: string | null;
}

export default function FinanciamentoDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [financing, setFinancing] = useState<FinancingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const res = await apiFetch(`/api/fi/financing/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Erro ao carregar financiamento');
        const data = await res.json();
        setFinancing(data);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (notFound || !financing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500 text-sm">Financiamento não encontrado.</p>
        <Link href="/fi/financiamento" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const statusSteps: string[] = ['SIMULACAO', 'PROPOSTA', 'ANALISE', 'APROVADO', 'CONTRATADO', 'LIBERADO'];
  const statusOrder: Record<string, number> = {
    SIMULACAO: 0, PROPOSTA: 1, ANALISE: 2, APROVADO: 3, CONTRATADO: 4, LIBERADO: 5, CANCELADO: -1,
  };

  const currentOrder = statusOrder[financing.status] ?? -1;
  const clientName = financing.person?.razaoSocial || financing.person?.nomeFantasia || '—';
  const financeiraName = financing.financeira?.razaoSocial || financing.financeira?.nomeFantasia || '—';
  const comissaoValor = financing.valorFinanciado && financing.comissaoPercent
    ? (financing.valorFinanciado * financing.comissaoPercent) / 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fi/financiamento"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{financing.numero || financing.id}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[financing.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[financing.status] ?? financing.status}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${typeColors[financing.type] ?? 'bg-slate-100 text-slate-600'}`}>
              {typeLabels[financing.type] ?? financing.type}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Financiamento criado em {new Date(financing.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2">
          {financing.status === 'SIMULACAO' && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors">
              <Send className="w-4 h-4" />
              Enviar Proposta
            </button>
          )}
          {financing.status === 'PROPOSTA' && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium transition-colors">
              <FileText className="w-4 h-4" />
              Enviar p/ Análise
            </button>
          )}
          {financing.status === 'APROVADO' && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
              <CreditCard className="w-4 h-4" />
              Registrar Contrato
            </button>
          )}
          {financing.status === 'CONTRATADO' && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
              <CheckCircle className="w-4 h-4" />
              Confirmar Liberação
            </button>
          )}
          {(financing.status !== 'LIBERADO' && financing.status !== 'CANCELADO') && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors">
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Client */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</h3>
          </div>
          <Link
            href={`/crm/pessoas/${financing.person.id}`}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {clientName}
          </Link>
          {financing.person.cpfCnpj && (
            <p className="text-xs text-slate-500 mt-1 font-mono">{financing.person.cpfCnpj}</p>
          )}
          {(financing.person.cidade || financing.person.estado) && (
            <p className="text-xs text-slate-500 mt-0.5">
              {[financing.person.cidade, financing.person.estado].filter(Boolean).join('/')}
            </p>
          )}
        </div>

        {/* Financeira */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Financeira</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">{financeiraName}</p>
        </div>

        {/* Valores */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valores</h3>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Bem:</span>
              <span className="text-xs font-medium text-slate-900">{formatCurrency(Number(financing.valorBem))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Entrada:</span>
              <span className="text-xs font-medium text-slate-900">{formatCurrency(Number(financing.valorEntrada ?? 0))}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700">Financiado:</span>
              <span className="text-sm font-bold text-indigo-700">{formatCurrency(Number(financing.valorFinanciado))}</span>
            </div>
          </div>
        </div>

        {/* Parcelas / Taxa */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Parcelas / Taxa</h3>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Parcelas:</span>
              <span className="text-sm font-bold text-slate-900">{financing.parcelas ?? '—'}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Taxa:</span>
              <span className="text-xs font-medium text-slate-900">
                {financing.taxaJuros != null ? `${fmtPercent(financing.taxaJuros)} a.m.` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Valor Parcela:</span>
              <span className="text-xs font-medium text-emerald-700">
                {financing.valorParcela != null ? formatCurrency(Number(financing.valorParcela)) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FINAME Section */}
      {financing.type === 'FINAME' && (financing.codigoFiname || financing.linhaCredito || financing.carencia != null) && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-green-700" />
            <h2 className="text-lg font-semibold text-green-900">Dados FINAME</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-green-600 uppercase tracking-wider">Código FINAME</label>
              <p className="text-sm font-semibold text-green-900 mt-1 font-mono">{financing.codigoFiname ?? '—'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-green-600 uppercase tracking-wider">Linha de Crédito</label>
              <p className="text-sm font-semibold text-green-900 mt-1">{financing.linhaCredito ?? '—'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-green-600 uppercase tracking-wider">Carência</label>
              <p className="text-sm font-semibold text-green-900 mt-1">
                {financing.carencia != null ? `${financing.carencia} meses` : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Status do Financiamento</h2>
        <div className="flex items-center gap-2">
          {statusSteps.map((status, index) => {
            const stepOrder = statusOrder[status];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = status === financing.status;

            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                        : isActive
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isActive && !isCurrent ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-indigo-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {statusLabels[status]}
                  </span>
                </div>
                {index < statusSteps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Comissão Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Comissão</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentual</label>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {financing.comissaoPercent != null ? fmtPercent(financing.comissaoPercent) : '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Valor da Comissão</label>
            <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(comissaoValor)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pedido de Venda</label>
            {financing.saleOrder ? (
              <Link
                href={`/comercial/pedidos/${financing.saleOrder.id}`}
                className="block text-sm font-semibold text-indigo-600 hover:text-indigo-700 mt-1"
              >
                {financing.saleOrder.numero}
              </Link>
            ) : (
              <p className="text-sm text-slate-400 mt-1">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Observations */}
      {financing.observacoes && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Observações</h2>
          <p className="text-sm text-slate-700 leading-relaxed">{financing.observacoes}</p>
        </div>
      )}
    </div>
  );
}
