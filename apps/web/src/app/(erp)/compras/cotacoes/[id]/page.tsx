'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  FileText,
  Package,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  Clock,
  CreditCard,
  ShoppingCart,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency, fmtPercent } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

// ---------- Types ----------

interface QuotationItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface SupplierInfo {
  name: string;
  cnpj: string;
}

interface Quotation {
  id: string;
  numero: string;
  purchaseRequestId: string | null;
  purchaseRequestNumero: string;
  purchaseRequestDescription: string;
  supplier: SupplierInfo;
  status: string;
  validUntil: string;
  condicaoPagamento: string;
  createdAt: string;
  total: number;
  items: QuotationItem[];
}

// Comparison table row (one supplier)
interface CompareSupplier {
  quotationId: string;
  supplier: string;
  status: string;
  condicaoPagamento: string;
  validUntil: string;
  isCurrentPage: boolean;
  // map productId -> { unitPrice }
  itemsByProductId: Record<string, number>;
  total: number;
}

// Unique products in comparison (from all quotation items)
interface CompareProduct {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  unit: string;
}

// ---------- Mappers ----------

function mapApiToQuotation(raw: Record<string, unknown>): Quotation {
  const supplier = (raw.supplier as Record<string, unknown>) ?? {};
  const purchaseRequest = (raw.purchaseRequest as Record<string, unknown>) ?? {};
  const rawItems = (raw.items as Array<Record<string, unknown>>) ?? [];

  const items: QuotationItem[] = rawItems.map((i) => {
    const product = (i.product as Record<string, unknown>) ?? {};
    return {
      id: i.id as string,
      code: product.code as string ?? '',
      name: product.description as string ?? '',
      quantity: Number(i.quantity) || 0,
      unit: product.unit as string ?? 'UN',
      unitPrice: Number(i.unitPrice) || 0,
      totalPrice: Number(i.totalPrice) || 0,
    };
  });

  return {
    id: raw.id as string,
    numero: raw.numero as string ?? '',
    purchaseRequestId: purchaseRequest.id as string | null ?? null,
    purchaseRequestNumero: purchaseRequest.numero as string ?? '—',
    purchaseRequestDescription: purchaseRequest.description as string ?? '',
    supplier: {
      name: (supplier.razaoSocial ?? supplier.nomeFantasia) as string ?? '—',
      cnpj: supplier.cpfCnpj as string ?? '—',
    },
    status: raw.status as string ?? 'PENDENTE',
    validUntil: raw.dataValidade as string ?? '',
    condicaoPagamento: raw.condicaoPagamento as string ?? '—',
    createdAt: raw.createdAt as string ?? '',
    total: Number(raw.totalValue) || 0,
    items,
  };
}

function mapCompareData(
  rawQuotations: Array<Record<string, unknown>>,
  currentId: string,
): { suppliers: CompareSupplier[]; products: CompareProduct[] } {
  const productMap = new Map<string, CompareProduct>();

  const suppliers: CompareSupplier[] = rawQuotations.map((q) => {
    const supplier = (q.supplier as Record<string, unknown>) ?? {};
    const rawItems = (q.items as Array<Record<string, unknown>>) ?? [];
    const itemsByProductId: Record<string, number> = {};

    rawItems.forEach((i) => {
      const product = (i.product as Record<string, unknown>) ?? {};
      const productId = product.id as string;
      if (!productId) return;

      itemsByProductId[productId] = Number(i.unitPrice) || 0;

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          code: product.code as string ?? '',
          name: product.description as string ?? '',
          quantity: Number(i.quantity) || 0,
          unit: product.unit as string ?? 'UN',
        });
      }
    });

    return {
      quotationId: q.id as string,
      supplier: ((supplier.razaoSocial ?? supplier.nomeFantasia) as string) ?? '—',
      status: q.status as string ?? '',
      condicaoPagamento: q.condicaoPagamento as string ?? '—',
      validUntil: q.dataValidade as string ?? '',
      isCurrentPage: q.id === currentId,
      itemsByProductId,
      total: Number(q.totalValue) || 0,
    };
  });

  return { suppliers, products: Array.from(productMap.values()) };
}

// ---------- Component ----------

