'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Landmark } from 'lucide-react';

export default function NovaContaBancariaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [tipo, setTipo] = useState<'Corrente' | 'Poupanca'>('Corrente');
  const [saldoInicial, setSaldoInicial] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      alert('Conta bancaria cadastrada com sucesso! (mock)');
      router.push('/financeiro/contas-bancarias');
    } catch {
      alert('Erro ao salvar conta bancaria');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/financeiro/contas-bancarias"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Conta Bancaria</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastrar uma nova conta bancaria</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados da Conta</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Conta *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Conta Principal Operacional"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Banco *</label>
            <select
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Selecione o banco...</option>
              <option value="001">001 - Banco do Brasil</option>
              <option value="237">237 - Bradesco</option>
              <option value="104">104 - Caixa Economica Federal</option>
              <option value="341">341 - Itau Unibanco</option>
              <option value="033">033 - Santander</option>
              <option value="756">756 - Sicoob</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Agencia *</label>
            <input
              type="text"
              value={agencia}
              onChange={(e) => setAgencia(e.target.value)}
              placeholder="Ex: 1234-5"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conta *</label>
            <input
              type="text"
              value={conta}
              onChange={(e) => setConta(e.target.value)}
              placeholder="Ex: 56789-0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
            <div className="flex items-center gap-4 mt-2">
              <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer border transition-colors ${
                tipo === 'Corrente' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-600'
              }`}>
                <input type="radio" name="tipo" value="Corrente" checked={tipo === 'Corrente'} onChange={() => setTipo('Corrente')} className="sr-only" />
                Conta Corrente
              </label>
              <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer border transition-colors ${
                tipo === 'Poupanca' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-600'
              }`}>
                <input type="radio" name="tipo" value="Poupanca" checked={tipo === 'Poupanca'} onChange={() => setTipo('Poupanca')} className="sr-only" />
                Poupanca
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial</label>
            <input
              type="number"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              placeholder="0,00"
              step="0.01"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/financeiro/contas-bancarias"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving || !nome || !banco || !agencia || !conta}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Salvar Conta
        </button>
      </div>
    </div>
  );
}
