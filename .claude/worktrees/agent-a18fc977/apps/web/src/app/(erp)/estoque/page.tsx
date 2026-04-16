'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  AlertTriangle,
  ArrowUpDown,
  MapPin,
  Plus,
  DollarSign,
  TrendingDown,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface AlertItem {
  productId: string;
  productCode: string;
  productDescription: string;
  unit: string;
  currentStock: number;
  reorderPoint: number;
  estoqueMinimo: number;
  locations: Array<{ locationCode: string; locationName: string }>;
}

interface RecentMovement {
  id: string;
  date: string;
  product?: { code: string; description: string } | null;
  type: string;
  quantity: number;
  location?: { code: string; name: string } | null;
  locationDestination?: { code: string; name: string } | null;
  user?: { name: string } | null;
}

interface StockLocation {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
  _count?: { stockBalances: number };
}

const typeColors: Record<string, string> = {
  ENTRADA: 'bg-emerald-100 text-emerald-700',
  SAIDA: 'bg-red-100 text-red-700',
  TRANSFERENCIA: 'bg-blue-100 text-blue-700',
  AJUSTE_POSITIVO: 'bg-emerald-100 text-emerald-700',
  AJUSTE_NEGATIVO: 'bg-orange-100 text-orange-700',
  CONSUMO_INTERNO: 'bg-purple-100 text-purple-700',
  DEVOLUCAO: 'bg-cyan-100 text-cyan-700',
};

const typeLabels: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saida',
  TRANSFERENCIA: 'Transferencia',
  AJUSTE_POSITIVO: 'Ajuste Positivo',
  AJUSTE_NEGATIVO: 'Ajuste Negativo',
  CONSUMO_INTERNO: 'Consumo Interno',
  DEVOLUCAO: 'Devolucao',
};

const locationTypeColors: Record<string, string> = {
  ALMOXARIFADO: 'bg-teal-100 text-teal-700',
  PRODUCAO: 'bg-amber-100 text-amber-700',
  EXPEDICAO: 'bg-emerald-100 text-emerald-700',
  QUARENTENA: 'bg-red-100 text-red-700',
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function EstoqueDashboardPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [movements, setMovements] = useState<RecentMovement[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [totalSKUs, setTotalSKUs] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [todayEntradas, setTodayEntradas] = useState(0);
  const [todaySaidas, setTodaySaidas] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [alertsRes, movementsRes, locationsRes, balancesRes] = await Promise.all([
      apiFetch('/api/inventory/alerts'),
      apiFetch('/api/inventory/movements?limit=5'),
      apiFetch('/api/inventory/locations?limit=100&active=true'),
      apiFetch('/api/inventory/balances?limit=1'),
    ]);

    if (alertsRes.ok) {
      const data = await alertsRes.json();
      setAlerts(data.data ?? data);
    }

    if (movementsRes.ok) {
      const data = await movementsRes.json();
      const list: RecentMovement[] = data.data ?? data;
      setMovements(list);

      const today = new Date().toDateString();
      const todayItems = list.filter((m) => new Date(m.date).toDateString() === today);
      setTodayEntradas(todayItems.filter((m) => m.type === 'ENTRADA').length);
      setTodaySaidas(todayItems.filter((m) => m.type === 'SAIDA').length);
    }

    if (locationsRes.ok) {
      const data = await locationsRes.json();
      setLocations(data.data ?? data);
    }

    if (balancesRes.ok) {
      const data = await balancesRes.json();
      setTotalSKUs(data.meta?.total ?? 0);
      const balanceList: Array<{ quantity: number; averageCost?: number; avgCost?: number }> =
        data.data ?? [];
      const tv = balanceList.reduce((acc, b) => {
        const cost = Number(b.averageCost ?? b.avgCost ?? 0);
        return acc + Number(b.quantity) * cost;
      }, 0);
      setTotalValue(tv);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayTotal = todayEntradas + todaySaidas;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estoque</h1>
          <p className="text-slate-500 mt-1">Painel de gestao de estoque, saldos e movimentacoes</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total SKUs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '—' : totalSKUs}</p>
            </div>
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Boxes className="w-5 h-5 text-teal-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-slate-500">Em {locations.length} locais de estoque</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total Estoque</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '—' : formatCurrency(totalValue)}</p>
            </div>
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-slate-500">Custo medio ponderado</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Abaixo do Minimo</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{loading ? '—' : alerts.length}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-red-600 font-medium">Requer reposicao urgente</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Movimentacoes Hoje</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '—' : todayTotal}</p>
            </div>
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <ArrowUpDown className="w-5 h-5 text-teal-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-emerald-600 flex items-center gap-0.5"><ArrowDownLeft className="w-3 h-3" /> {todayEntradas} entradas</span>
            <span className="text-xs text-red-600 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> {todaySaidas} saidas</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link href="/estoque/movimentacoes/nova" className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nova Movimentacao
        </Link>
        <Link href="/estoque/inventario/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Inventario
        </Link>
        <Link href="/estoque/saldos" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 text-sm font-medium transition-colors">
          <Boxes className="w-4 h-4" /> Ver Saldos
        </Link>
      </div>

      {/* Stock Alerts */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-slate-900">Alertas de Estoque — Abaixo do Ponto de Reposicao</h2>
          </div>
          <Link href="/estoque/alertas" className="text-sm text-teal-600 hover:text-teal-700 font-medium">Ver todos</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Local</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Disponivel</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ponto Reposicao</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deficit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : alerts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Nenhum alerta de estoque.</td></tr>
              ) : alerts.slice(0, 5).map((alert) => (
                <tr key={alert.productId} className="bg-red-50/50 hover:bg-red-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">{alert.productCode}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{alert.productDescription}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {alert.locations.map((l) => l.locationCode).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600 text-center">{alert.currentStock} {alert.unit}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center">{alert.reorderPoint} {alert.unit}</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-700 text-center">-{Math.max(0, alert.reorderPoint - alert.currentStock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Location Summary */}
      {locations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {locations.slice(0, 4).map((loc) => (
            <div key={loc.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-teal-600" />
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${locationTypeColors[loc.type] ?? 'bg-slate-100 text-slate-600'}`}>{loc.type}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{loc.name}</p>
              <p className="text-xs text-slate-500 font-mono">{loc.code}</p>
              <p className="text-lg font-bold text-teal-700 mt-2">{loc._count?.stockBalances ?? 0} itens</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Movements */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900">Movimentacoes Recentes</h2>
          </div>
          <Link href="/estoque/movimentacoes" className="text-sm text-teal-600 hover:text-teal-700 font-medium">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data/Hora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantidade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Local</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma movimentacao recente.</td></tr>
              ) : movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{fmtDate(mov.date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{mov.product?.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[mov.type] ?? 'bg-slate-100 text-slate-700'}`}>
                      {typeLabels[mov.type] ?? mov.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">{mov.quantity}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {mov.location?.code ?? '—'}
                    {mov.locationDestination ? ` → ${mov.locationDestination.code}` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{mov.user?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
