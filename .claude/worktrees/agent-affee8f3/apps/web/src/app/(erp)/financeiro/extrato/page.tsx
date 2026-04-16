'use client';

import { useState, useEffect, useCallback } from 'react';
import { Landmark, Calendar, ArrowUpRight, ArrowDownRight, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

type TxType = 'CREDITO' | 'DEBITO';

interface BankAccount {
  id: string;
  nome: string;
  banco: string;
  agencia: string;
  conta: string;
}

interface Transaction {
  id: string;
  data: string;
  descricao: string;
  tipo: TxType;
  valor: number;
  saldoApos?: number;
  conciliado: boolean;
}

interface StatementData {
  transactions: Transaction[];
  saldoInicial: number;
  saldoFinal: number;
  totalCreditos: number;
  totalDebitos: number;
}

export default function ExtratoPage() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);

  // Load bank accounts on mount
  useEffect(() => {
    apiFetch('/api/financial/bank-accounts?limit=50').then(async (res) => {
      if (res.ok) {
        const d = await res.json();
        const list: BankAccount[] = d.data ?? d;
        setAccounts(list);
        if (list.length > 0) setSelectedAccount(list[0].id);
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    const params = new URLSearchParams({ bankAccountId: selectedAccount, dateFrom, dateTo });
    const res = await apiFetch(`/api/financial/transactions/statement?${params}`);
    if (res.ok) setStatement(await res.json());
    else setStatement({ transactions: [], saldoInicial: 0, saldoFinal: 0, totalCreditos: 0, totalDebitos: 0 });
    setLoading(false);
  }, [selectedAccount, dateFrom, dateTo]);

  useEffect(() => { if (selectedAccount) load(); }, [load, selectedAccount]);

  const toggleConciliado = async (id: string) => {
    await apiFetch(`/api/financial/transactions/${id}/reconcile`, { method: 'PATCH' });
    setStatement(prev => prev ? {
      ...prev,
      transactions: prev.transactions.map(t => t.id === id ? { ...t, conciliado: !t.conciliado } : t),
    } : prev);
  };

  const txs = statement?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Extrato Bancario</h1>
        <p className="text-slate-500 mt-1">Visualize e concilie as movimentacoes bancarias</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancaria</label>
            <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {accounts.length === 0 && <option value="">Carregando...</option>}
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.banco} — Ag {a.agencia} Cc {a.conta}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Inicio</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex items-end">
            <button onClick={load} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Creditos</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(statement?.totalCreditos ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <ArrowDownRight className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Debitos</p>
            <p className="text-lg font-bold text-red-700">{fmt(statement?.totalDebitos ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Landmark className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Saldo Final</p>
            <p className={`text-lg font-bold ${(statement?.saldoFinal ?? 0) >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
              {fmt(statement?.saldoFinal ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">Conc.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : txs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma transacao no periodo selecionado.</td></tr>
              ) : txs.map((tx, i) => (
                <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => toggleConciliado(tx.id)} className="text-slate-400 hover:text-emerald-600 transition-colors">
                      {tx.conciliado ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {fmtDate(tx.data)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{tx.descricao}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tx.tipo === 'CREDITO' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {tx.tipo === 'CREDITO' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {tx.tipo === 'CREDITO' ? 'Credito' : 'Debito'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-semibold text-right ${tx.tipo === 'CREDITO' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {tx.tipo === 'CREDITO' ? '+' : '-'}{fmt(tx.valor)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">{fmt(tx.saldoApos ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
