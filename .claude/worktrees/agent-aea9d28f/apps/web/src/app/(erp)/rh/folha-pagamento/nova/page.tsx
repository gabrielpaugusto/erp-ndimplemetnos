'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, FileText, Calculator } from 'lucide-react';
import { api } from '@/lib/api';

type PayrollType = 'MENSAL' | 'FERIAS' | '13_SALARIO' | 'RESCISAO' | 'ADIANTAMENTO';

const typeDescriptions: Record<PayrollType, { label: string; desc: string }> = {
  MENSAL: { label: 'Mensal', desc: 'Folha mensal regular com todos os proventos e descontos' },
  FERIAS: { label: 'Ferias', desc: 'Calculo de ferias individuais ou coletivas' },
  '13_SALARIO': { label: '13o Salario', desc: 'Primeira ou segunda parcela do 13o salario' },
  RESCISAO: { label: 'Rescisao', desc: 'Calculo de verbas rescisorias por demissao' },
  ADIANTAMENTO: { label: 'Adiantamento', desc: 'Adiantamento salarial (vale)' },
};

const months = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function NovaFolhaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState('2'); // March (0-indexed)
  const [year, setYear] = useState('2026');
  const [tipo, setTipo] = useState<PayrollType>('MENSAL');
  const handleSave = async () => {
    setSaving(true);
    try {
      const mes = parseInt(month, 10) + 1; // convert 0-indexed to 1-indexed
      const periodoReferencia = `${String(mes).padStart(2, '0')}/${year}`;
      await api('/hr/payroll', {
        method: 'POST',
        body: JSON.stringify({ periodoReferencia, type: tipo }),
      });
      router.push('/rh/folha-pagamento');
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar folha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rh/folha-pagamento" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Folha de Pagamento</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Criar e calcular uma nova folha de pagamento</p>
        </div>
      </div>

      {/* Period */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Periodo</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mes *</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
              {months.map((m, i) => <option key={i} value={i.toString()}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ano *</label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>
      </div>

      {/* Type */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Tipo de Folha</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.entries(typeDescriptions) as [PayrollType, { label: string; desc: string }][]).map(([key, val]) => (
            <label
              key={key}
              className={`relative flex flex-col p-4 rounded-lg cursor-pointer border-2 transition-all ${
                tipo === key ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input type="radio" name="tipo" value={key} checked={tipo === key} onChange={() => setTipo(key)} className="sr-only" />
              <span className={`text-sm font-semibold ${tipo === key ? 'text-sky-700' : 'text-slate-700'}`}>{val.label}</span>
              <span className="text-xs text-slate-500 mt-1">{val.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-sky-50 rounded-lg border border-sky-200 p-4 text-sm text-sky-700">
        <Calculator className="w-4 h-4 inline-block mr-1" />
        Clique em <strong>Gerar Folha</strong> para criar a folha em rascunho. O calculo dos valores sera realizado na pagina de detalhes da folha.
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/rh/folha-pagamento" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" />
          {saving ? 'Aguarde...' : 'Gerar Folha'}
        </button>
      </div>
    </div>
  );
}
