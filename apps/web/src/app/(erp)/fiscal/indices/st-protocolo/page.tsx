'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, ChevronLeft, ChevronRight, FileText, X, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const EMPTY = { ufOrigem: 'SP', ufDestino: '', ncm: '', cest: '', protocolo: '', descricaoProduto: '', mvaOriginal: '', mvaAjustado: '', vigenciaInicio: '', vigenciaFim: '' };

export default function StProtocoloPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterUfO, setFilterUfO] = useState('SP');
  const [filterUfD, setFilterUfD] = useState('');
  const [filterNcm, setFilterNcm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) p.set('search', search);
      if (filterUfO) p.set('ufOrigem', filterUfO);
      if (filterUfD) p.set('ufDestino', filterUfD);
      if (filterNcm) p.set('ncm', filterNcm);
      const res = await apiFetch(`/api/fiscal/st-protocolo?${p}`);
      if (res.ok) { const j = await res.json(); setData(j.data); setTotal(j.meta.total); }
    } catch {} finally { setLoading(false); }
  }, [page, search, filterUfO, filterUfD, filterNcm]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterUfO, filterUfD, filterNcm]);

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (row: any) => {
    setForm({
      ufOrigem: row.ufOrigem, ufDestino: row.ufDestino, ncm: row.ncm,
      cest: row.cest ?? '', protocolo: row.protocolo,
      descricaoProduto: row.descricaoProduto ?? '',
      mvaOriginal: row.mvaOriginal, mvaAjustado: row.mvaAjustado ?? '',
      vigenciaInicio: row.vigenciaInicio?.substring(0, 10) ?? '',
      vigenciaFim: row.vigenciaFim?.substring(0, 10) ?? '',
    });
    setEditing(row);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, mvaOriginal: parseFloat(form.mvaOriginal), mvaAjustado: form.mvaAjustado ? parseFloat(form.mvaAjustado) : undefined, vigenciaFim: form.vigenciaFim || undefined };
      if (editing) {
        await apiFetch(`/api/fiscal/st-protocolo/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/fiscal/st-protocolo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setShowForm(false); load();
    } catch {} finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Desativar este protocolo?')) return;
    await apiFetch(`/api/fiscal/st-protocolo/${id}`, { method: 'DELETE' });
    load();
  };

  const totalPages = Math.ceil(total / limit);
  const f = (k: string) => (v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><FileText className="w-5 h-5 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Protocolos ST / MVA</h1>
            <p className="text-slate-500 text-sm mt-0.5">MVA por UF × NCM × Protocolo CONFAZ — base para cálculo do ICMS-ST interestadual</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Novo Protocolo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-3">
        <select value={filterUfO} onChange={e => setFilterUfO(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">Todas UF Origem</option>
          {UFS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterUfD} onChange={e => setFilterUfD(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">Todas UF Destino</option>
          {UFS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <input placeholder="NCM" value={filterNcm} onChange={e => setFilterNcm(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input placeholder="Buscar protocolo, CEST, produto..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="bg-white rounded-lg border-2 border-orange-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{editing ? 'Editar Protocolo' : 'Novo Protocolo ST/MVA'}</h2>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">UF Origem *</label>
              <select value={form.ufOrigem} onChange={e => f('ufOrigem')(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">UF Destino *</label>
              <select value={form.ufDestino} onChange={e => f('ufDestino')(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Selecione</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">NCM *</label>
              <input value={form.ncm} onChange={e => f('ncm')(e.target.value)} placeholder="8716.39.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">CEST</label>
              <input value={form.cest} onChange={e => f('cest')(e.target.value)} placeholder="01.040.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Protocolo *</label>
              <input value={form.protocolo} onChange={e => f('protocolo')(e.target.value)} placeholder="Prot. 41/2008" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">MVA Original % *</label>
              <input type="number" value={form.mvaOriginal} onChange={e => f('mvaOriginal')(e.target.value)} placeholder="30.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">MVA Ajustado %</label>
              <input type="number" value={form.mvaAjustado} onChange={e => f('mvaAjustado')(e.target.value)} placeholder="Opcional" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Vigência Início *</label>
              <input type="date" value={form.vigenciaInicio} onChange={e => f('vigenciaInicio')(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Descrição do Produto</label>
              <input value={form.descricaoProduto} onChange={e => f('descricaoProduto')(e.target.value)} placeholder="Ex: Reboques e semirreboques para transporte de mercadorias" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
            <button onClick={save} disabled={saving || !form.ufDestino || !form.ncm || !form.protocolo || !form.mvaOriginal || !form.vigenciaInicio}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-40 flex items-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">UF O→D</th>
              <th className="px-4 py-3 font-medium text-slate-600">NCM</th>
              <th className="px-4 py-3 font-medium text-slate-600">CEST</th>
              <th className="px-4 py-3 font-medium text-slate-600">Protocolo</th>
              <th className="px-4 py-3 font-medium text-slate-600">Descrição Produto</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right whitespace-nowrap">MVA Original %</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right whitespace-nowrap">MVA Ajust. %</th>
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Vigência</th>
              <th className="px-4 py-3 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? [...Array(5)].map((_, i) => (
              <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" /></td></tr>
            )) : data.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Nenhum protocolo cadastrado para os filtros selecionados</td></tr>
            ) : data.map((row: any) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-semibold text-orange-700">{row.ufOrigem}</span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span className="font-semibold text-blue-700">{row.ufDestino}</span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">{row.ncm}</td>
                <td className="px-4 py-3 font-mono text-slate-600 text-xs">{row.cest || '—'}</td>
                <td className="px-4 py-3 text-slate-700 text-xs">{row.protocolo}</td>
                <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate" title={row.descricaoProduto}>{row.descricaoProduto || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{Number(row.mvaOriginal).toFixed(2)}%</td>
                <td className="px-4 py-3 text-right text-slate-600">{row.mvaAjustado ? `${Number(row.mvaAjustado).toFixed(2)}%` : '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(row.vigenciaInicio).toLocaleDateString('pt-BR')}
                  {row.vigenciaFim && <> → {new Date(row.vigenciaFim).toLocaleDateString('pt-BR')}</>}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEdit(row)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                  <button onClick={() => remove(row.id)} className="text-red-500 hover:text-red-700 text-xs">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
            <span>{total} protocolos</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <span>Pág. {page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
