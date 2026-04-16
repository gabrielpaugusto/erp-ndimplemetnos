'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Flame, ClipboardList, Clock, AlertTriangle, Plus, Eye, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type OrderStatus = 'PENDENTE' | 'EM_EXECUCAO' | 'Concluída' | 'Cancelada';
type ServiceType = 'SOLDA' | 'CORTE' | 'DOBRA' | 'MONTAGEM_ESTRUTURAL' | 'USINAGEM' | 'JATEAMENTO' | 'TRATAMENTO_TERMICO' | string;

interface CalderariaOrder {
  id: string;
  number?: string;
  serviceType: ServiceType;
  description?: string;
  status: OrderStatus;
  estimatedHours?: number;
  actualHours?: number;
  progressPercent?: number;
  serviceOrder?: { number: string } | null;
  productionOrder?: { number: string } | null;
}

const statusLabels: Record<string, string> = {
  PENDENTE: 'Pendente', EM_EXECUCAO: 'Em Execução', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
};
const statusColors: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600', EM_EXECUCAO: 'bg-zinc-100 text-zinc-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700', CANCELADA: 'bg-red-100 text-red-700',
};
const serviceTypeColors: Record<string, string> = {
  SOLDA: 'bg-zinc-100 text-zinc-700', CORTE: 'bg-slate-100 text-slate-700',
  DOBRA: 'bg-slate-200 text-slate-700', MONTAGEM_ESTRUTURAL: 'bg-zinc-200 text-zinc-700',
  USINAGEM: 'bg-stone-100 text-stone-700', JATEAMENTO: 'bg-slate-100 text-slate-600',
  TRATAMENTO_TERMICO: 'bg-zinc-300 text-zinc-800',
};

const BAR_COLORS = [
  'bg-zinc-600', 'bg-zinc-500', 'bg-slate-500', 'bg-slate-600',
  'bg-zinc-400', 'bg-slate-400', 'bg-zinc-300',
];

export default function CalderariaDashboardPage() {
  const [orders, setOrders] = useState<CalderariaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/workshop/calderaria/orders?limit=10&orderBy=createdAt&order=desc');
    if (res.ok) {
      const data = await res.json();
      const list: CalderariaOrder[] = data.data ?? data;
      setOrders(list);
      setTotal(data.meta?.total ?? list.length);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeOrders = orders.filter((o) => o.status === 'EM_EXECUCAO').length;
  const pendingOrders = orders.filter((o) => o.status === 'PENDENTE').length;

  // Service type distribution from loaded orders
  const typeCounts: Record<string, number> = {};
  orders.forEach((o) => { typeCounts[o.serviceType] = (typeCounts[o.serviceType] ?? 0) + 1; });
  const typeTotal = orders.length || 1;
  const typeDistribution = Object.entries(typeCounts).map(([label, count], i) => ({
    label, count, color: BAR_COLORS[i % BAR_COLORS.length],
    percentage: Math.round((count / typeTotal) * 100),
  }));

  const avgProgress = orders.length > 0
    ? Math.round(orders.reduce((acc, o) => acc + (o.progressPercent ?? 0), 0) / orders.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calderaria — Painel de Controle</h1>
          <p className="text-slate-500 mt-1">Acompanhe ordens de calderaria, corte, solda e fabricacao pesada</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-zinc-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Ordens Ativas</h3>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Em execucao</span>
            <span className="text-2xl font-bold text-zinc-700">{loading ? '—' : activeOrders}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Progresso Medio</h3>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Das ordens carregadas</span>
            <span className="text-2xl font-bold text-slate-700">{loading ? '—' : `${avgProgress}%`}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Backlog</h3>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Ordens pendentes</span>
            <span className="text-2xl font-bold text-amber-600">{loading ? '—' : pendingOrders}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/calderaria/ordens/nova" className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nova Ordem de Calderaria
        </Link>
        <Link href="/calderaria/ordens" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 text-sm font-medium transition-colors">
          <ClipboardList className="w-4 h-4" /> Ver Todas as Ordens
        </Link>
      </div>

      {typeDistribution.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-slate-900">Distribuicao por Tipo de Servico</h2>
          </div>
          <div className="space-y-3">
            {typeDistribution.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{item.count} ordens</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className={`h-3 rounded-full ${item.color}`} style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-200">
            {typeDistribution.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-xs text-slate-600">{item.label} ({item.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-slate-900">Ordens Recentes</h2>
            {total > 0 && <span className="text-sm text-slate-500">({total} total)</span>}
          </div>
          <Link href="/calderaria/ordens" className="text-sm text-zinc-600 hover:text-zinc-700 font-medium">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Numero', 'Tipo Servico', 'Descricao', 'Vinculo', 'Status', 'Progresso', 'Acoes'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma ordem de calderaria encontrada.</td></tr>
              ) : orders.map((order) => {
                const linkedRef = order.serviceOrder?.number ?? order.productionOrder?.number;
                const linkedType = order.serviceOrder ? 'OS' : order.productionOrder ? 'OP' : null;
                const progress = order.progressPercent ?? 0;
                return (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{order.number ?? order.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${serviceTypeColors[order.serviceType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {order.serviceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{order.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      {linkedRef ? (
                        <><span className="text-sm font-medium text-zinc-600">{linkedRef}</span><span className="text-xs text-slate-400 ml-1">({linkedType})</span></>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-32">
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${progress === 100 ? 'bg-emerald-500' : progress > 80 ? 'bg-amber-500' : 'bg-zinc-500'}`}
                          style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5 block">{progress}%</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/calderaria/ordens/${order.id}`} className="p-1.5 text-slate-400 hover:text-zinc-600 hover:bg-zinc-50 rounded transition-colors inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
