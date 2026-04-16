'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  X,
  User,
  Truck,
  Wrench,
  Calendar,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

type OSType = 'MANUTENCAO' | 'REFORMA' | 'INSTALACAO' | 'GARANTIA' | 'ORCAMENTO';
type Priority = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';
type ItemType = 'PECA' | 'SERVICO' | 'TERCEIRO';

interface OSItem {
  id: string;
  description: string;
  type: ItemType;
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface OSForm {
  clientId: string;
  vehicleDescription: string;
  plate: string;
  chassi: string;
  km: string;
  type: OSType;
  priority: Priority;
  defeitoRelatado: string;
  entryDate: string;
  expectedDate: string;
}

interface ClientOption {
  id: string;
  name: string;
  cpfCnpj: string;
}

interface ProductOption {
  id: string;
  name: string;
  code: string;
  price: number;
}

const typeOptions: { key: OSType; label: string; desc: string }[] = [
  { key: 'MANUTENCAO', label: 'Manutencao', desc: 'Reparo e manutencao corretiva ou preventiva' },
  { key: 'REFORMA', label: 'Reforma', desc: 'Reforma geral da carroceria ou implemento' },
  { key: 'INSTALACAO', label: 'Instalacao', desc: 'Instalacao de acessorios ou equipamentos' },
  { key: 'GARANTIA', label: 'Garantia', desc: 'Servico coberto por garantia de fabrica' },
  { key: 'ORCAMENTO', label: 'Orcamento', desc: 'Avaliacao e orcamento para o cliente' },
];

const priorityOptions: { key: Priority; label: string; color: string }[] = [
  { key: 'URGENTE', label: 'Urgente', color: 'bg-red-100 text-red-700' },
  { key: 'ALTA', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { key: 'NORMAL', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { key: 'BAIXA', label: 'Baixa', color: 'bg-gray-100 text-gray-600' },
];

const itemTypeLabels: Record<ItemType, string> = {
  PECA: 'Peca',
  SERVICO: 'Servico',
  TERCEIRO: 'Terceiro',
};

const formatCurrency = (value: number) => fmtCurrency(value);

export default function NovaOrdemServicoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<OSForm>({
    clientId: '',
    vehicleDescription: '',
    plate: '',
    chassi: '',
    km: '',
    type: 'MANUTENCAO',
    priority: 'NORMAL',
    defeitoRelatado: '',
    entryDate: '',
    expectedDate: '',
  });

  const [items, setItems] = useState<OSItem[]>([
    { id: '1', description: '', type: 'PECA', productId: '', quantity: '1', unitPrice: '0' },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsRes, productsRes] = await Promise.all([
          apiFetch('/api/persons?limit=200'),
          apiFetch('/api/products?limit=200'),
        ]);

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          const clientItems = clientsData.data || clientsData || [];
          setClients(
            clientItems.map((p: any) => ({
              id: p.id,
              name: p.razaoSocial ?? p.name ?? p.nomeFantasia ?? '—',
              cpfCnpj: p.cpfCnpj ?? '',
            }))
          );
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const productItems = productsData.data || productsData || [];
          setProducts(
            productItems.map((p: any) => ({
              id: p.id,
              name: p.description ?? p.name ?? '—',
              code: p.code ?? '',
              price: p.salePrice ?? p.price ?? 0,
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

  const updateForm = (field: keyof OSForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: '', type: 'PECA', productId: '', quantity: '1', unitPrice: '0' },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof OSItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'productId' && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            updated.description = product.name;
            updated.unitPrice = String(product.price);
          }
        }
        return updated;
      })
    );
  };

  const getItemTotal = (item: OSItem) => {
    return (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
  };

  const totalPecas = items
    .filter((i) => i.type === 'PECA')
    .reduce((sum, i) => sum + getItemTotal(i), 0);

  const totalServicos = items
    .filter((i) => i.type === 'SERVICO' || i.type === 'TERCEIRO')
    .reduce((sum, i) => sum + getItemTotal(i), 0);

  const totalGeral = totalPecas + totalServicos;

  const handleSave = async () => {
    setError(null);
    if (!form.clientId) { setError('Selecione o cliente.'); return; }
    if (!form.vehicleDescription) { setError('Informe a descricao do veiculo.'); return; }
    if (!form.defeitoRelatado) { setError('Informe o defeito relatado.'); return; }
    if (!form.entryDate) { setError('Informe a data de entrada.'); return; }

    setSaving(true);
    try {
      const body = {
        personId: form.clientId,
        type: form.type,
        priority: form.priority,
        veiculoDescricao: form.vehicleDescription,
        veiculoPlaca: form.plate || undefined,
        veiculoChassi: form.chassi || undefined,
        veiculoKm: form.km ? parseInt(form.km, 10) : undefined,
        defeitoRelatado: form.defeitoRelatado,
        dataEntrada: form.entryDate,
        dataPrevisao: form.expectedDate || undefined,
        items: items
          .filter((i) => i.description)
          .map((i) => ({
            productId: i.productId || undefined,
            description: i.description,
            quantity: parseFloat(i.quantity) || 1,
            unitPrice: parseFloat(i.unitPrice) || 0,
            type: i.type,
          })),
      };

      const res = await apiFetch('/api/service-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        setError(errData.message || 'Erro ao criar ordem de servico.');
        return;
      }

      router.push('/oficina/ordens-servico');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar ordem de servico.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/oficina/ordens-servico"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Ordem de Servico</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Crie uma nova OS para manutencao, reforma ou instalacao em veiculos
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Dados do Cliente */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Cliente</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
          <select
            value={form.clientId}
            onChange={(e) => updateForm('clientId', e.target.value)}
            disabled={loadingData}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">{loadingData ? 'Carregando...' : 'Selecione o cliente'}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.cpfCnpj ? ` — ${c.cpfCnpj}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dados do Veiculo */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Veiculo</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao do Veiculo *</label>
            <input
              type="text"
              value={form.vehicleDescription}
              onChange={(e) => updateForm('vehicleDescription', e.target.value)}
              placeholder="Ex: Carroceria Bau Refrigerado 8m — Mercedes-Benz Atego 2430"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Placa *</label>
            <input
              type="text"
              value={form.plate}
              onChange={(e) => updateForm('plate', e.target.value)}
              placeholder="ABC-1D23"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chassi</label>
            <input
              type="text"
              value={form.chassi}
              onChange={(e) => updateForm('chassi', e.target.value)}
              placeholder="9BWZZZ377VT004251"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">KM Atual</label>
            <input
              type="number"
              value={form.km}
              onChange={(e) => updateForm('km', e.target.value)}
              placeholder="125000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Tipo e Prioridade */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Tipo e Prioridade</h2>
        </div>

        {/* Type Radio Cards */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Servico *</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {typeOptions.map((opt) => (
              <label
                key={opt.key}
                className={`flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${
                  form.type === opt.key
                    ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200'
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
                <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority Select */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade *</label>
          <select
            value={form.priority}
            onChange={(e) => updateForm('priority', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
          >
            {priorityOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Defeito Relatado */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Defeito Relatado *</label>
        <textarea
          value={form.defeitoRelatado}
          onChange={(e) => updateForm('defeitoRelatado', e.target.value)}
          rows={4}
          placeholder="Descreva o defeito relatado pelo cliente ou identificado na avaliacao..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Datas */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Datas</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data de Entrada *</label>
            <input
              type="date"
              value={form.entryDate}
              onChange={(e) => updateForm('entryDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Previsao de Conclusao</label>
            <input
              type="date"
              value={form.expectedDate}
              onChange={(e) => updateForm('expectedDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Itens/Servicos */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-semibold text-slate-900">Itens e Servicos</h2>
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Tipo</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">Produto</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Qtd</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Preco Unit.</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Total</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Descricao do item ou servico"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.type}
                      onChange={(e) => updateItem(item.id, 'type', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    >
                      {Object.entries(itemTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {item.type === 'PECA' ? (
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(item.id, 'productId', e.target.value)}
                        disabled={loadingData}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Selecione</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-400 px-2">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      min="1"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-900 text-right">
                    {formatCurrency(getItemTotal(item))}
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

        {/* Totals */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Pecas:</span>
                <span className="font-medium text-slate-700">{formatCurrency(totalPecas)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Mao de Obra:</span>
                <span className="font-medium text-slate-700">{formatCurrency(totalServicos)}</span>
              </div>
              <div className="flex items-center justify-between text-base pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Total Geral:</span>
                <span className="font-bold text-rose-700">{formatCurrency(totalGeral)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/oficina/ordens-servico"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Criar Ordem de Servico'}
        </button>
      </div>
    </div>
  );
}
