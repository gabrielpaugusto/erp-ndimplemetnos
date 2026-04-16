'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Truck,
  User,
  Wrench,
  FileText,
  Package,
  Clock,
  Send,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type OSStatus = 'ABERTA' | 'AGUARDANDO_PECAS' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'ENTREGUE' | 'CANCELADA';

const statusLabels: Record<OSStatus, string> = {
  ABERTA: 'Aberta',
  AGUARDANDO_PECAS: 'Aguardando Pecas',
  EM_EXECUCAO: 'Em Execução',
  CONCLUIDA: 'Concluída',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<OSStatus, string> = {
  ABERTA: 'bg-slate-100 text-slate-600',
  AGUARDANDO_PECAS: 'bg-amber-100 text-amber-700',
  EM_EXECUCAO: 'bg-rose-100 text-rose-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  ENTREGUE: 'bg-blue-100 text-blue-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const priorityColors: Record<string, string> = {
  URGENTE: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  BAIXA: 'bg-gray-100 text-gray-600',
};

interface OSItem {
  id: string;
  description: string;
  type: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface LinkedRequisition {
  id: string;
  number: string;
  type: string;
  status: string;
  statusColor: string;
  date: string;
}

interface LinkedCalderaria {
  id: string;
  number: string;
  serviceType: string;
  status: string;
  statusColor: string;
}

interface OrderData {
  id: string;
  number: string;
  status: OSStatus;
  type: string;
  priority: string;
  client: {
    name: string;
    cpfCnpj: string;
    phone?: string;
    email?: string;
  };
  vehicle: {
    description: string;
    plate: string;
    chassi: string;
    km: number | null;
  };
  defeitoRelatado: string;
  diagnostico: string;
  solucao: string;
  entryDate: string;
  expectedDate: string;
  timeline: {
    aberta: string | null;
    aguardandoPecas: string | null;
    emExecucao: string | null;
    concluida: string | null;
    entregue: string | null;
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const itemTypeLabels: Record<string, string> = {
  PECA: 'Peca',
  SERVICO: 'Servico',
  TERCEIRO: 'Terceiro',
};

const itemTypeColors: Record<string, string> = {
  PECA: 'bg-rose-100 text-rose-700',
  SERVICO: 'bg-blue-100 text-blue-700',
  TERCEIRO: 'bg-purple-100 text-purple-700',
};

const REQ_STATUS_COLOR: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  SOLICITADA: 'bg-cyan-100 text-cyan-700',
  APROVADA: 'bg-blue-100 text-blue-700',
  SEPARADA: 'bg-amber-100 text-amber-700',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const REQ_STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  SOLICITADA: 'Solicitada',
  APROVADA: 'Aprovada',
  SEPARADA: 'Separada',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

const CLD_STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600',
  EM_EXECUCAO: 'bg-zinc-100 text-zinc-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const CLD_STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_EXECUCAO: 'Em Execução',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export default function OrdemServicoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OSItem[]>([]);
  const [requisitions, setRequisitions] = useState<LinkedRequisition[]>([]);
  const [calderariaOrders, setCalderariaOrders] = useState<LinkedCalderaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/service-orders/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();

      setOrder({
        id: data.id,
        number: data.numero,
        status: data.status as OSStatus,
        type: data.type,
        priority: data.priority,
        client: {
          name: data.person?.razaoSocial ?? data.person?.nomeFantasia ?? '—',
          cpfCnpj: data.person?.cpfCnpj ?? '—',
          phone: data.person?.phone,
          email: data.person?.email,
        },
        vehicle: {
          description: data.veiculoDescricao ?? '—',
          plate: data.veiculoPlaca ?? '—',
          chassi: data.veiculoChassi ?? '—',
          km: data.veiculoKm ?? null,
        },
        defeitoRelatado: data.defeitoRelatado ?? '—',
        diagnostico: data.diagnostico ?? '',
        solucao: data.solucao ?? '',
        entryDate: data.dataEntrada ?? '',
        expectedDate: data.dataPrevisao ?? '',
        timeline: {
          aberta: data.createdAt ?? null,
          aguardandoPecas: null,
          emExecucao: null,
          concluida: data.dataConclusao ?? null,
          entregue: data.dataEntrega ?? null,
        },
      });

      setItems(
        (data.items || []).map((item: any) => ({
          id: item.id,
          description: item.description,
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.totalPrice ?? item.quantity * item.unitPrice,
        }))
      );

      setRequisitions(
        (data.requisitions || []).map((req: any) => ({
          id: req.id,
          number: req.numero,
          type: req.type,
          status: REQ_STATUS_LABEL[req.status] ?? req.status,
          statusColor: REQ_STATUS_COLOR[req.status] ?? 'bg-slate-100 text-slate-600',
          date: req.createdAt ?? '',
        }))
      );

      setCalderariaOrders(
        (data.calderariaOrders || []).map((cld: any) => ({
          id: cld.id,
          number: cld.numero,
          serviceType: cld.serviceType ?? '—',
          status: CLD_STATUS_LABEL[cld.status] ?? cld.status,
          statusColor: CLD_STATUS_COLOR[cld.status] ?? 'bg-slate-100 text-slate-600',
        }))
      );
    } catch (err) {
      console.error('Erro ao carregar OS:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const doAction = async (endpoint: string) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/service-orders/${id}/${endpoint}`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        setActionError(errData.message || 'Erro ao executar acao.');
        return;
      }
      await loadOrder();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao executar acao.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500 text-sm">Carregando ordem de servico...</p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-slate-700 font-semibold">Ordem de servico nao encontrada.</p>
        <Link
          href="/oficina/ordens-servico"
          className="text-sm text-rose-600 hover:text-rose-700 underline"
        >
          Voltar para a lista
        </Link>
      </div>
    );
  }

  const statusSteps: OSStatus[] = ['ABERTA', 'AGUARDANDO_PECAS', 'EM_EXECUCAO', 'CONCLUIDA', 'ENTREGUE'];
  const statusOrder: Record<OSStatus, number> = {
    ABERTA: 0, AGUARDANDO_PECAS: 1, EM_EXECUCAO: 2, CONCLUIDA: 3, ENTREGUE: 4, CANCELADA: -1,
  };
  const currentOrder = statusOrder[order.status];

  const totalPecas = items.filter((i) => i.type === 'PECA').reduce((s, i) => s + i.total, 0);
  const totalServicos = items.filter((i) => i.type === 'SERVICO' || i.type === 'TERCEIRO').reduce((s, i) => s + i.total, 0);
  const totalGeral = totalPecas + totalServicos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/oficina/ordens-servico"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.number}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700">
              {order.type}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${priorityColors[order.priority] ?? 'bg-blue-100 text-blue-700'}`}>
              {order.priority}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Entrada: {order.entryDate ? new Date(order.entryDate).toLocaleDateString('pt-BR') : '—'}
            {order.expectedDate ? ` — Previsao: ${new Date(order.expectedDate).toLocaleDateString('pt-BR')}` : ''}
          </p>
        </div>

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2">
          {order.status === 'ABERTA' && (
            <button
              onClick={() => doAction('start')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Iniciar
            </button>
          )}
          {order.status === 'EM_EXECUCAO' && (
            <>
              <button
                onClick={() => doAction('wait-parts')}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Pause className="w-4 h-4" />
                Aguardar Pecas
              </button>
              <button
                onClick={() => doAction('complete')}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Concluir
              </button>
            </>
          )}
          {order.status === 'AGUARDANDO_PECAS' && (
            <button
              onClick={() => doAction('start')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Retomar Execucao
            </button>
          )}
          {order.status === 'CONCLUIDA' && (
            <button
              onClick={() => doAction('deliver')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Entregar
            </button>
          )}
          {order.status !== 'ENTREGUE' && order.status !== 'CANCELADA' && order.status !== 'CONCLUIDA' && (
            <button
              onClick={() => doAction('cancel')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Status da Ordem de Servico</h2>
        <div className="flex items-center gap-2">
          {statusSteps.map((status, index) => {
            const stepOrder = statusOrder[status];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = status === order.status;
            const dateKey = status === 'ABERTA' ? 'aberta' : status === 'AGUARDANDO_PECAS' ? 'aguardandoPecas' : status === 'EM_EXECUCAO' ? 'emExecucao' : status === 'CONCLUIDA' ? 'concluida' : 'entregue';
            const stepDate = order.timeline[dateKey as keyof typeof order.timeline];

            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent
                        ? 'bg-rose-600 text-white ring-4 ring-rose-100'
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
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-rose-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
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

      {/* Vehicle & Client Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-semibold text-slate-900">Veiculo</h2>
          </div>
          <p className="text-sm font-semibold text-slate-900">{order.vehicle.description}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Placa:</span>
              <span className="font-bold text-slate-900 font-mono">{order.vehicle.plate}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Chassi:</span>
              <span className="font-medium text-slate-700 font-mono">{order.vehicle.chassi}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">KM:</span>
              <span className="font-medium text-slate-700">
                {order.vehicle.km !== null ? `${order.vehicle.km.toLocaleString('pt-BR')} km` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-semibold text-slate-900">Cliente</h2>
          </div>
          <p className="text-sm font-semibold text-slate-900">{order.client.name}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">CNPJ:</span>
              <span className="font-medium text-slate-700">{order.client.cpfCnpj}</span>
            </div>
            {order.client.phone && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Telefone:</span>
                <span className="font-medium text-slate-700">{order.client.phone}</span>
              </div>
            )}
            {order.client.email && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">E-mail:</span>
                <span className="font-medium text-slate-700">{order.client.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Defeito / Diagnostico / Solucao */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-semibold text-slate-900">Defeito Relatado</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{order.defeitoRelatado}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-900">Diagnostico</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{order.diagnostico || '—'}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-slate-900">Solucao</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{order.solucao || '—'}</p>
        </div>
      </div>

      {/* Items/Services Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Itens e Servicos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preco Unit.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-sm text-slate-400">Nenhum item cadastrado.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${itemTypeColors[item.type] || 'bg-slate-100 text-slate-600'}`}>
                        {itemTypeLabels[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(item.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Pecas:</span>
                <span className="font-medium text-slate-700">{formatCurrency(totalPecas)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Mao de Obra:</span>
                <span className="font-medium text-slate-700">{formatCurrency(totalServicos)}</span>
              </div>
              <div className="flex items-center justify-between text-base pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Total Geral:</span>
                <span className="font-bold text-rose-700">{formatCurrency(totalGeral)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Requisitions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Requisicoes Vinculadas</h2>
        </div>
        <div className="space-y-2">
          {requisitions.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma requisicao vinculada.</p>
          ) : (
            requisitions.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <Link href={`/requisicoes/${req.id}`} className="text-sm font-medium text-teal-600 hover:text-teal-700">
                    {req.number}
                  </Link>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                    {req.type}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${req.statusColor}`}>
                    {req.status}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{req.date ? new Date(req.date).toLocaleDateString('pt-BR') : '—'}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Linked Calderaria Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Ordens de Calderaria Vinculadas</h2>
        </div>
        <div className="space-y-2">
          {calderariaOrders.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma ordem de calderaria vinculada.</p>
          ) : (
            calderariaOrders.map((cld) => (
              <div key={cld.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <Link href={`/calderaria/ordens/${cld.id}`} className="text-sm font-medium text-zinc-600 hover:text-zinc-700">
                    {cld.number}
                  </Link>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700">
                    {cld.serviceType}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cld.statusColor}`}>
                    {cld.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
