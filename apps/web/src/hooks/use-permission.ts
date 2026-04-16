/**
 * usePermission — lê permissões do usuário logado (localStorage)
 * e expõe helpers semânticos para proteger campos/ações nas páginas.
 *
 * Uso:
 *   const { can, canConfigurar, canLancar } = usePermission();
 *   const readOnly = !canConfigurar('FISCAL');
 */

import { useMemo } from 'react';

export interface UserPermission {
  module: string;
  action: string;
}

/** Lê o array de permissões salvo no localStorage após o login. */
function loadPermissions(): UserPermission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return [];
    const user = JSON.parse(raw);
    return Array.isArray(user?.permissions) ? user.permissions : [];
  } catch {
    return [];
  }
}

export function usePermission() {
  const permissions = useMemo(() => loadPermissions(), []);

  /** Verifica permissão exata: module + action */
  const can = (module: string, action: string): boolean =>
    permissions.some((p) => p.module === module && p.action === action);

  /** Verdadeiro se tiver QUALQUER uma das actions no módulo */
  const canAny = (module: string, actions: string[]): boolean =>
    actions.some((a) => can(module, a));

  /** Verdadeiro se tiver TODAS as actions no módulo */
  const canAll = (module: string, actions: string[]): boolean =>
    actions.every((a) => can(module, a));

  // ── Operações semânticas ──────────────────────────────────────────────────

  /** Visualizar registros (READ) */
  const canConsultar = (module: string) => can(module, 'READ');

  /** Incluir e/ou alterar registros (CREATE ou UPDATE) */
  const canLancar = (module: string) => canAny(module, ['CREATE', 'UPDATE']);

  /** Incluir novos registros (CREATE) */
  const canIncluir = (module: string) => can(module, 'CREATE');

  /** Alterar registros existentes (UPDATE) */
  const canAlterar = (module: string) => can(module, 'UPDATE');

  /** Excluir registros (DELETE) */
  const canExcluir = (module: string) => can(module, 'DELETE');

  /** Aprovar documentos (APPROVE) */
  const canAprovar = (module: string) => can(module, 'APPROVE');

  /** Exportar / relatórios (EXPORT) */
  const canExportar = (module: string) => can(module, 'EXPORT');

  /**
   * Configuração total do módulo (MANAGE).
   * Use para proteger campos de parametrização fiscal, financeira, etc.
   */
  const canConfigurar = (module: string) => can(module, 'MANAGE');

  /**
   * Super-admin: tem MANAGE em SETTINGS → acesso irrestrito.
   * Use como bypass em módulos restritos se necessário.
   */
  const isSuperAdmin = can('SETTINGS', 'MANAGE');

  return {
    permissions,
    can,
    canAny,
    canAll,
    canConsultar,
    canLancar,
    canIncluir,
    canAlterar,
    canExcluir,
    canAprovar,
    canExportar,
    canConfigurar,
    isSuperAdmin,
  };
}
