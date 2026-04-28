'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  ClipboardList, Plus, Search, ChevronDown, ChevronRight, Trash2, Pencil, Clock, X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────

export default function TarefasCatalogoPage() {
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [contexto, setContexto] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modais
  const [tarefaModal, setTarefaModal] = useState(false);
  const [subtarefaModal, setSubtarefaModal] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<any>(null);
  const [editingSubtarefa, setEditingSubtarefa] = useState<any>(null);
  const [parentTarefaId, setParentTarefaId] = useState('');
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // ── Busca ─────────────────────────────────────────────────────────────────

  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ativo: 'true' });
      if (contexto) params.set('contexto', contexto);
      if (search) params.set('search', search);
      const res = await apiFetch(`/api/workshop/tarefas-catalogo?${params}`);
      if (!res.ok) throw new Error();
      setTarefas(await res.json());
    } catch {
      alert('Erro ao carregar catálogo de tarefas');
    } finally {
      setLoading(false);
    }
  }, [contexto, search]);

  useEffect(() => { fetchTarefas(); }, [fetchTarefas]);

  // ── Expandir/Colapsar ─────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Tarefa CRUD ───────────────────────────────────────────────────────────

  function openNewTarefa() {
    setEditingTarefa(null);
    setForm({ contexto: 'SERVICO' });
    setTarefaModal(true);
  }

  function openEditTarefa(t: any) {
    setEditingTarefa(t);
    setForm({ ...t });
    setTarefaModal(true);
  }

  async function saveTarefa() {
    setSaving(true);
    try {
      const url = editingTarefa
        ? `/api/workshop/tarefas-catalogo/${editingTarefa.id}`
        : '/api/workshop/tarefas-catalogo';
      const res = await apiFetch(url, {
        method: editingTarefa ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      setTarefaModal(false);
      fetchTarefas();
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar tarefa');
    } finally {
      setSaving(false);
    }
  }

  async function inativarTarefa(id: string) {
    if (!confirm('Inativar esta tarefa?')) return;
    await apiFetch(`/api/workshop/tarefas-catalogo/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: false }) });
    fetchTarefas();
  }

  // ── Subtarefa CRUD ────────────────────────────────────────────────────────

  function openNewSubtarefa(tarefaId: string) {
    setEditingSubtarefa(null);
    setParentTarefaId(tarefaId);
    setForm({ tempoPadraoH: 1 });
    setSubtarefaModal(true);
  }

  function openEditSubtarefa(sub: any, tarefaId: string) {
    setEditingSubtarefa(sub);
    setParentTarefaId(tarefaId);
    setForm({ ...sub });
    setSubtarefaModal(true);
  }

  async function saveSubtarefa() {
    setSaving(true);
    try {
      const url = editingSubtarefa
        ? `/api/workshop/tarefas-catalogo/subtarefas/${editingSubtarefa.id}`
        : `/api/workshop/tarefas-catalogo/${parentTarefaId}/subtarefas`;
      const res = await apiFetch(url, {
        method: editingSubtarefa ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      setSubtarefaModal(false);
      fetchTarefas();
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar subtarefa');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubtarefa(id: string) {
    if (!confirm('Excluir esta subtarefa?')) return;
    await apiFetch(`/api/workshop/tarefas-catalogo/subtarefas/${id}`, { method: 'DELETE' });
    fetchTarefas();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const grupoServico = tarefas.filter(t => t.contexto === 'SERVICO');
  const grupoProducao = tarefas.filter(t => t.contexto === 'PRODUCAO');

  function GrupoTarefas({ titulo, lista, cor }: { titulo: string; lista: any[]; cor: string }) {
    return (
      <div className="space-y-1">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${cor} text-sm font-semibold`}>
          <ClipboardList className="h-4 w-4" />
          {titulo} ({lista.length})
        </div>
        {lista.map(tarefa => (
          <div key={tarefa.id} className="border rounded-lg overflow-hidden bg-white">
            {/* Linha da tarefa */}
            <div
              className="flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer"
              onClick={() => toggleExpand(tarefa.id)}
            >
              {tarefa.subtarefas?.length > 0
                ? (expanded.has(tarefa.id) ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />)
                : <div className="w-4" />
              }
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs text-slate-400 mr-2">{tarefa.codigo}</span>
                <span className="font-medium text-sm">{tarefa.nome}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <Clock className="h-3 w-3" />
                {tarefa.tempoPadraoEfetivoH?.toFixed(1)}h
              </div>
              <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                <button
                  className="h-7 px-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  onClick={() => openEditTarefa(tarefa)}
                  title="Editar tarefa"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  className="h-7 px-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
                  onClick={() => openNewSubtarefa(tarefa.id)}
                  title="Adicionar subtarefa"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  className="h-7 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                  onClick={() => inativarTarefa(tarefa.id)}
                  title="Inativar tarefa"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Subtarefas */}
            {expanded.has(tarefa.id) && tarefa.subtarefas?.length > 0 && (
              <div className="divide-y border-t">
                {tarefa.subtarefas.map((sub: any, idx: number) => (
                  <div key={sub.id} className="flex items-center gap-2 px-4 py-2 text-sm bg-white hover:bg-slate-50">
                    <span className="text-slate-400 w-5 text-right">{idx + 1}.</span>
                    <span className="flex-1">{sub.nome}</span>
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <Clock className="h-3 w-3" />
                      {sub.tempoPadraoH?.toFixed(1)}h
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="h-6 px-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        onClick={() => openEditSubtarefa(sub, tarefa.id)}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="h-6 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        onClick={() => deleteSubtarefa(sub.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {expanded.has(tarefa.id) && (!tarefa.subtarefas || tarefa.subtarefas.length === 0) && (
              <div className="px-4 py-2 text-sm text-slate-400 border-t italic">
                Sem subtarefas — tempo definido na própria tarefa
              </div>
            )}
          </div>
        ))}
        {lista.length === 0 && (
          <div className="text-sm text-slate-400 px-3 py-2">Nenhuma tarefa cadastrada</div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold">Catálogo de Tarefas</h1>
            <p className="text-sm text-slate-500">Serviços e etapas de produção com tempo padrão</p>
          </div>
        </div>
        <button
          onClick={openNewTarefa}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar tarefa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={contexto}
          onChange={e => setContexto(e.target.value)}
        >
          <option value="">Todos os contextos</option>
          <option value="SERVICO">Oficina (OS)</option>
          <option value="PRODUCAO">Produção (OP)</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center text-slate-400 py-10">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {(contexto === '' || contexto === 'SERVICO') && (
            <GrupoTarefas titulo="Oficina / Serviços (OS)" lista={grupoServico} cor="bg-blue-50 text-blue-800" />
          )}
          {(contexto === '' || contexto === 'PRODUCAO') && (
            <GrupoTarefas titulo="Produção (OP)" lista={grupoProducao} cor="bg-green-50 text-green-800" />
          )}
        </div>
      )}

      {/* Modal Tarefa */}
      {tarefaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingTarefa ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
              <button onClick={() => setTarefaModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código *</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.codigo || ''}
                    onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    placeholder="T010"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contexto *</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.contexto || 'SERVICO'}
                    onChange={e => setForm({ ...form, contexto: e.target.value })}
                  >
                    <option value="SERVICO">Oficina (OS)</option>
                    <option value="PRODUCAO">Produção (OP)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.nome || ''}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Troca de óleo e filtros"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tempo Padrão (horas) — usado quando não tem subtarefas</label>
                <input
                  type="number"
                  step="0.5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.tempoPadraoH || ''}
                  onChange={e => setForm({ ...form, tempoPadraoH: Number(e.target.value) })}
                  placeholder="1.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.observations || ''}
                  onChange={e => setForm({ ...form, observations: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setTarefaModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveTarefa}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingTarefa ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Subtarefa */}
      {subtarefaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingSubtarefa ? 'Editar Subtarefa' : 'Nova Subtarefa'}</h2>
              <button onClick={() => setSubtarefaModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Etapa *</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.nome || ''}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Drenar óleo antigo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tempo Padrão (h) *</label>
                  <input
                    type="number"
                    step="0.25"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.tempoPadraoH || ''}
                    onChange={e => setForm({ ...form, tempoPadraoH: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ordem</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.ordem || ''}
                    onChange={e => setForm({ ...form, ordem: Number(e.target.value) })}
                    placeholder="10, 20, 30..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSubtarefaModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveSubtarefa}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingSubtarefa ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
