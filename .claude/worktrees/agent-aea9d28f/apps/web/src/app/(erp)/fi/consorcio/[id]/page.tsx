'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Users,
  Building2,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  Calendar,
  Award,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type ConsortiumStatus = 'ATIVO' | 'CONTEMPLADO' | 'ENCERRADO' | 'CANCELADO';
type PaymentStatus = 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'FUTURO';

const statusLabels: Record<string, string> = {
  ATIVO: 'Ativo',
  CONTEMPLADO: 'Contemplado',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<string, string> = {
  ATIVO: 'bg-blue-100 text-blue-700',
  CONTEMPLADO: 'bg-emerald-100 text-emerald-700',
  ENCERRADO: 'bg-slate-100 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-700',
};

const paymentStatusLabels: Record<string, string> = {
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
  VENCIDO: 'Vencido',
  FUTURO: 'Futuro',
};

const paymentStatusColors: Record<string, string> = {
  PAGO: 'bg-emerald-100 text-emerald-700',
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700',
  FUTURO: 'bg-slate-100 text-slate-500',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface Payment {
  id: string;
  numeroParcela: number;
  dataVencimento: string;
  valor: number;
  dataPagamento?: string | null;
  status: string;
}

interface ConsortiumDetail {
  id: string;
  grupo: string;
  cota: string;
  status: string;
  dataAdesao?: string | null;
  person: {
    id: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    cpfCnpj?: string;
    cidade?: string;
    estado?: string;
  };
  administradora?: {
    id: string;
    razaoSocial?: string;
    nomeFantasia?: string;
  } | null;
  saleOrder?: { id: string; numero: string; status: string } | null;
  valorCredito: number;
  parcelasMensais?: number | null;
  valorParcelaMensal?: number | null;
  parcelasPagas?: number | null;
  valorPago?: number | null;
  saldoDevedor?: number | null;
  comissaoPercent?: number | null;
  tipoContemplacao?: string | null;
  valorLance?: number | null;
  dataContemplacao?: string | null;
  payments?: Payment[];
}

export default function ConsorcioDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [consortium, setConsortium] = useState<ConsortiumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showContemplacao, setShowContemplacao] = useState(false);
  const [contemplacao, setContemplacao] = useState({
    tipo: 'LANCE',
    valorLance: '',
    data: '',
  });

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const res = await apiFetch(`/api/fi/consortium/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Erro ao carregar consórcio');
        const data = await res.json();
        setConsortium(data);
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

  if (notFound || !consortium) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500 text-sm">Consórcio não encontrado.</p>
        <Link href="/fi/consorcio" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const parcelasPagas = Number(consortium.parcelasPagas ?? 0);
  const parcelasMensais = Number(consortium.parcelasMensais ?? 0);
  const progressPct = parcelasMensais > 0 ? Math.round((parcelasPagas / parcelasMensais) * 100) : 0;
  const clientName = consortium.person?.razaoSocial || consortium.person?.nomeFantasia || '—';
  const adminName = consortium.administradora?.razaoSocial || consortium.administradora?.nomeFantasia || '—';
  const comissaoValor = consortium.valorCredito && consortium.comissaoPercent
    ? (consortium.valorCredito * consortium.comissaoPercent) / 100
    : 0;
  const payments: Payment[] = consortium.payments ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fi/consorcio"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{consortium.grupo} / {consortium.cota}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[consortium.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[consortium.status] ?? consortium.status}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            {consortium.dataAdesao
              ? `Adesão em ${new Date(consortium.dataAdesao).toLocaleDateString('pt-BR')}`
              : 'Data de adesão não informada'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {consortium.status === 'ATIVO' && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors">
              <XCircle className="w-4 h-4" />
              Cancelar Cota
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Cotista */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cotista</h3>
          </div>
          <Link
            href={`/crm/pessoas/${consortium.person.id}`}
            className="text-sm font-semibold text-violet-600 hover:text-violet-700"
          >
            {clientName}
          </Link>
          {consortium.person.cpfCnpj && (
            <p className="text-xs text-slate-500 mt-1 font-mono">{consortium.person.cpfCnpj}</p>
          )}
          {(consortium.person.cidade || consortium.person.estado) && (
            <p className="text-xs text-slate-500 mt-0.5">
              {[consortium.person.cidade, consortium.person.estado].filter(Boolean).join('/')}
            </p>
          )}
        </div>

        {/* Administradora */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administradora</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">{adminName}</p>
        </div>

        {/* Grupo/Cota */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Grupo / Cota</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900 font-mono">{consortium.grupo}</p>
          <p className="text-sm font-semibold text-slate-900 font-mono">{consortium.cota}</p>
          <p className="text-xs text-slate-500 mt-1">{parcelasMensais} parcelas mensais</p>
        </div>

        {/* Valores */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valores</h3>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Crédito:</span>
              <span className="text-xs font-medium text-slate-900">{formatCurrency(Number(consortium.valorCredito))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Pago:</span>
              <span className="text-xs font-medium text-emerald-700">{formatCurrency(Number(consortium.valorPago ?? 0))}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-xs text-slate-500">Saldo:</span>
              <span className="text-xs font-medium text-amber-700">{formatCurrency(Number(consortium.saldoDevedor ?? 0))}</span>
            </div>
          </div>
        </div>

        {/* Comissão */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comissão</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {consortium.comissaoPercent != null ? `${consortium.comissaoPercent}%` : '—'}
          </p>
          <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(comissaoValor)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Progresso das Parcelas</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-violet-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
            {parcelasPagas} / {parcelasMensais} ({progressPct}%)
          </span>
        </div>
      </div>

      {/* Contemplação */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-slate-900">Contemplação</h2>
          </div>
        </div>

        {consortium.tipoContemplacao ? (
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Tipo</label>
                <p className="text-sm font-semibold text-emerald-900 mt-1">{consortium.tipoContemplacao}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Valor do Lance</label>
                <p className="text-sm font-semibold text-emerald-900 mt-1">
                  {consortium.valorLance != null ? formatCurrency(Number(consortium.valorLance)) : '—'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Data</label>
                <p className="text-sm font-semibold text-emerald-900 mt-1">
                  {consortium.dataContemplacao
                    ? new Date(consortium.dataContemplacao).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {!showContemplacao ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                <Award className="w-8 h-8 mb-2" />
                <p className="text-sm mb-3">Cota ainda não contemplada</p>
                <button
                  onClick={() => setShowContemplacao(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Registrar Contemplação
                </button>
              </div>
            ) : (
              <div className="bg-violet-50 rounded-lg border border-violet-200 p-4">
                <h3 className="text-sm font-semibold text-violet-900 mb-3">Registrar Contemplação</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-violet-800 mb-1">Tipo *</label>
                    <select
                      value={contemplacao.tipo}
                      onChange={(e) => setContemplacao((prev) => ({ ...prev, tipo: e.target.value }))}
                      className="w-full px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                    >
                      <option value="LANCE">Lance</option>
                      <option value="SORTEIO">Sorteio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-violet-800 mb-1">
                      {contemplacao.tipo === 'LANCE' ? 'Valor do Lance (R$)' : 'Valor (R$)'}
                    </label>
                    <input
                      type="number"
                      value={contemplacao.valorLance}
                      onChange={(e) => setContemplacao((prev) => ({ ...prev, valorLance: e.target.value }))}
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-violet-800 mb-1">Data *</label>
                    <input
                      type="date"
                      value={contemplacao.data}
                      onChange={(e) => setContemplacao((prev) => ({ ...prev, data: e.target.value }))}
                      className="w-full px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={async () => {
                      try {
                        const res = await apiFetch(`/api/fi/consortium/${id}/contemplate`, {
                          method: 'POST',
                          body: JSON.stringify({
                            tipoContemplacao: contemplacao.tipo,
                            valorLance: contemplacao.valorLance ? parseFloat(contemplacao.valorLance) : undefined,
                            dataContemplacao: contemplacao.data || undefined,
                          }),
                        });
                        if (!res.ok) throw new Error('Erro ao registrar contemplação');
                        const updated = await res.json();
                        setConsortium(updated);
                        setShowContemplacao(false);
                      } catch (err: any) {
                        alert(err.message || 'Erro ao registrar contemplação');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar
                  </button>
                  <button
                    onClick={() => setShowContemplacao(false)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payments Table */}
      {payments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Parcelas</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Parcela</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimento</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Pagamento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700 text-center font-mono">{payment.numeroParcela}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(payment.dataVencimento).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {formatCurrency(Number(payment.valor))}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {payment.dataPagamento
                        ? new Date(payment.dataPagamento).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[payment.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {paymentStatusLabels[payment.status] ?? payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(payment.status === 'PENDENTE' || payment.status === 'VENCIDO') && (
                        <button
                          onClick={() => alert('Pagamento registrado! (funcionalidade em implementação)')}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Registrar Pgto
                        </button>
                      )}
                      {payment.status === 'PAGO' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {payment.status === 'FUTURO' && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
