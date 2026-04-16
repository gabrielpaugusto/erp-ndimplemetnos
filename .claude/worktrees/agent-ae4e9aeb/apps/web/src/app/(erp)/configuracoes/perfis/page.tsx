'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Lock,
  Users,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants — tradução dos módulos e ações
// ---------------------------------------------------------------------------

const MODULE_LABELS: Record<string, string> = {
  ENGINEERING:   'Engenharia / PCP',
  PCP:           'PCP',
  PRODUCTION:    'Producao',
  QUALITY:       'Qualidade',
  CRM:           'CRM',
  SALES:         'Comercial / Vendas',
  FI:            'F&I (Financiamento / Seguro)',
  SERVICE_ORDER: 'Oficina / O.S.',
  CALDERARIA:    'Calderaria',
  REQUISITION:   'Requisicoes Internas',
  FISCAL:        'Fiscal / NF-e',
  ACCOUNTING:    'Contabilidade',
  FINANCIAL:     'Financeiro',
  HR:            'RH / Folha',
  PURCHASING:    'Compras',
  INVENTORY:     'Estoque',
  AI_ASSISTANT:  'Assistente IA',
  SETTINGS:      'Configuracoes',
  DASHBOARD:     'Dashboard',
};

// Agrupa módulos por área
const MODULE_GROUPS: Record<string, string[]> = {
  'Industrial':     ['ENGINEERING', 'PCP', 'PRODUCTION', 'QUALITY'],
  'Comercial':      ['CRM', 'SALES', 'FI'],
  'Oficina':        ['SERVICE_ORDER', 'CALDERARIA', 'REQUISITION'],
  'Corporativo':    ['FISCAL', 'ACCOUNTING', 'FINANCIAL', 'HR', 'PURCHASING', 'INVENTORY'],
  'Sistema':        ['AI_ASSISTANT', 'SETTINGS', 'DASHBOARD'],
};

const ACTION_LABELS: Record<string, { label: string; short: string; color: string }> = {
  READ:    { label: 'Visualizar',  short: 'VER',   color: 'text-blue-600' },
  CREATE:  { label: 'Criar',       short: 'CRIAR', color: 'text-emerald-600' },
  UPDATE:  { label: 'Editar',      short: 'EDIT',  color: 'text-amber-600' },
  DELETE:  { label: 'Excluir',     short: 'DEL',   color: 'text-red-600' },
  APPROVE: { label: 'Aprovar',     short: 'APROV', color: 'text-violet-600' },
  EXPORT:  { label: 'Exportar',    short: 'EXP',   color: 'text-slate-600' },
  MANAGE:  { label: 'Gerenciar',   short: 'GEST',  color: 'text-rose-700' },
};

