'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Plus, RefreshCw, Tag, Layers, Package,
  ChevronRight, X, Save, Sparkles, Pencil, Trash2, AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ProductSubgroup {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  _count?: { products: number };
}

interface ProductGroup {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  subgroups: ProductSubgroup[];
  _count?: { products: number };
}

type ModalMode = 'new-group' | 'edit-group' | 'new-subgroup' | 'edit-subgroup';

interface ModalState {
  open: boolean;
  mode: ModalMode;
  editId?: string;
  groupId?: string;
  groupName?: string;
}

interface DeleteState {
  open: boolean;
  type: 'group' | 'subgroup';
  id: string;
  name: string;
  products: number;
}

const EMPTY_MODAL: ModalState = { open: false, mode: 'new-group' };
const EMPTY_DELETE: DeleteState = { open: false, type: 'group', id: '', name: '', products: 0 };

export default function GruposSubgruposPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Modal (novo / editar)
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Modal de confirmação de exclusão
  const [deleteModal, setDeleteModal] = useState<DeleteState>(EMPTY_DELETE);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/inventory/product-groups');
      if (res.ok) {
        const data: ProductGroup[] = await res.json();
        setGroups(data);
        if (selectedGroup) {
          const found = data.find((g) => g.id === selectedGroup.id);
          setSelectedGroup(found ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadGroups(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Seed ─────────────────────────────────────────────────────────────── */
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await apiFetch('/api/inventory/product-groups/seed', { method: 'POST' });
      if (res.ok) await loadGroups();
    } finally {
      setSeeding(false);
    }
  };

  /* ── Abrir modal ─────────────────────────────────────────────────────── */
  const openNewGroup = () => {
    setFormCode(''); setFormName(''); setFormDescription(''); setSaveError('');
    setModal({ open: true, mode: 'new-group' });
  };

  const openEditGroup = (g: ProductGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormCode(g.code); setFormName(g.name); setFormDescription(g.description ?? ''); setSaveError('');
    setModal({ open: true, mode: 'edit-group', editId: g.id });
  };

  const openNewSubgroup = (group: ProductGroup) => {
    setFormCode(''); setFormName(''); setFormDescription(''); setSaveError('');
    setModal({ open: true, mode: 'new-subgroup', groupId: group.id, groupName: group.name });
  };

  const openEditSubgroup = (sub: ProductSubgroup, group: ProductGroup) => {
    setFormCode(sub.code); setFormName(sub.name); setFormDescription(sub.description ?? ''); setSaveError('');
    setModal({ open: true, mode: 'edit-subgroup', editId: sub.id, groupName: group.name });
  };

  const closeModal = () => { setModal(EMPTY_MODAL); setSaveError(''); };

  /* ── Salvar (criar ou editar) ─────────────────────────────────────────── */
  const handleSave = async () => {
    if (!formName.trim()) { setSaveError('Nome é obrigatório.'); return; }
    if ((modal.mode === 'new-group' || modal.mode === 'new-subgroup') && !formCode.trim()) {
      setSaveError('Código é obrigatório.'); return;
    }
    setSaving(true); setSaveError('');
    try {
      let res: Response;
      if (modal.mode === 'new-group') {
        res = await apiFetch('/api/inventory/product-groups', {
          method: 'POST',
          body: JSON.stringify({ code: formCode.trim(), name: formName.trim(), description: formDescription.trim() || undefined }),
        });
      } else if (modal.mode === 'edit-group') {
        res = await apiFetch(`/api/inventory/product-groups/${modal.editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: formName.trim(), description: formDescription.trim() || undefined }),
        });
      } else if (modal.mode === 'new-subgroup') {
        res = await apiFetch('/api/inventory/product-groups/subgroups', {
          method: 'POST',
          body: JSON.stringify({ groupId: modal.groupId, code: formCode.trim(), name: formName.trim(), description: formDescription.trim() || undefined }),
        });
      } else {
        res = await apiFetch(`/api/inventory/product-groups/subgroups/${modal.editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: formName.trim(), description: formDescription.trim() || undefined }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || `Erro ${res.status}`);
      }
      closeModal();
      await loadGroups();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Excluir ──────────────────────────────────────────────────────────── */
  const openDeleteGroup = (g: ProductGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError('');
    setDeleteModal({ open: true, type: 'group', id: g.id, name: `${g.code} – ${g.name}`, products: g._count?.products ?? 0 });
  };

  const openDeleteSubgroup = (sub: ProductSubgroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError('');
    setDeleteModal({ open: true, type: 'subgroup', id: sub.id, name: sub.name, products: sub._count?.products ?? 0 });
  };

  const closeDeleteModal = () => { setDeleteModal(EMPTY_DELETE); setDeleteError(''); };

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('');
    try {
      const url = deleteModal.type === 'group'
        ? `/api/inventory/product-groups/${deleteModal.id}`
        : `/api/inventory/product-groups/subgroups/${deleteModal.id}`;
      const res = await apiFetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || `Erro ${res.status}`);
      }
      if (deleteModal.type === 'group' && selectedGroup?.id === deleteModal.id) {
        setSelectedGroup(null);
      }
      closeDeleteModal();
      await loadGroups();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir.');
    } finally {
      setDeleting(false);
    }
  };

  const subgroups = selectedGroup?.subgroups ?? [];

  const modalTitle = {
    'new-group': 'Novo Grupo',
    'edit-group': 'Editar Grupo',
    'new-subgroup': `Novo Subgrupo — ${modal.groupName}`,
    'edit-subgroup': `Editar Subgrupo — ${modal.groupName}`,
  }[modal.mode];

  const isEdit = modal.mode === 'edit-group' || modal.mode === 'edit-subgroup';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/estoque"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Grupos e Subgrupos</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Estrutura hierárquica de classificação de materiais</p>
        </div>
        <button
          onClick={loadGroups}
          className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Seed button */}
      {!loading && groups.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Nenhum grupo cadastrado</p>
              <p className="text-xs text-amber-700 mt-0.5">Inicialize com os 10 grupos padrão da ND Implementos</p>
            </div>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition-colors shrink-0 disabled:opacity-50"
          >
            {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {seeding ? 'Inicializando...' : 'Inicializar Grupos Padrão'}
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Left: Groups */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-semibold text-slate-900">Grupos</h2>
              <span className="text-xs text-slate-400 font-mono">({groups.length})</span>
            </div>
            <button
              onClick={openNewGroup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Grupo
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
              </div>
            ) : groups.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Nenhum grupo cadastrado.</div>
            ) : (
              groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;
                return (
                  <div
                    key={group.id}
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-teal-50 border-l-4 border-l-teal-500' : ''}`}
                    onClick={() => setSelectedGroup(isSelected ? null : group)}
                  >
                    {/* Code badge */}
                    <span className="text-xs font-mono font-bold text-teal-600 bg-teal-100 px-2 py-0.5 rounded shrink-0">
                      {group.code}
                    </span>

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{group.name}</p>
                      {group.description && (
                        <p className="text-xs text-slate-400 truncate">{group.description}</p>
                      )}
                    </div>

                    {/* Counts */}
                    <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
                      <span className="flex items-center gap-0.5"><Tag className="w-3 h-3" /> {group.subgroups.length}</span>
                      <span className="flex items-center gap-0.5"><Package className="w-3 h-3" /> {group._count?.products ?? 0}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => openEditGroup(group, e)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                        title="Editar grupo"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => openDeleteGroup(group, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir grupo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isSelected ? 'rotate-90 text-teal-500' : ''}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Subgroups */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-cyan-600" />
              <h2 className="text-base font-semibold text-slate-900 truncate">
                {selectedGroup
                  ? `Subgrupos — ${selectedGroup.code} ${selectedGroup.name}`
                  : 'Subgrupos'}
              </h2>
            </div>
            {selectedGroup && (
              <button
                onClick={() => openNewSubgroup(selectedGroup)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-xs font-medium transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Subgrupo
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {!selectedGroup ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Selecione um grupo para ver os subgrupos.
              </div>
            ) : subgroups.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Nenhum subgrupo cadastrado para este grupo.
              </div>
            ) : (
              subgroups.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors">
                  {/* Code badge */}
                  <span className="text-xs font-mono font-bold text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded shrink-0">
                    {selectedGroup.code}.{sub.code}
                  </span>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{sub.name}</p>
                    {sub.description && (
                      <p className="text-xs text-slate-400 truncate">{sub.description}</p>
                    )}
                  </div>

                  {/* Product count */}
                  <span className="flex items-center gap-0.5 text-xs text-slate-400 shrink-0">
                    <Package className="w-3 h-3" /> {sub._count?.products ?? 0}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditSubgroup(sub, selectedGroup)}
                      className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                      title="Editar subgrupo"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => openDeleteSubgroup(sub, e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Excluir subgrupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Novo / Editar ──────────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-900">{modalTitle}</h3>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Código — só editável na criação */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Código <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-slate-400 ml-1">(2 dígitos, ex: 01)</span>
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="01"
                  maxLength={2}
                  disabled={isEdit}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${isEdit ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                />
                {isEdit && (
                  <p className="text-xs text-slate-400 mt-1">O código não pode ser alterado após a criação.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do grupo/subgrupo"
                  maxLength={60}
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descrição opcional"
                  maxLength={200}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {saveError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Exclusão ─────────────────────────────────────── */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-2 bg-red-100 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Excluir {deleteModal.type === 'group' ? 'grupo' : 'subgrupo'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-medium text-slate-700">{deleteModal.name}</span>
                </p>
                {deleteModal.products > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1.5 rounded mt-2">
                    Atenção: possui {deleteModal.products} produto(s) vinculado(s).
                  </p>
                )}
                <p className="text-sm text-slate-500 mt-2">
                  Esta ação inativa o registro. Ele não aparecerá mais na listagem.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">
                {deleteError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
