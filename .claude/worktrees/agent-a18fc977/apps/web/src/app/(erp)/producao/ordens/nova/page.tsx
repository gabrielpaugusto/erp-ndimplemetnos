'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, ClipboardList, Package, Calendar, Settings } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Strategy = 'ATO' | 'MTO' | 'MTS';
type OrderType = 'NORMAL' | 'RETRABALHO' | 'PROTOTIPO';

interface OrderForm {
  productId: string;
  strategy: Strategy;
  type: OrderType;
  routingId: string;
  saleOrderId: string;
  quantity: string;
  startDate: string;
  endDate: string;
  priority: number;
  observations: string;
}

interface ProductOption {
  id: string;
  code: string;
  description: string;
}

interface RoutingOption {
  id: string;
  code: string;
  description: string;
  version: string;
}

interface SaleOrderOption {
  id: string;
  numero: string;
  clientName: string;
}

const strategyOptions: { key: Strategy; label: string; desc: string }[] = [
  { key: 'ATO', label: 'ATO', desc: 'Assemble to Order — Montagem sob encomenda a partir de componentes em estoque' },
  { key: 'MTO', label: 'MTO', desc: 'Make to Order — Fabricação completa sob encomenda do cliente' },
  { key: 'MTS', label: 'MTS', desc: 'Make to Stock — Fabricação para estoque com base em previsão de demanda' },
];

const typeOptions: { key: OrderType; label: string }[] = [
  { key: 'NORMAL', label: 'Normal' },
  { key: 'RETRABALHO', label: 'Retrabalho' },
  { key: 'PROTOTIPO', label: 'Protótipo' },
];

export default function NovaOrdemProducaoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [routings, setRoutings] = useState<RoutingOption[]>([]);
  const [saleOrders, setSaleOrders] = useState<SaleOrderOption[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const [form, setForm] = useState<OrderForm>({
    productId: '',
    strategy: 'MTO',
    type: 'NORMAL',
    routingId: '',
    saleOrderId: '',
    quantity: '1',
    startDate: '',
    endDate: '',
    priority: 5,
    observations: '',
  });

  useEffect(() => {
    const fetchDropdowns = async () => {
      setLoadingDropdowns(true);
      try {
        const [productsRes, routingsRes, saleOrdersRes] = await Promise.all([
          apiFetch('/api/products?limit=200'),
          apiFetch('/api/pcp/routing?limit=100'),
          apiFetch('/api/sales/orders?status=APROVADO&limit=100'),
        ]);

        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(data.data || []);
        }

        if (routingsRes.ok) {
          const data = await routingsRes.json();
          setRoutings(data.data || []);
        }

        if (saleOrdersRes.ok) {
          const data = await saleOrdersRes.json();
          setSaleOrders(data.data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dropdowns:', err);
      } finally {
        setLoadingDropdowns(false);
      }
    };

    fetchDropdowns();
  }, []);

  const updateForm = (field: keyof OrderForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.productId || !form.startDate || !form.endDate) {
      alert('Preencha os campos obrigatórios: Produto, Início Previsto e Fim Previsto.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        productId: form.productId,
        strategy: form.strategy,
        type: form.type,
        quantity: parseFloat(form.quantity),
        dataInicioPrevista: form.startDate,
        dataFimPrevista: form.endDate,
        priority: form.priority,
        observations: form.observations || undefined,
      };

      if (form.routingId) payload.routingId = form.routingId;
      if (form.saleOrderId) payload.saleOrderId = form.saleOrderId;

      const res = await apiFetch('/api/production/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || 'Erro ao criar ordem de produção');
      }

      router.push('/producao/ordens');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar ordem de produção';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/producao/ordens"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Ordem de Produção</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Crie uma nova ordem de produção para fabricação de carrocerias
          </p>
        </div>
      </div>

      {/* Produto e Estratégia */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Produto e Estratégia</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Produto *</label>
            <select
              value={form.productId}
              onChange={(e) => updateForm('productId', e.target.value)}
              disabled={loadingDropdowns}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
            >
              <option value="">{loadingDropdowns ? 'Carregando...' : 'Selecione o produto'}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => updateForm('type', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {typeOptions.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Strategy Radio Cards */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Estratégia de Produção *</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {strategyOptions.map((opt) => (
              <label
                key={opt.key}
                className={`flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${
                  form.strategy === opt.key
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={opt.key}
                  checked={form.strategy === opt.key}
                  onChange={() => updateForm('strategy', opt.key)}
                  className="sr-only"
                />
                <span className="text-lg font-bold text-slate-900">{opt.label}</span>
                <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Roteiro e PV */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Roteiro e Vínculo</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Roteiro de Fabricação (opcional)</label>
            <select
              value={form.routingId}
              onChange={(e) => updateForm('routingId', e.target.value)}
              disabled={loadingDropdowns}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
            >
              <option value="">{loadingDropdowns ? 'Carregando...' : 'Nenhum roteiro vinculado'}</option>
              {routings.map((r) => (
                <option key={r.id} value={r.id}>{r.code} v{r.version} — {r.description}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pedido de Venda (opcional)</label>
            <select
              value={form.saleOrderId}
              onChange={(e) => updateForm('saleOrderId', e.target.value)}
              disabled={loadingDropdowns}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
            >
              <option value="">{loadingDropdowns ? 'Carregando...' : 'Nenhum pedido vinculado'}</option>
              {saleOrders.map((so) => (
                <option key={so.id} value={so.id}>{so.numero} — {so.clientName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quantidade, Datas e Prioridade */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Quantidade e Prazos</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade *</label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => updateForm('quantity', e.target.value)}
              min="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Início Previsto *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => updateForm('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fim Previsto *</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => updateForm('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Priority Slider */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">Prioridade</label>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
              form.priority >= 8 ? 'bg-red-100 text-red-700' : form.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {form.priority} — {form.priority >= 8 ? 'Urgente' : form.priority >= 5 ? 'Normal' : 'Baixa'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={form.priority}
            onChange={(e) => updateForm('priority', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-400">1 — Baixa</span>
            <span className="text-xs text-slate-400">10 — Urgente</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={form.observations}
            onChange={(e) => updateForm('observations', e.target.value)}
            rows={3}
            placeholder="Informações adicionais sobre a ordem de produção..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/producao/ordens"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Criando...' : 'Criar Ordem de Produção'}
        </button>
      </div>
    </div>
  );
}
