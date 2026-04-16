'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Factory, Settings, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type WorkCenterType = 'FABRICACAO' | 'MONTAGEM' | 'PINTURA' | 'CALDERARIA' | 'ACABAMENTO' | 'INSPECAO';

interface WorkCenterForm {
  code: string;
  name: string;
  type: WorkCenterType;
  capacidadeHora: string;
  custoHora: string;
  description: string;
}

const typeOptions: { key: WorkCenterType; label: string; desc: string }[] = [
  { key: 'FABRICACAO', label: 'Fabricação', desc: 'Corte, dobra e conformação' },
  { key: 'CALDERARIA', label: 'Calderaria', desc: 'Soldagem e estruturas' },
  { key: 'MONTAGEM', label: 'Montagem', desc: 'Montagem de conjuntos' },
  { key: 'PINTURA', label: 'Pintura', desc: 'Tratamento e pintura' },
  { key: 'ACABAMENTO', label: 'Acabamento', desc: 'Instalações e acabamento' },
  { key: 'INSPECAO', label: 'Inspeção', desc: 'Controle de qualidade' },
];

export default function NovoCentroTrabalhoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState<WorkCenterForm>({
    code: '',
    name: '',
    type: 'FABRICACAO',
    capacidadeHora: '',
    custoHora: '',
    description: '',
  });

  const updateForm = (field: keyof WorkCenterForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string => {
    if (!form.code.trim()) return 'O código é obrigatório.';
    if (!form.name.trim()) return 'O nome é obrigatório.';
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
      const res = await apiFetch('/api/pcp/work-centers', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          capacidadeHora: parseFloat(form.capacidadeHora) || 0,
          custoHora: parseFloat(form.custoHora) || 0,
          description: form.description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Erro ao salvar centro de trabalho');
      }
      router.push('/pcp/centros-trabalho');
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
          href="/pcp/centros-trabalho"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Centro de Trabalho</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Cadastre um novo centro de trabalho na fábrica
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

      {/* Dados do Centro */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Factory className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Centro de Trabalho</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => updateForm('code', e.target.value)}
              placeholder="Ex: CT-007"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Ex: Corte CNC"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tipo - Radio Cards */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo *</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {typeOptions.map((type) => (
              <label
                key={type.key}
                className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors text-center ${
                  form.type === type.key
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={type.key}
                  checked={form.type === type.key}
                  onChange={() => updateForm('type', type.key)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-slate-900">{type.label}</span>
                <span className="text-xs text-slate-500 mt-0.5">{type.desc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Capacidade e Custos */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Capacidade e Custos</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade por Hora (un/h)</label>
            <input
              type="number"
              value={form.capacidadeHora}
              onChange={(e) => updateForm('capacidadeHora', e.target.value)}
              placeholder="Ex: 8"
              min="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Custo por Hora (R$/h)</label>
            <input
              type="number"
              value={form.custoHora}
              onChange={(e) => updateForm('custoHora', e.target.value)}
              placeholder="Ex: 185.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => updateForm('description', e.target.value)}
            rows={3}
            placeholder="Descrição das atividades e equipamentos do centro de trabalho..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/pcp/centros-trabalho"
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
          {saving ? 'Salvando...' : 'Salvar Centro de Trabalho'}
        </button>
      </div>
    </div>
  );
}
