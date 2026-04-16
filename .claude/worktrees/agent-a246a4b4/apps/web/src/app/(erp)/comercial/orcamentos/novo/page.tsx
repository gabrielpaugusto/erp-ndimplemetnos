'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Save, Send, X, Plus, Trash2,
  Package, Wrench, Factory, CreditCard, Shield, Users, FileText,
} from 'lucide-react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
type SaleType =
  | 'ESTOQUE_PROPRIO'
  | 'VENDA_DIRETA'
  | 'PRODUCAO_PROPRIA'
  | 'VENDA_PECA'
  | 'SERVICO_OFICINA'
  | 'FI_CONSORCIO'
  | 'FI_FINANCIAMENTO'
  | 'FI_SEGURO';

interface ItemType {
  value: SaleType;
  label: string;
  icon: React.ElementType;
  color: string;
  docGenerated: string;
  needsProduct: boolean;
}

const ITEM_TYPES: ItemType[] = [
  { value: 'ESTOQUE_PROPRIO',  label: 'Produto Estoque',   icon: Package, color: 'blue',    docGenerated: 'Pedido Venda',     needsProduct: true },
  { value: 'VENDA_DIRETA',     label: 'Venda Direta',      icon: FileText, color: 'indigo', docGenerated: 'Pedido Venda',     needsProduct: true },
  { value: 'PRODUCAO_PROPRIA', label: 'Produção Própria',  icon: Factory, color: 'amber',   docGenerated: 'Ordem Produção',   needsProduct: false },
  { value: 'VENDA_PECA',       label: 'Venda Peça',        icon: Package, color: 'cyan',    docGenerated: 'Pedido Venda',     needsProduct: true },
  { value: 'SERVICO_OFICINA',  label: 'Serviço Oficina',   icon: Wrench,  color: 'orange',  docGenerated: 'Ordem Serviço',    needsProduct: false },
  { value: 'FI_CONSORCIO',     label: 'Consórcio',         icon: Users,   color: 'violet',  docGenerated: 'Cota Consórcio',   needsProduct: false },
  { value: 'FI_FINANCIAMENTO', label: 'Financiamento',     icon: CreditCard, color: 'emerald', docGenerated: 'Financiamento', needsProduct: false },
  { value: 'FI_SEGURO',        label: 'Seguro',            icon: Shield,  color: 'rose',    docGenerated: 'Apólice Seguro',   needsProduct: false },
];

function getItemTypeMeta(type: SaleType): ItemType {
  return ITEM_TYPES.find((t) => t.value === type) || ITEM_TYPES[0];
}

interface QuotationItem {
  id: string;
  itemType: SaleType;
  productId: string;
  descricaoLivre: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
}

interface QuotationForm {
  personId: string;
  leadId: string;
  vendedorId: string;
  comissaoPercent: string;
  condicaoPagamento: string;
  prazoEntrega: string;
  validadeOrcamento: string;
  observations: string;
  totalFrete: string;
}

