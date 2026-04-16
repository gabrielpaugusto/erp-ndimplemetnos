'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, MapPin, Warehouse, Factory, Truck, ShieldAlert } from 'lucide-react';

type LocationType = 'ALMOXARIFADO' | 'PRODUCAO' | 'EXPEDICAO' | 'QUARENTENA';

const typeOptions: { key: LocationType; label: string; desc: string; icon: typeof Warehouse; color: string }[] = [
  { key: 'ALMOXARIFADO', label: 'Almoxarifado', desc: 'Deposito de materias-primas, componentes e insumos', icon: Warehouse, color: 'border-blue-500 bg-blue-50 ring-blue-200' },
  { key: 'PRODUCAO', label: 'Producao', desc: 'Area de fabricacao e montagem de produtos', icon: Factory, color: 'border-amber-500 bg-amber-50 ring-amber-200' },
  { key: 'EXPEDICAO', label: 'Expedicao', desc: 'Area de carregamento e envio de produtos acabados', icon: Truck, color: 'border-emerald-500 bg-emerald-50 ring-emerald-200' },
  { key: 'QUARENTENA', label: 'Quarentena', desc: 'Area de inspecao de qualidade e materiais bloqueados', icon: ShieldAlert, color: 'border-red-500 bg-red-50 ring-red-200' },
];

export default function NovoLocalEstoquePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('ALMOXARIFADO');
  const [description, setDescription] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      alert('Local de estoque criado com sucesso! (mock)');
      router.push('/estoque/locais');
    } catch {
      alert('Erro ao criar local');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/estoque/locais" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Local de Estoque</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastre um novo local de armazenagem ou producao</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Informacoes do Local</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: ALM-02" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Almoxarifado Secundario" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
        </div>

        {/* Type Radio Cards */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Local *</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {typeOptions.map((opt) => {
              const IconComp = opt.icon;
              return (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    type === opt.key ? `${opt.color} ring-2` : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input type="radio" name="locationType" value={opt.key} checked={type === opt.key} onChange={() => setType(opt.key)} className="sr-only" />
                  <IconComp className={`w-6 h-6 mt-0.5 ${type === opt.key ? 'text-slate-900' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descricao detalhada do local de estoque..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/estoque/locais" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" /> Criar Local
        </button>
      </div>
    </div>
  );
}
