'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Plus, Trash2, Package, ShoppingCart, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency as formatCurrency } from '@/lib/format';

type ItemDestinacao =
  | 'MATERIA_PRIMA'
  | 'COMPONENTE'
  | 'PRODUTO_REVENDA'
  | 'INSUMO_PRODUCAO'
  | 'EMBALAGEM'
  | 'MATERIAL_USO_CONSUMO'
  | 'GGF'
  | 'IMOBILIZADO'
  | 'SERVICO';

const destinacaoLabels: Record<ItemDestinacao, string> = {
  MATERIA_PRIMA: 'Matéria-Prima',
  COMPONENTE: 'Componente',
  PRODUTO_REVENDA: 'Produto p/ Revenda',
  INSUMO_PRODUCAO: 'Insumo de Produção',
  EMBALAGEM: 'Embalagem',
  MATERIAL_USO_CONSUMO: 'Mat. Uso e Consumo',
  GGF: 'GGF',
  IMOBILIZADO: 'Imobilizado',
  SERVICO: 'Serviço',
};

const destinacaoComEstoque: ItemDestinacao[] = [
  'MATERIA_PRIMA', 'COMPONENTE', 'PRODUTO_REVENDA', 'INSUMO_PRODUCAO', 'EMBALAGEM',
];

interface OrderItem {
  id: string;
  productId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  icms: string;
  ipi: string;
  destinacao: ItemDestinacao;
}

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  unit: string;
}

