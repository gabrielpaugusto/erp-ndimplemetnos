'use client';

import { useState, useEffect } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { ERP_MODULES } from '@erp/shared';
import { useUiStore } from '@/stores/ui-store';
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
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] || LayoutDashboard;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}');
      setUserName(u?.name ?? '');
      setUserEmail(u?.email ?? '');
    } catch { /* ignore */ }
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
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
        sidebarOpen ? 'w-64' : 'w-16'
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
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
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
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
                { path: '/configuracoes/empresa',  label: 'Dados da Empresa' },
                { path: '/configuracoes/usuarios', label: 'Usuarios do Sistema' },
                { path: '/configuracoes/perfis',   label: 'Perfis de Acesso' },
              ].map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
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

      {/* User area */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
            A
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {userName || 'Admin'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {userEmail}
              </p>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 transition-colors"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
