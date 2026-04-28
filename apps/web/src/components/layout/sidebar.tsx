'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Factory,
  Compass,
  CalendarClock,
  Hammer,
  ShieldCheck,
  Handshake,
  Users,
  ShoppingCart,
  Landmark,
  CreditCard,
  UsersRound,
  Shield,
  Wrench,
  ClipboardList,
  Flame,
  ArrowRightLeft,
  BadgeCheck,
  Building2,
  Receipt,
  BookOpen,
  DollarSign,
  UserCog,
  PackageSearch,
  Warehouse,
  Package,
  ArrowUpDown,
  Settings,
  BarChart3,
  Cog,
  Scale,
  FileText,
  Calculator,
  BookOpenCheck,
  Tag,
  ShieldAlert,
  Layers,
  LayoutList,
  ListTree,
  Map,
  Globe,
  ArrowLeftRight,
  Zap,
  FileInput,
  Headphones,
  MessageSquare,
  GitBranch,
  TrendingDown,
  TrendingUp,
  CalendarCheck,
  Timer,
  Activity,
  Play,
  Clock,
  Truck,
  FileSpreadsheet,
  FileSearch,
  FileBarChart,
  ListChecks,
  Wallet,
  KeyRound,
  User,
  ChevronUp,
  BookMarked,
  type LucideIcon,
} from 'lucide-react';
import { ERP_MODULES } from '@erp/shared';
import { useUiStore } from '@/stores/ui-store';
import { useTabStore } from '@/stores/tab-store';
import { cn } from '@/lib/utils';

// Map icon names from the shared module to actual lucide components
const iconMap: Record<string, LucideIcon> = {
  Factory,
  Compass,
  CalendarClock,
  Hammer,
  ShieldCheck,
  Handshake,
  Users,
  ShoppingCart,
  Landmark,
  CreditCard,
  UsersRound,
  Shield,
  Wrench,
  ClipboardList,
  Flame,
  ArrowRightLeft,
  BadgeCheck,
  Building2,
  Receipt,
  BookOpen,
  DollarSign,
  Wallet,
  UserCog,
  PackageSearch,
  Warehouse,
  Package,
  ArrowUpDown,
  BarChart3,
  Cog,
  Scale,
  FileText,
  Calculator,
  BookOpenCheck,
  Tag,
  ShieldAlert,
  Layers,
  LayoutList,
  ListTree,
  Map,
  Globe,
  ArrowLeftRight,
  Zap,
  FileInput,
  Headphones,
  MessageSquare,
  GitBranch,
  TrendingDown,
  TrendingUp,
  CalendarCheck,
  Timer,
  Activity,
  Play,
  Clock,
  Truck,
  FileSpreadsheet,
  FileSearch,
  FileBarChart,
  ListChecks,
  BookMarked,
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] || LayoutDashboard;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const { openInNewWindow } = useTabStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}');
      setUserName(u?.name ?? '');
      setUserEmail(u?.email ?? '');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      // Notifica outras janelas abertas para também fazer logout
      try {
        const bc = new BroadcastChannel('erp-sync');
        bc.postMessage({ type: 'LOGOUT' });
        bc.close();
      } catch { /* ignore */ }
      router.push('/login');
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar text-white transition-all duration-300 dark-scrollbar',
        // Desktop: colapsa para trilho w-16 | Mobile: some completamente quando fechado
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden md:w-16 md:overflow-visible'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-4 h-16 border-b border-sidebar-border shrink-0">
        {sidebarOpen ? (
          <img
            src="/logo-nd-horizontal.png"
            alt="ND Implementos"
            className="h-10 w-auto object-contain"
          />
        ) : (
          <img
            src="/logo-nd-horizontal.png"
            alt="ND"
            className="h-7 w-7 object-contain"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {/* Dashboard link */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
            pathname === '/dashboard'
              ? 'bg-sidebar-active text-white'
              : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
          )}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          {sidebarOpen && <span>Dashboard</span>}
        </Link>

        {/* Module groups */}
        {Object.entries(ERP_MODULES).map(([key, group]) => {
          const GroupIcon = getIcon(group.icon);
          const isExpanded = expandedGroups[key] ?? false;
          const children = Object.values(group.children);
          const isGroupActive = children.some((child) => pathname?.startsWith(child.path));

          return (
            <div key={key}>
              <button
                onClick={() => toggleGroup(key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                  isGroupActive
                    ? 'bg-sidebar-hover text-white'
                    : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                )}
              >
                <GroupIcon className="w-5 h-5 shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left truncate">{group.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </>
                )}
              </button>

              {/* Children */}
              {sidebarOpen && isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {children.map((child) => {
                    const ChildIcon = getIcon(child.icon);
                    const isActive = pathname === child.path;
                    return (
                      <Link
                        key={child.path}
                        href={child.path}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            openInNewWindow(child.path);
                          }
                        }}
                        title={`${child.label} (Ctrl+Click para nova janela)`}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-colors',
                          isActive
                            ? 'bg-sidebar-active text-white font-medium'
                            : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                        )}
                      >
                        <ChildIcon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Configuracoes */}
        <div className="mt-2">
          <button
            onClick={() => toggleGroup('_configuracoes')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
              pathname?.startsWith('/configuracoes')
                ? 'bg-sidebar-hover text-white'
                : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
            )}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {sidebarOpen && (
              <>
                <span className="flex-1 text-left">Configuracoes</span>
                {expandedGroups['_configuracoes'] ? (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {sidebarOpen && expandedGroups['_configuracoes'] && (
            <div className="ml-4 mt-1 space-y-0.5">
              {[
                { path: '/configuracoes/empresa',        label: 'Dados da Empresa' },
                { path: '/configuracoes/usuarios',       label: 'Usuarios do Sistema' },
                { path: '/configuracoes/perfis',         label: 'Perfis de Acesso' },
                { path: '/configuracoes/tabelas-dominio',label: 'Tabelas de Domínio' },
                { path: '/configuracoes/backup',         label: 'Backup do Banco' },
              ].map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-colors',
                    pathname === item.path
                      ? 'bg-sidebar-active text-white font-medium'
                      : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                  )}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Usuário + logout */}
      <div className="border-t border-sidebar-border shrink-0 relative" ref={userMenuRef}>
        {/* Dropdown trocar usuário (abre para cima) */}
        {showUserMenu && sidebarOpen && (
          <div className="absolute left-2 right-2 bottom-full mb-1 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-700">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Usuário ativo</p>
              <p className="text-xs font-semibold text-white truncate mt-0.5">{userName || 'Admin'}</p>
              <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
            </div>
            <button
              onClick={() => { setShowUserMenu(false); handleLogout(); router.push('/login'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <User className="w-4 h-4 shrink-0" />
              Trocar usuário
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-3">
          {/* Botão usuário */}
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex-1 flex items-center gap-2 rounded-lg hover:bg-sidebar-hover transition-colors min-w-0"
            title="Trocar usuário"
          >
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
              {userName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-slate-300 truncate">{userName || 'Admin'}</p>
                <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
              </div>
            )}
          </button>

          {/* Botão logout */}
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-red-400 transition-colors shrink-0 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-800"
            title="Sair do sistema"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
