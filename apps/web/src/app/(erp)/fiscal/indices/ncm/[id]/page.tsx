'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Save, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface NcmForm {
  code: string;
  description: string;
  exTipi: string;
  temSt: boolean;
  cestCode: string;
  cestDescricao: string;
  aliquotaImportacao: string;
  active: boolean;
}

const toStr = (v: unknown): string => (v == null ? '' : String(v));

function mapDataToForm(data: any): NcmForm {
  return {
    code: toStr(data.code),
    description: toStr(data.description),
    exTipi: toStr(data.exTipi),
    temSt: Boolean(data.temSt),
    cestCode: toStr(data.cestCode),
    cestDescricao: toStr(data.cestDescricao),
    aliquotaImportacao: data.aliquotaImportacao != null ? String(Number(data.aliquotaImportacao)) : '',
    active: data.active !== false,
  };
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

export default function EditNcmPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NcmForm | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/fiscal/ncm/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => setForm(mapDataToForm(data)))
      .catch(err => setLoadError(err.message || 'Erro ao carregar NCM.'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: keyof NcmForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!form) return;
    setForm(prev => prev ? ({ ...prev, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }) : prev);
  };

  const handleSave = async () => {
    if (!form) return;
    setSaveError('');
    if (!form.code.trim()) { setSaveError('Código NCM é obrigatório.'); return; }
    if (!form.description.trim()) { setSaveError('Descrição é obrigatória.'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim(),
        description: form.description.trim(),
        exTipi: form.exTipi || undefined,
        temSt: form.temSt,
        cestCode: form.temSt ? (form.cestCode || undefined) : undefined,
        cestDescricao: form.temSt ? (form.cestDescricao || undefined) : undefined,
        aliquotaImportacao: form.aliquotaImportacao ? parseFloat(form.aliquotaImportacao) : undefined,
        active: form.active,
      };

      const res = await apiFetch(`/api/fiscal/ncm/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message) ? err.message.join(' | ') : (err.message || `Erro ${res.status}`);
        throw new Error(msg);
      }
      router.push('/fiscal/indices/ncm');
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao salvar NCM.');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="h-64 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-6 rounded-lg text-center">
        <p className="font-semibold">Erro ao carregar NCM</p>
        <p className="text-sm mt-1">{loadError}</p>
        <Link href="/fiscal/indices/ncm" className="mt-4 inline-block text-sm text-blue-600 hover:underline">Voltar à lista</Link>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/fiscal/indices/ncm" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar NCM — {form.code}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Edição de Nomenclatura Comum do Mercosul</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          A classificação fiscal detalhada (CST, alíquotas, ICMS, PIS/COFINS) é determinada automaticamente pelo motor de IA FiscalBrain com base no NCM e no contexto da operação.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={labelCls}>Código NCM <span className="text-red-500">*</span></label>
            <input type="text" value={form.code} onChange={set('code')} placeholder="0000.00.00" maxLength={10} className={inputCls} />
            <p className="text-xs text-slate-400 mt-1">8 dígitos — ex: 8716.39.00</p>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Descrição <span className="text-red-500">*</span></label>
            <input type="text" value={form.description} onChange={set('description')} placeholder="Descrição completa conforme TIPI" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={labelCls}>Ex TIPI</label>
            <input type="text" value={form.exTipi} onChange={set('exTipi')} placeholder="Ex: 01" maxLength={5} className={inputCls} />
            <p className="text-xs text-slate-400 mt-1">Exceção TIPI (quando aplicável)</p>
          </div>
          <div>
            <label className={labelCls}>Alíquota Importação II (%)</label>
            <input type="number" step="0.01" min="0" value={form.aliquotaImportacao} onChange={set('aliquotaImportacao')} placeholder="0,00" className={inputCls} />
            <p className="text-xs text-slate-400 mt-1">Imposto de Importação</p>
          </div>
        </div>

        <div className="p-5 border border-orange-200 bg-orange-50 rounded-lg space-y-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="temSt" checked={form.temSt} onChange={set('temSt')} className="w-4 h-4 text-orange-600" />
            <label htmlFor="temSt" className="font-semibold text-orange-800 cursor-pointer">Sujeito à Substituição Tributária (ST)</label>
          </div>
          {form.temSt && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Código CEST</label>
                <input type="text" value={form.cestCode} onChange={set('cestCode')} placeholder="0000000 (sem pontos)" maxLength={7} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Descrição CEST / Segmento</label>
                <input type="text" value={form.cestDescricao} onChange={set('cestDescricao')} placeholder="Ex: Autopeças" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={set('active')} className="w-4 h-4 text-blue-600 border-slate-300 rounded" />
            <span className="text-sm font-medium text-slate-700">NCM ativo</span>
          </label>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <span className="font-semibold shrink-0">Erro:</span>
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError('')} className="text-red-400 hover:text-red-600">&#x2715;</button>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/fiscal/indices/ncm" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
