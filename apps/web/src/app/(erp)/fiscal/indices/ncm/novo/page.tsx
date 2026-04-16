'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

const emptyForm = (): NcmForm => ({
  code: '',
  description: '',
  exTipi: '',
  temSt: false,
  cestCode: '',
  cestDescricao: '',
  aliquotaImportacao: '',
  active: true,
});

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

export default function NovoNcmPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<NcmForm>(emptyForm());

  const set = (field: keyof NcmForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const handleSave = async () => {
    setSaveError('');
    if (!form.code.trim()) { setSaveError('Código NCM é obrigatório.'); return; }
    if (!form.description.trim()) { setSaveError('Descrição é obrigatória.'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim().replace(/\D/g, '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3'),
        description: form.description.trim(),
        exTipi: form.exTipi || undefined,
        temSt: form.temSt,
        cestCode: form.temSt ? (form.cestCode || undefined) : undefined,
        cestDescricao: form.temSt ? (form.cestDescricao || undefined) : undefined,
        aliquotaImportacao: form.aliquotaImportacao ? parseFloat(form.aliquotaImportacao) : undefined,
        active: form.active,
      };

      const res = await apiFetch('/api/fiscal/ncm', { method: 'POST', body: JSON.stringify(body) });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/fiscal/indices/ncm" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo NCM</h1>
          <p className="text-slate-500 text-sm mt-0.5">Cadastro de Nomenclatura Comum do Mercosul</p>
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
          <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar NCM'}
        </button>
      </div>
    </div>
  );
}