const ACTIONS = Object.keys(ACTION_LABELS);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: Permission }[];
  _count: { users: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ---------------------------------------------------------------------------
// Componente: Matriz de permissões de um perfil
// ---------------------------------------------------------------------------

function PermissionMatrix({
  allPermissions,
  selected,
  onChange,
  readOnly,
}: {
  allPermissions: Permission[];
  selected: Set<string>;
  onChange: (id: string, checked: boolean) => void;
  readOnly: boolean;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(MODULE_GROUPS).map((g) => [g, true]))
  );

  const toggleGroup = (g: string) =>
    setExpandedGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  // Verifica se todos de um módulo estão selecionados
  const modulePerms = (mod: string) => allPermissions.filter((p) => p.module === mod);
  const allCheckedInModule = (mod: string) => modulePerms(mod).every((p) => selected.has(p.id));
  const someCheckedInModule = (mod: string) => modulePerms(mod).some((p) => selected.has(p.id));

  const toggleModule = (mod: string) => {
    if (readOnly) return;
    const perms = modulePerms(mod);
    const all = allCheckedInModule(mod);
    perms.forEach((p) => onChange(p.id, !all));
  };

  // Verifica por ação dentro de um módulo
  const permByModuleAction = (mod: string, action: string) =>
    allPermissions.find((p) => p.module === mod && p.action === action);

  return (
    <div className="space-y-3">
      {Object.entries(MODULE_GROUPS).map(([groupName, modules]) => (
        <div key={groupName} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Group header */}
          <button
            onClick={() => toggleGroup(groupName)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{groupName}</span>
            {expandedGroups[groupName]
              ? <ChevronDown className="w-4 h-4 text-slate-400" />
              : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>

          {expandedGroups[groupName] && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 w-48">Módulo</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 min-w-[52px]">
                        <span className={ACTION_LABELS[a].color}>{ACTION_LABELS[a].short}</span>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-semibold text-slate-400 w-16">Todos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {modules.map((mod) => {
                    const allChecked = allCheckedInModule(mod);
                    const someChecked = someCheckedInModule(mod);
                    return (
                      <tr key={mod} className="hover:bg-slate-50/60 transition-colors">
                        {/* Módulo */}
                        <td className="px-4 py-2.5">
                          <span className="text-sm font-medium text-slate-700">
                            {MODULE_LABELS[mod] ?? mod}
                          </span>
                        </td>

                        {/* Checkboxes por ação */}
                        {ACTIONS.map((action) => {
                          const perm = permByModuleAction(mod, action);
                          if (!perm) {
                            return <td key={action} className="px-2 py-2.5 text-center"><span className="text-slate-200">—</span></td>;
                          }
                          const checked = selected.has(perm.id);
                          return (
                            <td key={action} className="px-2 py-2.5 text-center">
                              <button
                                onClick={() => !readOnly && onChange(perm.id, !checked)}
                                disabled={readOnly}
                                title={`${ACTION_LABELS[action].label} em ${MODULE_LABELS[mod]}`}
                                className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                  checked
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-300 bg-white hover:border-blue-400'
                                } ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
                              >
                                {checked && <Check className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          );
                        })}

                        {/* Toggle todos do módulo */}
                        <td className="px-2 py-2.5 text-center">
                          <button
                            onClick={() => toggleModule(mod)}
                            disabled={readOnly}
                            title={allChecked ? 'Desmarcar todos' : 'Marcar todos'}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                              allChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : someChecked
                                ? 'bg-amber-400 border-amber-400 text-white'
                                : 'border-slate-300 bg-white hover:border-emerald-400'
                            } ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
                          >
                            {(allChecked || someChecked) && <Check className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Criar / Editar perfil
// ---------------------------------------------------------------------------

function RoleModal({
  role,
  allPermissions,
  onClose,
  onSaved,
}: {
  role: Role | null;
  allPermissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!role;
  const isSystem = role?.isSystem ?? false;

  const [name, setName] = useState(role?.name ?? '');
  const [desc, setDesc] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role?.permissions.map((rp) => rp.permission.id) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  // Selecionar/desmarcar tudo
  const toggleAll = (check: boolean) => {
    setSelected(check ? new Set(allPermissions.map((p) => p.id)) : new Set());
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Nome do perfil é obrigatório'); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/roles/${role!.id}` : '/api/roles';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || undefined,
          permissionIds: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao salvar perfil');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selected.size;
  const totalCount = allPermissions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isEdit ? `Editar Perfil: ${role!.name}` : 'Novo Perfil de Acesso'}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedCount} de {totalCount} permissões selecionadas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Nome e descrição */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome do Perfil *
                {isSystem && <span className="ml-2 text-xs text-violet-600">(perfil de sistema)</span>}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                disabled={isSystem}
                className="input font-mono uppercase"
                placeholder="Ex: VENDEDOR_EXTERNO"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="input"
                placeholder="Descrição do perfil e suas responsabilidades"
              />
            </div>
          </div>

          {/* Barra de ações rápidas */}
          <div className="flex items-center justify-between py-2 border-y border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {ACTIONS.map((a) => (
                <span key={a} className={`flex items-center gap-1 ${ACTION_LABELS[a].color}`}>
                  <span className="font-bold">{ACTION_LABELS[a].short}</span>
                  <span className="text-slate-400 hidden sm:inline">= {ACTION_LABELS[a].label}</span>
                </span>
              )).reduce((acc, el, i) => [...acc, i > 0 ? <span key={`sep-${i}`} className="text-slate-300">|</span> : null, el], [] as React.ReactNode[])}
            </div>
            {!isSystem && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAll(true)}
                  className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium transition-colors"
                >
                  Marcar tudo
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                >
                  Desmarcar tudo
                </button>
              </div>
            )}
          </div>

          {/* Matriz */}
          <PermissionMatrix
            allPermissions={allPermissions}
            selected={selected}
            onChange={handleChange}
            readOnly={isSystem}
          />

          {isSystem && (
            <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-violet-700 text-sm">
              <Lock className="w-4 h-4 shrink-0" />
              Perfis de sistema não podem ter permissões alteradas. Para ajustar o acesso, crie um perfil personalizado.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <span className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{selectedCount}</span> permissões selecionadas
          </span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors">
              {isSystem ? 'Fechar' : 'Cancelar'}
            </button>
            {!isSystem && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {isEdit ? 'Salvar Alterações' : 'Criar Perfil'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PerfisPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNew, setModalNew] = useState(false);
  const [modalEdit, setModalEdit] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/roles', { headers: authHeader() }),
        fetch('/api/roles/permissions', { headers: authHeader() }),
      ]);
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setAllPermissions(Array.isArray(permsData) ? permsData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Excluir o perfil "${role.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(role.id);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao excluir');
      }
      showToast('success', `Perfil "${role.name}" excluído`);
      load();
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  const totalCount = allPermissions.length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Modais */}
      {modalNew && (
        <RoleModal role={null} allPermissions={allPermissions} onClose={() => setModalNew(false)} onSaved={() => { load(); showToast('success', 'Perfil criado com sucesso'); }} />
      )}
      {modalEdit && (
        <RoleModal role={modalEdit} allPermissions={allPermissions} onClose={() => setModalEdit(null)} onSaved={() => { load(); showToast('success', 'Perfil atualizado com sucesso'); }} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Perfis de Acesso</h1>
          <p className="text-slate-500 mt-1">
            Configure quais módulos e acoes cada perfil pode executar no sistema
          </p>
        </div>
        <button
          onClick={() => setModalNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Perfil
        </button>
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Como funciona o controle de acesso:</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li>Cada <strong>usuário</strong> recebe um ou mais <strong>perfis</strong></li>
          <li>Cada perfil tem uma combinação de <strong>módulo + ação</strong> liberada</li>
          <li>As permissões são acumulativas: se o usuário tem GERENTE + VENDEDOR, ele tem a união de ambos</li>
          <li>Perfis marcados com <Lock className="w-3 h-3 inline" /> são de sistema e as permissões não podem ser alteradas</li>
        </ul>
      </div>

      {/* Lista de perfis */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {roles.map((role) => {
            const permCount = role.permissions.length;
            const pct = totalCount > 0 ? Math.round((permCount / totalCount) * 100) : 0;

            // Agrupa permissões por módulo para preview
            const byModule: Record<string, string[]> = {};
            role.permissions.forEach(({ permission: p }) => {
              if (!byModule[p.module]) byModule[p.module] = [];
              byModule[p.module].push(p.action);
            });

            return (
              <div key={role.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        role.isSystem ? 'bg-violet-100' : 'bg-blue-100'
                      }`}>
                        {role.isSystem
                          ? <Lock className="w-5 h-5 text-violet-600" />
                          : <Shield className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 font-mono">{role.name}</h3>
                          {role.isSystem && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-600 rounded-full uppercase">Sistema</span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Users className="w-3 h-3" />
                            {role._count.users} usuário{role._count.users !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {role.description && (
                          <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>
                        )}

                        {/* Barra de progresso de permissões */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {permCount}/{totalCount} permissões ({pct}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setModalEdit(role)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {role.isSystem ? 'Ver' : 'Editar'}
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role)}
                          disabled={deleting === role.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Excluir perfil"
                        >
                          {deleting === role.id
                            ? <div className="animate-spin w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview das permissões por módulo */}
                  {Object.keys(byModule).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(byModule).map(([mod, actions]) => (
                        <span key={mod} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                          <span className="font-medium">{MODULE_LABELS[mod] ?? mod}</span>
                          <span className="text-slate-400">·</span>
                          {actions.map((a) => (
                            <span key={a} className={`font-bold ${ACTION_LABELS[a]?.color ?? 'text-slate-500'}`}>
                              {ACTION_LABELS[a]?.short ?? a}
                            </span>
                          ))}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {roles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
              <Shield className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum perfil cadastrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
