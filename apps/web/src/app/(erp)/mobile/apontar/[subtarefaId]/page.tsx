'use client';

/**
 * /mobile/apontar/[subtarefaId]
 * Destino do QR Code — exibe detalhes da subtarefa e controles de apontamento.
 * URL gravada no QR: https://erp.ndimplementos.com.br/mobile/apontar/<id>
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, PlayCircle, PauseCircle, CheckCircle2,
  Clock, Wrench, AlertTriangle, RefreshCw, User,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Subtarefa {
  id: string;
  nome: string;
  status: string;
  tempoPadraoH: number;
  horasApontadas: number | null;
  osTarefa: {
    titulo: string;
    serviceOrder: {
      id: string;
      numero: string;
      equipamento?: { placa?: string; modelo?: string };
    };
  };
}

interface ApontamentoAtivo {
  id: string;
  inicio: string;
  pausado: boolean;
  employeeId: string;
  employee?: { matricula: string; person?: { razaoSocial: string } };
}

const STATUS_LABELS: Record<string, string> = {
  PENDENTE:    'Pendente',
  EM_EXECUCAO: 'Em Execução',
  PAUSADA:     'Pausada',
  CONCLUIDA:   'Concluída',
  CANCELADA:   'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  PENDENTE:    'bg-slate-100 text-slate-600',
  EM_EXECUCAO: 'bg-emerald-100 text-emerald-700',
  PAUSADA:     'bg-amber-100 text-amber-700',
  CONCLUIDA:   'bg-blue-100 text-blue-700',
  CANCELADA:   'bg-red-100 text-red-700',
};

function elapsed(since: string): string {
  const diffMs = Date.now() - new Date(since).getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getEmployeeId(): string {
  try { const u = JSON.parse(localStorage.getItem('user') ?? '{}'); return u?.employeeId ?? u?.id ?? ''; } catch { return ''; }
}

export default function ApontarSubtarefaPage() {
  const { subtarefaId } = useParams<{ subtarefaId: string }>();
  const router = useRouter();

  const [subtarefa, setSubtarefa]           = useState<Subtarefa | null>(null);
  const [apontamentoAtivo, setApontamentoAtivo] = useState<ApontamentoAtivo | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [acting, setActing]                 = useState(false);
  const [tick, setTick]                     = useState(0);

  // Cronômetro ao vivo
  useEffect(() => {
    if (!apontamentoAtivo || apontamentoAtivo.pausado) return;
    const t = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [apontamentoAtivo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Busca detalhes da subtarefa via OS
      const res = await apiFetch(`/api/workshop/os-subtarefas/${subtarefaId}`);
      if (!res.ok) throw new Error('Subtarefa não encontrada');
      const data = await res.json();
      setSubtarefa(data);

      // Busca apontamento ativo (se houver)
      const rApt = await apiFetch(`/api/workshop/apontamentos/subtarefas/${subtarefaId}/ativo`).catch(() => null);
      if (rApt?.ok) {
        setApontamentoAtivo(await rApt.json());
      } else {
        setApontamentoAtivo(null);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar subtarefa');
    } finally {
      setLoading(false);
    }
  }, [subtarefaId]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: 'start' | 'pause' | 'stop') => {
    if (action === 'stop' && !confirm('Confirmar conclusão desta subtarefa? Esta ação não pode ser desfeita.')) return;
    setActing(true);
    try {
      await apiFetch(`/api/workshop/apontamentos/subtarefas/${subtarefaId}/${action}`, { method: 'POST' });
      await load();
      if (action === 'stop') {
        // Redireciona de volta após conclusão
        setTimeout(() => router.push('/mobile'), 1500);
      }
    } catch (e: any) {
      alert(e.message || `Erro ao ${action === 'start' ? 'iniciar' : action === 'pause' ? 'pausar' : 'finalizar'}`);
    } finally {
      setActing(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-sm text-slate-500">Carregando subtarefa...</p>
      </div>
    );
  }

  // ── Erro ────────────────────────────────────────────────────────────────────
  if (error || !subtarefa) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-slate-900">QR Code inválido</p>
          <p className="text-sm text-slate-500 mt-1">{error ?? 'Subtarefa não encontrada'}</p>
        </div>
        <Link href="/mobile" className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm">
          Voltar ao App
        </Link>
      </div>
    );
  }

  const meuApontamento = apontamentoAtivo?.employeeId === getEmployeeId();
  const outroMecanico = apontamentoAtivo && !meuApontamento;
  const concluida = subtarefa.status === 'CONCLUIDA' || subtarefa.status === 'CANCELADA';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/mobile" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 truncate">OS {subtarefa.osTarefa.serviceOrder.numero} · {subtarefa.osTarefa.titulo}</p>
          <p className="text-sm font-bold text-slate-900 truncate">{subtarefa.nome}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[subtarefa.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {STATUS_LABELS[subtarefa.status] ?? subtarefa.status}
        </span>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-4">

        {/* Card OS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Wrench className="w-4 h-4 text-orange-500" />
            <span className="font-semibold">{subtarefa.osTarefa.serviceOrder.numero}</span>
            {subtarefa.osTarefa.serviceOrder.equipamento?.placa && (
              <span className="text-slate-400">· {subtarefa.osTarefa.serviceOrder.equipamento.placa}</span>
            )}
            {subtarefa.osTarefa.serviceOrder.equipamento?.modelo && (
              <span className="text-slate-400 truncate">— {subtarefa.osTarefa.serviceOrder.equipamento.modelo}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Tempo Padrão</p>
              <p className="text-lg font-bold text-slate-900">{subtarefa.tempoPadraoH}h</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Horas Apontadas</p>
              <p className="text-lg font-bold text-slate-900">
                {Number(subtarefa.horasApontadas ?? 0).toFixed(1)}h
              </p>
            </div>
          </div>
        </div>

        {/* Cronômetro ativo */}
        {apontamentoAtivo && !apontamentoAtivo.pausado && meuApontamento && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 text-center">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Em andamento</p>
            <p className="text-5xl font-bold text-emerald-700 tabular-nums font-mono">
              {elapsed(apontamentoAtivo.inicio)}
            </p>
            <p className="text-xs text-emerald-500 mt-2">Cronômetro ao vivo</p>
          </div>
        )}

        {apontamentoAtivo && apontamentoAtivo.pausado && meuApontamento && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-amber-700">⏸ Apontamento Pausado</p>
            <p className="text-xs text-amber-600 mt-1">Toque em Retomar para continuar</p>
          </div>
        )}

        {outroMecanico && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <User className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-700">Sendo executada por outro mecânico</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {apontamentoAtivo?.employee?.person?.razaoSocial ?? apontamentoAtivo?.employee?.matricula ?? 'Outro mecânico'}
              </p>
            </div>
          </div>
        )}

        {concluida && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
            <p className="text-sm font-semibold text-blue-700">Esta subtarefa já foi concluída.</p>
          </div>
        )}

        {/* Controles */}
        {!concluida && !outroMecanico && (
          <div className="space-y-3">
            {/* Sem apontamento ativo — INICIAR */}
            {!apontamentoAtivo && (
              <button
                onClick={() => doAction('start')}
                disabled={acting}
                className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-60 active:scale-95"
              >
                {acting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <PlayCircle className="w-6 h-6" />}
                Iniciar Apontamento
              </button>
            )}

            {/* Apontamento ativo (não pausado) — PAUSAR + FINALIZAR */}
            {apontamentoAtivo && !apontamentoAtivo.pausado && meuApontamento && (
              <>
                <button
                  onClick={() => doAction('pause')}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-60 active:scale-95"
                >
                  {acting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <PauseCircle className="w-6 h-6" />}
                  Pausar
                </button>
                <button
                  onClick={() => doAction('stop')}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-60 active:scale-95"
                >
                  {acting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                  Concluir Subtarefa
                </button>
              </>
            )}

            {/* Pausado — RETOMAR + FINALIZAR */}
            {apontamentoAtivo?.pausado && meuApontamento && (
              <>
                <button
                  onClick={() => doAction('start')}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-60 active:scale-95"
                >
                  {acting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <PlayCircle className="w-6 h-6" />}
                  Retomar
                </button>
                <button
                  onClick={() => doAction('stop')}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-60 active:scale-95"
                >
                  {acting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                  Concluir Subtarefa
                </button>
              </>
            )}
          </div>
        )}

        {/* Link para OS completa */}
        <Link
          href={`/oficina/ordens-servico/${subtarefa.osTarefa.serviceOrder.id}`}
          className="w-full flex items-center justify-center gap-2 py-3 border border-slate-300 bg-white text-slate-700 rounded-2xl font-medium text-sm hover:bg-slate-50 transition-colors"
        >
          <Wrench className="w-4 h-4" />
          Ver OS Completa
        </Link>

      </div>
    </div>
  );
}
