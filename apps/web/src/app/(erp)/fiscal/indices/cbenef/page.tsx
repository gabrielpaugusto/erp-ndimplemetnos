'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Plus, Search, X, Pencil, Trash2, ChevronDown, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
];

const TIPO_OPTIONS = [
  { value: 'ISENCAO',           label: 'Isenção',                color: 'bg-green-100 text-green-700' },
  { value: 'REDUCAO_BASE',      label: 'Redução de Base',        color: 'bg-blue-100 text-blue-700' },
  { value: 'DIFERIMENTO',       label: 'Diferimento',            color: 'bg-yellow-100 text-yellow-700' },
  { value: 'SUSPENSAO',         label: 'Suspensão',              color: 'bg-orange-100 text-orange-700' },
  { value: 'IMUNIDADE',         label: 'Imunidade',              color: 'bg-purple-100 text-purple-700' },
  { value: 'CREDITO_OUTORGADO', label: 'Crédito Outorgado',      color: 'bg-teal-100 text-teal-700' },
];

function tipoBadge(tipo: string) {
  const opt = TIPO_OPTIONS.find((t) => t.value === tipo);
  return opt
    ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>{opt.label}</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{tipo}</span>;
}

interface CbenefItem {
  id: string;
  codigo: string;
  uf: string;
  descricao: string;
  tipo: string;
  fundamentoLegal: string | null;
  ncms: string | null;
  percentualReducao: number | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  ativo: boolean;
}

const emptyForm = (): Partial<CbenefItem> => ({
  codigo: '',
  uf: 'SP',
  descricao: '',
  tipo: 'ISENCAO',
  fundamentoLegal: '',
  ncms: '',
  percentualReducao: undefined,
  vigenciaInicio: undefined,
  vigenciaFim: undefined,
  ativo: true,
});

export default function CbenefPage() {
  const [items, setItems] = useState<CbenefItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterUf, setFilterUf] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CbenefItem>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (filterUf) params.set('uf', filterUf);
      if (filterTipo) params.set('tipo', filterTipo);
      const res = await apiFetch(`/api/fiscal/cbenef?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data);
        setTotal(json.meta.total);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterUf, filterTipo, page]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setSaveError('');
    setShowForm(true);
  };

  const openEdit = (item: CbenefItem) => {
    setEditId(item.id);
    setForm({
      ...item,
      vigenciaInicio: item.vigenciaInicio ? item.vigenciaInicio.slice(0, 10) : undefined,
      vigenciaFim: item.vigenciaFim ? item.vigenciaFim.slice(0, 10) : undefined,
    });
    setSaveError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.codigo || !form.uf || !form.descricao || !form.tipo) {
      setSaveError('Preencha Código, UF, Descrição e Tipo.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      let res: Response;
      if (editId) {
        res = await apiFetch(`/api/fiscal/cbenef/${editId}`, { method: 'PATCH', headers, body: JSON.stringify(form) });
      } else {
        res = await apiFetch('/api/fiscal/cbenef', { method: 'POST', headers, body: JSON.stringify(form) });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.message ?? `Erro ${res.status}`);
        return;
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setSaveError(e?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este CBENEF?')) return;
    try {
      await apiFetch(`/api/fiscal/cbenef/${id}`, { method: 'DELETE' });
      load();
    } catch {
      alert('Erro ao excluir');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/fiscal/indices" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-violet-600" />
            Benefícios Fiscais (CBENEF)
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Código de Benefício Fiscal — tag &lt;pBenef&gt; da NF-e
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo CBENEF
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar código, descrição, fundamento..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="relative">
          <select
            value={filterUf}
            onChange={(e) => { setFilterUf(e.target.value); setPage(1); }}
            className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Todos os estados</option>
            {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterTipo}
            onChange={(e) => { setFilterTipo(e.target.value); setPage(1); }}
            className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Todos os tipos</option>
            {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {(search || filterUf || filterTipo) && (
          <button
            onClick={() => { setSearch(''); setFilterUf(''); setFilterTipo(''); setPage(1); }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}

        <span className="ml-auto text-sm text-slate-500 self-center">{total} registros</span>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <span className="animate-spin">⟳</span> Carregando...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum CBENEF encontrado</p>
            <button onClick={openNew} className="mt-3 text-violet-600 text-sm hover:underline">
              Cadastrar primeiro registro
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Código</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">UF</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Fundamento Legal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">NCMs</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Red. %</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Vigência</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className={`hover:bg-slate-50 ${!item.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                      {item.codigo}
                    </code>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{item.uf}</td>
                  <td className="px-4 py-3">{tipoBadge(item.tipo)}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs">
                    <p className="truncate">{item.descricao}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs">
                    <p className="truncate">{item.fundamentoLegal ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[120px]">
                    <p className="truncate">{item.ncms ?? 'Todos'}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {item.percentualReducao != null ? `${Number(item.percentualReducao).toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {item.vigenciaInicio
                      ? `${new Date(item.vigenciaInicio).toLocaleDateString('pt-BR')}${item.vigenciaFim ? ` → ${new Date(item.vigenciaFim).toLocaleDateString('pt-BR')}` : ' →'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Painel lateral de formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowForm(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Header do painel */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">
                {editId ? 'Editar CBENEF' : 'Novo CBENEF'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {saveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Código *</label>
                  <input
                    value={form.codigo ?? ''}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    placeholder="SP000001"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">UF *</label>
                  <select
                    value={form.uf ?? 'SP'}
                    onChange={(e) => setForm({ ...form, uf: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
                <select
                  value={form.tipo ?? 'ISENCAO'}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição *</label>
                <textarea
                  value={form.descricao ?? ''}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descrição detalhada do benefício fiscal..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fundamento Legal</label>
                <input
                  value={form.fundamentoLegal ?? ''}
                  onChange={(e) => setForm({ ...form, fundamentoLegal: e.target.value })}
                  placeholder="Ex: RICMS/SP Art. 7°, Inc. XIV"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  NCMs aplicáveis
                  <span className="text-slate-400 font-normal ml-1">(vazio = todos, separar por vírgula)</span>
                </label>
                <input
                  value={form.ncms ?? ''}
                  onChange={(e) => setForm({ ...form, ncms: e.target.value })}
                  placeholder="8716, 7308, 7326"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {form.tipo === 'REDUCAO_BASE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">% Redução da Base</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.percentualReducao ?? ''}
                    onChange={(e) => setForm({ ...form, percentualReducao: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Ex: 33.33"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vigência Início</label>
                  <input
                    type="date"
                    value={form.vigenciaInicio ?? ''}
                    onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vigência Fim</label>
                  <input
                    type="date"
                    value={form.vigenciaFim ?? ''}
                    onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo ?? true}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="w-4 h-4 text-violet-600 rounded"
                />
                Ativo
              </label>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
