'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  User,
  Package,
  CheckCircle,
  XCircle,
  ShoppingCart,
  RefreshCw,
  ChevronRight,
  Calendar,
  Tag,
  Hash,
  Factory,
  Wrench,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtQty } from '@/lib/format';

type QuotationStatus =
  | 'RASCUNHO'
  | 'ENVIADO'
  | 'ACEITO'
  | 'RECUSADO'
  | 'EXPIRADO';

type SaleType =
  | 'ESTOQUE_PROPRIO'
  | 'VENDA_DIRETA'
  | 'PRODUCAO_PROPRIA'
  | 'VENDA_PECA'
  | 'SERVICO_OFICINA'
  | 'FI_CONSORCIO'
  | 'FI_FINANCIAMENTO'
  | 'FI_SEGURO';

interface QuotationItem {
  id: string;
  itemType?: SaleType;
  quantidade: number | string;
  precoUnitario: number | string;
  desconto: number | string;
  total: number | string;
  descricaoLivre?: string;
  observacoes?: string;
  product?: {
    id: string;
    code: string;
    description: string;
    unit: string;
  };
}

interface ConvertResult {
  id: string;
  summary: {
    pedidoVenda: number;
    ordensProducao: string[];
    ordensServico: string[];
    totalDocumentos: number;
  };
  productionOrders: { id: string; numero: string }[];
  serviceOrders: { id: string; numero: string }[];
}

interface Quotation {
  id: string;
  numero: number;
  status: QuotationStatus;
  saleType: SaleType;
  createdAt: string;
  validadeOrcamento?: string;
  prazoEntrega?: string;
  condicaoPagamento?: string;
  observacoes?: string;
  subtotal: number | string;
  desconto: number | string;
  total: number | string;
  comissaoPercent?: number | string;
  person?: {
    id: string;
    razaoSocial: string;
    nomeFantasia?: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
  };
  vendedor?: { id: string; name: string; email: string } | null;
  lead?: { id: string; title: string; status: string } | null;
  items: QuotationItem[];
}

const statusConfig: Record<QuotationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  RASCUNHO: {
    label: 'Rascunho',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FileText className="w-4 h-4" />,
  },
  ENVIADO: {
    label: 'Enviado ao Cliente',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <ChevronRight className="w-4 h-4" />,
  },
  ACEITO: {
    label: 'Aceito / Convertido',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  RECUSADO: {
    label: 'Recusado',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="w-4 h-4" />,
  },
  EXPIRADO: {
    label: 'Expirado',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: <Calendar className="w-4 h-4" />,
  },
};

const saleTypeLabels: Record<SaleType, string> = {
  ESTOQUE_PROPRIO: 'Estoque Próprio',
  VENDA_DIRETA: 'Venda Direta',
  PRODUCAO_PROPRIA: 'Produção Própria',
  VENDA_PECA: 'Venda de Peça',
  SERVICO_OFICINA: 'Serviço de Oficina',
  FI_CONSORCIO: 'Consórcio',
  FI_FINANCIAMENTO: 'Financiamento',
  FI_SEGURO: 'Seguro',
};

