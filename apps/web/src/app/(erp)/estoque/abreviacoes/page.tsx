'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, AlertCircle, BookOpen, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ProductAbbreviation {
  id: string;
  code: string;
  fullText: string;
  category: string | null;
  active: boolean;
}

const CATEGORIES = [
  'Material', 'Acabamento', 'Forma', 'Posicao', 'Fixacao', 'Tipo', 'Resistencia', 'Norma', 'Outro',
];

export default function AbreviacoesPage() {
  const [items, setItems] = useState<ProductAbbreviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal nova abreviacao
  const [showModal, setShowModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newFullText, setNewFullText] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const url = `/api/inventory/abbreviations${search ? `?search=${encodeURIComponent(search)}` : ''}`;
    const res = await apiFetch(url);
    if (res.ok) {
      setItems(await res.json());
    } else {
      setError('Erro ao carregar abreviacoes.');
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    setError('');
    setSuccessMsg('');
    const res = await apiFetch('/api/inventory/abbreviations/seed', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setSuccessMsg(data.message ?? 'Abreviacoes inicializadas.');
      load();
    } else {
      setError('Erro ao inicializar abreviacoes.');
    }
    setSeeding(false);
  };

  const handleCreate = async () => {
    if (!newCode.trim() || !newFullText.trim()) return;
    setSaving(true);
    setError('');
    const res = await apiFetch('/api/inventory/abbreviations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode.trim(), fullText: newFullText.trim(), category: newCategory || null }),
    });
    if (res.ok) {
      setShowModal(false);
      setNewCode('');
      setNewFullText('');
      setNewCategory('');
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.message ?? 'Erro ao criar abreviacao.');
    }
    setSaving(false);
  };

  const handleToggleActive = async (item: ProductAbbreviation) => {
    const res = await apiFetch(`/api/inventory/abbreviations/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (res.ok) load();
  };

  // Agrupamento por categoria
  const grouped = items.reduce<Record<string, ProductAbbreviation[]>>((acc, item) => {
    const cat = item.category ?? 'Sem Categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Abreviacoes de Materiais</h1>
          <p className="text-slate-500 mt-1">Codigos padrao para descricao tecnica de produtos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium disabled:opacity-50"
          >
            <BookOpen className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
            Inicializar Padroes
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova Abreviacao
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por codigo ou texto..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          onClick={load}
          className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-sm text-slate-500">{items.length} abreviacoes</span>
      </div>

      {/* Grouped Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center text-slate-500 text-sm">
          Nenhuma abreviacao encontrada. Clique em "Inicializar Padroes" para criar o cadastro inicial.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
            <div key={cat} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{cat}</h3>
                <span className="text-xs text-slate-400">{catItems.length} item(ns)</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-32">Codigo</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Texto Completo</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-20">Ativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {catItems.map((item) => (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${!item.active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2 text-sm font-mono font-semibold text-teal-700">{item.code}</td>
                      <td className="px-4 py-2 text-sm text-slate-900">{item.fullText}</td>
                      <td className="px-4 py-2 text-sm text-slate-500">{item.category ?? '—'}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            item.active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {item.active ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Abreviacao */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Nova Abreviacao</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Codigo *</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Ex: GALV"
                  maxLength={10}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Texto Completo *</label>
                <input
                  type="text"
                  value={newFullText}
                  onChange={(e) => setNewFullText(e.target.value)}
                  placeholder="Ex: Galvanizado"
                  maxLength={60}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Selecione...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); setError(''); }}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newCode.trim() || !newFullText.trim()}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
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
