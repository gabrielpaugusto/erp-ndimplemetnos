'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Save, X, ArrowUpDown,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, TrendingUp, TrendingDown, Wrench, RotateCcw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type MovementType = 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'CONSUMO_INTERNO' | 'DEVOLUCAO';

const typeOptions: { key: MovementType; label: string; desc: string; icon: typeof ArrowDownLeft; color: string; selectedColor: string }[] = [
  { key: 'ENTRADA', label: 'Entrada', desc: 'Recebimento de material de compra ou producao', icon: ArrowDownLeft, color: 'text-emerald-600', selectedColor: 'border-emerald-500 bg-emerald-50 ring-emerald-200' },
  { key: 'SAIDA', label: 'Saida', desc: 'Requisicao de material para producao ou venda', icon: ArrowUpRight, color: 'text-red-600', selectedColor: 'border-red-500 bg-red-50 ring-red-200' },
  { key: 'TRANSFERENCIA', label: 'Transferencia', desc: 'Movimentacao entre locais de estoque', icon: ArrowLeftRight, color: 'text-blue-600', selectedColor: 'border-blue-500 bg-blue-50 ring-blue-200' },
  { key: 'AJUSTE_POSITIVO', label: 'Ajuste Positivo', desc: 'Correcao de saldo para mais (inventario)', icon: TrendingUp, color: 'text-emerald-600', selectedColor: 'border-emerald-500 bg-emerald-50 ring-emerald-200' },
  { key: 'AJUSTE_NEGATIVO', label: 'Ajuste Negativo', desc: 'Correcao de saldo para menos (inventario)', icon: TrendingDown, color: 'text-orange-600', selectedColor: 'border-orange-500 bg-orange-50 ring-orange-200' },
  { key: 'CONSUMO_INTERNO', label: 'Consumo Interno', desc: 'Consumo de material na producao sem requisicao formal', icon: Wrench, color: 'text-purple-600', selectedColor: 'border-purple-500 bg-purple-50 ring-purple-200' },
  { key: 'DEVOLUCAO', label: 'Devolucao', desc: 'Retorno de material nao utilizado na producao', icon: RotateCcw, color: 'text-cyan-600', selectedColor: 'border-cyan-500 bg-cyan-50 ring-cyan-200' },
];

const sourceOptions = [
  { id: 'MANUAL', label: 'Manual' },
  { id: 'PEDIDO_COMPRA', label: 'Pedido de Compra' },
  { id: 'ORDEM_PRODUCAO', label: 'Ordem de Producao' },
  { id: 'INVENTARIO', label: 'Inventario' },
  { id: 'VENDA', label: 'Venda' },
  { id: 'REQUISICAO', label: 'Requisicao' },
];

interface Product {
  id: string;
  name: string;
  code: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

export default function NovaMovimentacaoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<MovementType>('ENTRADA');
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [destLocationId, setDestLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [source, setSource] = useState('MANUAL');
  const [documentNumber, setDocumentNumber] = useState('');
  const [observations, setObservations] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
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

  const showDestination = type === 'TRANSFERENCIA';
  const showCost = ['ENTRADA', 'AJUSTE_POSITIVO', 'DEVOLUCAO'].includes(type);

  const handleSave = async () => {
    if (!productId) { alert('Selecione o produto.'); return; }
    if (!locationId) { alert('Selecione o local.'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { alert('Informe a quantidade.'); return; }
    if (showDestination && !destLocationId) { alert('Selecione o local de destino.'); return; }

    setSaving(true);
    try {
      const body: Record<string, any> = {
        productId,
        locationId,
        type,
        source,
        quantity: parseFloat(quantity),
        documentNumber: documentNumber || undefined,
        observations: observations || undefined,
      };
      if (showCost && unitCost) {
        body.unitCost = parseFloat(unitCost);
      }
      if (showDestination && destLocationId) {
        body.locationDestinationId = destLocationId;
      }

      const res = await apiFetch('/api/inventory/movements', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Erro ao registrar movimentacao');
        return;
      }
      router.push('/estoque/movimentacoes');
    } catch {
      alert('Erro ao registrar movimentacao');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/estoque/movimentacoes" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Movimentacao de Estoque</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Registre entradas, saidas, transferencias e ajustes</p>
        </div>
      </div>

      {/* Movement Type */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpDown className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Tipo de Movimentacao *</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {typeOptions.map((opt) => {
            const IconComp = opt.icon;
            return (
              <label
                key={opt.key}
                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  type === opt.key ? `${opt.selectedColor} ring-2` : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input type="radio" name="movType" value={opt.key} checked={type === opt.key} onChange={() => setType(opt.key)} className="sr-only" />
                <IconComp className={`w-5 h-5 mt-0.5 flex-shrink-0 ${type === opt.key ? opt.color : 'text-slate-400'}`} />
                <div>
                  <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Detalhes da Movimentacao</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Produto *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={loadingData} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60">
              <option value="">{loadingData ? 'Carregando...' : 'Selecione o produto...'}</option>
              {products.map((p) => (<option key={p.id} value={p.id}>{p.code} — {p.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{showDestination ? 'Local de Origem *' : 'Local *'}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={loadingData} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60">
              <option value="">{loadingData ? 'Carregando...' : 'Selecione o local...'}</option>
              {locations.map((l) => (<option key={l.id} value={l.id}>{l.code} — {l.name}</option>))}
            </select>
          </div>
          {showDestination && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Local de Destino *</label>
              <select value={destLocationId} onChange={(e) => setDestLocationId(e.target.value)} disabled={loadingData} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60">
                <option value="">Selecione o destino...</option>
                {locations.map((l) => (<option key={l.id} value={l.id}>{l.code} — {l.name}</option>))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade *</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" min="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          {showCost && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custo Unitario (R$)</label>
              <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0,00" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
              {sourceOptions.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Numero Documento</label>
            <input type="text" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Ex: NF-12345" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
          <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} placeholder="Informacoes adicionais..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/estoque/movimentacoes" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" /> Registrar Movimentacao
        </button>
      </div>
    </div>
  );
}
