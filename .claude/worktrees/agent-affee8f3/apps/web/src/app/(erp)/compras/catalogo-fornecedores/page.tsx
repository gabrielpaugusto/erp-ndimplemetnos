'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Star,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface SupplierLink {
  id: string;
  ourCode: string;
  ourDescription: string;
  supplier: string;
  supplierCNPJ: string;
  supplierCode: string;
  supplierDescription: string;
  supplierUnit: string;
  conversionFactor: number;
  lastPrice: number;
  leadTimeDays: number;
  preferred: boolean;
}

interface NewLinkForm {
  ourCode: string;
  supplierName: string;
  supplierCode: string;
  supplierDescription: string;
  supplierUnit: string;
  conversionFactor: string;
  lastPrice: string;
  leadTimeDays: string;
  preferred: boolean;
}

const emptyForm: NewLinkForm = {
  ourCode: '',
  supplierName: '',
  supplierCode: '',
  supplierDescription: '',
  supplierUnit: '',
  conversionFactor: '1',
  lastPrice: '',
  leadTimeDays: '',
  preferred: false,
};

export default function CatalogoFornecedoresPage() {
  const [links, setLinks] = useState<SupplierLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'TODOS' | 'PRODUTO' | 'FORNECEDOR'>('TODOS');
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewLinkForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchLinks = () => {
    setLoading(true);
    api<{ data: any[]; meta: any }>('/purchasing/product-suppliers', { params: { limit: 200, search: search || undefined } })
      .then((result) => {
        const mapped: SupplierLink[] = result.data.map((l) => ({
          id: l.id,
          ourCode: l.product?.code ?? '',
          ourDescription: l.product?.description ?? '',
          supplier: l.person?.razaoSocial ?? l.person?.nomeFantasia ?? '',
          supplierCNPJ: l.person?.cpfCnpj ?? '',
          supplierCode: l.codigoFornecedor ?? '',
          supplierDescription: l.descricaoFornecedor ?? '',
          supplierUnit: l.unidadeFornecedor ?? '',
          conversionFactor: Number(l.fatorConversao ?? 1),
          lastPrice: Number(l.precoUltCompra ?? 0),
          leadTimeDays: l.prazoEntregaDias ?? 0,
          preferred: Boolean(l.preferred),
        }));
        setLinks(mapped);
      })
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLinks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const suppliers = [...new Set(links.map((l) => l.supplier))].filter(Boolean);

  const filtered = links.filter((l) => {
    const matchSearch =
      search === '' ||
      l.ourCode.toLowerCase().includes(search.toLowerCase()) ||
      l.ourDescription.toLowerCase().includes(search.toLowerCase()) ||
      l.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
      l.supplierDescription.toLowerCase().includes(search.toLowerCase());
    const matchSupplier = supplierFilter === '' || l.supplier === supplierFilter;
    return matchSearch && matchSupplier;
  });

  const grouped =
    tab === 'PRODUTO'
      ? [...new Set(filtered.map((l) => l.ourCode))].map((code) => ({
          key: code,
          label: filtered.find((l) => l.ourCode === code)?.ourDescription || code,
          items: filtered.filter((l) => l.ourCode === code),
        }))
      : tab === 'FORNECEDOR'
      ? [...new Set(filtered.map((l) => l.supplier))].map((sup) => ({
          key: sup,
          label: sup,
          items: filtered.filter((l) => l.supplier === sup),
        }))
      : [{ key: 'all', label: '', items: filtered }];

  const togglePreferred = async (id: string) => {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    try {
      await api(`/purchasing/product-suppliers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ preferred: !link.preferred }),
      });
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, preferred: !l.preferred } : l)));
    } catch {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, preferred: !l.preferred } : l)));
    }
  };

  const deleteLink = async (id: string) => {
    try {
      await api(`/purchasing/product-suppliers/${id}`, { method: 'DELETE' });
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setLinks((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleSave = async () => {
    if (!form.ourCode || !form.supplierName || !form.supplierCode) return;
    try {
      if (editingId) {
        const updated = await api<any>(`/purchasing/product-suppliers/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            codigoFornecedor: form.supplierCode,
            descricaoFornecedor: form.supplierDescription,
            unidadeFornecedor: form.supplierUnit,
            fatorConversao: parseFloat(form.conversionFactor) || 1,
            precoUltCompra: parseFloat(form.lastPrice) || 0,
            prazoEntregaDias: parseInt(form.leadTimeDays) || 0,
            preferred: form.preferred,
          }),
        });
        setLinks((prev) => prev.map((l) => l.id === editingId ? {
          ...l,
          supplierCode: updated.codigoFornecedor ?? l.supplierCode,
          supplierDescription: updated.descricaoFornecedor ?? l.supplierDescription,
          supplierUnit: updated.unidadeFornecedor ?? l.supplierUnit,
          conversionFactor: Number(updated.fatorConversao ?? l.conversionFactor),
          lastPrice: Number(updated.precoUltCompra ?? l.lastPrice),
          leadTimeDays: updated.prazoEntregaDias ?? l.leadTimeDays,
          preferred: Boolean(updated.preferred),
        } : l));
      } else {
        fetchLinks();
      }
    } catch {
      // silent
    }
    setSaved(true);
    setTimeout(() => {
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      setSaved(false);
    }, 800);
  };

  const TableBody = ({ items }: { items: SupplierLink[] }) => (
    <tbody className="divide-y divide-slate-100">
      {items.length === 0 && (
        <tr>
          <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-sm">
            {loading ? 'Carregando...' : 'Nenhum registro encontrado.'}
          </td>
        </tr>
      )}
      {items.map((link) => (
        <tr key={link.id} className="hover:bg-slate-50 transition-colors">
          <td className="px-4 py-3">
            <p className="text-xs font-mono text-slate-400">{link.ourCode}</p>
            <p className="text-sm font-medium text-slate-900 max-w-[200px] truncate">{link.ourDescription}</p>
          </td>
          <td className="px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{link.supplier}</p>
            <p className="text-xs text-slate-400 font-mono">{link.supplierCNPJ}</p>
          </td>
          <td className="px-4 py-3 text-xs font-mono text-slate-600">{link.supplierCode}</td>
          <td className="px-4 py-3 text-sm text-slate-700 max-w-[180px] truncate">{link.supplierDescription}</td>
          <td className="px-4 py-3 text-sm text-slate-700 text-center">{link.supplierUnit}</td>
          <td className="px-4 py-3 text-sm text-slate-700 text-center">{link.conversionFactor}x</td>
          <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(link.lastPrice)}</td>
          <td className="px-4 py-3 text-sm text-slate-700 text-center">{link.leadTimeDays}d</td>
          <td className="px-4 py-3 text-center">
            <button
              onClick={() => togglePreferred(link.id)}
              className={`p-1 rounded transition-colors ${link.preferred ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-400'}`}
              title={link.preferred ? 'Remover preferencial' : 'Marcar como preferencial'}
            >
              <Star className={`w-4 h-4 ${link.preferred ? 'fill-amber-500' : ''}`} />
            </button>
          </td>
          <td className="px-4 py-3 text-right">
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => {
                  setForm({
                    ourCode: link.ourCode,
                    supplierName: link.supplier,
                    supplierCode: link.supplierCode,
                    supplierDescription: link.supplierDescription,
                    supplierUnit: link.supplierUnit,
                    conversionFactor: String(link.conversionFactor),
                    lastPrice: String(link.lastPrice),
                    leadTimeDays: String(link.leadTimeDays),
                    preferred: link.preferred,
                  });
                  setEditingId(link.id);
                  setShowModal(true);
                }}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteLink(link.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catalogo de Fornecedores</h1>
          <p className="text-slate-500 mt-1">Mapeamento entre nossos produtos e os codigos dos fornecedores</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setEditingId(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Vinculacao
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {(['TODOS', 'PRODUTO', 'FORNECEDOR'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'TODOS' ? 'Todos' : t === 'PRODUTO' ? 'Por Produto' : 'Por Fornecedor'}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por produto, codigo ou descricao..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="relative">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="appearance-none pl-4 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-700 min-w-[200px]"
          >
            <option value="">Todos os fornecedores</option>
            {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table(s) */}
      {grouped.map((group) => (
        <div key={group.key} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {tab !== 'TODOS' && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">{group.label}</span>
                <span className="text-xs text-amber-600 ml-1">{group.items.length} vinculacao(s)</span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nosso Produto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cod. Fornecedor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao Fornecedor</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unid. Forn.</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fator Conv.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ultimo Preco</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prazo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preferencial</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <TableBody items={group.items} />
            </table>
          </div>
        </div>
      ))}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Editar Vinculacao' : 'Nova Vinculacao'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Codigo do Produto *</label>
                  <input
                    type="text"
                    placeholder="MAT-001"
                    value={form.ourCode}
                    onChange={(e) => setForm((f) => ({ ...f, ourCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fornecedor *</label>
                  <input
                    type="text"
                    placeholder="Nome do fornecedor"
                    value={form.supplierName}
                    onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Codigo do Fornecedor *</label>
                  <input
                    type="text"
                    placeholder="AV-CH1020-12"
                    value={form.supplierCode}
                    onChange={(e) => setForm((f) => ({ ...f, supplierCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unidade do Fornecedor</label>
                  <input
                    type="text"
                    placeholder="UN / PC / CX"
                    value={form.supplierUnit}
                    onChange={(e) => setForm((f) => ({ ...f, supplierUnit: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Descricao do Fornecedor</label>
                <input
                  type="text"
                  placeholder="Como o fornecedor descreve o produto"
                  value={form.supplierDescription}
                  onChange={(e) => setForm((f) => ({ ...f, supplierDescription: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fator de Conversao</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.conversionFactor}
                    onChange={(e) => setForm((f) => ({ ...f, conversionFactor: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ultimo Preco (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.lastPrice}
                    onChange={(e) => setForm((f) => ({ ...f, lastPrice: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Prazo (dias)</label>
                  <input
                    type="number"
                    value={form.leadTimeDays}
                    onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.preferred}
                  onChange={(e) => setForm((f) => ({ ...f, preferred: e.target.checked }))}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-700">Marcar como fornecedor preferencial para este produto</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                  saved ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {saved ? <Check className="w-4 h-4" /> : null}
                {saved ? 'Salvo!' : 'Salvar Vinculacao'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
