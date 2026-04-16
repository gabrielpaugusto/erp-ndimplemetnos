'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  X,
  Package,
  FileText,
  Plus,
  Trash2,
  ArrowRightLeft,
  ShoppingCart,
  Building2,
  Factory,
  Wrench,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// A8: todos os tipos de requisição com finalidade explícita
type ReqType = 'INTERNA' | 'COMPRA' | 'TRANSFERENCIA' | 'OP' | 'RGGF' | 'RUC';

interface ReqItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
}

interface ReqForm {
  type: ReqType;
  linkedOsId: string;
  linkedCldId: string;
  linkedOpId: string;
  justificativa: string;
}

interface ProductOption {
  id: string;
  name: string;
  code: string;
  unit: string;
}

interface DropdownOption {
  id: string;
  label: string;
}

// A8: Finalidade da requisição — determina o source do StockMovement e valida flags do produto
const typeOptions: { key: ReqType; label: string; desc: string; icon: React.ReactNode; badge?: string }[] = [
  { key: 'OP',           label: 'Ordem de Produção', desc: 'Saída para fabricação — valida flag usoProducaoOp',      icon: <Factory     className="w-5 h-5" />, badge: 'CFOP 5101' },
  { key: 'RGGF',         label: 'GGF',               desc: 'Gastos Gerais de Fabricação — controla estoque GGF',     icon: <Zap         className="w-5 h-5" />, badge: 'CFOP 1101' },
  { key: 'INTERNA',      label: 'Ordem de Serviço',  desc: 'Materiais para OS/Caldeiraria — valida flag usoOficinaOs', icon: <Wrench    className="w-5 h-5" /> },
  { key: 'RUC',          label: 'Uso e Consumo',     desc: 'Despesa direta — sem crédito ICMS (MUC)',               icon: <Building2   className="w-5 h-5" /> },
  { key: 'COMPRA',       label: 'Compra',            desc: 'Necessita processo de compra via OC',                    icon: <ShoppingCart className="w-5 h-5" /> },
  { key: 'TRANSFERENCIA',label: 'Transferência',     desc: 'Transferência entre locais/setores',                     icon: <ArrowRightLeft className="w-5 h-5" /> },
];

