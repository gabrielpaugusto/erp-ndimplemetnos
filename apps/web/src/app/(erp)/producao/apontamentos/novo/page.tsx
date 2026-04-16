'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Clock, Factory, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type PointingType = 'MAO_DE_OBRA' | 'MATERIAL' | 'SETUP' | 'PARADA';

interface PointingForm {
  productionOrderId: string;
  workCenterId: string;
  type: PointingType;
  startDatetime: string;
  endDatetime: string;
  quantityProduced: string;
  quantityRejected: string;
  observations: string;
  motivoParada: string;
}

interface OrderOption {
  id: string;
  numero: string;
  status: string;
  product: { description: string } | null;
}

interface WorkCenterOption {
  id: string;
  code: string;
  name: string;
}

const typeOptions: { key: PointingType; label: string; desc: string; color: string }[] = [
  { key: 'MAO_DE_OBRA', label: 'Mão de Obra', desc: 'Tempo de trabalho direto na produção', color: 'border-blue-500 bg-blue-50 ring-blue-200' },
  { key: 'MATERIAL', label: 'Material', desc: 'Consumo de materiais e componentes', color: 'border-emerald-500 bg-emerald-50 ring-emerald-200' },
  { key: 'SETUP', label: 'Setup', desc: 'Preparação de máquinas e ferramentas', color: 'border-amber-500 bg-amber-50 ring-amber-200' },
  { key: 'PARADA', label: 'Parada', desc: 'Parada não planejada ou manutenção', color: 'border-red-500 bg-red-50 ring-red-200' },
];

const motivosParada = [
  'Falta de material',
  'Manutenção corretiva',
  'Manutenção preventiva',
  'Falta de energia',
  'Aguardando peça de reposição',
  'Problema de qualidade',
  'Troca de turno',
  'Outros',
];

export default function NovoApontamentoPage() {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterOption[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const [form, setForm] = useState<PointingForm>({
    productionOrderId: '',
    workCenterId: '',
    type: 'MAO_DE_OBRA',
    startDatetime: '',
    endDatetime: '',
    quantityProduced: '0',
    quantityRejected: '0',
    observations: '',
    motivoParada: '',
  });

  useEffect(() => {
    const fetchDropdowns = async () => {
      setLoadingDropdowns(true);
      try {
        const [ordersRes, wcRes] = await Promise.all([
          apiFetch('/api/production/orders?status=EM_PRODUCAO&limit=100'),
          apiFetch('/api/pcp/work-centers?limit=100'),
        ]);

        if (ordersRes.ok) {
          const data = await ordersRes.json();
          setOrders(data.data || []);
        }

        if (wcRes.ok) {
          const data = await wcRes.json();
          setWorkCenters(data.data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dropdowns:', err);
      } finally {
        setLoadingDropdowns(false);
      }
    };

    fetchDropdowns();
  }, []);

  const updateForm = (field: keyof PointingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.productionOrderId || !form.workCenterId || !form.startDatetime) {
      toast.error('Preencha os campos obrigatórios: Ordem de Produção, Centro de Trabalho e Início.');
      return;
    }

    if (form.type === 'PARADA' && !form.motivoParada) {
      toast.error('Informe o motivo da parada.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        productionOrderId: form.productionOrderId,
        workCenterId: form.workCenterId,
        type: form.type,
        dataInicio: new Date(form.startDatetime).toISOString(),
        quantityProduced: parseFloat(form.quantityProduced) || 0,
        quantityRejected: parseFloat(form.quantityRejected) || 0,
      };

      if (form.endDatetime) {
        payload.dataFim = new Date(form.endDatetime).toISOString();
      }

      if (form.observations) {
        payload.observations = form.observations;
      }

      if (form.type === 'PARADA' && form.motivoParada) {
        payload.motivoParada = form.motivoParada;
      }

      const res = await apiFetch('/api/production/pointing', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || 'Erro ao registrar apontamento');
      }

      router.push('/producao/apontamentos');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar apontamento';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const calculateDuration = () => {
    if (!form.startDatetime || !form.endDatetime) return '-';
    const start = new Date(form.startDatetime);
    const end = new Date(form.endDatetime);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '-';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/producao/apontamentos"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Apontamento</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Registre tempo de trabalho, consumo de material ou parada de produção
          </p>
        </div>
      </div>

      {/* Ordem e Centro */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Apontamento</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ordem de Produção *</label>
            <select
              value={form.productionOrderId}
              onChange={(e) => updateForm('productionOrderId', e.target.value)}
              disabled={loadingDropdowns}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:opacity-60"
            >
              <option value="">{loadingDropdowns ? 'Carregando...' : 'Selecione a ordem'}</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numero}{o.product ? ` — ${o.product.description}` : ''} ({o.status === 'EM_PRODUCAO' ? 'Em Produção' : o.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Trabalho *</label>
            <select
              value={form.workCenterId}
              onChange={(e) => updateForm('workCenterId', e.target.value)}
              disabled={loadingDropdowns}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:opacity-60"
            >
              <option value="">{loadingDropdowns ? 'Carregando...' : 'Selecione o centro'}</option>
              {workCenters.map((wc) => (
                <option key={wc.id} value={wc.id}>{wc.code} — {wc.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Type Radio Cards */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Factory className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Tipo de Apontamento *</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {typeOptions.map((opt) => (
            <label
              key={opt.key}
              className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-colors text-center ${
                form.type === opt.key
                  ? `${opt.color} ring-2`
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="type"
                value={opt.key}
                checked={form.type === opt.key}
                onChange={() => updateForm('type', opt.key)}
                className="sr-only"
              />
              <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
              <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tempo e Quantidades */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Tempo e Quantidades</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Início *</label>
            <input
              type="datetime-local"
              value={form.startDatetime}
              onChange={(e) => updateForm('startDatetime', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fim *</label>
            <input
              type="datetime-local"
              value={form.endDatetime}
              onChange={(e) => updateForm('endDatetime', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duração Calculada</label>
            <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-semibold">
              {calculateDuration()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Produzida</label>
            <input
              type="number"
              value={form.quantityProduced}
              onChange={(e) => updateForm('quantityProduced', e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Rejeitada</label>
            <input
              type="number"
              value={form.quantityRejected}
              onChange={(e) => updateForm('quantityRejected', e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Motivo de Parada (conditional) */}
      {form.type === 'PARADA' && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">Motivo da Parada</h2>
          </div>
          <p className="text-xs text-red-700 mb-4">
            Informe o motivo da parada para registro e análise de indicadores
          </p>

          <div>
            <label className="block text-sm font-medium text-red-800 mb-1">Motivo *</label>
            <select
              value={form.motivoParada}
              onChange={(e) => updateForm('motivoParada', e.target.value)}
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
            >
              <option value="">Selecione o motivo</option>
              {motivosParada.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Observações */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
        <textarea
          value={form.observations}
          onChange={(e) => updateForm('observations', e.target.value)}
          rows={3}
          placeholder="Informações adicionais sobre o apontamento..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/producao/apontamentos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Registrando...' : 'Registrar Apontamento'}
        </button>
      </div>
    </div>
  );
}
