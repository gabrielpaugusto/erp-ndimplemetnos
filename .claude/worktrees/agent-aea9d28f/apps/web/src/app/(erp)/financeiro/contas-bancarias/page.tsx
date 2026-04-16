'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface BankAccount {
  id: string;
  name: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  saldoAtual: number;
  active: boolean;
}

export default function ContasBancariasListPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const data = await api<{ data: BankAccount[] }>('/financial/bank-accounts');
        setAccounts(data.data ?? []);
      } catch {
        // keep empty list
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas Bancarias</h1>
          <p className="text-slate-500 mt-1">Gerencie as contas bancarias da empresa</p>
        </div>
        <Link
          href="/financeiro/contas-bancarias/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Conta
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-slate-500 text-sm">Carregando...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Banco</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Agencia</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conta</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Atual</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">Nenhuma conta bancaria cadastrada</td>
                  </tr>
                )}
                {accounts.map((acc, index) => (
                  <tr key={acc.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-slate-400" />
                        <div>
                          <span className="text-sm font-medium text-slate-900">{acc.banco}</span>
                          <p className="text-xs text-slate-500">{acc.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{acc.agencia}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{acc.conta}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{acc.tipoConta}</td>
                    <td className={`px-4 py-3 text-sm font-bold text-right ${Number(acc.saldoAtual) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatCurrency(Number(acc.saldoAtual))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {acc.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          <XCircle className="w-3 h-3" />
                          Inativa
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
