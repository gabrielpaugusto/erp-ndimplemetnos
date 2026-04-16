'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Shield,
  Building2,
  DollarSign,
  Calendar,
  Truck,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const typeLabels: Record<string, string> = {
  RCFV: 'RCFV',
  CASCO: 'Casco',
  TOTAL: 'Total',
  TRANSPORTE: 'Transporte',
  GARANTIA_ESTENDIDA: 'Garantia Estendida',
};

const typeColors: Record<string, string> = {
  RCFV: 'bg-blue-100 text-blue-700',
  CASCO: 'bg-purple-100 text-purple-700',
  TOTAL: 'bg-indigo-100 text-indigo-700',
  TRANSPORTE: 'bg-teal-100 text-teal-700',
  GARANTIA_ESTENDIDA: 'bg-orange-100 text-orange-700',
};

const statusLabels: Record<string, string> = {
  VIGENTE: 'Vigente',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
  EM_ANALISE: 'Em Análise',
};

const statusColors: Record<string, string> = {
  VIGENTE: 'bg-emerald-100 text-emerald-700',
  VENCIDO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-slate-100 text-slate-600',
  EM_ANALISE: 'bg-yellow-100 text-yellow-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface InsuranceDetail {
  id: string;
  numeroApolice?: string | null;
  status: string;
  type: string;
  person: {
    id: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    cpfCnpj?: string;
    cidade?: string;
    estado?: string;
  };
  seguradora?: {
    id: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    cpfCnpj?: string;
  } | null;
  saleOrder?: { id: string; numero: string; status: string } | null;
  descricaoBem: string;
  anoFabricacao?: number | null;
  chassi?: string | null;
  placa?: string | null;
  valorBem: number;
  premio?: number | null;
  franquia?: number | null;
  importanciaSegurada?: number | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  dataRenovacao?: string | null;
  comissaoPercent?: number | null;
  observacoes?: string | null;
}

