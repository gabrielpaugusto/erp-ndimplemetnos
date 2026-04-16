'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Send,
  Package,
  ShoppingCart,
  Users,
  Calendar,
  DollarSign,
  Truck,
} from 'lucide-react';
import { api } from '@/lib/api';

type OrderStatus = 'RASCUNHO' | 'ENVIADA' | 'CONFIRMADA' | 'PARCIAL_RECEBIDA' | 'RECEBIDA' | 'CANCELADA';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const statusLabels: Record<OrderStatus, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada',
  CONFIRMADA: 'Confirmada',
  PARCIAL_RECEBIDA: 'Parcial Recebida',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<OrderStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  ENVIADA: 'bg-blue-100 text-blue-700',
  CONFIRMADA: 'bg-emerald-100 text-emerald-700',
  PARCIAL_RECEBIDA: 'bg-amber-100 text-amber-700',
  RECEBIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

interface OrderData {
  id: string;
  number: string;
  status: OrderStatus;
  supplier: { name: string; cnpj: string; contact: string; phone: string };
  linkedRequest: string;
  linkedRequestId: string;
  deliveryDate: string;
  paymentCondition: string;
  frete: number;
  desconto: number;
  subtotal: number;
  total: number;
  createdAt: string;
  timeline: {
    RASCUNHO: string | null;
    ENVIADA: string | null;
    CONFIRMADA: string | null;
    PARCIAL_RECEBIDA: string | null;
    RECEBIDA: string | null;
  };
}

interface OrderItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  icms: number;
  ipi: number;
  received: number;
  receivingQty: string;
}

function mapApiOrder(data: any): OrderData {
  return {
    id: data.id,
    number: data.numero ?? '',
    status: data.status as OrderStatus,
    supplier: {
      name: data.supplier?.razaoSocial ?? data.supplier?.nomeFantasia ?? '',
      cnpj: data.supplier?.cpfCnpj ?? '',
      contact: '',
      phone: '',
    },
    linkedRequest: data.purchaseRequest?.numero ?? '',
    linkedRequestId: data.purchaseRequest?.id ?? '',
    deliveryDate: data.dataEntregaPrevista ?? '',
    paymentCondition: data.condicaoPagamento ?? '',
    frete: Number(data.frete ?? 0),
    desconto: Number(data.desconto ?? 0),
    subtotal: Number(data.subtotal ?? 0),
    total: Number(data.totalValue ?? 0),
    createdAt: data.createdAt ?? '',
    timeline: {
      RASCUNHO: data.createdAt ?? null,
      ENVIADA: data.status === 'ENVIADA' || data.status === 'CONFIRMADA' || data.status === 'PARCIAL_RECEBIDA' || data.status === 'RECEBIDA' ? (data.updatedAt ?? data.createdAt) : null,
      CONFIRMADA: data.status === 'CONFIRMADA' || data.status === 'PARCIAL_RECEBIDA' || data.status === 'RECEBIDA' ? (data.updatedAt ?? null) : null,
      PARCIAL_RECEBIDA: data.status === 'PARCIAL_RECEBIDA' ? (data.updatedAt ?? null) : null,
      RECEBIDA: data.status === 'RECEBIDA' ? (data.dataEntregaReal ?? data.updatedAt ?? null) : null,
    },
  };
}

function mapApiItems(data: any): OrderItem[] {
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    code: item.product?.code ?? '',
    name: item.product?.description ?? '',
    unit: item.unit ?? item.product?.unit ?? 'UN',
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? 0),
    icms: Number(item.icms ?? 0),
    ipi: Number(item.ipi ?? 0),
    received: Number(item.quantityReceived ?? 0),
    receivingQty: '',
  }));
}

