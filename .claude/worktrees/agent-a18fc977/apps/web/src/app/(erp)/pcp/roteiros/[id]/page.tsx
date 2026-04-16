'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  Route,
  Clock,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  X,
  Factory,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface RoutingStep {
  id: string;
  routingId: string;
  stepNumber: number;
  workCenterId: string;
  description: string;
  tempoSetup: number;
  tempoExecucao: number;
  tempoEspera: number;
  workCenter: { id: string; code: string; name: string; type: string };
}

interface Routing {
  id: string;
  productId: string;
  version: number;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  product: { id: string; code: string; description: string };
  _count: { steps: number };
  steps?: RoutingStep[];
}

const formatMinutes = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

function SkeletonDetail() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 h-24" />
        ))}
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-64" />
    </div>
  );
}

export default function RoteiroDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [routing, setRouting] = useState<Routing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchRouting = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/pcp/routing/${id}`);
      if (!res.ok) throw new Error('Roteiro não encontrado');
      const data: Routing = await res.json();
      setRouting(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar roteiro');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRouting();
  }, [fetchRouting]);

  const handleToggleActive = async () => {
    if (!routing) return;
    setToggling(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/pcp/routing/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !routing.active }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar status');
      const updated: Routing = await res.json();
      setRouting((prev) => prev ? { ...prev, active: updated.active } : prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!routing) return;
    if (!confirm(`Deseja excluir o roteiro "${routing.product.description}" v${routing.version}? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/pcp/routing/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir roteiro');
      router.push('/pcp/roteiros');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao excluir');
      setDeleting(false);
    }
  };

  if (loading) return <SkeletonDetail />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pcp/roteiros" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Roteiro</h1>
        </div>
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const steps = routing?.steps ?? [];
  const totalSetup = steps.reduce((sum, s) => sum + s.tempoSetup, 0);
  const totalExec = steps.reduce((sum, s) => sum + s.tempoExecucao, 0);
  const totalEspera = steps.reduce((sum, s) => sum + s.tempoEspera, 0);
  const totalTime = totalSetup + totalExec + totalEspera;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/pcp/roteiros"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{routing?.product.code}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              routing?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {routing?.active ? 'Ativo' : 'Inativo'}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 font-mono">
              v{routing?.version}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">{routing?.product.description}</p>
          {routing?.description && <p className="text-xs text-slate-400 mt-0.5">{routing.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              routing?.active
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            {routing?.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {routing?.active ? 'Desativar' : 'Ativar'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="ml-auto p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Route className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900 truncate">{routing?.product.description}</p>
          <p className="text-xs text-slate-500 mt-1 font-mono">{routing?.product.code}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Versão</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">v{routing?.version}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Factory className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Etapas</h3>
          </div>
          <p className="text-2xl font-bold text-amber-700">{routing?._count.steps ?? steps.length}</p>
          <p className="text-xs text-slate-500 mt-1">centros de trabalho</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tempo Total</h3>
          </div>
          <p className="text-xl font-bold text-amber-700">{formatMinutes(totalTime)}</p>
          <p className="text-xs text-slate-500 mt-1">
            Atualizado em {routing ? new Date(routing.updatedAt).toLocaleDateString('pt-BR') : '-'}
          </p>
        </div>
      </div>

      {/* Steps Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Etapas do Roteiro</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro de Trabalho</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Setup</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Execução</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Espera</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {steps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhuma etapa cadastrada neste roteiro.
                  </td>
                </tr>
              ) : (
                steps
                  .slice()
                  .sort((a, b) => a.stepNumber - b.stepNumber)
                  .map((step, idx) => {
                    const stepTotal = step.tempoSetup + step.tempoExecucao + step.tempoEspera;
                    return (
                      <tr key={step.id} className={`hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                            {step.stepNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900">{step.workCenter.name}</span>
                            <span className="text-xs text-slate-500 font-mono">{step.workCenter.code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{step.description}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-center">{formatMinutes(step.tempoSetup)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-center">{formatMinutes(step.tempoExecucao)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-center">{formatMinutes(step.tempoEspera)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-amber-700 text-center">{formatMinutes(stepTotal)}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        {steps.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="w-80 bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700">Total Setup:</span>
                <span className="font-medium text-amber-900">{formatMinutes(totalSetup)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700">Total Execução:</span>
                <span className="font-medium text-amber-900">{formatMinutes(totalExec)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700">Total Espera:</span>
                <span className="font-medium text-amber-900">{formatMinutes(totalEspera)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-amber-200">
                <span className="font-semibold text-amber-900">Tempo Total:</span>
                <span className="text-lg font-bold text-amber-700">{formatMinutes(totalTime)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
