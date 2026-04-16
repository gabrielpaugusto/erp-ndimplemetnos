'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  X,
  Factory,
  Settings,
  AlertCircle,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type WorkCenterType = 'FABRICACAO' | 'MONTAGEM' | 'PINTURA' | 'CALDERARIA' | 'ACABAMENTO' | 'INSPECAO';

interface WorkCenter {
  id: string;
  code: string;
  name: string;
  type: WorkCenterType;
  capacidadeHora: number;
  custoHora: number;
  active: boolean;
  description?: string;
}

const typeOptions: { key: WorkCenterType; label: string; desc: string }[] = [
  { key: 'FABRICACAO', label: 'Fabricação', desc: 'Corte, dobra e conformação' },
  { key: 'CALDERARIA', label: 'Calderaria', desc: 'Soldagem e estruturas' },
  { key: 'MONTAGEM', label: 'Montagem', desc: 'Montagem de conjuntos' },
  { key: 'PINTURA', label: 'Pintura', desc: 'Tratamento e pintura' },
  { key: 'ACABAMENTO', label: 'Acabamento', desc: 'Instalações e acabamento' },
  { key: 'INSPECAO', label: 'Inspeção', desc: 'Controle de qualidade' },
];

const typeColors: Record<WorkCenterType, string> = {
  FABRICACAO: 'bg-amber-100 text-amber-700',
  MONTAGEM: 'bg-orange-100 text-orange-700',
  PINTURA: 'bg-yellow-100 text-yellow-700',
  CALDERARIA: 'bg-red-100 text-red-700',
  ACABAMENTO: 'bg-cyan-100 text-cyan-700',
  INSPECAO: 'bg-emerald-100 text-emerald-700',
};

const typeLabels: Record<WorkCenterType, string> = {
  FABRICACAO: 'Fabricação',
  MONTAGEM: 'Montagem',
  PINTURA: 'Pintura',
  CALDERARIA: 'Calderaria',
  ACABAMENTO: 'Acabamento',
  INSPECAO: 'Inspeção',
};

function SkeletonForm() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="h-5 w-48 bg-slate-200 rounded mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-10 bg-slate-200 rounded" />
            <div className="h-10 bg-slate-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CentroTrabalhoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [wc, setWc] = useState<WorkCenter | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'FABRICACAO' as WorkCenterType,
    capacidadeHora: '',
    custoHora: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchWC = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/pcp/work-centers/${id}`);
      if (!res.ok) throw new Error('Centro de trabalho não encontrado');
      const data: WorkCenter = await res.json();
      setWc(data);
      setForm({
        code: data.code,
        name: data.name,
        type: data.type,
        capacidadeHora: String(data.capacidadeHora),
        custoHora: String(data.custoHora),
        description: data.description ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWC();
  }, [fetchWC]);

  const updateForm = (field: string, value: string) => {
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
    setSaveSuccess(false);
    try {
      const res = await apiFetch(`/api/pcp/work-centers/${id}`, {
        method: 'PATCH',
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
        throw new Error(d.message || 'Erro ao salvar');
      }
      const updated: WorkCenter = await res.json();
      setWc(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!wc) return;
    setToggling(true);
    try {
      const res = await apiFetch(`/api/pcp/work-centers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !wc.active }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar status');
      const updated: WorkCenter = await res.json();
      setWc(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!wc) return;
    if (!confirm(`Deseja excluir o centro de trabalho "${wc.name}" (${wc.code})? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/pcp/work-centers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir');
      router.push('/pcp/centros-trabalho');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao excluir');
      setDeleting(false);
    }
  };

  if (loading) return <SkeletonForm />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pcp/centros-trabalho" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Centro de Trabalho</h1>
        </div>
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

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
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{wc?.code}</h1>
            {wc && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${typeColors[wc.type]}`}>
                {typeLabels[wc.type]}
              </span>
            )}
            {wc && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                wc.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {wc.active ? 'Ativo' : 'Inativo'}
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">{wc?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              wc?.active
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            {wc?.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {wc?.active ? 'Desativar' : 'Ativar'}
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

      {/* Error / Success banners */}
      {saveError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{saveError}</span>
          <button onClick={() => setSaveError('')} className="ml-auto p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          Centro de trabalho salvo com sucesso.
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
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