export default function PedidoCompraDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = () => {
    setLoading(true);
    api<any>(`/purchasing/orders/${id}`)
      .then((data) => {
        setOrder(mapApiOrder(data));
        setItems(mapApiItems(data));
        setNotFound(false);
      })
      .catch((err) => {
        if (err?.message?.includes('not found') || err?.message?.includes('404')) {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) fetchOrder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAction = async (action: 'send' | 'confirm' | 'receive' | 'cancel') => {
    if (!order) return;
    setActionLoading(true);
    try {
      if (action === 'receive') {
        const receiveItems = items
          .filter((i) => parseFloat(i.receivingQty) > 0)
          .map((i) => ({ id: i.id, quantityReceived: parseFloat(i.receivingQty) }));
        await api(`/purchasing/orders/${id}/receive`, { method: 'POST', body: JSON.stringify({ items: receiveItems }) });
      } else {
        await api(`/purchasing/orders/${id}/${action}`, { method: 'POST' });
      }
      fetchOrder();
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao executar acao');
    } finally {
      setActionLoading(false);
    }
  };

  const statusSteps: OrderStatus[] = ['RASCUNHO', 'ENVIADA', 'CONFIRMADA', 'PARCIAL_RECEBIDA', 'RECEBIDA'];
  const statusOrder: Record<OrderStatus, number> = {
    RASCUNHO: 0, ENVIADA: 1, CONFIRMADA: 2, PARCIAL_RECEBIDA: 3, RECEBIDA: 4, CANCELADA: -1,
  };

  const updateReceiving = (itemId: string, value: string) => {
    setItems(items.map((i) => (i.id === itemId ? { ...i, receivingQty: value } : i)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-slate-400 text-sm">Carregando pedido...</span>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-slate-700 text-lg font-semibold">Pedido nao encontrado</span>
        <Link href="/compras/pedidos" className="text-amber-600 hover:underline text-sm">Voltar para Pedidos</Link>
      </div>
    );
  }

  const currentOrder = statusOrder[order.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/compras/pedidos" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.number}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">{order.supplier.name} — Entrega: {new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="flex items-center gap-2">
          {order.status === 'RASCUNHO' && (
            <button onClick={() => handleAction('send')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-4 h-4" /> Enviar</button>
          )}
          {order.status === 'ENVIADA' && (
            <button onClick={() => handleAction('confirm')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><CheckCircle className="w-4 h-4" /> Confirmar</button>
          )}
          {(order.status === 'CONFIRMADA' || order.status === 'PARCIAL_RECEBIDA') && (
            <button onClick={() => handleAction('receive')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Package className="w-4 h-4" /> Registrar Recebimento</button>
          )}
          {order.status !== 'RECEBIDA' && order.status !== 'CANCELADA' && (
            <button onClick={() => handleAction('cancel')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><XCircle className="w-4 h-4" /> Cancelar</button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Timeline do Pedido</h2>
        <div className="flex items-center gap-2">
          {statusSteps.map((status, index) => {
            const stepOrder = statusOrder[status];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = status === order.status;
            const stepDate = order.timeline[status as keyof typeof order.timeline];
            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-amber-600 text-white ring-4 ring-amber-100' : isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {isActive && !isCurrent ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-amber-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{statusLabels[status]}</span>
                  {stepDate && <span className="text-[10px] text-slate-400 mt-0.5">{new Date(stepDate).toLocaleDateString('pt-BR')}</span>}
                </div>
                {index < statusSteps.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-amber-600" /><h3 className="text-sm font-semibold text-slate-700">Fornecedor</h3></div>
          <p className="text-sm font-semibold text-slate-900">{order.supplier.name}</p>
          <p className="text-xs text-slate-500 mt-1">CNPJ: {order.supplier.cnpj}</p>
          <p className="text-xs text-slate-500">Contato: {order.supplier.contact}</p>
          <p className="text-xs text-slate-500">Fone: {order.supplier.phone}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3"><DollarSign className="w-5 h-5 text-amber-600" /><h3 className="text-sm font-semibold text-slate-700">Valores</h3></div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Subtotal:</span><span className="text-slate-700">{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Frete:</span><span className="text-slate-700">{formatCurrency(order.frete)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Desconto:</span><span className="text-slate-700">{formatCurrency(order.desconto)}</span></div>
            <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-1 mt-1"><span className="text-slate-700">Total:</span><span className="text-amber-700">{formatCurrency(order.total)}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-amber-600" /><h3 className="text-sm font-semibold text-slate-700">Detalhes</h3></div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Pagamento:</span><span className="text-slate-700">{order.paymentCondition}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Entrega:</span><span className="text-slate-700">{new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Solicitacao:</span>{order.linkedRequest ? <Link href={`/compras/solicitacoes/${order.linkedRequestId}`} className="text-amber-600 hover:underline font-medium">{order.linkedRequest}</Link> : <span className="text-slate-500">—</span>}</div>
          </div>
        </div>
      </div>

      {/* Items with receiving */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Itens do Pedido</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Und</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pedido</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recebido</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Progresso</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preco Unit.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtotal</th>
                {(order.status === 'CONFIRMADA' || order.status === 'PARCIAL_RECEBIDA') && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Receber</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const progress = item.quantity > 0 ? Math.round((item.received / item.quantity) * 100) : 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.code}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-center">{item.unit}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-center">{item.received}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    {(order.status === 'CONFIRMADA' || order.status === 'PARCIAL_RECEBIDA') && (
                      <td className="px-4 py-3">
                        <input type="number" value={item.receivingQty} onChange={(e) => updateReceiving(item.id, e.target.value)} placeholder="0" min="0" max={item.quantity - item.received} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" />
                      </td>
                    )}
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
