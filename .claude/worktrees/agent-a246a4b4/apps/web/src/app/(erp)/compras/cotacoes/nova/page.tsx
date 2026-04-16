'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, FileText, Package } from 'lucide-react';
import { api } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface QuotationItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  productId: string;
}

interface PurchaseRequestOption {
  id: string;
  numero: string;
  description: string;
  items: Array<{
    id: string;
    product: { id: string; code: string; description: string; unit: string };
    quantity: number;
    unit: string;
  }>;
}

interface SupplierOption {
  id: string;
  razaoSocial: string;
}

export default function NovaCotacaoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [paymentCondition, setPaymentCondition] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([]);

  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  useEffect(() => {
    api<{ data: Array<Record<string, unknown>> }>('/purchasing/requests', {
      params: { status: 'APROVADA', limit: 100 },
    })
      .then((res) => {
        const mapped: PurchaseRequestOption[] = (res.data ?? []).map((r) => ({
          id: r.id as string,
          numero: r.numero as string,
          description: r.description as string ?? '',
          items: ((r.items as Array<Record<string, unknown>>) ?? []).map((i) => {
            const product = (i.product as Record<string, unknown>) ?? {};
            return {
              id: i.id as string,
              product: {
                id: product.id as string,
                code: product.code as string ?? '',
                description: product.description as string ?? '',
                unit: product.unit as string ?? 'UN',
              },
              quantity: Number(i.quantity) || 1,
              unit: product.unit as string ?? (i.unit as string) ?? 'UN',
            };
          }),
        }));
        setPurchaseRequests(mapped);
      })
      .catch(() => setPurchaseRequests([]));

    api<{ data: Array<Record<string, unknown>> }>('/persons', {
      params: { type: 'PJ', limit: 200 },
    })
      .then((res) => {
        const mapped: SupplierOption[] = (res.data ?? []).map((s) => ({
          id: s.id as string,
          razaoSocial: (s.razaoSocial ?? s.name) as string ?? '',
        }));
        setSuppliers(mapped);
      })
      .catch(() => setSuppliers([]));
  }, []);

  const handleRequestChange = (requestId: string) => {
    setSelectedRequestId(requestId);
    const request = purchaseRequests.find((r) => r.id === requestId);
    if (request) {
      setItems(request.items.map((item) => ({
        id: item.id,
        code: item.product.code,
        name: item.product.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: '',
        productId: item.product.id,
      })));
    } else {
      setItems([]);
    }
  };

  const updateItemPrice = (id: string, price: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, unitPrice: price } : i)));
  };

  const total = items.reduce((sum, item) => {
    const price = parseFloat(item.unitPrice) || 0;
    return sum + item.quantity * price;
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('/purchasing/quotations', {
        method: 'POST',
        body: JSON.stringify({
          purchaseRequestId: selectedRequestId,
          supplierId,
          dataValidade: validUntil || undefined,
          condicaoPagamento: paymentCondition || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: parseFloat(item.unitPrice) || 0,
          })),
        }),
      });
      router.push('/compras/cotacoes');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar cotacao');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/compras/cotacoes" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Cotacao</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Registre uma cotacao de fornecedor para uma solicitacao de compra</p>
        </div>
      </div>

      {/* Request & Supplier */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados da Cotacao</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Solicitacao de Compra *</label>
            <select value={selectedRequestId} onChange={(e) => handleRequestChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              <option value="">Selecione a solicitacao...</option>
              {purchaseRequests.map((r) => (<option key={r.id} value={r.id}>{r.numero} — {r.description}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              <option value="">Selecione o fornecedor...</option>
              {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.razaoSocial}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Validade da Cotacao *</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Condicao de Pagamento</label>
            <select value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              <option value="">Selecione...</option>
              <option value="avista">A Vista</option>
              <option value="30d">30 dias</option>
              <option value="30_60">30/60 dias</option>
              <option value="30_60_90">30/60/90 dias</option>
              <option value="28ddl">28 DDL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items with prices */}
      {items.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">Itens e Precos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidade</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preco Unitario</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const price = parseFloat(item.unitPrice) || 0;
                  const subtotal = item.quantity * price;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-center">{item.unit}</td>
                      <td className="px-4 py-3">
                        <input type="number" value={item.unitPrice} onChange={(e) => updateItemPrice(item.id, e.target.value)} placeholder="0,00" step="0.01" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-700 text-right">Total:</td>
                  <td className="px-4 py-3 text-sm font-bold text-orange-700 text-right">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/compras/cotacoes" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" /> Salvar Cotacao
        </button>
      </div>
    </div>
  );
}
