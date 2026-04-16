'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, ClipboardCheck, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface InventoryProduct {
  id: string;
  code: string;
  name: string;
  unit: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

export default function NovoInventarioPage() {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<InventoryProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [prodRes, locRes] = await Promise.all([
          apiFetch('/api/products?limit=200'),
          apiFetch('/api/inventory/locations?limit=200'),
        ]);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          const items = prodData.data ?? prodData;
          setProducts(
            items.map((p: any) => ({
              id: p.id,
              code: p.code,
              name: p.description ?? p.name,
              unit: p.unit,
            }))
          );
        }
        if (locRes.ok) {
          const locData = await locRes.json();
          const items = locData.data ?? locData;
          setLocations(
            items.map((l: any) => ({ id: l.id, code: l.code, name: l.name }))
          );
        }
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const availableProducts = products.filter(
    (p) => !selectedProducts.find((sp) => sp.id === p.id) &&
    (productSearch === '' || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const addProduct = (product: InventoryProduct) => {
    setSelectedProducts([...selectedProducts, product]);
    setProductSearch('');
  };

  const removeProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== id));
  };

  const addAllFromLocation = () => {
    setSelectedProducts([...products]);
  };

  const handleSave = async () => {
    if (!locationId) {
      toast.error('Selecione o local de estoque.');
      return;
    }
    if (selectedProducts.length === 0) {
      toast.error('Adicione pelo menos um produto.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        locationId,
        description,
        items: selectedProducts.map((p) => ({ productId: p.id })),
      };
      const res = await apiFetch('/api/inventory/inventories', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erro ao criar inventario');
        return;
      }
      router.push('/estoque/inventario');
    } catch {
      toast.error('Erro ao criar inventario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/estoque/inventario" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Inventario</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Planeje uma contagem de estoque fisico</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="w-5 h-5 text-cyan-600" />
          <h2 className="text-lg font-semibold text-slate-900">Informacoes do Inventario</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Local de Estoque *</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={loadingData} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-60">
              <option value="">{loadingData ? 'Carregando...' : 'Selecione o local...'}</option>
              {locations.map((l) => (<option key={l.id} value={l.id}>{l.code} — {l.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Inventario mensal de materias-primas" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {/* Product Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Produtos para Contagem ({selectedProducts.length})</h2>
          <button onClick={addAllFromLocation} disabled={loadingData} className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-xs font-medium transition-colors disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Adicionar Todos do Local
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar produto para adicionar..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
        </div>

        {productSearch && availableProducts.length > 0 && (
          <div className="border border-slate-200 rounded-lg mb-4 max-h-48 overflow-y-auto">
            {availableProducts.map((p) => (
              <button key={p.id} onClick={() => addProduct(p)} className="w-full flex items-center justify-between px-4 py-2 hover:bg-cyan-50 text-left transition-colors border-b border-slate-100 last:border-b-0">
                <div>
                  <span className="text-sm text-slate-900 font-medium">{p.name}</span>
                  <span className="text-xs text-slate-500 ml-2 font-mono">{p.code}</span>
                </div>
                <Plus className="w-4 h-4 text-cyan-600" />
              </button>
            ))}
          </div>
        )}

        {/* Selected Products */}
        {selectedProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidade</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs font-mono text-slate-500">{p.code}</td>
                    <td className="px-4 py-2 text-sm text-slate-900 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-sm text-slate-700 text-center">{p.unit}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => removeProduct(p.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-slate-500">
            Nenhum produto selecionado. Busque e adicione produtos ou clique em &quot;Adicionar Todos do Local&quot;.
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/estoque/inventario" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" /> Criar Inventario
        </button>
      </div>
    </div>
  );
}
