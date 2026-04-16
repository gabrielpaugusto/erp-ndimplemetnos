'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  FileText,
  ClipboardCheck,
  Package,
  Plus,
  Eye,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  RefreshCw,
  Inbox,
  Bell,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtCurrency as formatCurrency } from '@/lib/format';

interface RecentOrder {
  id: string;
  number: string;
  supplier: string;
  total: number;
  deliveryDate: string;
  status: string;
  statusColor: string;
}

interface ApprovalItem {
  id: string;
  number: string;
  requester: string;
  description: string;
  total: number;
  priority: number;
  date: string;
}

const orderStatusColor: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  ENVIADA: 'bg-blue-100 text-blue-700',
  CONFIRMADA: 'bg-emerald-100 text-emerald-700',
  PARCIAL_RECEBIDA: 'bg-amber-100 text-amber-700',
  RECEBIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const orderStatusLabel: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada',
  CONFIRMADA: 'Confirmada',
  PARCIAL_RECEBIDA: 'Parcial Recebida',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
};

interface StockAlert {
  id: string;
  code: string;
  description: string;
  qty: number;
  severity: 'CRITICO' | 'ALERTA';
}

export default function ComprasDashboardPage() {
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);
  const [sefazSyncing, setSefazSyncing] = useState(false);
  const [dismissAlerts, setDismissAlerts] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);

  // KPI state
  const [pedidosPendentes, setPedidosPendentes] = useState(0);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);
  const [valorTotalMes, setValorTotalMes] = useState(0);
  const [cotacoesEmAndamento, setCotacoesEmAndamento] = useState(0);
  const [cotacoesVencendo, setCotacoesVencendo] = useState(0);
  const [pedidosEntregaSemana, setPedidosEntregaSemana] = useState(0);

  const criticalAlerts = stockAlerts.filter((a) => a.severity === 'CRITICO');
  const alertCount = stockAlerts.length;

  useEffect(() => {
    // Fetch recent purchase orders
    api<{ data: any[]; meta: any }>('/purchasing/orders', { params: { limit: 5 } })
      .then((result) => {
        const mapped: RecentOrder[] = result.data.map((o) => ({
          id: o.id,
          number: o.numero,
          supplier: o.supplier?.razaoSocial ?? o.supplier?.nomeFantasia ?? '',
          total: Number(o.totalValue ?? 0),
          deliveryDate: o.dataEntregaPrevista ?? '',
          status: orderStatusLabel[o.status] ?? o.status,
          statusColor: orderStatusColor[o.status] ?? 'bg-slate-100 text-slate-600',
        }));
        setRecentOrders(mapped);
      })
      .catch(() => {});

    // Fetch purchase orders stats
    api<{ byStatus: { status: string; count: number; totalValue: any }[]; totals: { count: number; totalValue: any } }>('/purchasing/orders/stats')
      .then((stats) => {
        const openStatuses = ['RASCUNHO', 'ENVIADA', 'CONFIRMADA', 'PARCIAL_RECEBIDA'];
        const open = (stats.byStatus ?? []).filter((s) => openStatuses.includes(s.status)).reduce((sum, s) => sum + s.count, 0);
        setPedidosPendentes(open);
        setValorTotalMes(Number(stats.totals?.totalValue ?? 0));
      })
      .catch(() => {});

    // Fetch purchase requests for approval queue (SOLICITADA status)
    api<{ data: any[]; meta: any }>('/purchasing/requests', { params: { status: 'SOLICITADA', limit: 5 } })
      .then((result) => {
        const mapped: ApprovalItem[] = result.data.map((r) => ({
          id: r.id,
          number: r.numero,
          requester: r.solicitante?.name ?? '',
          description: r.description ?? '',
          total: Number(r.totalEstimated ?? 0),
          priority: r.priority ?? 5,
          date: r.dataSolicitacao ?? r.createdAt ?? '',
        }));
        setApprovalQueue(mapped);
      })
      .catch(() => {});

    // Fetch requests stats for pending count
    api<{ byStatus: { status: string; count: number }[] }>('/purchasing/requests/stats')
      .then((stats) => {
        const pendingStatuses = ['RASCUNHO', 'SOLICITADA'];
        const pending = (stats.byStatus ?? []).filter((s) => pendingStatuses.includes(s.status)).reduce((sum, s) => sum + s.count, 0);
        setSolicitacoesPendentes(pending);
      })
      .catch(() => {});

    // Fetch quotations stats
    api<{ data: any[]; meta: any }>('/purchasing/quotations', { params: { status: 'PENDENTE', limit: 1 } })
      .then((result) => {
        const total = result.meta?.total ?? result.data?.length ?? 0;
        setCotacoesEmAndamento(total);
        // Conta cotações vencendo em 3 dias
        const em3dias = new Date();
        em3dias.setDate(em3dias.getDate() + 3);
        const vencendo = (result.data ?? []).filter((q: any) => {
          if (!q.dataValidade) return false;
          const validade = new Date(q.dataValidade);
          return validade <= em3dias && validade >= new Date();
        }).length;
        setCotacoesVencendo(vencendo);
      })
      .catch(() => {});

    // Fetch pedidos com entrega esta semana
    api<{ data: any[]; meta: any }>('/purchasing/orders', { params: { limit: 100 } })
      .then((result) => {
        const hoje = new Date();
        const fimSemana = new Date();
        fimSemana.setDate(hoje.getDate() + 7);
        const entregaSemana = (result.data ?? []).filter((o: any) => {
          if (!o.dataEntregaPrevista) return false;
          const d = new Date(o.dataEntregaPrevista);
          return d >= hoje && d <= fimSemana && !['RECEBIDA', 'CANCELADA'].includes(o.status);
        }).length;
        setPedidosEntregaSemana(entregaSemana);
      })
      .catch(() => {});

    // Fetch stock alerts
    api<any[]>('/inventory/alerts')
      .then((data) => {
        const mapped: StockAlert[] = (data ?? []).map((a, idx) => ({
          id: a.id ?? String(idx),
          code: a.productCode ?? '',
          description: a.productDescription ?? '',
          qty: Number(a.currentStock ?? 0),
          severity: Number(a.currentStock) <= Number(a.estoqueMinimo) ? 'CRITICO' : 'ALERTA',
        }));
        setStockAlerts(mapped);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
          <p className="text-slate-500 mt-1">
            Painel de gestao de compras, solicitacoes e fornecedores
          </p>
        </div>
        <button
          onClick={() => { setSefazSyncing(true); setTimeout(() => setSefazSyncing(false), 2000); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${sefazSyncing ? 'animate-spin text-amber-600' : ''}`} />
          {sefazSyncing ? 'Sincronizando...' : 'Sincronizar SEFAZ'}
        </button>
      </div>

      {/* ── ALERTAS DE ESTOQUE WIDGET ── */}
      {!dismissAlerts && alertCount > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-red-900">Alertas de Estoque</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                    {alertCount}
                  </span>
                </div>
                <p className="text-xs text-red-700 mt-0.5">
                  {criticalAlerts.length} produto(s) com estoque zerado · requer reposicao imediata
                </p>

                {/* Compact list of critical items */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {stockAlerts.slice(0, 4).map((alert) => (
                    <span
                      key={alert.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        alert.severity === 'CRITICO'
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : 'bg-orange-100 text-orange-800 border-orange-200'
                      }`}
                    >
                      {alert.severity === 'CRITICO' && <XCircle className="w-3 h-3" />}
                      {alert.severity === 'ALERTA' && <AlertTriangle className="w-3 h-3" />}
                      {alert.code}: {alert.qty === 0 ? 'ZERADO' : `${alert.qty} un`}
                    </span>
                  ))}
                  {alertCount > 4 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      +{alertCount - 4} mais
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/estoque/alertas"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Ver Todos Alertas
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setDismissAlerts(true)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                title="Fechar"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SEFAZ NF-e pending notice */}
          <div className="mt-4 pt-4 border-t border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-red-700">
              <Inbox className="w-3.5 h-3.5" />
              <span><strong>3 NF-es pendentes</strong> na caixa de entrada SEFAZ aguardando manifestacao</span>
            </div>
            <Link
              href="/compras/nfe-entrada"
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 underline"
            >
              Ver Caixa de Entrada <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Solicitacoes Pendentes</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{solicitacoesPendentes}</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-amber-600 font-medium">aguardando aprovacao</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cotacoes em Andamento</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{cotacoesEmAndamento}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-slate-500">
              {cotacoesVencendo > 0 ? `${cotacoesVencendo} vencem em 3 dias` : 'Nenhuma vencendo em breve'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pedidos Abertos</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{pedidosPendentes}</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <Package className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">
              {pedidosEntregaSemana > 0 ? `${pedidosEntregaSemana} com entrega esta semana` : 'Nenhuma entrega prevista'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total Compras</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(valorTotalMes)}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">acumulado geral</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/compras/solicitacoes/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitacao
        </Link>
        <Link
          href="/compras/cotacoes/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Cotacao
        </Link>
        <Link
          href="/compras/pedidos/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido de Compra
        </Link>
      </div>

      {/* Approval Queue */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Fila de Aprovacao</h2>
          </div>
          <Link href="/compras/solicitacoes" className="text-sm text-amber-600 hover:text-amber-700 font-medium">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Est.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvalQueue.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma solicitacao pendente.</td></tr>
              ) : approvalQueue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.number}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.requester}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.description}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      item.priority >= 8 ? 'bg-red-100 text-red-700' : item.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(item.total)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/compras/solicitacoes/${item.id}`}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors inline-flex"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Purchase Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">Pedidos de Compra Recentes</h2>
          </div>
          <Link href="/compras/pedidos" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrega</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Carregando...</td></tr>
              ) : recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{order.number}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{order.supplier}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${order.statusColor}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/compras/pedidos/${order.id}`}
                      className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors inline-flex"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