const formatCurrency = (value: number | string) => fmtCurrency(Number(value));

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [converting, setConverting] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [finalidadeOperacao, setFinalidadeOperacao] = useState('REVENDA');
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);

  async function fetchQuotation() {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/sales/quotations/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Orçamento não encontrado');
      }
      const data = await res.json();
      setQuotation(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar orçamento');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) fetchQuotation();
  }, [id]);

  async function handleConverter() {
    if (!quotation) return;
    setConverting(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/sales/quotations/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalidadeOperacao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao converter orçamento');

      // If only a sale order was generated (simple case), redirect immediately
      const hasMixed = (data.summary?.ordensProducao?.length || 0) + (data.summary?.ordensServico?.length || 0) > 0;
      if (!hasMixed) {
        setShowConvertModal(false);
        router.push(`/comercial/pedidos/${data.id}`);
        return;
      }

      // Mixed — show result panel instead of redirecting
      setConvertResult(data as ConvertResult);
      setShowConvertModal(false);
      await fetchQuotation();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao converter orçamento');
      setConverting(false);
    }
  }

  async function handleRecusar() {
    if (!quotation) return;
    if (!confirm('Confirma a recusa deste orçamento?')) return;
    setRefusing(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/sales/quotations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RECUSADO' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao recusar orçamento');
      setQuotation(data);
    } catch (err: any) {
      setActionError(err.message || 'Erro ao recusar orçamento');
    } finally {
      setRefusing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-5 bg-slate-200 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="space-y-6">
        <Link
          href="/comercial/orcamentos"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Orçamento não encontrado'}
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[quotation.status] || statusConfig.RASCUNHO;
  const canConvert =
    quotation.status !== 'ACEITO' &&
    quotation.status !== 'RECUSADO' &&
    quotation.status !== 'EXPIRADO';
  const canRefuse =
    quotation.status !== 'ACEITO' &&
    quotation.status !== 'RECUSADO' &&
    quotation.status !== 'EXPIRADO';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/comercial/orcamentos"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Orçamento ORC-{String(quotation.numero).padStart(4, '0')}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Criado em {formatDate(quotation.createdAt)}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusInfo.color}`}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQuotation}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {canRefuse && (
            <button
              onClick={handleRecusar}
              disabled={refusing}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              {refusing ? 'Recusando...' : 'Recusar'}
            </button>
          )}

          {canConvert && (
            <button
              onClick={() => setShowConvertModal(true)}
              disabled={converting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" />
              {converting ? 'Convertendo...' : 'Converter em Pedido'}
            </button>
          )}

          {quotation.status === 'ACEITO' && (
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Pedido gerado
            </span>
          )}
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      {/* Convert modal */}
      {showConvertModal && quotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Aceitar e Converter Orçamento</h2>

            {/* Documents preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documentos que serão gerados:</p>
              {/* SaleOrder — always */}
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <ShoppingCart className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Pedido de Venda</p>
                  <p className="text-xs text-blue-600">
                    {quotation.items.filter(i => !i.itemType || ['ESTOQUE_PROPRIO','VENDA_DIRETA','VENDA_PECA','FI_CONSORCIO','FI_FINANCIAMENTO','FI_SEGURO'].includes(i.itemType as string)).length} iten(s) de produto/serviço financeiro
                  </p>
                </div>
              </div>
              {/* Production orders */}
              {quotation.items.filter(i => i.itemType === 'PRODUCAO_PROPRIA').length > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Factory className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      {quotation.items.filter(i => i.itemType === 'PRODUCAO_PROPRIA').length}× Ordem(ns) de Produção
                    </p>
                    <p className="text-xs text-amber-600">Status inicial: PLANEJADA · Estratégia: MTO</p>
                  </div>
                </div>
              )}
              {/* Service orders */}
              {quotation.items.filter(i => i.itemType === 'SERVICO_OFICINA').length > 0 && (
                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <Wrench className="w-4 h-4 text-orange-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">
                      {quotation.items.filter(i => i.itemType === 'SERVICO_OFICINA').length}× Ordem(ns) de Serviço
                    </p>
                    <p className="text-xs text-orange-600">Status inicial: ABERTA · Preencher dados do veículo</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Finalidade da Operação</label>
              <select
                value={finalidadeOperacao}
                onChange={e => setFinalidadeOperacao(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="REVENDA">Revenda</option>
                <option value="INDUSTRIALIZACAO">Industrialização</option>
                <option value="USO_CONSUMO">Uso e Consumo</option>
                <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConverter}
                disabled={converting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {converting ? 'Convertendo...' : 'Aceitar e Gerar Documentos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversion result panel (mixed documents) */}
      {convertResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-emerald-900">
              {convertResult.summary.totalDocumentos} documento(s) gerado(s) com sucesso!
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href={`/comercial/pedidos/${convertResult.id}`}
              className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-4 py-3 hover:bg-emerald-50 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-slate-500">Pedido de Venda</p>
                <p className="text-sm font-semibold text-slate-900">PV-{String(convertResult.summary.pedidoVenda).padStart(4,'0')}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
            </Link>
            {convertResult.productionOrders.map(op => (
              <Link
                key={op.id}
                href={`/producao/ordens/${op.id}`}
                className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-4 py-3 hover:bg-amber-50 transition-colors"
              >
                <Factory className="w-4 h-4 text-amber-600" />
                <div>
                  <p className="text-xs text-slate-500">Ordem de Produção</p>
                  <p className="text-sm font-semibold text-slate-900">{op.numero}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
              </Link>
            ))}
            {convertResult.serviceOrders.map(os => (
              <Link
                key={os.id}
                href={`/oficina/ordens/${os.id}`}
                className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-4 py-3 hover:bg-orange-50 transition-colors"
              >
                <Wrench className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-xs text-slate-500">Ordem de Serviço</p>
                  <p className="text-sm font-semibold text-slate-900">{os.numero}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" />
                Itens do Orçamento
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Qtd
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Preço Unit.
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Desconto
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotation.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                        Nenhum item cadastrado
                      </td>
                    </tr>
                  ) : (
                    quotation.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          {/* Item type badge */}
                          {item.itemType && item.itemType !== 'ESTOQUE_PROPRIO' && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium mb-1 ${
                              item.itemType === 'PRODUCAO_PROPRIA' ? 'bg-amber-100 text-amber-700' :
                              item.itemType === 'SERVICO_OFICINA'  ? 'bg-orange-100 text-orange-700' :
                              item.itemType === 'VENDA_DIRETA'     ? 'bg-purple-100 text-purple-700' :
                              item.itemType === 'VENDA_PECA'       ? 'bg-cyan-100 text-cyan-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {item.itemType === 'PRODUCAO_PROPRIA' && <Factory className="w-3 h-3" />}
                              {item.itemType === 'SERVICO_OFICINA'  && <Wrench className="w-3 h-3" />}
                              {saleTypeLabels[item.itemType]}
                            </span>
                          )}
                          {item.product ? (
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {item.product.description}
                              </p>
                              <p className="text-xs text-slate-500">
                                Cód: {item.product.code} · {item.product.unit}
                              </p>
                            </div>
                          ) : item.descricaoLivre ? (
                            <p className="text-sm font-medium text-slate-900">{item.descricaoLivre}</p>
                          ) : (
                            <span className="text-sm text-slate-500 italic">Produto não identificado</span>
                          )}
                          {item.observacoes && (
                            <p className="text-xs text-slate-400 mt-0.5 italic">{item.observacoes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-center">
                          {fmtQty(Number(item.quantidade))}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-right">
                          {formatCurrency(item.precoUnitario)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-right">
                          {Number(item.desconto) > 0 ? (
                            <span className="text-red-600">-{formatCurrency(item.desconto)}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={3} />
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-500 text-right">
                      Subtotal
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-900 text-right">
                      {formatCurrency(quotation.subtotal)}
                    </td>
                  </tr>
                  {Number(quotation.desconto) > 0 && (
                    <tr>
                      <td colSpan={3} />
                      <td className="px-4 py-1 text-xs font-medium text-slate-500 text-right">
                        Desconto Total
                      </td>
                      <td className="px-4 py-1 text-sm text-red-600 text-right">
                        -{formatCurrency(quotation.desconto)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} />
                    <td className="px-4 py-2.5 text-sm font-bold text-slate-900 text-right border-t border-slate-200">
                      TOTAL
                    </td>
                    <td className="px-4 py-2.5 text-base font-bold text-emerald-700 text-right border-t border-slate-200">
                      {formatCurrency(quotation.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Observations */}
          {quotation.observacoes && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-3">Observações</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{quotation.observacoes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Client info */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              Cliente
            </h2>
            {quotation.person ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">{quotation.person.razaoSocial}</p>
                {quotation.person.nomeFantasia && (
                  <p className="text-xs text-slate-500">{quotation.person.nomeFantasia}</p>
                )}
                {quotation.person.cpfCnpj && (
                  <p className="text-xs text-slate-500">CPF/CNPJ: {quotation.person.cpfCnpj}</p>
                )}
                {quotation.person.email && (
                  <p className="text-xs text-slate-500">{quotation.person.email}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Cliente não informado</p>
            )}
          </div>

          {/* Details */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-500" />
              Detalhes
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Tipo de Venda</dt>
                <dd className="text-slate-900 font-medium">
                  {saleTypeLabels[quotation.saleType as SaleType] || quotation.saleType}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Cond. Pagamento</dt>
                <dd className="text-slate-900">{quotation.condicaoPagamento || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Prazo de Entrega</dt>
                <dd className="text-slate-900">{quotation.prazoEntrega || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Validade</dt>
                <dd className="text-slate-900">{formatDate(quotation.validadeOrcamento)}</dd>
              </div>
              {quotation.comissaoPercent && Number(quotation.comissaoPercent) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Comissão</dt>
                  <dd className="text-slate-900">{Number(quotation.comissaoPercent)}%</dd>
                </div>
              )}
              {quotation.vendedor && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Vendedor</dt>
                  <dd className="text-slate-900">{quotation.vendedor.name}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* CRM Origin */}
          {quotation.lead && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-500" />
                Origem CRM
              </h2>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">{quotation.lead.title}</p>
                <p className="text-xs text-slate-500">Status: {quotation.lead.status}</p>
                <Link
                  href={`/crm/oportunidades/${quotation.lead.id}`}
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Ver oportunidade
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Status timeline */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Progresso</h2>
            <div className="space-y-3">
              {(
                [
                  { key: 'RASCUNHO', label: 'Rascunho' },
                  { key: 'ENVIADO', label: 'Enviado ao Cliente' },
                  { key: 'ACEITO', label: 'Aceito / Convertido' },
                ] as { key: QuotationStatus; label: string }[]
              ).map(({ key, label }, idx, arr) => {
                const statuses = ['RASCUNHO', 'ENVIADO', 'ACEITO', 'RECUSADO', 'EXPIRADO'];
                const currentIdx = statuses.indexOf(quotation.status);
                const stepIdx = statuses.indexOf(key);
                const isDone =
                  quotation.status === key ||
                  (currentIdx > stepIdx && quotation.status !== 'RECUSADO' && quotation.status !== 'EXPIRADO');
                const isCurrent = quotation.status === key;
                const isRefused =
                  (key === 'ACEITO' && (quotation.status === 'RECUSADO' || quotation.status === 'EXPIRADO'));
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isRefused
                          ? 'bg-red-100 text-red-500'
                          : isDone
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isRefused ? '✕' : isDone ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-sm ${
                        isCurrent ? 'font-semibold text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {key === 'ACEITO' && (quotation.status === 'RECUSADO' || quotation.status === 'EXPIRADO')
                        ? quotation.status === 'RECUSADO' ? 'Recusado' : 'Expirado'
                        : label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
