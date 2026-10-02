'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Wrench, PlayCircle, PauseCircle, CheckCircle2,
  Clock, User, AlertTriangle, QrCode, RefreshCw,
  ChevronRight, Wifi, WifiOff, LogOut, BarChart3,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Mecanico {
  employeeId: string;
  matricula: string;
  nome: string;
  cargo: string;
  estado: 'TRABALHANDO' | 'PAUSADO' | 'PARADO';
  apontamentoId: string | null;
  inicio: string | null;
}

interface OsSubtarefaAberta {
  id: string;
  nome: string;
  status: string;
  osTarefaNome: string;
  osNumero: string;
  osId: string;
  equipamento: string;
  tempoPadraoH: number;
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') ?? '{}'); } catch { return {}; }
}

function elapsed(since: string): string {
  const diffMs = Date.now() - new Date(since).getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

const estadoConfig = {
  TRABALHANDO: { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Trabalhando', icon: PlayCircle },
  PAUSADO:     { color: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   label: 'Pausado',     icon: PauseCircle },
  PARADO:      { color: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-50',   label: 'Disponível',  icon: CheckCircle2 },
};

export default function MobilePage() {
  const [user, setUser] = useState<any>(null);
  const [meuEstado, setMeuEstado] = useState<Mecanico | null>(null);
  const [subtarefasAbertas, setSubtarefasAbertas] = useState<OsSubtarefaAberta[]>([]);
  const [sinaleira, setSinaleira] = useState<Mecanico[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    setOnline(navigator.onLine);
    const onOnline  = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rSinal, rSubtarefas] = await Promise.allSettled([
        apiFetch('/api/workshop/apontamentos/sinaleira'),
        apiFetch('/api/service-orders?status=EM_EXECUCAO&limit=50'),
      ]);

      if (rSinal.status === 'fulfilled' && rSinal.value.ok) {
        const data = await rSinal.value.json();
        const lista: Mecanico[] = data.mecanicos ?? [];
        setSinaleira(lista);
        const u = getUser();
        if (u?.employeeId) {
          setMeuEstado(lista.find(m => m.employeeId === u.employeeId) ?? null);
        }
      }
    } catch { /* offline */ } finally {
      setLoading(false);
      setAtualizadoEm(new Date());
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh a cada 30 s
  useEffect(() => {
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const handleStart = async (subtarefaId: string) => {
    try {
      await apiFetch(`/api/workshop/apontamentos/subtarefas/${subtarefaId}/start`, { method: 'POST' });
      await load();
    } catch (e: any) { alert(e.message || 'Erro ao iniciar'); }
  };

  const handlePause = async (subtarefaId: string) => {
    try {
      await apiFetch(`/api/workshop/apontamentos/subtarefas/${subtarefaId}/pause`, { method: 'POST' });
      await load();
    } catch (e: any) { alert(e.message || 'Erro ao pausar'); }
  };

  const handleStop = async (subtarefaId: string) => {
    if (!confirm('Confirmar conclusão desta subtarefa?')) return;
    try {
      await apiFetch(`/api/workshop/apontamentos/subtarefas/${subtarefaId}/stop`, { method: 'POST' });
      await load();
    } catch (e: any) { alert(e.message || 'Erro ao finalizar'); }
  };

  const cfg = meuEstado ? estadoConfig[meuEstado.estado] : estadoConfig.PARADO;
  const CfgIcon = cfg.icon;

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      {/* Header fixo */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">App Mecânico</p>
              <p className="text-xs text-slate-500 mt-0.5">{user?.name ?? 'Carregando...'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {online
              ? <Wifi className="w-4 h-4 text-emerald-500" />
              : <WifiOff className="w-4 h-4 text-red-500" />}
            <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Meu Status */}
        <div className={`rounded-2xl border-2 p-4 ${meuEstado?.estado === 'TRABALHANDO' ? 'border-emerald-300 bg-emerald-50' : meuEstado?.estado === 'PAUSADO' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 ${cfg.color} rounded-xl flex items-center justify-center`}>
                <CfgIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Meu Status</p>
                <p className={`text-base font-bold ${cfg.text}`}>{cfg.label}</p>
              </div>
            </div>
            {meuEstado?.inicio && meuEstado.estado === 'TRABALHANDO' && (
              <div className="text-right">
                <p className="text-xs text-slate-500">Em andamento há</p>
                <p className="text-lg font-bold text-emerald-700 tabular-nums">{elapsed(meuEstado.inicio)}</p>
              </div>
            )}
          </div>

          {/* Acesso rápido por QR */}
          <Link
            href="/mobile/apontar"
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm transition-colors active:scale-95"
          >
            <QrCode className="w-5 h-5" />
            Escanear QR para Apontar
          </Link>
        </div>

        {/* Última atualização */}
        {atualizadoEm && (
          <p className="text-center text-xs text-slate-400">
            Atualizado às {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {' · '}Atualização automática a cada 30s
          </p>
        )}

        {/* Sinaleira da equipe */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-700">Equipe Agora</h2>
            <Link href="/oficina/relatorios/eficiencia-mecanicos" className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" /> Relatório
            </Link>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-400">
              Carregando equipe...
            </div>
          ) : sinaleira.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-400">
              Nenhum mecânico cadastrado
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {sinaleira.map((m) => {
                const c = estadoConfig[m.estado];
                const MIcon = c.icon;
                return (
                  <div key={m.employeeId} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 ${c.color} rounded-full flex items-center justify-center shrink-0`}>
                      <MIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.nome}</p>
                      <p className="text-xs text-slate-500">{m.matricula} · {m.cargo}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                        {c.label}
                      </span>
                      {m.inicio && m.estado !== 'PARADO' && (
                        <p className="text-xs text-slate-400 mt-0.5">{elapsed(m.inicio)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Atalhos */}
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-2">Acesso Rápido</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Ordens de Serviço', href: '/oficina/os',      icon: Wrench,    color: 'bg-orange-500' },
              { label: 'Painel Ao Vivo',    href: '/apontamentos/sinaleira', icon: BarChart3, color: 'bg-violet-500' },
              { label: 'Meus Apontamentos', href: '/apontamentos',    icon: Clock,     color: 'bg-blue-500'   },
              { label: 'Eficiência',        href: '/oficina/relatorios/eficiencia-mecanicos', icon: BarChart3, color: 'bg-emerald-500' },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-md active:scale-95 transition-all"
              >
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-slate-700 text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
