import { ERP_MODULES } from '@erp/shared';

const STATIC_TITLES: Record<string, string> = {
  '/dashboard':               'Dashboard',
  '/configuracoes/empresa':   'Dados da Empresa',
  '/configuracoes/usuarios':  'Usuários',
  '/configuracoes/perfis':    'Perfis de Acesso',
};

/**
 * Resolve o título da aba para uma rota.
 * Prefere match exato ao match de prefixo, e entre prefixos prefere o mais longo
 * (evita que "/compras" sobreponha "/compras/nfe-entrada").
 */
export function resolveTabTitle(pathname: string): string {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname];

  let exactLabel: string | null = null;
  let bestPrefix: { label: string; len: number } | null = null;

  for (const group of Object.values(ERP_MODULES)) {
    for (const child of Object.values(
      group.children as Record<string, { path: string; label: string }>
    )) {
      if (pathname === child.path) {
        exactLabel = child.label;
        break; // match exato é definitivo
      }
      if (pathname.startsWith(child.path + '/')) {
        if (!bestPrefix || child.path.length > bestPrefix.len) {
          const rest = pathname.slice(child.path.length + 1).split('?')[0];
          const label = rest === 'novo' ? `Novo — ${child.label}` : child.label;
          bestPrefix = { label, len: child.path.length };
        }
      }
    }
    if (exactLabel) break;
  }

  if (exactLabel) return exactLabel;
  if (bestPrefix) return bestPrefix.label;

  // Fallback: capitaliza o último segmento da URL
  const parts = pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] ?? 'Página';
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Retorna o caminho base do módulo ERP para uma rota.
 * Usa match exato primeiro, depois prefixo mais longo.
 *
 * Ex: '/compras/nfe-entrada/123' → '/compras/nfe-entrada'
 *     '/compras/nfe-entrada'     → '/compras/nfe-entrada'
 *     '/compras/cte/abc'         → '/compras/cte'
 *     '/dashboard'               → '/dashboard'
 */
export function resolveModuleBasePath(pathname: string): string {
  // Remove query string para comparação
  const path = pathname.split('?')[0];

  let bestMatch: { basePath: string; len: number } | null = null;

  for (const group of Object.values(ERP_MODULES)) {
    for (const child of Object.values(
      group.children as Record<string, { path: string; label: string }>
    )) {
      if (path === child.path) {
        return child.path; // match exato — retorna imediatamente
      }
      if (path.startsWith(child.path + '/')) {
        if (!bestMatch || child.path.length > bestMatch.len) {
          bestMatch = { basePath: child.path, len: child.path.length };
        }
      }
    }
  }

  return bestMatch?.basePath ?? path;
}
