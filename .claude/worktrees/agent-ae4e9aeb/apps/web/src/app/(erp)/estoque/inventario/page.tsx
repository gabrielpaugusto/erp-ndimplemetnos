'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Eye, ClipboardCheck, Calendar, MapPin, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type InventoryStatus = 'PLANEJADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

interface Inventory {
  id: string;
  number?: string;
  description?: string;
  dateFrom?: string;
  startDate?: string;
  dateTo?: string;
  endDate?: string;
  status: InventoryStatus;
  totalItems?: number;
  countedItems?: number;
  differencesFound?: number;
  location?: { code: string; name: string } | null;
}

const statusLabels: Record<InventoryStatus, string> = {
  PLANEJADO: 'Planejado', EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado',
};
const statusColors: Record<InventoryStatus, string> = {
  PLANEJADO: 'bg-slate-100 text-slate-600', EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
  CONCLUIDO: 'bg-emerald-100 text-emerald-700', CANCELADO: 'bg-red-100 text-red-700',
};

const fmtDate = (s?: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

export default function InventariosPage() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/inventory/inventories?limit=50');
    if (res.ok) {
      const data = await res.json();
      const list = data.data ?? data;
      setInventories(list);
      setTotal(data.meta?.total ?? list.length);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventarios</h1>
          <p className="text-slate-500 mt-1">Gerencie contagens de estoque e ajustes de inventario</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/estoque/inventario/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Novo Inventario
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Numero', 'Local', 'Descricao', 'Periodo', 'Status', 'Progresso', 'Diferencas', 'Acoes'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : inventories.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum inventario encontrado.</td></tr>
              ) : inventories.map((inv) => {
                const total = inv.totalItems ?? 0;
                const counted = inv.countedItems ?? 0;
                const progress = total > 0 ? Math.round((counted / total) * 100) : 0;
                const startDate = inv.dateFrom ?? inv.startDate;
                const endDate = inv.dateTo ?? inv.endDate;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{inv.number ?? inv.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-teal-600" />
                        <span className="text-sm text-slate-700">{inv.location?.name ?? '—'}</span>
                      </div>
                      {inv.location?.code && <span className="text-xs text-slate-500 font-mono">{inv.location.code}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{inv.description ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {fmtDate(startDate)} — {fmtDate(endDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status]}`}>
                        {statusLabels[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600">{counted}/{total}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(inv.differencesFound ?? 0) > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{inv.differencesFound}</span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/estoque/inventario/${inv.id}`} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-500">Total: <span className="font-medium">{total}</span> registros</p>
          </div>
        )}
      </div>
    </div>
  );
}