interface Person { id: string; razaoSocial: string; nomeFantasia?: string; }
interface Product { id: string; code: string; description: string; salePrice?: number; }

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function NovoOrcamentoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<QuotationForm>({
    personId: '', leadId: '', vendedorId: '',
    comissaoPercent: '3',
    condicaoPagamento: 'À Vista',
    prazoEntrega: '30',
    validadeOrcamento: '',
    observations: '',
    totalFrete: '0',
  });

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const getCompanyId = () => {
    try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.company?.id ?? ''; } catch { return ''; }
  };

  // Load persons (clients)
  const loadPersons = useCallback(async () => {
    try {
      const companyId = getCompanyId();
      const res = await fetch(`/api/persons?companyId=${companyId}&role=CLIENTE&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.data || data;
        setPersons(list.map((p: any) => ({ id: p.id, razaoSocial: p.razaoSocial, nomeFantasia: p.nomeFantasia })));
      }
    } catch { /* ignore */ }
  }, []);

  // Load products
  const loadProducts = useCallback(async () => {
    try {
      const companyId = getCompanyId();
      const res = await fetch(`/api/products?companyId=${companyId}&limit=200`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadPersons();
    loadProducts();
  }, [loadPersons, loadProducts]);

  const updateForm = (field: keyof QuotationForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // --------------------------------------------------------------------------
  // Items
  // --------------------------------------------------------------------------
  const addItem = (type: SaleType = 'ESTOQUE_PROPRIO') => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemType: type,
        productId: '',
        descricaoLivre: '',
        quantidade: 1,
        precoUnitario: 0,
        desconto: 0,
      },
    ]);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const updateItem = (id: string, patch: Partial<QuotationItem>) => {
    setItems((prev) => prev.map((i) => i.id !== id ? i : { ...i, ...patch }));
  };

  const selectProduct = (itemId: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    updateItem(itemId, {
      productId,
      descricaoLivre: p?.description || '',
      precoUnitario: p?.salePrice || 0,
    });
  };

  const getItemTotal = (item: QuotationItem) => {
    const sub = item.quantidade * item.precoUnitario;
    return sub - (sub * item.desconto) / 100;
  };

  // --------------------------------------------------------------------------
  // Totals
  // --------------------------------------------------------------------------
  const subtotal = items.reduce((s, i) => s + getItemTotal(i), 0);
  const frete = parseFloat(form.totalFrete) || 0;
  const total = subtotal + frete;

  // Documents preview
  const docCounts = items.reduce<Record<string, number>>((acc, item) => {
    const doc = getItemTypeMeta(item.itemType).docGenerated;
    acc[doc] = (acc[doc] || 0) + 1;
    return acc;
  }, {});

  // --------------------------------------------------------------------------
  // Submit
  // --------------------------------------------------------------------------
  const handleSave = async (status: 'RASCUNHO' | 'ENVIADO') => {
    if (!form.personId) { alert('Selecione o cliente'); return; }
    if (items.length === 0) { alert('Adicione pelo menos um item'); return; }

    setSaving(true);
    try {
      const body = {
        personId: form.personId,
        leadId: form.leadId || undefined,
        vendedorId: form.vendedorId || undefined,
        comissaoPercent: parseFloat(form.comissaoPercent) || undefined,
        condicaoPagamento: form.condicaoPagamento || undefined,
        prazoEntrega: form.prazoEntrega ? `${form.prazoEntrega} dias` : undefined,
        validadeOrcamento: form.validadeOrcamento || undefined,
        observacoes: form.observations || undefined,
        items: items.map((item, idx) => ({
          sequencia: idx + 1,
          itemType: item.itemType,
          productId: item.productId || undefined,
          descricaoLivre: item.descricaoLivre || undefined,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          desconto: item.desconto || 0,
        })),
      };

      const res = await fetch('/api/sales/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao salvar');
      }

      router.push('/comercial/orcamentos');
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar orçamento');
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/comercial/orcamentos" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Orçamento</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Orçamento unificado — múltiplos tipos de item na mesma proposta</p>
        </div>
      </div>

      {/* Dados Gerais */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Dados Gerais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cliente */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
            <select value={form.personId} onChange={(e) => updateForm('personId', e.target.value)} className="input">
              <option value="">Selecione o cliente</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.nomeFantasia || p.razaoSocial}</option>
              ))}
            </select>
          </div>

          {/* Origem CRM */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lead / Atendimento CRM</label>
            <input
              type="text"
              placeholder="ID do Lead (opcional)"
              value={form.leadId}
              onChange={(e) => updateForm('leadId', e.target.value)}
              className="input"
            />
          </div>

          {/* Cond Pagamento */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Condição de Pagamento</label>
            <input value={form.condicaoPagamento} onChange={(e) => updateForm('condicaoPagamento', e.target.value)} className="input" placeholder="Ex: 3x30dd" />
          </div>

          {/* Prazo Entrega */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prazo de Entrega (dias)</label>
            <input type="number" value={form.prazoEntrega} onChange={(e) => updateForm('prazoEntrega', e.target.value)} className="input" min="0" />
          </div>

          {/* Validade */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Validade do Orçamento</label>
            <input type="date" value={form.validadeOrcamento} onChange={(e) => updateForm('validadeOrcamento', e.target.value)} className="input" />
          </div>

          {/* Frete */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frete (R$)</label>
            <input type="number" value={form.totalFrete} onChange={(e) => updateForm('totalFrete', e.target.value)} className="input" min="0" step="0.01" />
          </div>

          {/* Observações */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea value={form.observations} onChange={(e) => updateForm('observations', e.target.value)} rows={2} className="input resize-none" placeholder="Condições especiais, notas ao cliente..." />
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Itens do Orçamento</h2>
          <div className="flex items-center gap-2">
            {/* Quick-add type buttons */}
            {ITEM_TYPES.slice(0, 4).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => addItem(t.value)}
                  title={`Adicionar ${t.label}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    border-${t.color}-200 bg-${t.color}-50 text-${t.color}-700 hover:bg-${t.color}-100`}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
            <button
              onClick={() => addItem()}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={14} />
              Item
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Package size={40} className="mb-3 opacity-30" />
            <p className="font-medium">Nenhum item adicionado</p>
            <p className="text-sm mt-1">Use os botões acima para adicionar diferentes tipos de item</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const meta = getItemTypeMeta(item.itemType);
              const Icon = meta.icon;
              const itemTotal = getItemTotal(item);

              return (
                <div key={item.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    {/* Index + Type badge */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-400 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                      <div className={`p-1.5 rounded-lg bg-${meta.color}-100 text-${meta.color}-600`}>
                        <Icon size={14} />
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Item Type */}
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Tipo do Item</label>
                        <select
                          value={item.itemType}
                          onChange={(e) => updateItem(item.id, { itemType: e.target.value as SaleType, productId: '', descricaoLivre: '' })}
                          className="input text-xs"
                        >
                          {ITEM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Product or Description */}
                      <div className="lg:col-span-1">
                        <label className="block text-xs text-slate-500 mb-1">
                          {meta.needsProduct ? 'Produto' : 'Descrição'}
                        </label>
                        {meta.needsProduct ? (
                          <select
                            value={item.productId}
                            onChange={(e) => selectProduct(item.id, e.target.value)}
                            className="input text-xs"
                          >
                            <option value="">Selecione...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.code} – {p.description}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={item.descricaoLivre}
                            onChange={(e) => updateItem(item.id, { descricaoLivre: e.target.value })}
                            placeholder="Descreva o serviço / produto..."
                            className="input text-xs"
                          />
                        )}
                      </div>

                      {/* Qty + Price + Discount */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Qtd</label>
                          <input
                            type="number" min="0.001" step="0.001"
                            value={item.quantidade}
                            onChange={(e) => updateItem(item.id, { quantidade: parseFloat(e.target.value) || 0 })}
                            className="input text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Preço Unit.</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={item.precoUnitario}
                            onChange={(e) => updateItem(item.id, { precoUnitario: parseFloat(e.target.value) || 0 })}
                            className="input text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Desc %</label>
                          <input
                            type="number" min="0" max="100" step="0.1"
                            value={item.desconto}
                            onChange={(e) => updateItem(item.id, { desconto: parseFloat(e.target.value) || 0 })}
                            className="input text-xs text-center"
                          />
                        </div>
                      </div>

                      {/* Total + doc generated */}
                      <div className="flex flex-col justify-between">
                        <div className="text-right">
                          <span className="text-xs text-slate-400">Total</span>
                          <p className="font-bold text-slate-900">{formatCurrency(itemTotal)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-${meta.color}-50 text-${meta.color}-600 text-center`}>
                          → {meta.docGenerated}
                        </span>
                      </div>
                    </div>

                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 text-sm">
              <div className="flex justify-between sm:block text-right min-w-[200px]">
                <span className="text-slate-500">Subtotal:</span>
                <span className="ml-4 font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between sm:block text-right min-w-[200px]">
                <span className="text-slate-500">Frete:</span>
                <span className="ml-4 font-medium">{formatCurrency(frete)}</span>
              </div>
              <div className="flex justify-between sm:block text-right min-w-[200px] text-lg">
                <span className="font-bold text-slate-900">Total:</span>
                <span className="ml-4 font-bold text-blue-700">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Documents preview */}
      {items.length > 0 && Object.keys(docCounts).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">📄 Documentos que serão gerados ao aceitar este orçamento:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(docCounts).map(([doc, count]) => (
              <span key={doc} className="px-3 py-1 bg-white border border-blue-200 rounded-full text-sm text-blue-700 font-medium">
                {count}x {doc}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href="/comercial/orcamentos" className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">
          Cancelar
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave('RASCUNHO')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <Save size={14} />
            Salvar Rascunho
          </button>
          <button
            onClick={() => handleSave('ENVIADO')}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={14} />
            {saving ? 'Salvando...' : 'Enviar ao Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