export default function SeguroDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [insurance, setInsurance] = useState<InsuranceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const res = await apiFetch(`/api/fi/insurance/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Erro ao carregar apólice');
        const data = await res.json();
        setInsurance(data);
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

  if (notFound || !insurance) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500 text-sm">Apólice não encontrada.</p>
        <Link href="/fi/seguro" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const clientName = insurance.person?.razaoSocial || insurance.person?.nomeFantasia || '—';
  const seguradoraName = insurance.seguradora?.razaoSocial || insurance.seguradora?.nomeFantasia || '—';
  const comissaoValor = insurance.premio && insurance.comissaoPercent
    ? (insurance.premio * insurance.comissaoPercent) / 100
    : 0;

  // Calculate vigencia status
  const hoje = new Date();
  const fimVigencia = insurance.dataFim ? new Date(insurance.dataFim) : null;
  const diasRestantes = fimVigencia
    ? Math.ceil((fimVigencia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let vigenciaColor = 'bg-emerald-500';
  let vigenciaLabel = 'Vigente';
  if (diasRestantes === null) {
    vigenciaLabel = '—';
  } else if (diasRestantes <= 0) {
    vigenciaColor = 'bg-red-500';
    vigenciaLabel = 'Vencido';
  } else if (diasRestantes <= 30) {
    vigenciaColor = 'bg-amber-500';
    vigenciaLabel = `Vence em ${diasRestantes} dias`;
  } else {
    vigenciaLabel = `${diasRestantes} dias restantes`;
  }

  const inicioDate = insurance.dataInicio ? new Date(insurance.dataInicio) : null;
  const fimDate = insurance.dataFim ? new Date(insurance.dataFim) : null;
  const totalDias = inicioDate && fimDate
    ? Math.ceil((fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const diasDecorridos = diasRestantes !== null ? Math.max(0, totalDias - diasRestantes) : 0;
  const vigenciaProgress = totalDias > 0 ? Math.min(100, Math.round((diasDecorridos / totalDias) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fi/seguro"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{insurance.numeroApolice ?? insurance.id}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[insurance.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[insurance.status] ?? insurance.status}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${typeColors[insurance.type] ?? 'bg-slate-100 text-slate-600'}`}>
              {typeLabels[insurance.type] ?? insurance.type}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Seguradora: {seguradoraName}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/fi/seguro/novo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Renovar Apólice
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Segurado */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Segurado</h3>
          </div>
          <Link
            href={`/crm/pessoas/${insurance.person.id}`}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            {clientName}
          </Link>
          {insurance.person.cpfCnpj && (
            <p className="text-xs text-slate-500 mt-1 font-mono">{insurance.person.cpfCnpj}</p>
          )}
          {(insurance.person.cidade || insurance.person.estado) && (
            <p className="text-xs text-slate-500 mt-0.5">
              {[insurance.person.cidade, insurance.person.estado].filter(Boolean).join('/')}
            </p>
          )}
        </div>

        {/* Seguradora */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Seguradora</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">{seguradoraName}</p>
          {insurance.seguradora?.cpfCnpj && (
            <p className="text-xs text-slate-500 mt-1 font-mono">{insurance.seguradora.cpfCnpj}</p>
          )}
        </div>

        {/* Bem */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bem Segurado</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">{insurance.descricaoBem}</p>
          {insurance.anoFabricacao && (
            <p className="text-xs text-slate-500 mt-1">Ano: {insurance.anoFabricacao}</p>
          )}
          {insurance.chassi && (
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{insurance.chassi}</p>
          )}
          {insurance.placa && (
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{insurance.placa}</p>
          )}
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
              <span className="text-xs font-medium text-slate-900">{formatCurrency(Number(insurance.valorBem))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Prêmio:</span>
              <span className="text-xs font-bold text-emerald-700">
                {insurance.premio != null ? formatCurrency(Number(insurance.premio)) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Franquia:</span>
              <span className="text-xs font-medium text-slate-900">
                {insurance.franquia != null ? formatCurrency(Number(insurance.franquia)) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-xs text-slate-500">IS:</span>
              <span className="text-xs font-medium text-slate-900">
                {insurance.importanciaSegurada != null ? formatCurrency(Number(insurance.importanciaSegurada)) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Vigência */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vigência</h3>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Início:</span>
              <span className="text-xs font-medium text-slate-900">
                {insurance.dataInicio ? new Date(insurance.dataInicio).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Fim:</span>
              <span className="text-xs font-medium text-slate-900">
                {insurance.dataFim ? new Date(insurance.dataFim).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Renovação:</span>
              <span className="text-xs font-medium text-slate-900">
                {insurance.dataRenovacao ? new Date(insurance.dataRenovacao).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Vigência Visual Bar */}
      {insurance.dataInicio && insurance.dataFim && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Vigência da Apólice</h2>
            <div className="flex items-center gap-2">
              {diasRestantes !== null && diasRestantes <= 30 && diasRestantes > 0 && (
                <span className="inline-flex items-center gap-1 text-sm text-amber-600 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Vencimento próximo
                </span>
              )}
              {diasRestantes !== null && diasRestantes <= 0 && (
                <span className="inline-flex items-center gap-1 text-sm text-red-600 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Apólice vencida
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{new Date(insurance.dataInicio).toLocaleDateString('pt-BR')}</span>
              <span className="font-medium text-slate-700">{vigenciaLabel}</span>
              <span>{new Date(insurance.dataFim).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${vigenciaColor} transition-all`}
                style={{ width: `${vigenciaProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Início</span>
              <span>{vigenciaProgress}% decorrido</span>
              <span>Fim</span>
            </div>
          </div>
        </div>
      )}

      {/* Comissão Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Comissão</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentual sobre Prêmio</label>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {insurance.comissaoPercent != null ? `${insurance.comissaoPercent}%` : '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Valor da Comissão</label>
            <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(comissaoValor)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pedido de Venda</label>
            {insurance.saleOrder ? (
              <Link
                href={`/comercial/pedidos/${insurance.saleOrder.id}`}
                className="block text-sm font-semibold text-emerald-600 hover:text-emerald-700 mt-1"
              >
                {insurance.saleOrder.numero}
              </Link>
            ) : (
              <p className="text-sm text-slate-400 mt-1">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Observations */}
      {insurance.observacoes && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Observações</h2>
          <p className="text-sm text-slate-700 leading-relaxed">{insurance.observacoes}</p>
        </div>
      )}
    </div>
  );
}
