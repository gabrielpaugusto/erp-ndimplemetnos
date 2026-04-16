'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Send,
  Package,
  ShieldCheck,
  Truck,
  User,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtPercent } from '@/lib/format';

type ReqStatus = 'RASCUNHO' | 'SOLICITADA' | 'AGUARDANDO_APROVACAO' | 'APROVADA' | 'SEPARADA' | 'ENTREGUE' | 'CANCELADA';
type ReqType = 'INTERNA' | 'COMPRA' | 'TRANSFERENCIA';

const statusLabels: Record<ReqStatus, string> = {
  RASCUNHO: 'Rascunho',
  SOLICITADA: 'Solicitada',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  APROVADA: 'Aprovada',
  SEPARADA: 'Separada',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<ReqStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  SOLICITADA: 'bg-cyan-100 text-cyan-700',
  AGUARDANDO_APROVACAO: 'bg-amber-100 text-amber-800',
  APROVADA: 'bg-blue-100 text-blue-700',
  SEPARADA: 'bg-amber-100 text-amber-700',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const typeColors: Record<ReqType, string> = {
  INTERNA: 'bg-teal-100 text-teal-700',
  COMPRA: 'bg-purple-100 text-purple-700',
  TRANSFERENCIA: 'bg-blue-100 text-blue-700',
};

const typeLabels: Record<ReqType, string> = {
  INTERNA: 'Interna',
  COMPRA: 'Compra',
  TRANSFERENCIA: 'Transferencia',
};

interface ReqItem {
  id: string;
  product: string;
  code: string;
  unit: string;
  qtdSolicitada: number;
  qtdAprovada: number;
  qtdEntregue: number;
}

interface RequisitionData {
  id: string;
  number: string;
  type: ReqType;
  status: ReqStatus;
  linkedRef: string;
  linkedRefType: string;
  linkedRefId: string;
  linkedRefDescription: string;
  justificativa: string;
  solicitante: {
    name: string;
    department: string;
    date: string;
  };
  aprovador: {
    name: string;
    department: string;
    date: string;
  } | null;
  createdAt: string;
  timeline: {
    rascunho: string | null;
    solicitada: string | null;
    aguardando_aprovacao: string | null;
    aprovada: string | null;
    separada: string | null;
    entregue: string | null;
  };
}

export default function RequisicaoDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [requisition, setRequisition] = useState<RequisitionData | null>(null);
  const [items, setItems] = useState<ReqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRequisition = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/requisitions/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();

      const linkedRef = data.serviceOrder?.numero
        ?? data.calderariaOrder?.numero
        ?? data.productionOrder?.numero
        ?? '';
      const linkedRefType = data.serviceOrder ? 'OS'
        : data.calderariaOrder ? 'CLD'
        : data.productionOrder ? 'OP'
        : '';
      const linkedRefId = data.serviceOrder?.id
        ?? data.calderariaOrder?.id
        ?? data.productionOrder?.id
        ?? '';
      const linkedRefDescription = data.serviceOrder
        ? `OS ${data.serviceOrder.numero} — ${data.serviceOrder.status}`
        : data.calderariaOrder
        ? `CLD ${data.calderariaOrder.numero} — ${data.calderariaOrder.status}`
        : data.productionOrder
        ? `OP ${data.productionOrder.numero} — ${data.productionOrder.status}`
        : '';

      setRequisition({
        id: data.id,
        number: data.numero,
        type: data.type as ReqType,
        status: data.status as ReqStatus,
        linkedRef,
        linkedRefType,
        linkedRefId,
        linkedRefDescription,
        justificativa: data.justificativa ?? '',
        solicitante: {
          name: data.solicitante?.name ?? '—',
          department: '',
          date: data.createdAt ?? '',
        },
        aprovador: data.aprovador
          ? {
              name: data.aprovador.name,
              department: '',
              date: data.updatedAt ?? '',
            }
          : null,
        createdAt: data.createdAt ?? '',
        timeline: {
          rascunho: data.status === 'RASCUNHO' ? data.createdAt : null,
          solicitada: ['SOLICITADA', 'AGUARDANDO_APROVACAO', 'APROVADA', 'SEPARADA', 'ENTREGUE'].includes(data.status) ? data.createdAt : null,
          aguardando_aprovacao: ['AGUARDANDO_APROVACAO', 'APROVADA', 'SEPARADA', 'ENTREGUE'].includes(data.status) ? data.updatedAt ?? null : null,
          aprovada: ['APROVADA', 'SEPARADA', 'ENTREGUE'].includes(data.status) ? data.updatedAt ?? null : null,
          separada: ['SEPARADA', 'ENTREGUE'].includes(data.status) ? data.updatedAt ?? null : null,
          entregue: data.status === 'ENTREGUE' ? data.updatedAt ?? null : null,
        },
      });

      setItems(
        (data.items || []).map((item: any) => ({
          id: item.id,
          product: item.product?.description ?? item.description ?? '—',
          code: item.product?.code ?? '',
          unit: item.unit ?? item.product?.unit ?? '—',
          qtdSolicitada: item.quantityRequested ?? 0,
          qtdAprovada: item.quantityApproved ?? 0,
          qtdEntregue: item.quantityDelivered ?? 0,
        }))
      );
    } catch (err) {
      console.error('Erro ao carregar requisicao:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRequisition();
  }, [loadRequisition]);

  const doSimpleAction = async (endpoint: string) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/requisitions/${id}/${endpoint}`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        setActionError(errData.message || 'Erro ao executar acao.');
        return;
      }
      await loadRequisition();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao executar acao.');
    } finally {
      setActionLoading(false);
    }
  };

  const doApprove = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      // Approve all items at full requested quantity
      const body = {
        items: items.map((item) => ({
          id: item.id,
          quantityApproved: item.qtdSolicitada,
        })),
      };
      const res = await apiFetch(`/api/requisitions/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        setActionError(errData.message || 'Erro ao aprovar.');
        return;
      }
      await loadRequisition();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao aprovar.');
    } finally {
      setActionLoading(false);
    }
  };

  const doDeliver = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      // Deliver all items at full approved quantity
      const body = {
        items: items.map((item) => ({
          id: item.id,
          quantityDelivered: item.qtdAprovada,
        })),
      };
      const res = await apiFetch(`/api/requisitions/${id}/deliver`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        setActionError(errData.message || 'Erro ao entregar.');
        return;
      }
      await loadRequisition();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao entregar.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500 text-sm">Carregando requisicao...</p>
      </div>
    );
  }

  if (notFound || !requisition) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-slate-700 font-semibold">Requisicao nao encontrada.</p>
        <Link
          href="/requisicoes/lista"
          className="text-sm text-teal-600 hover:text-teal-700 underline"
        >
          Voltar para a lista
        </Link>
      </div>
    );
  }

  const statusSteps: ReqStatus[] = ['RASCUNHO', 'SOLICITADA', 'AGUARDANDO_APROVACAO', 'APROVADA', 'SEPARADA', 'ENTREGUE'];
  const statusOrder: Record<ReqStatus, number> = {
    RASCUNHO: 0, SOLICITADA: 1, AGUARDANDO_APROVACAO: 2, APROVADA: 3, SEPARADA: 4, ENTREGUE: 5, CANCELADA: -1,
  };
  const currentOrder = statusOrder[requisition.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/requisicoes/lista"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{requisition.number}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[requisition.status]}`}>
              {statusLabels[requisition.status]}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${typeColors[requisition.type]}`}>
              {typeLabels[requisition.type]}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Criada em: {new Date(requisition.createdAt).toLocaleDateString('pt-BR')}
            {requisition.linkedRef ? ` | Vinculo: ${requisition.linkedRef}` : ''}
          </p>
        </div>

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2">
          {requisition.status === 'RASCUNHO' && (
            <button
              onClick={() => doSimpleAction('submit')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          )}
          {requisition.status === 'SOLICITADA' && (
            <button
              onClick={doApprove}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              Aprovar
            </button>
          )}
          {requisition.status === 'APROVADA' && (
            <button
              onClick={() => doSimpleAction('separate')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Package className="w-4 h-4" />
              Separar
            </button>
          )}
          {requisition.status === 'SEPARADA' && (
            <button
              onClick={doDeliver}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              Entregar
            </button>
          )}
          {requisition.status !== 'ENTREGUE' && requisition.status !== 'CANCELADA' && (
            <button
              onClick={() => doSimpleAction('cancel')}
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

      {/* INTERNA note */}
      {requisition.type === 'INTERNA' && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-teal-800">Requisicao interna — mesmo CNPJ, sem emissao de NF-e</p>
            <p className="text-xs text-teal-600 mt-1">
              Movimentacao interna de materiais entre Industria e Oficina. Nao gera documento fiscal.
            </p>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Status da Requisicao</h2>
        <div className="flex items-center gap-2">
          {statusSteps.map((status, index) => {
            const stepOrder = statusOrder[status];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = status === requisition.status;
            const dateKey = status.toLowerCase() as keyof typeof requisition.timeline;
            const stepDate = requisition.timeline[dateKey];

            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent
                        ? 'bg-teal-600 text-white ring-4 ring-teal-100'
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
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-teal-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
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

      {/* Type Badge & Origin Reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900">Solicitante</h2>
          </div>
          <p className="text-sm font-semibold text-slate-900">{requisition.solicitante.name}</p>
          {requisition.solicitante.department && (
            <p className="text-xs text-slate-500 mt-1">{requisition.solicitante.department}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            Solicitado em: {new Date(requisition.solicitante.date).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900">Aprovador</h2>
          </div>
          {requisition.aprovador ? (
            <>
              <p className="text-sm font-semibold text-slate-900">{requisition.aprovador.name}</p>
              {requisition.aprovador.department && (
                <p className="text-xs text-slate-500 mt-1">{requisition.aprovador.department}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Aprovado em: {new Date(requisition.aprovador.date).toLocaleDateString('pt-BR')}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Aguardando aprovacao</p>
          )}
        </div>
      </div>

      {/* Origin Reference */}
      {requisition.linkedRef && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900">Origem</h2>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={
                requisition.linkedRefType === 'OS'
                  ? `/oficina/ordens-servico/${requisition.linkedRefId}`
                  : requisition.linkedRefType === 'CLD'
                  ? `/calderaria/ordens/${requisition.linkedRefId}`
                  : `/producao/ordens/${requisition.linkedRefId}`
              }
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              {requisition.linkedRef}
            </Link>
            <span className="text-xs text-slate-400">({requisition.linkedRefType})</span>
          </div>
          {requisition.linkedRefDescription && (
            <p className="text-xs text-slate-500 mt-1">{requisition.linkedRefDescription}</p>
          )}
        </div>
      )}

      {/* Justificativa */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Justificativa</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{requisition.justificativa || '—'}</p>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Itens da Requisicao</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidade</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd Solicitada</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd Aprovada</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd Entregue</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-sm text-slate-400">Nenhum item cadastrado.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const progress = item.qtdAprovada > 0
                    ? Math.round((item.qtdEntregue / item.qtdAprovada) * 100)
                    : 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.product}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-center">{item.unit}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 text-center">{item.qtdSolicitada}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`font-semibold ${item.qtdAprovada < item.qtdSolicitada ? 'text-amber-600' : 'text-blue-700'}`}>
                          {item.qtdAprovada}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-center">{item.qtdEntregue}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-10 text-right">{fmtPercent(progress, 0)}</span>
                        </div>
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