export default function NovoPedidoCompraPage() {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [linkedRequest, setLinkedRequest] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentCondition, setPaymentCondition] = useState('');
  const [frete, setFrete] = useState('');
  const [desconto, setDesconto] = useState('');
  const [finalidade, setFinalidade] = useState<string>('INDUSTRIALIZACAO');
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', productId: '', quantity: '1', unit: 'UN', unitPrice: '', icms: '12', ipi: '5', destinacao: 'MATERIA_PRIMA' },
  ]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api<{ data: any[] }>('/persons', { params: { type: 'PJ', limit: 200 } })
      .then((result) => {
        const mapped: Supplier[] = (result.data ?? []).map((p: any) => ({
          id: p.id,
          name: p.razaoSocial ?? p.nomeFantasia ?? p.name ?? '',
        }));
        setSuppliers(mapped);
      })
      .catch(() => {});

    api<{ data: any[] }>('/products', { params: { limit: 200 } })
      .then((result) => {
        const mapped: Product[] = (result.data ?? []).map((p: any) => ({
          id: p.id,
          code: p.code ?? '',
          name: p.description ?? p.name ?? '',
          unit: p.unit ?? 'UN',
        }));
        setProducts(mapped);
      })
      .catch(() => {});
  }, []);

  const addItem = () => {
    setItems([...items, { id: String(Date.now()), productId: '', quantity: '1', unit: 'UN', unitPrice: '', icms: '12', ipi: '5', destinacao: 'MATERIA_PRIMA' }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const freteVal = parseFloat(frete) || 0;
  const descontoVal = parseFloat(desconto) || 0;
  const total = subtotal + freteVal - descontoVal;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        supplierId,
        purchaseRequestId: linkedRequest || undefined,
        dataEntregaPrevista: deliveryDate || undefined,
        condicaoPagamento: paymentCondition || undefined,
        frete: parseFloat(frete) || 0,
        desconto: parseFloat(desconto) || 0,
        finalidadeOperacao: finalidade,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit,
          unitPrice: parseFloat(item.unitPrice) || 0,
          icms: parseFloat(item.icms) || 0,
          ipi: parseFloat(item.ipi) || 0,
          destinacao: item.destinacao,
        })),
      };
      await api('/purchasing/orders', { method: 'POST', body: JSON.stringify(body) });
      router.push('/compras/pedidos');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao criar pedido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/compras/pedidos" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Pedido de Compra</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Crie um pedido de compra para um fornecedor</p>
        </div>
      </div>

      {/* Supplier & General */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Pedido</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
              <option value="">Selecione o fornecedor...</option>
              {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Solicitacao Vinculada</label>
            <select value={linkedRequest} onChange={(e) => setLinkedRequest(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
              <option value="">Nenhuma</option>
              <option value="SC-2026-001">SC-2026-001 — Chapas de aco</option>
              <option value="SC-2026-002">SC-2026-002 — Perfis e tubos</option>
              <option value="SC-2026-004">SC-2026-004 — Tintas e primers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data de Entrega *</label>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Condicao de Pagamento</label>
            <select value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
              <option value="">Selecione...</option>
              <option value="avista">A Vista</option>
              <option value="30d">30 dias</option>
              <option value="30_60">30/60 dias</option>
              <option value="30_60_90">30/60/90 dias</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Finalidade da Operação *
              <span className="ml-1 text-xs text-slate-400 font-normal">— define CFOP e créditos fiscais</span>
            </label>
            <select
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="INDUSTRIALIZACAO">Industrialização (CFOP 1.101 / 2.101)</option>
              <option value="REVENDA">Revenda (CFOP 1.102 / 2.102)</option>
              <option value="USO_CONSUMO">Uso e Consumo (CFOP 1.120 / 2.120)</option>
              <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado (CFOP 1.551 / 2.551)</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {finalidade === 'INDUSTRIALIZACAO' && 'ICMS diferido na entrada · IPI recuperável · Crédito PIS/COFINS'}
              {finalidade === 'REVENDA' && 'Crédito normal de ICMS · IPI compõe custo · Crédito PIS/COFINS'}
              {finalidade === 'USO_CONSUMO' && 'Sem crédito de ICMS · Sem crédito de IPI · DIFAL aplicável nas interestaduais'}
              {finalidade === 'ATIVO_IMOBILIZADO' && 'Crédito ICMS em 48 parcelas (1/48/mês) · Controle via CIAP'}
            </p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Itens do Pedido</h2>
          </div>
          <button onClick={addItem} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> Adicionar Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Destinação</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Qtd</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Und</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Preco Unit.</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">ICMS%</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">IPI%</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Subtotal</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.unitPrice) || 0;
                const sub = qty * price;
                const temEstoque = destinacaoComEstoque.includes(item.destinacao);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <select value={item.productId} onChange={(e) => updateItem(item.id, 'productId', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="">Selecione...</option>
                        {products.map((p) => (<option key={p.id} value={p.id}>{p.code} — {p.name}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select value={item.destinacao} onChange={(e) => updateItem(item.id, 'destinacao', e.target.value as ItemDestinacao)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                          {(Object.keys(destinacaoLabels) as ItemDestinacao[]).map((d) => (
                            <option key={d} value={d}>{destinacaoLabels[d]}</option>
                          ))}
                        </select>
                        <span title={temEstoque ? 'Gera entrada de estoque' : 'Não gera estoque'} className={`shrink-0 w-2 h-2 rounded-full ${temEstoque ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      </div>
                    </td>
                    <td className="px-3 py-2"><input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} min="1" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" /></td>
                    <td className="px-3 py-2">
                      <select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="UN">Unidade (UN)</option><option value="KG">Quilograma (KG)</option><option value="M">Metro (M)</option><option value="M2">Metro² (M²)</option><option value="L">Litro (L)</option><option value="CJ">Conjunto (CJ)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2"><input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} placeholder="0,00" step="0.01" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500" /></td>
                    <td className="px-3 py-2"><input type="number" value={item.icms} onChange={(e) => updateItem(item.id, 'icms', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" /></td>
                    <td className="px-3 py-2"><input type="number" value={item.ipi} onChange={(e) => updateItem(item.id, 'ipi', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" /></td>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-900 text-right">{formatCurrency(sub)}</td>
                    <td className="px-3 py-2"><button onClick={() => removeItem(item.id)} disabled={items.length <= 1} className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Frete, Desconto e Totais</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frete (R$)</label>
            <input type="number" value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="0,00" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Desconto (R$)</label>
            <input type="number" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-xs text-slate-500">Subtotal</p>
            <p className="text-lg font-semibold text-slate-900">{formatCurrency(subtotal)}</p>
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-xs text-slate-500">Total do Pedido</p>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/compras/pedidos" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" /> Criar Pedido de Compra
        </button>
      </div>
    </div>
  );
}
