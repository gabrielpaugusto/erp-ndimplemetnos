'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Plus, Trash2, Package, FileText } from 'lucide-react';
import { api } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface RequestItem {
  id: string;
  productId: string;
  quantity: string;
  unit: string;
  estimatedPrice: string;
  description: string;
}

interface Product {
  id: string;
  code: string;
  description: string;
  unit: string;
}

export default function NovaSolicitacaoCompraPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [priority, setPriority] = useState(5);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<RequestItem[]>([
    { id: '1', productId: '', quantity: '1', unit: 'UN', estimatedPrice: '', description: '' },
  ]);

  useEffect(() => {
    api<{ data: Product[] }>('/products?limit=200')
      .then((res) => setProducts(res.data ?? []))
      .catch(() => setProducts([]));
  }, []);

  const addItem = () => {
    setItems([...items, { id: String(Date.now()), productId: '', quantity: '1', unit: 'UN', estimatedPrice: '', description: '' }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof RequestItem, value: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const totalEstimated = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.estimatedPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('/purchasing/requests', {
        method: 'POST',
        body: JSON.stringify({
          description,
          justificativa,
          priority,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit,
            estimatedPrice: item.estimatedPrice ? parseFloat(item.estimatedPrice) : undefined,
            specifications: item.description || undefined,
          })),
        }),
      });
      router.push('/compras/solicitacoes');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar solicitacao');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/compras/solicitacoes" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Solicitacao de Compra</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Solicite materiais e insumos para producao</p>
        </div>
      </div>

      {/* General Info */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Informacoes Gerais</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Chapas de aco para producao de chassis"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Justificativa</label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              placeholder="Justifique a necessidade desta compra..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Priority Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Prioridade</label>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                priority >= 8 ? 'bg-red-100 text-red-700' : priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {priority} — {priority >= 8 ? 'Urgente' : priority >= 5 ? 'Normal' : 'Baixa'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-400">1 — Baixa</span>
              <span className="text-xs text-slate-400">10 — Urgente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Itens da Solicitacao</h2>
          </div>
          <button onClick={addItem} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Adicionar Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/3">Produto</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Qtd</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Unidade</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Preco Est.</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Observacao</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Subtotal</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.estimatedPrice) || 0;
                const subtotal = qty * price;
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <select value={item.productId} onChange={(e) => updateItem(item.id, 'productId', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="">Selecione...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} min="1" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="UN">Unidade (UN)</option>
                        <option value="KG">Quilograma (KG)</option>
                        <option value="M">Metro (M)</option>
                        <option value="M2">Metro² (M²)</option>
                        <option value="L">Litro (L)</option>
                        <option value="CJ">Conjunto (CJ)</option>
                        <option value="PC">Peça (PC)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.estimatedPrice} onChange={(e) => updateItem(item.id, 'estimatedPrice', e.target.value)} placeholder="0,00" step="0.01" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="Obs..." className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-900 text-right">{formatCurrency(subtotal)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeItem(item.id)} disabled={items.length <= 1} className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={5} className="px-3 py-3 text-sm font-semibold text-slate-700 text-right">Total Estimado:</td>
                <td className="px-3 py-3 text-sm font-bold text-amber-700 text-right">{formatCurrency(totalEstimated)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/compras/solicitacoes" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" />
          Criar Solicitacao
        </button>
      </div>
    </div>
  );
}
