'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft,
  Save,
  X,
  Flame,
  Scissors,
  ArrowDownUp,
  Zap,
  CircleDot,
  Cog,
  Thermometer,
  Wind,
  Boxes,
  FileText,
  Clock,
} from 'lucide-react';

type ServiceType = 'CORTE' | 'DOBRA' | 'SOLDA' | 'Conformação' | 'USINAGEM' | 'TRATAMENTO_TERMICO' | 'JATEAMENTO' | 'MONTAGEM_ESTRUTURAL';

interface CldForm {
  serviceType: ServiceType;
  linkedOsId: string;
  linkedOpId: string;
  description: string;
  materialDescription: string;
  technicalSpecs: string;
  estimatedTime: string;
  observations: string;
}

interface DropdownItem {
  id: string;
  label: string;
}

const serviceTypeOptions: { key: ServiceType; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'CORTE', label: 'Corte', desc: 'Corte CNC, plasma, oxi-corte', icon: <Scissors className="w-5 h-5" /> },
  { key: 'DOBRA', label: 'Dobra', desc: 'Dobra em prensa viradeira', icon: <ArrowDownUp className="w-5 h-5" /> },
  { key: 'SOLDA', label: 'Solda', desc: 'Solda MIG/MAG, TIG, eletrodo', icon: <Zap className="w-5 h-5" /> },
  { key: 'Conformação', label: 'Conformação', desc: 'Calandragem, repuxo, estampo', icon: <CircleDot className="w-5 h-5" /> },
  { key: 'USINAGEM', label: 'Usinagem', desc: 'Torno, fresa, furadeira', icon: <Cog className="w-5 h-5" /> },
  { key: 'TRATAMENTO_TERMICO', label: 'Trat. Térmico', desc: 'Tempera, revenimento, normalizacao', icon: <Thermometer className="w-5 h-5" /> },
  { key: 'JATEAMENTO', label: 'Jateamento', desc: 'Granalha, areia, hidrojateamento', icon: <Wind className="w-5 h-5" /> },
  { key: 'MONTAGEM_ESTRUTURAL', label: 'Montagem Estrutural', desc: 'Montagem e gabarito de estruturas', icon: <Boxes className="w-5 h-5" /> },
];

export default function NovaOrdemCalderariaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [osList, setOsList] = useState<DropdownItem[]>([]);
  const [opList, setOpList] = useState<DropdownItem[]>([]);

  const [form, setForm] = useState<CldForm>({
    serviceType: 'CORTE',
    linkedOsId: '',
    linkedOpId: '',
    description: '',
    materialDescription: '',
    technicalSpecs: '',
    estimatedTime: '',
    observations: '',
  });

  useEffect(() => {
    // Load OS dropdown
    apiFetch('/api/service-orders?status=ABERTA&limit=100')
      .then((res) => res.ok ? res.json() : { data: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((json) => {
        const items = (json.data || []).map((os: any) => ({
          id: os.id,
          label: `${os.numero} — ${os.veiculoDescricao || os.descricao || ''}`.trim().replace(/—\s*$/, ''),
        }));
        setOsList(items);
      })
      .catch(() => {});

    // Load OP dropdown
    apiFetch('/api/production/orders?status=EM_PRODUCAO&status=LIBERADA&limit=100')
      .then((res) => res.ok ? res.json() : { data: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((json) => {
        const items = (json.data || []).map((op: any) => ({
          id: op.id,
          label: `${op.numero} — ${op.descricao || op.description || ''}`.trim().replace(/—\s*$/, ''),
        }));
        setOpList(items);
      })
      .catch(() => {});
  }, []);

  const updateForm = (field: keyof CldForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.description.trim()) {
      alert('Descricao do servico e obrigatoria');
      return;
    }
    if (!form.estimatedTime) {
      alert('Tempo estimado e obrigatorio');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        serviceType: form.serviceType,
        description: form.description,
        materialDescription: form.materialDescription,
        tempoEstimado: parseFloat(form.estimatedTime),
        especificacoesTecnicas: form.technicalSpecs,
        observations: form.observations,
      };
      if (form.linkedOsId) body.serviceOrderId = form.linkedOsId;
      if (form.linkedOpId) body.productionOrderId = form.linkedOpId;

      const res = await apiFetch('/api/calderaria', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao criar ordem');
      }
      router.push('/calderaria/ordens');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao criar ordem de calderaria');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/calderaria/ordens"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Ordem de Calderaria</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Crie uma nova ordem para servicos de calderaria e fabricacao pesada
          </p>
        </div>
      </div>

      {/* Service Type Radio Cards */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-zinc-600" />
          <h2 className="text-lg font-semibold text-slate-900">Tipo de Servico *</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {serviceTypeOptions.map((opt) => (
            <label
              key={opt.key}
              className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-colors text-center ${
                form.serviceType === opt.key
                  ? 'border-zinc-500 bg-zinc-50 ring-2 ring-zinc-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="serviceType"
                value={opt.key}
                checked={form.serviceType === opt.key}
                onChange={() => updateForm('serviceType', opt.key)}
                className="sr-only"
              />
              <div className={`mb-2 ${form.serviceType === opt.key ? 'text-zinc-700' : 'text-slate-400'}`}>
                {opt.icon}
              </div>
              <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
              <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Vinculo OS ou OP */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-zinc-600" />
          <h2 className="text-lg font-semibold text-slate-900">Vinculo (opcional)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ordem de Servico (OS)</label>
            <select
              value={form.linkedOsId}
              onChange={(e) => {
                updateForm('linkedOsId', e.target.value);
                if (e.target.value) updateForm('linkedOpId', '');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            >
              <option value="">Nenhuma OS vinculada</option>
              {osList.map((os) => (
                <option key={os.id} value={os.id}>{os.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ordem de Producao (OP)</label>
            <select
              value={form.linkedOpId}
              onChange={(e) => {
                updateForm('linkedOpId', e.target.value);
                if (e.target.value) updateForm('linkedOsId', '');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            >
              <option value="">Nenhuma OP vinculada</option>
              {opList.map((op) => (
                <option key={op.id} value={op.id}>{op.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Descricao e Material */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-zinc-600" />
          <h2 className="text-lg font-semibold text-slate-900">Detalhes do Servico</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao do Servico *</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              rows={3}
              placeholder="Descreva o servico de calderaria a ser executado..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao do Material</label>
            <input
              type="text"
              value={form.materialDescription}
              onChange={(e) => updateForm('materialDescription', e.target.value)}
              placeholder="Ex: Chapa Aco ASTM A36 6mm, Perfil U 150x60mm, Tubo Retangular 100x50x3mm"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Especificacoes Tecnicas</label>
            <textarea
              value={form.technicalSpecs}
              onChange={(e) => updateForm('technicalSpecs', e.target.value)}
              rows={4}
              placeholder="Especificacoes tecnicas: tolerancias, normas, processos de solda, tratamentos, acabamentos..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </div>

      {/* Tempo Estimado */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-zinc-600" />
          <h2 className="text-lg font-semibold text-slate-900">Tempo Estimado</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tempo Estimado (horas) *</label>
            <input
              type="number"
              value={form.estimatedTime}
              onChange={(e) => updateForm('estimatedTime', e.target.value)}
              min="0.5"
              step="0.5"
              placeholder="Ex: 8"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Observacoes */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
        <textarea
          value={form.observations}
          onChange={(e) => updateForm('observations', e.target.value)}
          rows={3}
          placeholder="Informacoes adicionais sobre a ordem de calderaria..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/calderaria/ordens"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Criar Ordem de Calderaria
        </button>
      </div>
    </div>
  );
}
