'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight, ChevronDown, Filter, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type AccountType = 'ATIVO' | 'PASSIVO' | 'RECEITA' | 'DESPESA' | 'PL';

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  nature: 'DEVEDORA' | 'CREDORA';
  level: number;
  acceptsEntries: boolean;
  children?: Account[];
}

const typeColors: Record<AccountType, string> = {
  ATIVO: 'bg-blue-100 text-blue-700', PASSIVO: 'bg-red-100 text-red-700',
  RECEITA: 'bg-emerald-100 text-emerald-700', DESPESA: 'bg-amber-100 text-amber-700',
  PL: 'bg-violet-100 text-violet-700',
};
const typeLabels: Record<AccountType, string> = {
  ATIVO: 'Ativo', PASSIVO: 'Passivo', RECEITA: 'Receita', DESPESA: 'Despesa', PL: 'PL',
};

function AccountRow({ account, expanded, toggleExpand }: { account: Account; expanded: Set<string>; toggleExpand: (id: string) => void }) {
  const isExpanded = expanded.has(account.id);
  const hasChildren = (account.children?.length ?? 0) > 0;
  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-2.5">
          <div className="flex items-center" style={{ paddingLeft: `${(account.level - 1) * 24}px` }}>
            {hasChildren ? (
              <button onClick={() => toggleExpand(account.id)} className="p-0.5 mr-1 text-slate-400 hover:text-violet-600 rounded transition-colors">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : <span className="w-5 mr-1" />}
            <span className="text-sm font-mono text-slate-500 mr-3">{account.code}</span>
            <span className={`text-sm ${account.level <= 2 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{account.name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[account.type] ?? 'bg-slate-100 text-slate-600'}`}>
            {typeLabels[account.type] ?? account.type}
          </span>
        </td>
        <td className="px-4 py-2.5 text-sm text-slate-600">{account.nature === 'DEVEDORA' ? 'Devedora' : 'Credora'}</td>
        <td className="px-4 py-2.5 text-sm text-slate-600 text-center">{account.level}</td>
        <td className="px-4 py-2.5 text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${account.acceptsEntries ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {account.acceptsEntries ? 'Sim' : 'Nao'}
          </span>
        </td>
      </tr>
      {isExpanded && hasChildren && account.children!.map((child) => (
        <AccountRow key={child.id} account={child} expanded={expanded} toggleExpand={toggleExpand} />
      ))}
    </>
  );
}

export default function PlanoContasPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/accounting/chart/tree');
    if (res.ok) {
      const data = await res.json();
      const list: Account[] = data.data ?? data;
      setAccounts(list);
      // Auto-expand top level
      setExpanded(new Set(list.map((a) => a.id)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const collectIds = (accts: Account[]): string[] =>
    accts.flatMap((a) => a.children ? [a.id, ...collectIds(a.children)] : []);

  const expandAll = () => setExpanded(new Set(collectIds(accounts)));
  const collapseAll = () => setExpanded(new Set());

  const filteredAccounts = typeFilter ? accounts.filter((a) => a.type === typeFilter) : accounts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plano de Contas</h1>
          <p className="text-slate-500 mt-1">Estrutura hierarquica das contas contabeis</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/contabilidade/plano-contas/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nova Conta
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <label className="text-sm font-medium text-slate-700">Filtrar por tipo:</label>
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">Todos</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex-1" />
          <button onClick={expandAll} className="text-sm text-violet-600 hover:text-violet-700 font-medium">Expandir tudo</button>
          <button onClick={collapseAll} className="text-sm text-slate-500 hover:text-slate-700 font-medium">Recolher tudo</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Codigo / Nome', 'Tipo', 'Natureza', 'Nivel', 'Aceita Lanc.'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 3 || i === 4 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : filteredAccounts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma conta encontrada.</td></tr>
              ) : filteredAccounts.map((account) => (
                <AccountRow key={account.id} account={account} expanded={expanded} toggleExpand={toggleExpand} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
