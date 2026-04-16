'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Layers, Plus, Trash2, Package, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Product {
  id: string;
  code: string;
  description: string;
  type: string;
  unit: string;
}

interface BOMItemForm {
  uid: number;
  productId: string;
  quantity: string;
  unit: string;
  wastagePercent: string;
}

let uidCounter = 1;

export default function NovaBOMPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  const [productId, setProductId] = useState('');
  const [version, setVersion] = useState('1');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<BOMItemForm[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await apiFetch('/api/engineering/products?limit=200');
        if (!res.ok) throw new Error('Erro ao carregar produtos');
        const data = await res.json();
        setProducts(data.data ?? data);
      } catch {
        // silently fail — user will see empty dropdown
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        uid: uidCounter++,
        productId: '',
        quantity: '1',
        unit: 'UN',
        wastagePercent: '0',
      },
    ]);
  };

  const removeItem = (uid: number) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const updateItem = (uid: number, field: keyof BOMItemForm, value: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== uid) return i;
        const updated = { ...i, [field]: value };
        // Auto-fill unit from product
        if (field === 'productId') {
          const prod = products.find((p) => p.id === value);
          if (prod?.unit) updated.unit = prod.unit;
        }
        return updated;
      })
    );
  };

  const validate = (): string => {
    if (!productId) return 'Selecione o produto da BOM.';
    if (!version || parseInt(version) < 1) return 'Versão inválida (deve ser >= 1).';
    if (items.length === 0) return 'Adicione pelo menos um componente.';
    for (const item of items) {
      if (!item.productId) return 'Selecione o produto em todos os itens.';
      if (!parseFloat(item.quantity) || parseFloat(item.quantity) <= 0) return 'Quantidade inválida em algum item.';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const res = await apiFetch('/api/pcp/bom', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          version: parseInt(version),
          description: description.trim() || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: parseFloat(i.quantity),
            unit: i.unit,
            wastagePercent: parseFloat(i.wastagePercent) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Erro ao salvar BOM');
      }
      const newBom = await res.json();
      router.push(`/pcp/bom/${newBom.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/pcp/bom"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Estrutura de Produto (BOM)</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Defina os componentes e materiais necessários para fabricação
          </p>
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{saveError}</span>
          <button onClick={() => setSaveError('')} className="ml-auto p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Produto e Versão */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-slate-900">Produto</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Produto *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={loadingProducts}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-slate-50"
            >
              <option value="">{loadingProducts ? 'Carregando produtos...' : 'Selecione o produto'}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Versão *</label>
            <input
              type="number"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              min="1"
              step="1"
              placeholder="Ex: 1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição opcional da BOM..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">Componentes</h2>
            <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Componente
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            Nenhum componente adicionado. Clique em &quot;Adicionar Componente&quot; para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Componente</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Quantidade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Unidade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Perda (%)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.uid} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2">
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(item.uid, 'productId', e.target.value)}
                        disabled={loadingProducts}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-slate-50"
                      >
                        <option value="">Selecione...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.uid, 'quantity', e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(item.uid, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="UN">Unidade (UN)</option>
                        <option value="M">Metro (M)</option>
                        <option value="M2">Metro² (M²)</option>
                        <option value="M3">Metro³ (M³)</option>
                        <option value="KG">Quilograma (KG)</option>
                        <option value="L">Litro (L)</option>
                        <option value="PC">Peça (PC)</option>
                        <option value="CJ">Conjunto (CJ)</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.wastagePercent}
                        onChange={(e) => updateItem(item.uid, 'wastagePercent', e.target.value)}
                        min="0"
                        max="100"
                        step="0.5"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeItem(item.uid)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/pcp/bom"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar BOM'}
        </button>
      </div>
    </div>
  );
}
