'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Play,
  ClipboardCheck,
  MapPin,
  Calendar,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency as formatCurrency } from '@/lib/format';

type InventoryStatus = 'PLANEJADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

const statusLabels: Record<InventoryStatus, string> = {
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<InventoryStatus, string> = {
  PLANEJADO: 'bg-slate-100 text-slate-600',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
  CONCLUIDO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  systemQty: number;
  countedQty: string;
  avgCost: number;
  justification: string;
}

interface InventoryData {
  id: string;
  numero: string;
  status: InventoryStatus;
  location: string;
  locationName: string;
  description: string;
  dateFrom: string;
  dateTo: string | null;
  createdBy: string;
  timeline: {
    PLANEJADO: string | null;
    EM_ANDAMENTO: string | null;
    CONCLUIDO: string | null;
  };
}

export default function InventarioDetailPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/inventory/inventories/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();

      setInventory({
        id: data.id,
        numero: data.numero,
        status: data.status as InventoryStatus,
        location: data.location?.code ?? '',
        locationName: data.location?.name ?? '',
        description: data.description ?? '',
        dateFrom: data.dataInicio ?? data.createdAt,
        dateTo: data.dataFim ?? null,
        createdBy: data.responsavel?.name ?? '',
        timeline: {
          PLANEJADO: data.createdAt ?? null,
          EM_ANDAMENTO: data.status !== 'PLANEJADO' ? data.dataInicio ?? null : null,
          CONCLUIDO: data.dataFim ?? null,
        },
      });

      setItems(
        (data.items ?? []).map((item: any) => ({
          id: item.id,
          code: item.product?.code ?? '',
          name: item.product?.description ?? item.product?.name ?? '',
          unit: item.product?.unit ?? '',
          systemQty: Number(item.quantidadeSistema ?? 0),
          countedQty: item.quantidadeContada !== null && item.quantidadeContada !== undefined
            ? String(item.quantidadeContada)
            : '',
          avgCost: Number(item.custoUnitario ?? 0),
          justification: item.justificativa ?? '',
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const updateCounted = (itemId: string, value: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, countedQty: value } : i)));
  };

  const updateJustification = (itemId: string, value: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, justification: value } : i)));
  };

  const saveItemCount = async (item: InventoryItem) => {
    const qty = parseFloat(item.countedQty);
    if (isNaN(qty)) return;
    try {
      await apiFetch(`/api/inventory/inventories/${id}/count/${item.id}`, {
        method: 'POST',
        body: JSON.stringify({
          quantidadeContada: qty,
          justificativa: item.justification,
        }),
      });
    } catch {
      // Silent — local state already updated
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/inventory/inventories/${id}/start`, { method: 'POST' });
      if (res.ok) await fetchInventory();
      else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erro ao iniciar inventario');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    setActionLoading(true);
    try {
      // Save any pending counts first
      await Promise.all(
        items
          .filter((i) => i.countedQty !== '')
          .map((i) => saveItemCount(i))
      );
      const res = await apiFetch(`/api/inventory/inventories/${id}/finish`, { method: 'POST' });
      if (res.ok) {
        setShowConfirmation(false);
        await fetchInventory();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erro ao finalizar inventario');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar este inventario?')) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/inventory/inventories/${id}/cancel`, { method: 'POST' });
      if (res.ok) await fetchInventory();
      else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erro ao cancelar inventario');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Carregando inventario...
      </div>
    );
  }

  if (notFound || !inventory) {
    return (
      <div className="space-y-4">
        <Link href="/estoque/inventario" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="text-center py-20 text-slate-500">Inventario não encontrado.</div>
      </div>
    );
  }

  const statusSteps: InventoryStatus[] = ['PLANEJADO', 'EM_ANDAMENTO', 'CONCLUIDO'];
  const statusOrder: Record<InventoryStatus, number> = { PLANEJADO: 0, EM_ANDAMENTO: 1, CONCLUIDO: 2, CANCELADO: -1 };
  const currentOrder = statusOrder[inventory.status];

  const countedItems = items.filter((i) => i.countedQty !== '').length;
  const pendingItems = items.length - countedItems;
  const differencesItems = items.filter((i) => {
    const counted = parseFloat(i.countedQty);
    return !isNaN(counted) && counted !== i.systemQty;
  });

  const totalDifferenceValue = differencesItems.reduce((sum, i) => {
    const counted = parseFloat(i.countedQty) || 0;
    return sum + (counted - i.systemQty) * i.avgCost;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/estoque/inventario" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{inventory.numero}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[inventory.status]}`}>{statusLabels[inventory.status]}</span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">{inventory.description} — {inventory.locationName}</p>
        </div>
        <div className="flex items-center gap-2">
          {inventory.status === 'PLANEJADO' && (
            <button onClick={handleStart} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50">
              <Play className="w-4 h-4" /> Iniciar
            </button>
          )}
          {inventory.status === 'EM_ANDAMENTO' && (
            <button onClick={() => setShowConfirmation(true)} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50">
              <CheckCircle className="w-4 h-4" /> Finalizar
            </button>
          )}
          {inventory.status !== 'CONCLUIDO' && inventory.status !== 'CANCELADO' && (
            <button onClick={handleCancel} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50">
              <XCircle className="w-4 h-4" /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">Confirmar Finalizacao do Inventario</h3>
              <p className="text-sm text-slate-700 mt-1">Ao finalizar, os seguintes ajustes serao gerados automaticamente:</p>
              <div className="mt-3 space-y-1">
                {differencesItems.map((item) => {
                  const counted = parseFloat(item.countedQty) || 0;
                  const diff = counted - item.systemQty;
                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{item.name} ({item.code})</span>
                      <span className={`font-bold ${diff > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {diff > 0 ? '+' : ''}{diff} {item.unit} ({formatCurrency(diff * item.avgCost)})
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-amber-300 pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span>Valor total dos ajustes:</span>
                  <span className={totalDifferenceValue >= 0 ? 'text-emerald-700' : 'text-red-600'}>{formatCurrency(totalDifferenceValue)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button onClick={() => setShowConfirmation(false)} className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">Voltar</button>
                <button onClick={handleFinish} disabled={actionLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50">Confirmar e Gerar Ajustes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Timeline</h2>
        <div className="flex items-center gap-2">
          {statusSteps.map((status, index) => {
            const stepOrder = statusOrder[status];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = status === inventory.status;
            const stepDate = inventory.timeline[status as keyof typeof inventory.timeline];
            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-cyan-600 text-white ring-4 ring-cyan-100' : isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {isActive && !isCurrent ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-cyan-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{statusLabels[status]}</span>
                  {stepDate && <span className="text-[10px] text-slate-400 mt-0.5">{new Date(stepDate).toLocaleDateString('pt-BR')}</span>}
                </div>
                {index < statusSteps.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-2"><Package className="w-5 h-5 text-cyan-600" /><h3 className="text-sm font-semibold text-slate-700">Total Itens</h3></div>
          <p className="text-2xl font-bold text-slate-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-5 h-5 text-emerald-600" /><h3 className="text-sm font-semibold text-slate-700">Contados</h3></div>
          <p className="text-2xl font-bold text-emerald-700">{countedItems}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-2"><ClipboardCheck className="w-5 h-5 text-amber-600" /><h3 className="text-sm font-semibold text-slate-700">Pendentes</h3></div>
          <p className="text-2xl font-bold text-amber-600">{pendingItems}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5 text-red-600" /><h3 className="text-sm font-semibold text-slate-700">Valor Diferenca</h3></div>
          <p className={`text-2xl font-bold ${totalDifferenceValue >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(totalDifferenceValue)}</p>
        </div>
      </div>

      {/* Location Info */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1"><MapPin className="w-4 h-4 text-teal-600" /><span className="text-slate-500">Local:</span><span className="font-medium text-slate-900">{inventory.locationName} ({inventory.location})</span></div>
          <div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-slate-400" /><span className="text-slate-500">Inicio:</span><span className="font-medium text-slate-900">{new Date(inventory.dateFrom).toLocaleDateString('pt-BR')}</span></div>
          {inventory.dateTo && (
            <div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-slate-400" /><span className="text-slate-500">Fim:</span><span className="font-medium text-slate-900">{new Date(inventory.dateTo).toLocaleDateString('pt-BR')}</span></div>
          )}
          {inventory.createdBy && (
            <div><span className="text-slate-500">Responsavel:</span> <span className="font-medium text-slate-900">{inventory.createdBy}</span></div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-cyan-600" />
          <h2 className="text-lg font-semibold text-slate-900">Itens do Inventario</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Und</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd Sistema</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Qtd Contada</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Diferenca</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Dif.</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Justificativa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const counted = parseFloat(item.countedQty);
                const hasCounted = !isNaN(counted);
                const diff = hasCounted ? counted - item.systemQty : 0;
                const diffValue = diff * item.avgCost;
                const hasDiff = hasCounted && diff !== 0;

                return (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${hasDiff ? (diff > 0 ? 'bg-emerald-50/30' : 'bg-red-50/30') : ''}`}>
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">{item.code}</td>
                    <td className="px-3 py-2 text-sm text-slate-900 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 text-center">{item.unit}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-900 text-center">{item.systemQty}</td>
                    <td className="px-3 py-2">
                      {inventory.status === 'EM_ANDAMENTO' ? (
                        <input
                          type="number"
                          value={item.countedQty}
                          onChange={(e) => updateCounted(item.id, e.target.value)}
                          onBlur={() => saveItemCount(item)}
                          placeholder="-"
                          min="0"
                          className={`w-full px-2 py-1.5 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 ${hasDiff ? (diff > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-slate-300'}`}
                        />
                      ) : (
                        <span className="text-sm font-semibold text-center block">{item.countedQty || '-'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {hasCounted ? (
                        <span className={`text-sm font-bold ${diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {hasDiff ? (
                        <span className={`text-sm font-semibold ${diffValue > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(diffValue)}</span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {inventory.status === 'EM_ANDAMENTO' ? (
                        <input
                          type="text"
                          value={item.justification}
                          onChange={(e) => updateJustification(item.id, e.target.value)}
                          onBlur={() => saveItemCount(item)}
                          placeholder={hasDiff ? 'Justifique...' : ''}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      ) : (
                        <span className="text-xs text-slate-600">{item.justification || '-'}</span>
                      )}
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
