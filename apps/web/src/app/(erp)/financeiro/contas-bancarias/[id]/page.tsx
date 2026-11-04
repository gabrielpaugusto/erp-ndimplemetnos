'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Landmark, Save, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

const tipoContaLabels: Record<string, string> = {
  CORRENTE:   'Conta Corrente',
  POUPANCA:   'Poupança',
  INVESTIMENTO: 'Investimento',
  CAIXA:      'Caixa',
};

interface BankAccount {
  id: string;
  name: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  saldoAtual: number;
  saldoInicial: number;
  active: boolean;
  createdAt: string;
}

export default function ContaBancariaDetailPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: 'CORRENTE',
    saldoInicial: '0',
    active: true,
  });

  useEffect(() => {
    async function fetch() {
      try {
        const data = await api<BankAccount>(`/financial/bank-accounts/${id}`);
        setAccount(data);
        setForm({
          name: data.name,
          banco: data.banco,
          agencia: data.agencia,
          conta: data.conta,
          tipoConta: data.tipoConta,
          saldoInicial: String(data.saldoInicial ?? 0),
          active: data.active,
        });
      } catch {
        toast.error('Erro ao carregar conta bancária');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      await api(`/financial/bank-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          saldoInicial: parseFloat(form.saldoInicial) || 0,
        }),
      });
      toast.success('Conta bancária atualizada');
      router.refresh();
    } catch {
      toast.error('Erro ao salvar conta bancária');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        Conta não encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/financeiro/contas-bancarias" className="text-slate-500 hover:text-slate-700">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-600" />
              {account.name}
            </h1>
            <p className="text-sm text-slate-500">{tipoContaLabels[account.tipoConta] ?? account.tipoConta}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Saldo cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Saldo Atual
          </div>
          <p className={`text-2xl font-bold ${account.saldoAtual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtCurrency(account.saldoAtual)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendingDown className="w-4 h-4 text-slate-400" />
            Saldo Inicial
          </div>
          <p className="text-2xl font-bold text-slate-700">
            {fmtCurrency(account.saldoInicial ?? 0)}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">Dados da Conta</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Nome / Apelido</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Banco</label>
            <input
              type="text"
              value={form.banco}
              onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Conta</label>
            <select
              value={form.tipoConta}
              onChange={e => setForm(f => ({ ...f, tipoConta: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {Object.entries(tipoContaLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Agência</label>
            <input
              type="text"
              value={form.agencia}
              onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Conta</label>
            <input
              type="text"
              value={form.conta}
              onChange={e => setForm(f => ({ ...f, conta: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Saldo Inicial (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.saldoInicial}
              onChange={e => setForm(f => ({ ...f, saldoInicial: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 accent-primary-600"
            />
            <label htmlFor="active" className="text-sm font-medium text-slate-600">Conta ativa</label>
          </div>
        </div>
      </div>
    </div>
  );
}