export default function NovaRequisicaoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [osList, setOsList] = useState<DropdownOption[]>([]);
  const [cldList, setCldList] = useState<DropdownOption[]>([]);
  const [opList, setOpList] = useState<DropdownOption[]>([]);

  const [form, setForm] = useState<ReqForm>({
    type: 'INTERNA',
    linkedOsId: '',
    linkedCldId: '',
    linkedOpId: '',
    justificativa: '',
  });

  const [items, setItems] = useState<ReqItem[]>([
    { id: '1', productId: '', productName: '', quantity: '1', unit: '' },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsRes, osRes, cldRes, opRes] = await Promise.all([
          apiFetch('/api/products?limit=200'),
          apiFetch('/api/service-orders?status=ABERTA&limit=100'),
          apiFetch('/api/calderaria?status=PENDENTE&limit=100'),
          apiFetch('/api/production/orders?limit=100'),
        ]);

        if (productsRes.ok) {
          const data = await productsRes.json();
          const items = data.data || data || [];
          setProducts(
            items.map((p: any) => ({
              id: p.id,
              name: p.description ?? p.name ?? '—',
              code: p.code ?? '',
              unit: p.unit ?? 'UN',
            }))
          );
        }

        if (osRes.ok) {
          const data = await osRes.json();
          const items = data.data || [];
          setOsList(
            items.map((os: any) => ({
              id: os.id,
              label: `${os.numero} — ${os.type} ${os.veiculoDescricao ?? ''}`.trim(),
            }))
          );
        }

        if (cldRes.ok) {
          const data = await cldRes.json();
          const items = data.data || [];
          setCldList(
            items.map((cld: any) => ({
              id: cld.id,
              label: `${cld.numero} — ${cld.serviceType ?? ''}`.trim(),
            }))
          );
        }

        if (opRes.ok) {
          const data = await opRes.json();
          const items = data.data || [];
          setOpList(
            items.map((op: any) => ({
              id: op.id,
              label: `${op.numero} — ${op.description ?? op.productDescription ?? ''}`.trim(),
            }))
          );
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, []);

  const updateForm = (field: keyof ReqForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), productId: '', productName: '', quantity: '1', unit: '' },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof ReqItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'productId' && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            updated.productName = product.name;
            updated.unit = product.unit;
          }
        }
        return updated;
      })
    );
  };

  const handleSave = async () => {
    setError(null);

    const filledItems = items.filter((i) => i.productId);
    if (filledItems.length === 0) {
      setError('Adicione ao menos um produto a requisicao.');
      return;
    }
    if (!form.justificativa) {
      setError('Informe a justificativa.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        type: form.type,
        serviceOrderId: form.linkedOsId || undefined,
        calderariaOrderId: form.linkedCldId || undefined,
        productionOrderId: form.linkedOpId || undefined,
        justificativa: form.justificativa,
        items: filledItems.map((i) => ({
          productId: i.productId,
          quantityRequested: parseFloat(i.quantity) || 1,
          unit: i.unit || undefined,
        })),
      };

      const res = await apiFetch('/api/requisitions', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        setError(errData.message || 'Erro ao criar requisicao.');
        return;
      }

      router.push('/requisicoes/lista');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar requisicao.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/requisicoes/lista"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Requisicao</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Crie uma nova requisicao de materiais ou transferencia
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Finalidade (A8 — obrigatória, determina source do StockMovement) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Finalidade da Requisição *</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Define a destinação fiscal e o controle de estoque. Produtos precisam ter a flag correspondente habilitada.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {typeOptions.map((opt) => (
            <label
              key={opt.key}
              className={`flex flex-col items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                form.type === opt.key
                  ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="type"
                value={opt.key}
                checked={form.type === opt.key}
                onChange={() => updateForm('type', opt.key)}
                className="sr-only"
              />
              <div className={`mb-2 ${form.type === opt.key ? 'text-teal-700' : 'text-slate-400'}`}>
                {opt.icon}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                {opt.badge && (
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {opt.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Vinculo de Origem */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Origem (opcional)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ordem de Servico (OS)</label>
            <select
              value={form.linkedOsId}
              onChange={(e) => {
                updateForm('linkedOsId', e.target.value);
                if (e.target.value) {
                  updateForm('linkedCldId', '');
                  updateForm('linkedOpId', '');
                }
              }}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">Nenhuma</option>
              {osList.map((os) => (
                <option key={os.id} value={os.id}>{os.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Calderaria (CLD)</label>
            <select
              value={form.linkedCldId}
              onChange={(e) => {
                updateForm('linkedCldId', e.target.value);
                if (e.target.value) {
                  updateForm('linkedOsId', '');
                  updateForm('linkedOpId', '');
                }
              }}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">Nenhuma</option>
              {cldList.map((cld) => (
                <option key={cld.id} value={cld.id}>{cld.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ordem de Producao (OP)</label>
            <select
              value={form.linkedOpId}
              onChange={(e) => {
                updateForm('linkedOpId', e.target.value);
                if (e.target.value) {
                  updateForm('linkedOsId', '');
                  updateForm('linkedCldId', '');
                }
              }}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">Nenhuma</option>
              {opList.map((op) => (
                <option key={op.id} value={op.id}>{op.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Justificativa */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Justificativa *</label>
        <textarea
          value={form.justificativa}
          onChange={(e) => updateForm('justificativa', e.target.value)}
          rows={3}
          placeholder="Descreva a necessidade e justificativa da requisicao..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900">Itens da Requisicao</h2>
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Qtd</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Unidade</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(item.id, 'productId', e.target.value)}
                      disabled={loadingData}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
                    >
                      <option value="">{loadingData ? 'Carregando...' : 'Selecione o produto'}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      min="1"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-sm font-medium text-slate-600">
                      {item.unit || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/requisicoes/lista"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Criar Requisicao'}
        </button>
      </div>
    </div>
  );
}
