'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  ClipboardList,
  Package,
  Calendar,
  CheckCircle,
  XCircle,
  Play,
  Unlock,
  Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type OrderStatus = 'PLANEJADA' | 'LIBERADA' | 'EM_PRODUCAO' | 'CONCLUIDA' | 'CANCELADA';

const statusLabels: Record<OrderStatus, string> = {
  PLANEJADA: 'Planejada',
  LIBERADA: 'Liberada',
  EM_PRODUCAO: 'Em Produção',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<OrderStatus, string> = {
  PLANEJADA: 'bg-slate-100 text-slate-600',
  LIBERADA: 'bg-sky-100 text-sky-700',
  EM_PRODUCAO: 'bg-blue-100 text-blue-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

interface Material {
  id: string;
  product: { code: string; description: string; unit: string } | null;
  quantityRequired: number;
  quantityConsumed: number;
  unit: string;
}

interface Pointing {
  id: string;
  dataInicio: string;
  dataFim: string | null;
  workCenter: { code: string; name: string } | null;
  type: string;
  quantityProduced: number | null;
  quantityRejected: number | null;
  user: { name: string } | null;
}

interface ProductionOrder {
  id: string;
  numero: string;
  status: OrderStatus;
  strategy: string;
  type: string;
  priority: number;
  product: { code: string; description: string } | null;
  routing: { version: string; description: string } | null;
  saleOrder: { numero: string } | null;
  quantity: number;
  quantityProduced: number;
  dataInicioPrevista: string;
  dataFimPrevista: string;
  dataInicioReal: string | null;
  dataFimReal: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  items: Material[];
  pointings: Pointing[];
}

const typeLabels: Record<string, string> = {
  MAO_DE_OBRA: 'Mão de Obra',
  MATERIAL: 'Material',
  SETUP: 'Setup',
  PARADA: 'Parada',
};

const typeColors: Record<string, string> = {
  MAO_DE_OBRA: 'bg-blue-100 text-blue-700',
  MATERIAL: 'bg-emerald-100 text-emerald-700',
  SETUP: 'bg-amber-100 text-amber-700',
  PARADA: 'bg-red-100 text-red-700',
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return '-';
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs <= 0) return '-';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
}

export default function OrdemProducaoDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/production/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      }
    } catch (err) {
      console.error('Erro ao carregar ordem de produção:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleAction = async (action: 'release' | 'start' | 'complete' | 'cancel') => {
    if (!order) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/production/orders/${order.id}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchOrder();
      } else {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        alert(err.message || 'Erro ao executar ação');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao executar ação';
      alert(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Carregando ordem de produção...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-slate-500">Ordem de produção não encontrada.</p>
        <Link href="/producao/ordens" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const statusSteps: OrderStatus[] = ['PLANEJADA', 'LIBERADA', 'EM_PRODUCAO', 'CONCLUIDA'];
  const statusOrder: Record<OrderStatus, number> = {
    PLANEJADA: 0, LIBERADA: 1, EM_PRODUCAO: 2, CONCLUIDA: 3, CANCELADA: -1,
  };
  const currentOrder = statusOrder[order.status];
  const progress = order.quantity > 0 ? Math.round((order.quantityProduced / order.quantity) * 100) : 0;

  const timeline: Record<string, string | null> = {
    planejada: order.createdAt,
    liberada: order.status !== 'PLANEJADA' ? order.updatedAt : null,
    emProducao: order.dataInicioReal,
    concluida: order.dataFimReal,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/producao/ordens"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.numero}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
              {order.strategy}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
              order.priority >= 8 ? 'bg-red-100 text-red-700' : order.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            }`}>
              P{order.priority}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Início: {new Date(order.dataInicioPrevista).toLocaleDateString('pt-BR')} — Previsão: {new Date(order.dataFimPrevista).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2">
          {order.status === 'PLANEJADA' && (
            <button
              onClick={() => handleAction('release')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              Liberar
            </button>
          )}
          {order.status === 'LIBERADA' && (
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Iniciar Produção
            </button>
          )}
          {order.status === 'EM_PRODUCAO' && (
            <button
              onClick={() => handleAction('complete')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Concluir
            </button>
          )}
          {(order.status !== 'CONCLUIDA' && order.status !== 'CANCELADA') && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Status da Ordem</h2>
        <div className="flex items-center gap-2">
          {statusSteps.map((status, index) => {
            const stepOrder = statusOrder[status];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = status === order.status;
            const dateKey = status === 'PLANEJADA' ? 'planejada' : status === 'LIBERADA' ? 'liberada' : status === 'EM_PRODUCAO' ? 'emProducao' : 'concluida';
            const stepDate = timeline[dateKey];

            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : isActive
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isActive && !isCurrent ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-blue-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {statusLabels[status]}
                  </span>
                  {stepDate && (
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(stepDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {index < statusSteps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Product Info & Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Produto</h2>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {order.product?.description || '-'}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono">{order.product?.code || '-'}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Roteiro:</span>
              <span className="font-medium text-slate-700">
                {order.routing ? `${order.routing.description} v${order.routing.version}` : '-'}
              </span>
            </div>
            {order.saleOrder && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Pedido de Venda:</span>
                <span className="font-medium text-blue-600">
                  {order.saleOrder.numero}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Tipo:</span>
              <span className="font-medium text-slate-700">{order.type}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Progresso</h2>
          </div>
          <div className="text-center mb-4">
            <p className="text-4xl font-bold text-blue-700">{order.quantityProduced}/{order.quantity}</p>
            <p className="text-sm text-slate-500 mt-1">unidades produzidas</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm font-medium text-slate-600 mt-2">{progress}% concluído</p>
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500">Início Real</p>
              <p className="text-sm font-semibold text-slate-900">
                {order.dataInicioReal ? new Date(order.dataInicioReal).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Fim Real</p>
              <p className="text-sm font-semibold text-slate-900">
                {order.dataFimReal ? new Date(order.dataFimReal).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Materiais (Explosão BOM)</h2>
        </div>
        {order.items.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum material explodido. Libere a ordem para explodir a BOM.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Necessário</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumido</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Progresso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((mat) => {
                  const matProgress = mat.quantityRequired > 0 ? Math.round((mat.quantityConsumed / mat.quantityRequired) * 100) : 0;
                  return (
                    <tr key={mat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{mat.product?.code || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-900 font-medium">{mat.product?.description || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-center">{mat.unit || mat.product?.unit || '-'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">{mat.quantityRequired}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-700 text-center">{mat.quantityConsumed}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${matProgress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${matProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-10 text-right">{matProgress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pointings Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Apontamentos</h2>
          </div>
          <Link
            href="/producao/apontamentos/novo"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            Novo Apontamento
          </Link>
        </div>
        {order.pointings.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum apontamento registrado para esta ordem.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data/Hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro Trabalho</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duração</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produzido</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejeitado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.pointings.map((pt) => (
                  <tr key={pt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(pt.dataInicio).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {pt.workCenter ? `${pt.workCenter.code} — ${pt.workCenter.name}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[pt.type] || 'bg-slate-100 text-slate-600'}`}>
                        {typeLabels[pt.type] || pt.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 text-center">
                      {formatDuration(pt.dataInicio, pt.dataFim)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {pt.quantityProduced && pt.quantityProduced > 0 ? (
                        <span className="font-semibold text-emerald-700">{pt.quantityProduced}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {pt.quantityRejected && pt.quantityRejected > 0 ? (
                        <span className="font-semibold text-red-600">{pt.quantityRejected}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{pt.user?.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Observations */}
      {order.observations && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Observações</h2>
          <p className="text-sm text-slate-700 leading-relaxed">{order.observations}</p>
        </div>
      )}
    </div>
  );
}
