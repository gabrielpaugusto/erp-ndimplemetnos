'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  UserCheck,
  UserX,
  Shield,
  KeyRound,
  Pencil,
  X,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { maskCpf } from '@/lib/masks';
import { apiFetch } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  lastLoginAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  roles: { role: Role }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}


function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG = {
  ACTIVE:   { label: 'Ativo',    bg: 'bg-emerald-100 text-emerald-700', icon: UserCheck },
  INACTIVE: { label: 'Inativo',  bg: 'bg-slate-100 text-slate-600',     icon: UserX    },
  BLOCKED:  { label: 'Bloqueado',bg: 'bg-red-100 text-red-700',         icon: Shield   },
} as const;

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   'bg-violet-100 text-violet-700',
  GERENTE: 'bg-blue-100 text-blue-700',
  VENDEDOR:'bg-amber-100 text-amber-700',
};

function roleBadgeColor(name: string) {
  const key = Object.keys(ROLE_COLORS).find((k) => name.toUpperCase().includes(k));
  return key ? ROLE_COLORS[key] : 'bg-slate-100 text-slate-600';
}

// ---------------------------------------------------------------------------
// Modal: Criar/Editar usuário
// ---------------------------------------------------------------------------

function UserModal({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: UserItem | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [cpf, setCpf] = useState(user?.cpf ? maskCpf(user.cpf) : '');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'BLOCKED'>(user?.status ?? 'ACTIVE');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user?.roles.map((r) => r.role.id) ?? []);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleRole = (id: string) => {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    if (!email.trim()) { setError('E-mail é obrigatório'); return; }
    if (!isEdit && password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return; }

    setSaving(true);
    try {
      const url = isEdit ? `/api/users/${user!.id}` : '/api/users';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        cpf: cpf ? cpf.replace(/\D/g, '') : undefined,
        roleIds: selectedRoles,
        ...(isEdit && { status }),
        ...(!isEdit && { password }),
      };

      const res = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao salvar usuário');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? `Editar: ${user!.name}` : 'Novo Usuário'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nome do usuário" />
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="usuario@empresa.com.br" />
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
            <input
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              className="input font-mono"
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>

          {/* Senha (só criação) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha inicial *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Status (só edição) */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input">
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="BLOCKED">Bloqueado</option>
              </select>
            </div>
          )}

          {/* Perfis (Roles) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Perfis de Acesso</label>
            {roles.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum perfil cadastrado</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{role.name}</span>
                        {role.isSystem && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-violet-100 text-violet-600 rounded font-medium">Sistema</span>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
            {isEdit ? 'Salvar Alterações' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Redefinir senha
// ---------------------------------------------------------------------------

function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return; }
    if (password !== confirm) { setError('As senhas não coincidem'); return; }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/users/${user.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao redefinir senha');
      }
      setDone(true);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao redefinir senha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-500" />
            Redefinir Senha — {user.name}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-slate-700">Senha redefinida com sucesso!</p>
            <p className="text-xs text-slate-500">O usuário precisará fazer login novamente com a nova senha.</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Fechar
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha *</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                placeholder="Repita a senha"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                <KeyRound className="w-4 h-4" />
                Redefinir Senha
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [modalCreate, setModalCreate] = useState(false);
  const [modalEdit, setModalEdit] = useState<UserItem | null>(null);
  const [modalResetPwd, setModalResetPwd] = useState<UserItem | null>(null);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(filterStatus && { status: filterStatus }),
      });
      const res = await apiFetch(`/api/users?${params}`);
      const data = await res.json();
      setUsers(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Carrega roles disponíveis
    apiFetch('/api/users/roles')
      .then((r) => r.json())
      .then((data) => setRoles(Array.isArray(data) ? data : []));
  }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Modais */}
      {modalCreate && (
        <UserModal user={null} roles={roles} onClose={() => setModalCreate(false)} onSaved={load} />
      )}
      {modalEdit && (
        <UserModal user={modalEdit} roles={roles} onClose={() => setModalEdit(null)} onSaved={load} />
      )}
      {modalResetPwd && (
        <ResetPasswordModal user={modalResetPwd} onClose={() => setModalResetPwd(null)} onSaved={load} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários do Sistema</h1>
          <p className="text-slate-500 mt-1">
            Gerencie os usuários, perfis de acesso e senhas
          </p>
        </div>
        <button
          onClick={() => setModalCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pl-9"
            placeholder="Buscar por nome, e-mail ou CPF..."
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="input w-44"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
          <option value="BLOCKED">Bloqueados</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum usuário encontrado</p>
            {search && <p className="text-xs mt-1">Tente uma busca diferente</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">CPF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Perfis</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Último Login</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const cfg = STATUS_CONFIG[u.status];
                    const StatusIcon = cfg.icon;
                    const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Usuário */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-blue-700">
                                {u.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{u.name}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* CPF */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-600">
                            {u.cpf ? maskCpf(u.cpf) : '—'}
                          </span>
                        </td>

                        {/* Perfis */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">Sem perfil</span>
                            ) : (
                              u.roles.map((r) => (
                                <span key={r.role.id} className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${roleBadgeColor(r.role.name)}`}>
                                  {r.role.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${cfg.bg}`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                            {isLocked && (
                              <span className="text-[10px] text-red-500">
                                Bloqueado até {formatDate(u.lockedUntil)}
                              </span>
                            )}
                            {u.failedAttempts > 0 && !isLocked && (
                              <span className="text-[10px] text-amber-600">
                                {u.failedAttempts} tentativa{u.failedAttempts > 1 ? 's' : ''} falha{u.failedAttempts > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Último login */}
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(u.lastLoginAt)}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setModalEdit(u)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar usuário"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setModalResetPwd(u)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Redefinir senha"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                <p className="text-xs text-slate-500">
                  Mostrando {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} de {total} usuários
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + Math.max(1, page - 2);
                    if (p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                          p === page
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-700">Perfis de acesso (Roles):</p>
        <ul className="space-y-1 list-disc list-inside">
          {roles.map((r) => (
            <li key={r.id}>
              <span className="font-medium text-slate-700">{r.name}</span>
              {r.description && <span className="text-slate-500"> — {r.description}</span>}
            </li>
          ))}
          {roles.length === 0 && <li className="text-slate-400">Nenhum perfil cadastrado</li>}
        </ul>
        <p className="text-xs text-slate-400 pt-1">
          Após 5 tentativas de login com senha errada, o usuário é bloqueado por 30 minutos automaticamente.
          Use "Editar" para desbloquear manualmente.
        </p>
      </div>
    </div>
  );
}
