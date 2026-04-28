'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Pencil, Check, X, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NaturezaJuridica {
  id: string;
  codigoIbge?: string;
  sigla: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
}

interface RamoAtividade {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
}

// ─── Empty forms ─────────────────────────────────────────────────────────────

const emptyNJ: Omit<NaturezaJuridica, 'id'> = {
  codigoIbge: '',
  sigla: '',
  descricao: '',
  ativo: true,
  ordem: 0,
};

const emptyRA: Omit<RamoAtividade, 'id'> = {
  codigo: '',
  descricao: '',
  ativo: true,
  ordem: 0,
};

// ─── Toast helper ─────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
      {type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TabelasDominioPage() {
  const [activeTab, setActiveTab] = useState<'natureza' | 'ramo'>('natureza');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── NaturezaJuridica state ──
  const [naturezas, setNaturezas] = useState<NaturezaJuridica[]>([]);
  const [loadingNJ, setLoadingNJ] = useState(false);
  const [editingNJ, setEditingNJ] = useState<NaturezaJuridica | null>(null);
  const [showFormNJ, setShowFormNJ] = useState(false);
  const [formNJ, setFormNJ] = useState(emptyNJ);
  const [savingNJ, setSavingNJ] = useState(false);

  // ── RamoAtividade state ──
  const [ramos, setRamos] = useState<RamoAtividade[]>([]);
  const [loadingRA, setLoadingRA] = useState(false);
  const [editingRA, setEditingRA] = useState<RamoAtividade | null>(null);
  const [showFormRA, setShowFormRA] = useState(false);
  const [formRA, setFormRA] = useState(emptyRA);
  const [savingRA, setSavingRA] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  // ─── NaturezaJuridica CRUD ────────────────────────────────────────────────

  async function fetchNaturezas() {
    setLoadingNJ(true);
    try {
      const res = await apiFetch('/api/ref-tables/naturezas-juridicas');
      const json = await res.json();
      setNaturezas(Array.isArray(json) ? json : []);
    } catch {
      setNaturezas([]);
    } finally {
      setLoadingNJ(false);
    }
  }

  function openNewNJ() {
    setEditingNJ(null);
    setFormNJ(emptyNJ);
    setShowFormNJ(true);
  }

  function openEditNJ(nj: NaturezaJuridica) {
    setEditingNJ(nj);
    setFormNJ({ codigoIbge: nj.codigoIbge ?? '', sigla: nj.sigla, descricao: nj.descricao, ativo: nj.ativo, ordem: nj.ordem });
    setShowFormNJ(true);
  }

  function cancelNJ() {
    setShowFormNJ(false);
    setEditingNJ(null);
    setFormNJ(emptyNJ);
  }

  async function saveNJ() {
    if (!formNJ.sigla.trim() || !formNJ.descricao.trim()) {
      showToast('Sigla e Descrição são obrigatórias.', 'error');
      return;
    }
    setSavingNJ(true);
    try {
      const body = { ...formNJ, codigoIbge: formNJ.codigoIbge || undefined, ordem: Number(formNJ.ordem) };
      if (editingNJ) {
        await apiFetch(`/api/ref-tables/naturezas-juridicas/${editingNJ.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        showToast('Natureza Jurídica atualizada.');
      } else {
        await apiFetch('/api/ref-tables/naturezas-juridicas', { method: 'POST', body: JSON.stringify(body) });
        showToast('Natureza Jurídica criada.');
      }
      cancelNJ();
      fetchNaturezas();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao salvar.', 'error');
    } finally {
      setSavingNJ(false);
    }
  }

  async function toggleAtivoNJ(nj: NaturezaJuridica) {
    try {
      await apiFetch(`/api/ref-tables/naturezas-juridicas/${nj.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !nj.ativo }) });
      fetchNaturezas();
    } catch {
      showToast('Erro ao alterar status.', 'error');
    }
  }

  // ─── RamoAtividade CRUD ───────────────────────────────────────────────────

  async function fetchRamos() {
    setLoadingRA(true);
    try {
      const res = await apiFetch('/api/ref-tables/ramos-atividade');
      const json = await res.json();
      setRamos(Array.isArray(json) ? json : []);
    } catch {
      setRamos([]);
    } finally {
      setLoadingRA(false);
    }
  }

  function openNewRA() {
    setEditingRA(null);
    setFormRA(emptyRA);
    setShowFormRA(true);
  }

  function openEditRA(ra: RamoAtividade) {
    setEditingRA(ra);
    setFormRA({ codigo: ra.codigo, descricao: ra.descricao, ativo: ra.ativo, ordem: ra.ordem });
    setShowFormRA(true);
  }

  function cancelRA() {
    setShowFormRA(false);
    setEditingRA(null);
    setFormRA(emptyRA);
  }

  async function saveRA() {
    if (!formRA.codigo.trim() || !formRA.descricao.trim()) {
      showToast('Código e Descrição são obrigatórios.', 'error');
      return;
    }
    setSavingRA(true);
    try {
      const body = { ...formRA, ordem: Number(formRA.ordem) };
      if (editingRA) {
        await apiFetch(`/api/ref-tables/ramos-atividade/${editingRA.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        showToast('Ramo de Atividade atualizado.');
      } else {
        await apiFetch('/api/ref-tables/ramos-atividade', { method: 'POST', body: JSON.stringify(body) });
        showToast('Ramo de Atividade criado.');
      }
      cancelRA();
      fetchRamos();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao salvar.', 'error');
    } finally {
      setSavingRA(false);
    }
  }

  async function toggleAtivoRA(ra: RamoAtividade) {
    try {
      await apiFetch(`/api/ref-tables/ramos-atividade/${ra.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !ra.ativo }) });
      fetchRamos();
    } catch {
      showToast('Erro ao alterar status.', 'error');
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchNaturezas();
    fetchRamos();
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tabelas de Domínio</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie as classificações utilizadas no cadastro de pessoas e no motor fiscal.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: 'natureza', label: 'Natureza Jurídica' },
          { key: 'ramo',    label: 'Ramo de Atividade' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Natureza Jurídica ────────────────────────────────────────────── */}
      {activeTab === 'natureza' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {naturezas.length} {naturezas.length === 1 ? 'registro' : 'registros'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={fetchNaturezas}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </button>
              <button
                onClick={openNewNJ}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Natureza
              </button>
            </div>
          </div>

          {/* Form NJ */}
          {showFormNJ && (
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-800">
                {editingNJ ? 'Editar Natureza Jurídica' : 'Nova Natureza Jurídica'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Sigla *</label>
                  <input
                    type="text"
                    value={formNJ.sigla}
                    onChange={(e) => setFormNJ((f) => ({ ...f, sigla: e.target.value.toUpperCase() }))}
                    placeholder="Ex: LTDA"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Código IBGE</label>
                  <input
                    type="text"
                    value={formNJ.codigoIbge}
                    onChange={(e) => setFormNJ((f) => ({ ...f, codigoIbge: e.target.value }))}
                    placeholder="Ex: 2062"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
                  <input
                    type="number"
                    value={formNJ.ordem}
                    onChange={(e) => setFormNJ((f) => ({ ...f, ordem: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={formNJ.descricao}
                  onChange={(e) => setFormNJ((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Sociedade Limitada"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formNJ.ativo}
                    onChange={(e) => setFormNJ((f) => ({ ...f, ativo: e.target.checked }))}
                    className="rounded"
                  />
                  Ativo
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveNJ}
                  disabled={savingNJ}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingNJ ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={cancelNJ}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Table NJ */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loadingNJ ? (
              <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
            ) : naturezas.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Nenhum registro encontrado.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sigla</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cód. IBGE</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Ordem</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {naturezas.map((nj) => (
                    <tr key={nj.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{nj.sigla}</td>
                      <td className="px-4 py-3 text-slate-700">{nj.descricao}</td>
                      <td className="px-4 py-3 text-slate-500">{nj.codigoIbge || '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{nj.ordem}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${nj.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {nj.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditNJ(nj)}
                            title="Editar"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleAtivoNJ(nj)}
                            title={nj.ativo ? 'Desativar' : 'Ativar'}
                            className={`p-1.5 rounded-lg transition-colors ${nj.ativo ? 'text-emerald-500 hover:text-slate-400 hover:bg-slate-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          >
                            {nj.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Ramo de Atividade ────────────────────────────────────────────── */}
      {activeTab === 'ramo' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {ramos.length} {ramos.length === 1 ? 'registro' : 'registros'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={fetchRamos}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </button>
              <button
                onClick={openNewRA}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Ramo
              </button>
            </div>
          </div>

          {/* Form RA */}
          {showFormRA && (
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-800">
                {editingRA ? 'Editar Ramo de Atividade' : 'Novo Ramo de Atividade'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Código *</label>
                  <input
                    type="text"
                    value={formRA.codigo}
                    onChange={(e) => setFormRA((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ex: INDUSTRIA"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
                  <input
                    type="number"
                    value={formRA.ordem}
                    onChange={(e) => setFormRA((f) => ({ ...f, ordem: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRA.ativo}
                      onChange={(e) => setFormRA((f) => ({ ...f, ativo: e.target.checked }))}
                      className="rounded"
                    />
                    Ativo
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={formRA.descricao}
                  onChange={(e) => setFormRA((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Indústria"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveRA}
                  disabled={savingRA}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingRA ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={cancelRA}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Table RA */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loadingRA ? (
              <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
            ) : ramos.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Nenhum registro encontrado.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Ordem</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ramos.map((ra) => (
                    <tr key={ra.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{ra.codigo}</td>
                      <td className="px-4 py-3 text-slate-700">{ra.descricao}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{ra.ordem}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ra.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {ra.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditRA(ra)}
                            title="Editar"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleAtivoRA(ra)}
                            title={ra.ativo ? 'Desativar' : 'Ativar'}
                            className={`p-1.5 rounded-lg transition-colors ${ra.ativo ? 'text-emerald-500 hover:text-slate-400 hover:bg-slate-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          >
                            {ra.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
