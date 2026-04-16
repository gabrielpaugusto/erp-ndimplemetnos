'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Factory,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  Plus,
  Eye,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface RecentOrder {
  id: string;
  numero: string;
  product: { code: string; description: string } | null;
  quantity: number;
  quantityProduced: number;
  status: string;
  priority: number;
  strategy: string;
  dataFimPrevista: string;
}

interface StatusStat {
  status: string;
  count: number;
}

interface StatsResponse {
  byStatus: StatusStat[];
  byStrategy: { strategy: string; count: number; totalQuantity: number }[];
}

const statusLabels: Record<string, string> = {
  PLANEJADA: 'Planejada',
  LIBERADA: 'Liberada',
  EM_PRODUCAO: 'Em Produção',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<string, string> = {
  PLANEJADA: 'bg-slate-100 text-slate-600',
  LIBERADA: 'bg-sky-100 text-sky-700',
  EM_PRODUCAO: 'bg-blue-100 text-blue-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const chartColors: Record<string, string> = {
  PLANEJADA: 'bg-slate-400',
  LIBERADA: 'bg-sky-500',
  EM_PRODUCAO: 'bg-blue-600',
  CONCLUIDA: 'bg-emerald-500',
  CANCELADA: 'bg-red-500',
};

const svgColors: Record<string, string> = {
  PLANEJADA: '#94a3b8',
  LIBERADA: '#0ea5e9',
  EM_PRODUCAO: '#2563eb',
  CONCLUIDA: '#10b981',
  CANCELADA: '#ef4444',
};

export default function ProducaoDashboardPage() {
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersRes, statsRes] = await Promise.all([
          apiFetch('/api/production/orders?limit=5&page=1'),
          apiFetch('/api/production/orders/stats'),
        ]);

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setRecentOrders(ordersData.data || []);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (err) {
        console.error('Erro ao carregar dados de produção:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const byStatus = stats?.byStatus || [];
  const totalOrders = byStatus.reduce((sum, s) => sum + s.count, 0);

  const opsEmProducao = byStatus.find((s) => s.status === 'EM_PRODUCAO')?.count ?? 0;
  const atrasos = byStatus.find((s) => s.status === 'CANCELADA')?.count ?? 0;

  // Build chart items
  const statusOrder = ['PLANEJADA', 'LIBERADA', 'EM_PRODUCAO', 'CONCLUIDA'];
  const chartItems = statusOrder
    .map((status) => {
      const found = byStatus.find((s) => s.status === status);
      const count = found?.count ?? 0;
      const percentage = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
      return { status, label: statusLabels[status] || status, count, percentage };
    })
    .filter((item) => item.count > 0 || totalOrders === 0);

  // Build pie chart segments
  let offset = 0;
  const piePath = 100 * 2.51;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produção — Gestão de Ordens</h1>
          <p className="text-slate-500 mt-1">
            Acompanhe ordens de produção, apontamentos e indicadores de eficiência
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Factory className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">OPs em Produção</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Ativas</span>
            <span className="text-2xl font-bold text-blue-700">
              {loading ? '...' : opsEmProducao}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Total de OPs</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Cadastradas</span>
            <span className="text-2xl font-bold text-sky-700">
              {loading ? '...' : totalOrders}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Concluídas</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Total</span>
            <span className="text-2xl font-bold text-emerald-700">
              {loading ? '...' : byStatus.find((s) => s.status === 'CONCLUIDA')?.count ?? 0}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Canceladas</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">OPs canceladas</span>
            <span className="text-2xl font-bold text-red-600">
              {loading ? '...' : atrasos}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/producao/ordens/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem de Produção
        </Link>
        <Link
          href="/producao/apontamentos/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Apontamento
        </Link>
      </div>

      {/* Status Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Distribuição por Status</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            Carregando...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="space-y-3">
              {chartItems.map((item) => (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{item.count} OPs</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${chartColors[item.status] || 'bg-slate-400'}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {chartItems.length === 0 && (
                <p className="text-sm text-slate-400">Nenhuma ordem encontrada.</p>
              )}
            </div>

            {/* Pie chart */}
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {chartItems.map((item) => {
                    const dashArray = (item.percentage / 100) * piePath;
                    const dashOffset = -offset;
                    offset += dashArray;
                    return (
                      <circle
                        key={item.status}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={svgColors[item.status] || '#94a3b8'}
                        strokeWidth="20"
                        strokeDasharray={`${dashArray} ${piePath}`}
                        strokeDashoffset={dashOffset}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{totalOrders}</p>
                    <p className="text-xs text-slate-500">Total OPs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        {!loading && chartItems.length > 0 && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-200 flex-wrap">
            {chartItems.map((item) => (
              <div key={item.status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${chartColors[item.status] || 'bg-slate-400'}`} />
                <span className="text-xs text-slate-600">{item.label} ({item.count})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Ordens de Produção Recentes</h2>
          </div>
          <Link href="/producao/ordens" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estratégia</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progresso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Previsão</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    Nenhuma ordem de produção encontrada.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => {
                  const progress = order.quantity > 0 ? Math.round((order.quantityProduced / order.quantity) * 100) : 0;
                  const statusColor = statusColors[order.status] || 'bg-slate-100 text-slate-600';
                  const statusLabel = statusLabels[order.status] || order.status;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{order.numero}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {order.product ? `${order.product.code} — ${order.product.description}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          order.strategy === 'MTO' ? 'bg-blue-100 text-blue-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {order.strategy}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          order.priority >= 8 ? 'bg-red-100 text-red-700' : order.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600 w-16 text-right">
                            {order.quantityProduced}/{order.quantity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {order.dataFimPrevista ? new Date(order.dataFimPrevista).toLocaleDateString('pt-BR') : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/producao/ordens/${order.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