export default function CotacaoDetailPage() {
  const toast = useToast();
  const params = useParams();
  const id = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [compareSuppliers, setCompareSuppliers] = useState<CompareSupplier[]>([]);
  const [compareProducts, setCompareProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await api<Record<string, unknown>>(`/purchasing/quotations/${id}`);
      const mapped = mapApiToQuotation(raw);
      setQuotation(mapped);

      if (mapped.purchaseRequestId) {
        try {
          const compareRaw = await api<{ quotations: Array<Record<string, unknown>> }>(
            `/purchasing/quotations/compare/${mapped.purchaseRequestId}`,
          );
          const { suppliers, products } = mapCompareData(compareRaw.quotations ?? [], id);
          setCompareSuppliers(suppliers);
          setCompareProducts(products);
        } catch {
          // comparison data optional; fall back to current quotation only
          const singleSupplier: CompareSupplier = {
            quotationId: mapped.id,
            supplier: mapped.supplier.name,
            status: mapped.status,
            condicaoPagamento: mapped.condicaoPagamento,
            validUntil: mapped.validUntil,
            isCurrentPage: true,
            itemsByProductId: Object.fromEntries(
              mapped.items.map((i) => [i.id, i.unitPrice]),
            ),
            total: mapped.total,
          };
          setCompareSuppliers([singleSupplier]);
          setCompareProducts(
            mapped.items.map((i) => ({
              productId: i.id,
              code: i.code,
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
            })),
          );
        }
      }
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
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!quotation) return;
    try {
      await api(`/purchasing/quotations/${quotation.id}/approve`, { method: 'POST' });
      setApproved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar cotacao');
    }
    setApproving(false);
  };

  const handleReject = async () => {
    if (!quotation) return;
    try {
      await api(`/purchasing/quotations/${quotation.id}/reject`, { method: 'POST' });
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar cotacao');
    }
  };

  // ---------- Loading / not found ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (notFound || !quotation) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-lg">Cotacao nao encontrada.</p>
        <Link href="/compras/cotacoes" className="mt-4 inline-block text-orange-600 hover:underline text-sm">
          Voltar para Cotacoes
        </Link>
      </div>
    );
  }

  // ---------- Approved success screen ----------

  if (approved) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-10 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-emerald-800">Cotacao Aprovada!</h2>
          <p className="text-slate-500 mt-1 text-sm">Pedido de Compra gerado automaticamente</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/compras/pedidos"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-semibold transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Ver Pedidos de Compra
          </Link>
          <Link href="/compras/cotacoes" className="text-sm text-slate-500 hover:text-slate-700 underline mt-2">
            Voltar para Cotacoes
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Comparison helpers ----------

  const supplierTotals = compareSuppliers.map((s) => s.total);
  const minTotal = supplierTotals.length > 0 ? Math.min(...supplierTotals) : 0;
  const maxTotal = supplierTotals.length > 0 ? Math.max(...supplierTotals) : 0;

  const statusBadgeColor: Record<string, string> = {
    PENDENTE: 'bg-amber-100 text-amber-700',
    APROVADA: 'bg-emerald-100 text-emerald-700',
    REJEITADA: 'bg-red-100 text-red-700',
    RECEBIDA: 'bg-blue-100 text-blue-700',
    EXPIRADA: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/compras/cotacoes" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{quotation.numero}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeColor[quotation.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {quotation.status}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            {quotation.purchaseRequestDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!approving ? (
            <>
              <button
                onClick={() => setApproving(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Aprovar esta Cotacao
              </button>
              <button
                onClick={handleReject}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Rejeitar
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
              <span className="text-sm text-emerald-800 font-medium">Confirmar aprovacao e gerar PO?</span>
              <button onClick={handleApprove} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700">
                Sim, Aprovar
              </button>
              <button onClick={() => setApproving(false)} className="px-3 py-1 text-slate-600 hover:text-slate-900 text-sm">
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── COMPARATIVO DE FORNECEDORES ── */}
      {compareSuppliers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-amber-200 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-amber-900">Comparativo de Fornecedores — {quotation.purchaseRequestNumero}</h2>
            </div>
            <p className="text-xs text-amber-700 mt-0.5">{compareSuppliers.length} fornecedor(es) cotaram este pedido</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-64 bg-slate-50">
                    Item / Produto
                  </th>
                  {compareSuppliers.map((sq, idx) => (
                    <th key={idx} className={`px-5 py-4 text-center min-w-[180px] ${sq.isCurrentPage ? 'bg-amber-50' : 'bg-white'}`}>
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          {supplierTotals[idx] === minTotal && supplierTotals.length > 1 && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          )}
                          <span className={`text-sm font-bold ${sq.isCurrentPage ? 'text-amber-800' : 'text-slate-800'}`}>
                            {sq.supplier.split(' ').slice(0, 2).join(' ')}
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColor[sq.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {sq.status}
                        </span>
                        {sq.isCurrentPage && (
                          <span className="text-xs text-amber-600 font-medium">(esta cotacao)</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Item rows */}
                {compareProducts.map((product) => {
                  const prices = compareSuppliers.map((sq) => sq.itemsByProductId[product.productId] ?? null);
                  const validPrices = prices.filter((p): p is number => p !== null);
                  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
                  const maxPrice = validPrices.length > 1 ? Math.max(...validPrices) : null;

                  return (
                    <tr key={product.productId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 bg-slate-50">
                        <p className="text-xs font-mono text-slate-400">{product.code}</p>
                        <p className="text-sm font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{product.quantity} {product.unit}</p>
                      </td>
                      {compareSuppliers.map((sq, idx) => {
                        const unitPrice = sq.itemsByProductId[product.productId] ?? null;
                        const lineTotal = unitPrice !== null ? unitPrice * product.quantity : null;
                        const isLowest = unitPrice !== null && minPrice !== null && unitPrice === minPrice;
                        const isHighest = unitPrice !== null && maxPrice !== null && unitPrice === maxPrice && unitPrice !== minPrice;

                        return (
                          <td key={idx} className={`px-5 py-3 text-center ${sq.isCurrentPage ? 'bg-amber-50/50' : ''} ${isLowest ? 'bg-emerald-50' : isHighest ? 'bg-red-50' : ''}`}>
                            {unitPrice !== null ? (
                              <>
                                <p className={`text-sm font-bold ${isLowest ? 'text-emerald-700' : isHighest ? 'text-red-600' : 'text-slate-800'}`}>
                                  {formatCurrency(unitPrice)}
                                </p>
                                <p className={`text-xs mt-0.5 ${isLowest ? 'text-emerald-600' : isHighest ? 'text-red-500' : 'text-slate-500'}`}>
                                  Total: {lineTotal !== null ? formatCurrency(lineTotal) : '—'}
                                </p>
                                {isLowest && (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded mt-1">
                                    <Award className="w-2.5 h-2.5" />menor
                                  </span>
                                )}
                                {isHighest && (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium bg-red-100 px-1.5 py-0.5 rounded mt-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />maior
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="px-5 py-4 text-sm font-bold text-slate-700">Total Geral</td>
                  {compareSuppliers.map((sq, idx) => (
                    <td key={idx} className={`px-5 py-4 text-center ${supplierTotals[idx] === minTotal ? 'bg-emerald-50' : supplierTotals[idx] === maxTotal && supplierTotals[idx] !== minTotal ? 'bg-red-50' : ''}`}>
                      <p className={`text-base font-bold ${supplierTotals[idx] === minTotal ? 'text-emerald-700' : supplierTotals[idx] === maxTotal && supplierTotals[idx] !== minTotal ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatCurrency(sq.total)}
                      </p>
                      {sq.total === minTotal && supplierTotals.length > 1 && (
                        <p className="text-xs text-emerald-600 font-medium">Melhor preco</p>
                      )}
                      {sq.total !== minTotal && minTotal > 0 && (
                        <p className="text-xs text-slate-500 font-normal">
                          +{formatCurrency(sq.total - minTotal)} ({fmtPercent((sq.total / minTotal - 1) * 100, 1)})
                        </p>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Prazo Entrega */}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" />Condicao de Pagamento
                    </div>
                  </td>
                  {compareSuppliers.map((sq, idx) => (
                    <td key={idx} className="px-5 py-3 text-sm text-slate-700 text-center">{sq.condicaoPagamento}</td>
                  ))}
                </tr>

                {/* Validity */}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5" />Validade
                    </div>
                  </td>
                  {compareSuppliers.map((sq, idx) => (
                    <td key={idx} className="px-5 py-3 text-sm text-slate-700 text-center">
                      {sq.validUntil ? new Date(sq.validUntil).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  ))}
                </tr>

                {/* Approve action row */}
                <tr className="border-t-2 border-slate-200">
                  <td className="px-5 py-4 text-xs text-slate-400">Selecionar fornecedor</td>
                  {compareSuppliers.map((sq, idx) => (
                    <td key={idx} className={`px-5 py-4 text-center ${sq.isCurrentPage ? 'bg-amber-50/50' : ''}`}>
                      <button
                        onClick={() => setApproving(true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          supplierTotals[idx] === minTotal
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {supplierTotals[idx] === minTotal ? 'Aprovar (Melhor)' : 'Aprovar'}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-orange-600" />
            <h3 className="text-sm font-semibold text-slate-700">Fornecedor (esta cotacao)</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">{quotation.supplier.name}</p>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-500">CNPJ: <span className="font-mono text-slate-700">{quotation.supplier.cnpj}</span></p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <h3 className="text-sm font-semibold text-slate-700">Valores</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Total:</span><span className="font-bold text-lg text-orange-700">{formatCurrency(quotation.total)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Pagamento:</span><span className="font-medium text-slate-700">{quotation.condicaoPagamento}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-orange-600" />
            <h3 className="text-sm font-semibold text-slate-700">Datas</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Criada em:</span><span className="font-medium text-slate-700">{quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString('pt-BR') : '—'}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Valida ate:</span><span className="font-medium text-slate-700">{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('pt-BR') : '—'}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Solicitacao:</span><Link href={`/compras/solicitacoes/${quotation.purchaseRequestId ?? ''}`} className="font-medium text-amber-600 hover:underline">{quotation.purchaseRequestNumero}</Link></div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-slate-900">Itens da Cotacao — {quotation.supplier.name}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidade</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preco Unit.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotation.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 text-center font-semibold">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center">{item.unit}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-700 text-right">Total:</td>
                <td className="px-4 py-3 text-sm font-bold text-orange-700 text-right">{formatCurrency(quotation.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary insight */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
        <FileText className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <strong>Solicitacao:</strong> {quotation.purchaseRequestNumero} — {quotation.purchaseRequestDescription}
        </div>
      </div>
    </div>
  );
}
