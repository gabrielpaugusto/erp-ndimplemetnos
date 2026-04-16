'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, Brain, Bell, User, Info, AlertTriangle, AlertCircle, CheckCircle, Clock, Check, ExternalLink, HelpCircle, Search } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type NotificationType = 'INFO' | 'ALERTA' | 'ERRO' | 'SUCESSO' | 'LEMBRETE' | 'info' | 'alerta' | 'erro' | 'sucesso' | 'lembrete';

interface ModuleAmbientes {
  ambienteNfe: number;
  ambienteNfce: number;
  ambienteNfse: number;
  ambienteSped: number;
  ambienteEsocial: number;
  ambienteReinf: number;
  ambienteDctfweb: number;
}

const MODULE_LABELS: { key: keyof ModuleAmbientes; label: string }[] = [
  { key: 'ambienteNfe',     label: 'NF-e'     },
  { key: 'ambienteNfce',    label: 'NFC-e'    },
  { key: 'ambienteNfse',    label: 'NFS-e'    },
  { key: 'ambienteSped',    label: 'SPED'     },
  { key: 'ambienteEsocial', label: 'e-Social' },
  { key: 'ambienteReinf',   label: 'REINF'    },
  { key: 'ambienteDctfweb', label: 'DCTFWeb'  },
];

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link: string | null;
}

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info:      { icon: Info,          color: 'text-blue-500',    bg: 'bg-blue-100'    },
  INFO:      { icon: Info,          color: 'text-blue-500',    bg: 'bg-blue-100'    },
  alerta:    { icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-100'   },
  ALERTA:    { icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-100'   },
  erro:      { icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-100'     },
  ERRO:      { icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-100'     },
  sucesso:   { icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-100' },
  SUCESSO:   { icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-100' },
  lembrete:  { icon: Clock,         color: 'text-purple-500',  bg: 'bg-purple-100'  },
  LEMBRETE:  { icon: Clock,         color: 'text-purple-500',  bg: 'bg-purple-100'  },
};

function formatTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} hora${h !== 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d !== 1 ? 's' : ''}`;
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/industrial/engenharia': 'Engenharia',
  '/industrial/pcp': 'PCP',
  '/industrial/producao': 'Producao',
  '/industrial/qualidade': 'Qualidade',
  '/comercial/crm': 'CRM',
  '/comercial/vendas': 'Vendas',
  '/comercial/concessionaria': 'Concessionaria',
  '/fi/financiamento': 'Financiamento',
  '/fi/consorcio': 'Consorcio',
  '/fi/seguro': 'Seguro',
  '/oficina/os': 'Ordens de Servico',
  '/oficina/calderaria': 'Calderaria',
  '/oficina/requisicao': 'Requisicao Interna',
  '/oficina/garantia': 'Garantia',
  '/fiscal': 'Fiscal',
  '/contabilidade': 'Contabilidade',
  '/financeiro': 'Financeiro',
  '/rh': 'RH / Folha',
  '/compras': 'Compras',
  '/estoque': 'Estoque',
  '/chamados': 'Chamados',
};

export function Header() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleAiChat = useUiStore((s) => s.toggleAiChat);
  const aiChatOpen = useUiStore((s) => s.aiChatOpen);
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [govAmbiente, setGovAmbiente] = useState<string | null>(null);
  const [moduleAmbientes, setModuleAmbientes] = useState<ModuleAmbientes | null>(null);
  const [showEnvTooltip, setShowEnvTooltip] = useState(false);
  const envTooltipRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications?limit=20');
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data ?? []);
      }
    } catch {
      // notifications unavailable — keep empty list
    }
  }, []);

  useEffect(() => {
    // Fetch server-level global environment indicator
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data?.environment?.govAmbiente) {
          setGovAmbiente(data.environment.govAmbiente);
        }
      })
      .catch(() => { /* Health endpoint unavailable */ });

    // Fetch per-module environments from authenticated company endpoint
    apiFetch('/api/company')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.id) {
          setModuleAmbientes({
            ambienteNfe:     data.ambienteNfe     ?? 2,
            ambienteNfce:    data.ambienteNfce    ?? 2,
            ambienteNfse:    data.ambienteNfse    ?? 2,
            ambienteSped:    data.ambienteSped    ?? 2,
            ambienteEsocial: data.ambienteEsocial ?? 2,
            ambienteReinf:   data.ambienteReinf   ?? 2,
            ambienteDctfweb: data.ambienteDctfweb ?? 2,
          });
        }
      })
      .catch(() => { /* Unauthenticated or company not found */ });

    // Fetch notifications from real API
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const pageTitle = pageTitles[pathname] || 'ERP Implementos';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (envTooltipRef.current && !envTooltipRef.current.contains(event.target as Node)) {
        setShowEnvTooltip(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    } catch {
      // reload to get accurate state on failure
      fetchNotifications();
    }
  };

  return (
    <div className="shrink-0">
      {/* Environment indicator — compact single badge, only shown when in HML */}
      {(moduleAmbientes || govAmbiente) && (() => {
        const hmlModules = moduleAmbientes
          ? MODULE_LABELS.filter(({ key }) => moduleAmbientes[key] !== 1).map(({ label }) => label)
          : (govAmbiente !== 'PRODUCAO' ? ['Sistema'] : []);
        const allProd = hmlModules.length === 0;
        if (allProd) return null;
        return (
          <div className="py-1 px-4 bg-amber-50 border-b border-amber-200 flex items-center justify-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[11px] font-semibold text-amber-800">
              Ambiente de Homologação (teste) — {hmlModules.join(', ')}
            </span>
            <div className="relative" ref={envTooltipRef}>
              <button
                onClick={() => setShowEnvTooltip((v) => !v)}
                className="text-amber-500 hover:text-amber-700 transition-colors"
                aria-label="Informações sobre os ambientes"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              {showEnvTooltip && (
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-72 bg-white border border-slate-200 text-slate-700 text-[12px] rounded-lg px-3 py-3 shadow-xl z-50">
                  <p className="font-semibold text-slate-900 mb-2">Módulos em Homologação</p>
                  <p className="text-slate-600 mb-2">As transmissões em HML são testes sem validade jurídica.</p>
                  <div className="space-y-1 mb-2">
                    {MODULE_LABELS.map(({ key, label }) => {
                      const isProd = moduleAmbientes ? moduleAmbientes[key] === 1 : govAmbiente === 'PRODUCAO';
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-slate-600">{label}</span>
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', isProd ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                            {isProd ? 'PRODUÇÃO' : 'HML'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Link href="/configuracoes/empresa" onClick={() => setShowEnvTooltip(false)} className="text-blue-600 hover:text-blue-700 underline text-[11px]">
                    Configurar ambientes →
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })()}

    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center text-sm">
          <span className="text-slate-400">ERP</span>
          <span className="mx-2 text-slate-300">/</span>
          <span className="font-medium text-slate-700">{pageTitle}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Quick search trigger */}
        <button
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
          }}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-xs transition-colors"
          title="Busca rápida"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Buscar...</span>
          <kbd className="text-[10px] border border-slate-300 rounded px-1 font-medium">Ctrl+K</kbd>
        </button>

        <button
          onClick={toggleAiChat}
          className={`p-2 rounded-lg transition-colors ${
            aiChatOpen
              ? 'bg-blue-100 text-blue-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title="Assistente IA"
        >
          <Brain className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              'p-2 rounded-lg transition-colors relative',
              showNotifications
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            )}
            title="Notificacoes"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Notificações</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    Nenhuma notificação
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const config = typeConfig[notif.type] ?? typeConfig['info'];
                    const NotifIcon = config.icon;
                    const href = notif.link ?? '#';
                    return (
                      <Link
                        key={notif.id}
                        href={href}
                        onClick={() => {
                          markAsRead(notif.id);
                          setShowNotifications(false);
                        }}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors',
                          !notif.read && 'bg-blue-50/40'
                        )}
                      >
                        <div className={`w-8 h-8 ${config.bg} rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                          <NotifIcon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm truncate', !notif.read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                              {notif.title}
                            </p>
                            {!notif.read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{formatTimestamp(notif.createdAt)}</p>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>

              <div className="border-t border-slate-100 px-4 py-2.5">
                <Link
                  href="/chamados"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
                >
                  Ver todas as notificações
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="ml-2 flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">Admin</span>
        </div>
      </div>
    </header>
    </div>
  );
}
