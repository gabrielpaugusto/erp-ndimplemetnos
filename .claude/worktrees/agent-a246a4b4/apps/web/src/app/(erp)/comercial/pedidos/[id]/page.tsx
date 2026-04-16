'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  DollarSign,
  User,
  Calendar,
  Building2,
  Package,
  FileText,
  CheckCircle,
  XCircle,
  Truck,
  AlertTriangle,
  RefreshCw,
  Send,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type OrderStatus = 'RASCUNHO' | 'PENDENTE' | 'APROVADO' | 'FATURADO' | 'ENTREGUE' | 'CANCELADO';

interface OrderItem {
  id: string;
  seq: number;
  description: string;
  quantity: number;
  unitPrice: number;
  desconto: number;
  total: number;
  product?: { id: string; code: string; description: string; unit: string } | null;
  cfop?: { code: string; description: string } | null;
}

interface SaleOrder {
  id: string;
  numero: number;
  status: OrderStatus;
  saleType: string;
  createdAt: string;
  dataAprovacao: string | null;
  dataFaturamento: string | null;
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  condicaoPagamento: string | null;
  observacoes: string | null;
  comissaoPercent: number | null;
  comissaoValor: number | null;
  person: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cpfCnpj: string | null;
    uf?: string | null;
    municipio?: string | null;
  } | null;
  vendedor: { id: string; name: string; email: string } | null;
  fabricante: { id: string; razaoSocial: string; nomeFantasia: string | null } | null;
  quotation: { id: string; numero: number; status: string } | null;
  items: OrderItem[];
  nfeDocuments?: { id: string; numero: number | null; serie: number; status: string; chaveAcesso: string | null }[];
}

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE:  'Pendente',
  APROVADO:  'Aprovado',
  FATURADO:  'Faturado',
  ENTREGUE:  'Entregue',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<string, string> = {
  RASCUNHO:  'bg-slate-100 text-slate-600',
  PENDENTE:  'bg-yellow-100 text-yellow-700',
  APROVADO:  'bg-emerald-100 text-emerald-700',
  FATURADO:  'bg-blue-100 text-blue-700',
  ENTREGUE:  'bg-teal-100 text-teal-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

const saleTypeLabels: Record<string, string> = {
  ESTOQUE:  'Estoque Próprio',
  DIRETA:   'Venda Direta',
  PRODUCAO: 'Produção Própria',
};

const saleTypeColors: Record<string, string> = {
  ESTOQUE:  'bg-blue-100 text-blue-700',
  DIRETA:   'bg-purple-100 text-purple-700',
  PRODUCAO: 'bg-orange-100 text-orange-700',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const STATUS_STEPS: OrderStatus[] = ['RASCUNHO', 'PENDENTE', 'APROVADO', 'FATURADO', 'ENTREGUE'];
const STATUS_ORDER: Record<string, number> = {
  RASCUNHO: 0, PENDENTE: 1, APROVADO: 2, FATURADO: 3, ENTREGUE: 4, CANCELADO: -1,
};

export default function PedidoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder]           = useState<SaleOrder | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState('');
  const [emitindoNfe, setEmitindoNfe]     = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/sales/orders/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Pedido não encontrado');
        return;
      }
      setOrder(await res.json());
    } catch {
      setError('Erro ao carregar pedido. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  async function handleApprove() {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/sales/orders/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Erro ao aprovar'); return; }
      setOrder(data);
    } catch { setActionError('Erro de conexão'); }
    finally { setActionLoading(false); }
  }

  async function handleCancel() {
    if (!confirm('Confirma o cancelamento deste pedido?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/sales/orders/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Erro ao cancelar'); return; }
      setOrder(data);
    } catch { setActionError('Erro de conexão'); }
    finally { setActionLoading(false); }
  }

  /** Emitir NF-e: cria NF-e pré-preenchida com os itens do pedido e redireciona */
  async function handleEmitirNfe() {
    if (!order) return;
    setEmitindoNfe(true);
    setActionError('');
    try {
      const payload = {
        type: 'SAIDA',
        finality: 'NORMAL',
        operation: 'VENDA',
        personId: order.person?.id,
        saleOrderId: order.id,
        naturezaOperacao: 'Venda de produção do estabelecimento',
        dataEmissao: new Date().toISOString(),
        informacoesComplementares: order.observacoes || undefined,
        items: order.items.map((item) => ({
          description: item.description || item.product?.description || 'Item',
          ncmCode:     '00000000',   // será ajustado pelo usuário na NF-e
          cfopCode:    item.cfop?.code || '5101',
          quantity:    Number(item.quantity),
          unitPrice:   Number(item.unitPrice),
          unit:        item.product?.unit || 'UN',
        })),
      };

      const res  = await apiFetch('/api/fiscal/nfe', {
        method: 'POST',
        body:   JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const msgs = Array.isArray(data.message) ? data.message.join('; ') : data.message || 'Erro ao criar NF-e';
        setActionError(msgs);
        return;
      }

      // Redireciona para a NF-e criada
      router.push(`/fiscal/nfe/${data.id}`);
    } catch {
      setActionError('Erro de conexão ao criar NF-e');
    } finally {
      setEmitindoNfe(false);
    }
  }

  // ---------- Render states ----------
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-200 animate-pulse rounded w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-100 animate-pulse rounded" />)}
        </div>
        <div className="h-48 bg-slate-100 animate-pulse rounded" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
        <p className="font-semibold text-slate-700">{error || 'Pedido não encontrado'}</p>
        <Link href="/comercial/pedidos" className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
          ← Voltar para lista
        </Link>
      </div>
    );
  }

  const currentOrder = STATUS_ORDER[order.status] ?? 0;
  const nfeVinculadas = order.nfeDocuments ?? [];
  const nfeAutorizada = nfeVinculadas.find(n => n.status === 'AUTORIZADA');
  const canEmitirNfe  = (order.status === 'APROVADO' || order.status === 'PENDENTE' || order.status === 'RASCUNHO') && !nfeAutorizada;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/comercial/pedidos"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">
              PV-{String(order.numero).padStart(4, '0')}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[order.status] ?? order.status}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${saleTypeColors[order.saleType] ?? 'bg-slate-100 text-slate-600'}`}>
              {saleTypeLabels[order.saleType] ?? order.saleType}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Criado em {new Date(order.createdAt).toLocaleDateString('pt-BR')}
            {order.quotation && (
              <> · Orçamento <Link href={`/comercial/orcamentos`} className="text-blue-600 hover:underline">#{order.quotation.numero}</Link></>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {(order.status === 'PENDENTE' || order.status === 'RASCUNHO') && (
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {actionLoading ? 'Aprovando...' : 'Aprovar'}
            </button>
          )}

          {canEmitirNfe && (
            <button
              onClick={handleEmitirNfe}
              disabled={emitindoNfe || !order.person}
              title={!order.person ? 'O pedido precisa de um cliente para emitir NF-e' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              {emitindoNfe ? 'Criando NF-e...' : 'Emitir NF-e'}
            </button>
          )}

          {nfeAutorizada && (
            <Link
              href={`/fiscal/nfe/${nfeAutorizada.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver NF-e #{nfeAutorizada.numero ?? '—'}
            </Link>
          )}

          {order.status === 'FATURADO' && (
            <button
              disabled
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg opacity-60 cursor-not-allowed text-sm font-medium"
            >
              <Truck className="w-4 h-4" />
              Confirmar Entrega
            </button>
          )}

          {(order.status === 'PENDENTE' || order.status === 'APROVADO') && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}

          <button
            onClick={fetchOrder}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Erro</p>
            <p className="text-sm text-red-700 mt-0.5">{actionError}</p>
          </div>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* NF-e vinculadas (quando faturado) */}
      {nfeVinculadas.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">NF-e Vinculadas</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {nfeVinculadas.map((nfe) => (
              <Link
                key={nfe.id}
                href={`/fiscal/nfe/${nfe.id}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  nfe.status === 'AUTORIZADA'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : nfe.status === 'DENEGADA' || nfe.status === 'CANCELADA'
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                NF-e {nfe.numero ? `${String(nfe.numero).padStart(6,'0')}-${nfe.serie}` : 'Rascunho'} · {nfe.status}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Client */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</h3>
          </div>
          {order.person ? (
            <>
              <Link
                href={`/crm/pessoas/${order.person.id}`}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {order.person.razaoSocial}
              </Link>
              {order.person.nomeFantasia && (
                <p className="text-xs text-slate-400 mt-0.5">{order.person.nomeFantasia}</p>
              )}
              {order.person.cpfCnpj && (
                <p className="text-xs text-slate-500 mt-1 font-mono">{order.person.cpfCnpj}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Não informado</p>
          )}
        </div>

        {/* Salesperson */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendedor</h3>
          </div>
          {order.vendedor ? (
            <>
              <p className="text-sm font-semibold text-slate-900">{order.vendedor.name}</p>
              {order.comissaoPercent && (
                <>
                  <p className="text-xs text-slate-500 mt-1">Comissão: {Number(order.comissaoPercent).toFixed(1)}%</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">
                    {fmt(Number(order.comissaoValor ?? 0))}
                  </p>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Não informado</p>
          )}
        </div>

        {/* Dates */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datas</h3>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Emissão:</span>
              <span className="text-xs font-medium text-slate-900">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Aprovação:</span>
              <span className="text-xs font-medium text-slate-900">
                {order.dataAprovacao ? new Date(order.dataAprovacao).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Faturamento:</span>
              <span className="text-xs font-medium text-slate-900">
                {order.dataFaturamento ? new Date(order.dataFaturamento).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</h3>
          </div>
          <p className="text-xl font-bold text-emerald-700">{fmt(Number(order.total))}</p>
          {order.condicaoPagamento && (
            <p className="text-xs text-slate-500 mt-1">Pgto: {order.condicaoPagamento}</p>
          )}
        </div>
      </div>

      {/* Fabricante (DIRETA only) */}
      {order.saleType === 'DIRETA' && order.fabricante && (
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-purple-900">Venda Direta — Fabricante</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-purple-600 uppercase tracking-wider">Fabricante</label>
              <p className="text-sm font-semibold text-purple-900 mt-1">{order.fabricante.razaoSocial}</p>
              {order.fabricante.nomeFantasia && (
                <p className="text-xs text-purple-700 mt-0.5">{order.fabricante.nomeFantasia}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Itens do Pedido ({order.items.length})</h2>

        {order.items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nenhum item no pedido</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto / Descrição</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Qtd</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Preço Unit.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Desconto</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Total</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">CFOP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 text-sm text-slate-500 text-center">{item.seq}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <span className="text-sm font-medium text-slate-900">
                            {item.description || item.product?.description || '—'}
                          </span>
                          {item.product?.code && (
                            <p className="text-xs text-slate-400 font-mono">{item.product.code}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-900 text-center">{item.quantity}</td>
                    <td className="px-3 py-3 text-sm text-slate-900 text-right">{fmt(Number(item.unitPrice))}</td>
                    <td className="px-3 py-3 text-sm text-right">
                      {Number(item.desconto) > 0
                        ? <span className="text-red-600">- {fmt(Number(item.desconto))}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-900 text-right">{fmt(Number(item.total))}</td>
                    <td className="px-3 py-3 text-sm text-slate-700 text-center font-mono">
                      {item.cfop?.code ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-medium text-slate-900">{fmt(Number(order.subtotal))}</span>
            </div>
            {Number(order.desconto) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Desconto:</span>
                <span className="font-medium text-red-600">- {fmt(Number(order.desconto))}</span>
              </div>
            )}
            {Number(order.frete) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Frete:</span>
                <span className="font-medium text-slate-900">{fmt(Number(order.frete))}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200">
              <span className="font-semibold text-slate-900">Total:</span>
              <span className="text-lg font-bold text-emerald-700">{fmt(Number(order.total))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Observations */}
      {order.observacoes && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Observações</h2>
          <p className="text-sm text-slate-700 leading-relaxed">{order.observacoes}</p>
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Histórico do Pedido</h2>
        <div className="flex items-center gap-2">
          {STATUS_STEPS.map((status, index) => {
            const stepOrder = STATUS_ORDER[status] ?? 0;
            const isActive  = stepOrder <= currentOrder;
            const isCurrent = status === order.status;

            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent && isActive
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : isActive
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isActive && !isCurrent ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent && isActive ? 'font-bold text-blue-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {statusLabels[status]}
                  </span>
                </div>
                {index < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
        {order.status === 'CANCELADO' && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Cancelado
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
