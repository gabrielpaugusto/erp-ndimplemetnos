'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Send,
  ClipboardList,
  Package,
  FileText,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';

type RequestStatus = 'RASCUNHO' | 'SOLICITADA' | 'APROVADA' | 'COTADA' | 'PEDIDA' | 'RECEBIDA' | 'CANCELADA';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const statusLabels: Record<RequestStatus, string> = {
  RASCUNHO: 'Rascunho',
  SOLICITADA: 'Solicitada',
  APROVADA: 'Aprovada',
  COTADA: 'Cotada',
  PEDIDA: 'Pedida',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<RequestStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  SOLICITADA: 'bg-blue-100 text-blue-700',
  APROVADA: 'bg-emerald-100 text-emerald-700',
  COTADA: 'bg-purple-100 text-purple-700',
  PEDIDA: 'bg-indigo-100 text-indigo-700',
  RECEBIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

interface RequestItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  description: string;
}

interface QuotationSummary {
  id: string;
  numero: string;
  supplier: { razaoSocial: string };
  totalValue: number;
  status: string;
}

interface PurchaseRequest {
  id: string;
  numero: string;
  status: RequestStatus;
  solicitante: { name: string } | null;
  description: string;
  justificativa: string | null;
  priority: number;
  dataSolicitacao: string;
  dataAprovacao: string | null;
  items: RequestItem[];
  supplierQuotations: QuotationSummary[];
  totalEstimated: number;
}

function mapApiToRequest(raw: Record<string, unknown>): PurchaseRequest {
  const rawItems = (raw.items as Array<Record<string, unknown>>) ?? [];
  const items: RequestItem[] = rawItems.map((i) => {
    const product = (i.product as Record<string, unknown>) ?? {};
    return {
      id: i.id as string,
      code: product.code as string ?? '',
      name: product.description as string ?? '',
      quantity: Number(i.quantity) || 0,
      unit: product.unit as string ?? (i.unit as string) ?? 'UN',
      estimatedPrice: Number(i.estimatedPrice) || 0,
      description: (i.description as string) ?? '',
    };
  });

  const totalEstimated = items.reduce((sum, it) => sum + it.quantity * it.estimatedPrice, 0);

  return {
    id: raw.id as string,
    numero: raw.numero as string,
    status: raw.status as RequestStatus,
    solicitante: raw.solicitante as { name: string } | null,
    description: raw.description as string ?? '',
    justificativa: raw.justificativa as string | null,
    priority: Number(raw.priority) || 5,
    dataSolicitacao: raw.dataSolicitacao as string ?? raw.createdAt as string ?? '',
    dataAprovacao: raw.dataAprovacao as string | null,
    items,
    supplierQuotations: (raw.supplierQuotations as QuotationSummary[]) ?? [],
    totalEstimated,
  };
}

const quotationStatusColor: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-700',
  APROVADA: 'bg-emerald-100 text-emerald-700',
  REJEITADA: 'bg-red-100 text-red-700',
  RECEBIDA: 'bg-blue-100 text-blue-700',
};

export default function SolicitacaoCompraDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await api<Record<string, unknown>>(`/purchasing/requests/${id}`);
      setRequest(mapApiToRequest(raw));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('not found') || msg.includes('404')) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const handleAction = async (action: 'approve' | 'cancel' | 'submit') => {
    if (!request) return;
    setActionLoading(true);
    try {
      await api(`/purchasing/requests/${request.id}/${action}`, { method: 'POST' });
      await fetchRequest();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Erro ao executar acao ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-lg">Solicitacao nao encontrada.</p>
        <Link href="/compras/solicitacoes" className="mt-4 inline-block text-amber-600 hover:underline text-sm">
          Voltar para Solicitacoes
        </Link>
      </div>
    );
  }

  const statusSteps: RequestStatus[] = ['RASCUNHO', 'SOLICITADA', 'APROVADA', 'COTADA', 'PEDIDA', 'RECEBIDA'];
  const statusOrder: Record<RequestStatus, number> = {
    RASCUNHO: 0, SOLICITADA: 1, APROVADA: 2, COTADA: 3, PEDIDA: 4, RECEBIDA: 5, CANCELADA: -1,
  };
  const currentOrder = statusOrder[request.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/compras/solicitacoes" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{request.numero}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[request.status]}`}>
              {statusLabels[request.status]}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
              request.priority >= 8 ? 'bg-red-100 text-red-700' : request.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            }`}>
              P{request.priority}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">{request.description}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {request.status === 'RASCUNHO' && (
            <button
              onClick={() => handleAction('submit')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Solicitar
            </button>
          )}
          {request.status === 'SOLICITADA' && (
            <button
              onClick={() => handleAction('approve')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Aprovar
            </button>
          )}
          {(request.status !== 'RECEBIDA' && request.status !== 'CANCELADA') && (
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
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Timeline</h2>
        <div className="flex items-center gap-2">
          {statusSteps.map((status, index) => {
            const stepOrder = statusOrder[status];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = status === request.status;

            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent ? 'bg-amber-600 text-white ring-4 ring-amber-100' : isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isActive && !isCurrent ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-amber-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {statusLabels[status]}
                  </span>
                </div>
                {index < statusSteps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-700">Dados da Solicitacao</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Solicitante:</span><span className="font-medium text-slate-700">{request.solicitante?.name ?? '—'}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Data:</span><span className="font-medium text-slate-700">{new Date(request.dataSolicitacao).toLocaleDateString('pt-BR')}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-700">Resumo</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Total Itens:</span><span className="font-medium text-slate-700">{request.items.length}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Valor Estimado:</span><span className="font-bold text-amber-700">{formatCurrency(request.totalEstimated)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Cotacoes:</span><span className="font-medium text-slate-700">{request.supplierQuotations.length}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-700">Justificativa</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{request.justificativa ?? '—'}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Itens Solicitados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidade</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preco Est.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtotal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {request.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center">{item.unit}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 text-right">{formatCurrency(item.estimatedPrice)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(item.quantity * item.estimatedPrice)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.description}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-700 text-right">Total Estimado:</td>
                <td className="px-4 py-3 text-sm font-bold text-amber-700 text-right">{formatCurrency(request.totalEstimated)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Linked Quotations */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">Cotacoes Vinculadas</h2>
          </div>
          <Link href="/compras/cotacoes/nova" className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs font-medium transition-colors">
            Nova Cotacao
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {request.supplierQuotations.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma cotacao vinculada.</td></tr>
              )}
              {request.supplierQuotations.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-orange-600">
                    <Link href={`/compras/cotacoes/${q.id}`} className="hover:underline">{q.numero}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{q.supplier?.razaoSocial ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(Number(q.totalValue) || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${quotationStatusColor[q.status] ?? 'bg-slate-100 text-slate-600'}`}>{q.status}</span>
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
