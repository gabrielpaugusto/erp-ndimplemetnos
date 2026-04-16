'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  X,
  Route,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Product {
  id: string;
  code: string;
  description: string;
  type: string;
  unit: string;
}

interface WorkCenter {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface RoutingStepForm {
  uid: number;
  stepNumber: number;
  workCenterId: string;
  description: string;
  tempoSetup: string;
  tempoExecucao: string;
  tempoEspera: string;
}

let uidCounter = 1;

const formatMinutes = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

export default function NovoRoteiroPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);

  const [productId, setProductId] = useState('');
  const [version, setVersion] = useState('1');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<RoutingStepForm[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [prodRes, wcRes] = await Promise.all([
          apiFetch('/api/engineering/products?limit=200'),
          apiFetch('/api/pcp/work-centers?limit=100'),
        ]);
        if (prodRes.ok) {
          const pd = await prodRes.json();
          setProducts(pd.data ?? pd);
        }
        if (wcRes.ok) {
          const wcd = await wcRes.json();
          setWorkCenters(wcd.data ?? wcd);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        uid: uidCounter++,
        stepNumber: prev.length + 1,
        workCenterId: '',
        description: '',
        tempoSetup: '30',
        tempoExecucao: '120',
        tempoEspera: '15',
      },
    ]);
  };

  const removeStep = (uid: number) => {
    setSteps((prev) =>
      prev
        .filter((s) => s.uid !== uid)
        .map((s, idx) => ({ ...s, stepNumber: idx + 1 }))
    );
  };

  const updateStep = (uid: number, field: keyof RoutingStepForm, value: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.uid === uid ? { ...s, [field]: value } : s))
    );
  };

  const moveStep = (uid: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.uid === uid);
      if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === prev.length - 1)) return prev;
      const newSteps = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
      return newSteps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const totalSetup = steps.reduce((sum, s) => sum + (parseInt(s.tempoSetup) || 0), 0);
  const totalExec = steps.reduce((sum, s) => sum + (parseInt(s.tempoExecucao) || 0), 0);
  const totalEspera = steps.reduce((sum, s) => sum + (parseInt(s.tempoEspera) || 0), 0);
  const totalTime = totalSetup + totalExec + totalEspera;

  const validate = (): string => {
    if (!productId) return 'Selecione o produto do roteiro.';
    if (!version || parseInt(version) < 1) return 'Versão inválida (deve ser >= 1).';
    if (steps.length === 0) return 'Adicione pelo menos uma etapa.';
    for (const step of steps) {
      if (!step.workCenterId) return 'Selecione o centro de trabalho em todas as etapas.';
      if (!step.description.trim()) return 'Preencha a descrição em todas as etapas.';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const res = await apiFetch('/api/pcp/routing', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          version: parseInt(version),
          description: description.trim() || undefined,
          steps: steps.map((s) => ({
            stepNumber: s.stepNumber,
            workCenterId: s.workCenterId,
            description: s.description.trim(),
            tempoSetup: parseInt(s.tempoSetup) || 0,
            tempoExecucao: parseInt(s.tempoExecucao) || 0,
            tempoEspera: parseInt(s.tempoEspera) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Erro ao salvar roteiro');
      }
      const newRouting = await res.json();
      router.push(`/pcp/roteiros/${newRouting.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Roteiro de Fabricação</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Defina as etapas de produção e tempos por centro de trabalho
          </p>
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{saveError}</span>
          <button onClick={() => setSaveError('')} className="ml-auto p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Produto e Versão */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Route className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Produto</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Produto *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-slate-50"
            >
              <option value="">{loadingData ? 'Carregando produtos...' : 'Selecione o produto'}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Versão *</label>
            <input
              type="number"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              min="1"
              step="1"
              placeholder="Ex: 1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição opcional do roteiro..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Steps Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Etapas do Roteiro</h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {steps.length} {steps.length === 1 ? 'etapa' : 'etapas'}
            </span>
          </div>
          <button
            onClick={addStep}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Etapa
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            Nenhuma etapa adicionada. Clique em &quot;Adicionar Etapa&quot; para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Ordem</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro de Trabalho</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Setup (min)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Execução (min)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Espera (min)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {steps.map((step) => (
                  <tr key={step.uid} className="hover:bg-slate-50">
                    <td className="px-2 py-2 text-sm font-semibold text-slate-500 text-center">{step.stepNumber}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => moveStep(step.uid, 'up')}
                          disabled={step.stepNumber === 1}
                          className="p-0.5 text-slate-300 hover:text-amber-600 rounded disabled:opacity-30"
                          title="Mover para cima"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveStep(step.uid, 'down')}
                          disabled={step.stepNumber === steps.length}
                          className="p-0.5 text-slate-300 hover:text-amber-600 rounded disabled:opacity-30"
                          title="Mover para baixo"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={step.workCenterId}
                        onChange={(e) => updateStep(step.uid, 'workCenterId', e.target.value)}
                        disabled={loadingData}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-slate-50"
                      >
                        <option value="">Selecione...</option>
                        {workCenters.map((wc) => (
                          <option key={wc.id} value={wc.id}>{wc.code} — {wc.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => updateStep(step.uid, 'description', e.target.value)}
                        placeholder="Descrição da operação..."
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={step.tempoSetup}
                        onChange={(e) => updateStep(step.uid, 'tempoSetup', e.target.value)}
                        min="0"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={step.tempoExecucao}
                        onChange={(e) => updateStep(step.uid, 'tempoExecucao', e.target.value)}
                        min="0"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={step.tempoEspera}
                        onChange={(e) => updateStep(step.uid, 'tempoEspera', e.target.value)}
                        min="0"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeStep(step.uid)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/pcp/roteiros"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Roteiro'}
        </button>
      </div>
    </div>
  );
}
