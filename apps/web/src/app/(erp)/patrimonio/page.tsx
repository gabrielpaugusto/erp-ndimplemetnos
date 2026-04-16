'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtPercent } from '@/lib/format';
import {
  Building2,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  BarChart3,
  List,
} from 'lucide-react';

interface Stats {
  porStatus: { status: string; _count: { id: number } }[];
  valorTotalAquisicao: number;
  valorTotalDepreciado: number;
  valorTotalResidual: number;
  ativosDepreciadosTotalmente: number;
}

interface ProcessResult {
  periodo: string;
  totalAtivos: number;
  processados: number;
  jaProcessados: number;
  totalDepreciado: number;
  observacao: string;
}

function formatCurrency(value: number) { return fmtCurrency(value); }

export default function PatrimonioDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/patrimonio/stats');
      const data = await (res as any).json();
      setStats(data);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleProcessarDepreciacao = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const agora = new Date();
      const resDeprec = await apiFetch('/api/patrimonio/processar-depreciacao', {
        method: 'POST',
        body: JSON.stringify({ ano: agora.getFullYear(), mes: agora.getMonth() + 1 }),
      });
      const result = await (resDeprec as any).json();
      setProcessResult(result);
      await loadStats();
    } catch (err) {
      console.error('Erro ao processar depreciação:', err);
    } finally {
      setProcessing(false);
    }
  };

  const totalAtivos = stats?.porStatus.find(s => s.status === 'ATIVO')?._count.id ?? 0;
  const totalManutencao = stats?.porStatus.find(s => s.status === 'EM_MANUTENCAO')?._count.id ?? 0;
  const totalBaixados = stats?.porStatus.find(s => s.status === 'BAIXADO')?._count.id ?? 0;

  const percentDepreciado = stats && stats.valorTotalAquisicao > 0
    ? (stats.valorTotalDepreciado / stats.valorTotalAquisicao) * 100
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patrimônio / Ativo Imobilizado</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão e controle de ativos fixos da empresa</p>
        </div>
        <button
          onClick={handleProcessarDepreciacao}
          disabled={processing}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
          {processing ? 'Processando...' : 'Processar Depreciação do Mês'}
        </button>
      </div>

      {/* Process result */}
      {processResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-800">Depreciação processada — {processResult.periodo}</p>
              <p className="text-sm text-green-700 mt-1">
                {processResult.processados} ativos processados, {processResult.jaProcessados} já processados.
                Total depreciado: <strong>{formatCurrency(processResult.totalDepreciado)}</strong>
              </p>
              <p className="text-xs text-green-600 mt-1">{processResult.observacao}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total de Ativos */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Total de Ativos</span>
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalAtivos}</p>
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              <span>{totalManutencao} em manutenção</span>
              <span>{totalBaixados} baixados</span>
            </div>
            {stats && stats.ativosDepreciadosTotalmente > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3" />
                <span>{stats.ativosDepreciadosTotalmente} totalmente depreciados</span>
              </div>
            )}
          </div>

          {/* Valor Total de Aquisição */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Valor Total de Aquisição</span>
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats?.valorTotalAquisicao ?? 0)}
            </p>
            <p className="text-xs text-gray-500 mt-2">Valor histórico de aquisição</p>
          </div>

          {/* Valor Depreciado */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Valor Já Depreciado</span>
              <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats?.valorTotalDepreciado ?? 0)}
            </p>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Depreciação acumulada</span>
                <span>{fmtPercent(percentDepreciado, 1)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(percentDepreciado, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Valor Residual */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Valor Residual Atual</span>
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats?.valorTotalResidual ?? 0)}
            </p>
            <p className="text-xs text-gray-500 mt-2">Valor contábil líquido atual</p>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/patrimonio/ativos"
          className="flex items-center justify-between p-5 bg-white rounded-lg border hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <List className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Listar Ativos</p>
              <p className="text-sm text-gray-500">Visualizar e gerenciar todos os ativos</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </Link>

        <Link
          href="/patrimonio/relatorio"
          className="flex items-center justify-between p-5 bg-white rounded-lg border hover:border-orange-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Relatório de Depreciação</p>
              <p className="text-sm text-gray-500">GGF mensal por centro de custo</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 transition-colors" />
        </Link>
      </div>
    </div>
  );
}
