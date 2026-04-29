'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Square,
  Truck,
  User,
  Wrench,
  FileText,
  Package,
  Clock,
  Send,
  AlertTriangle,
  DollarSign,
  ListChecks,
  Plus,
  Shield,
  Timer,
  BarChart3,
  RefreshCw,
  TrendingUp,
  QrCode,
  Printer,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtQty } from '@/lib/format';
import { QRCodeSVG } from 'qrcode.react';

// ── Types ─────────────────────────────────────────────────────────────────────

type OSStatus =
  | 'ORCAMENTO'
  | 'AGUARD_APROVACAO'
  | 'APROVADA'
  | 'EM_EXECUCAO'
  | 'AGUARD_PECAS'
  | 'CONCLUIDA'
  | 'FATURADA'
  | 'CANCELADA'
  | 'VENDA_PERDIDA';

interface OsSubtarefa {
  id: string;
  nome: string;
  ordem: number;
  status: string;
  tempoPadraoH: number;
  horasApontadas: string | number;
}

interface OsTarefa {
  id: string;
  titulo: string;
  ordem: number;
  status: string;
  tempoPadraoH: number;
  subtarefas: OsSubtarefa[];
}

interface OsItem {
  id: string;
  description: string;
  tipo: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice?: number | string;
}

interface TarefaCatalogo {
  id: string;
  codigo: string;
  nome: string;
  tempoPadraoH: number;
}

interface EficienciaSubtarefa {
  subtarefaId: string;
  nome: string;
  horasPadrao: number;
  horasReais: number;
  eficiencia: number | null;
  status: string;
}

interface EficienciaTarefa {
  osTarefaId: string;
  titulo: string;
  totalHorasPadrao: number;
  totalHorasReais: number;
  eficienciaGeral: number | null;
  subtarefas: EficienciaSubtarefa[];
}

interface OrderData {
  id: string;
  numero: string;
  status: OSStatus;
  type: string;
  priority: string;
  tipoPagador?: string;
  valorTotal?: string | number;
  valorPecas?: string | number;
  valorMaoDeObra?: string | number;
  valorTerceiros?: string | number;
  person: { id: string; razaoSocial?: string; nomeFantasia?: string; cpfCnpj?: string };
  equipamento?: {
    id: string;
    tipo: string;
    marca?: string;
    modelo?: string;
    anoModelo?: number;
    placa?: string;
    chassi?: string;
    serialNumber?: string;
    tipoCarroceria?: { nome: string };
    modeloCarroceria?: { nome: string; fabricante?: string };
    proprietario?: { razaoSocial?: string };
  };
  defeitoRelatado: string;
  diagnostico?: string;
  solucao?: string;
  motivoVendaPerdida?: string;
  dataEntrada?: string;
  dataPrevisao?: string;
  dataConclusao?: string;
  dataEntrega?: string;
  kmEntrada?: number | null;
  garantiaFabricante?: string;
  garantiaReembolsaPecas?: boolean;
  garantiaReembolsaMO?: boolean;
  observations?: string;
  items: OsItem[];
  osTarefas: OsTarefa[];
  requisitions: { id: string; numero: string; status: string; type: string; createdAt: string }[];
  calderariaOrders: { id: string; numero: string; status: string; serviceType?: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OSStatus, string> = {
  ORCAMENTO:        'Orçamento',
  AGUARD_APROVACAO: 'Aguard. Aprovação',
  APROVADA:         'Aprovada',
  EM_EXECUCAO:      'Em Execução',
  AGUARD_PECAS:     'Aguard. Peças',
  CONCLUIDA:        'Concluída',
  FATURADA:         'Faturada',
  CANCELADA:        'Cancelada',
  VENDA_PERDIDA:    'Venda Perdida',
};

const STATUS_BADGE: Record<OSStatus, string> = {
  ORCAMENTO:        'bg-slate-100 text-slate-600 border-slate-200',
  AGUARD_APROVACAO: 'bg-sky-100 text-sky-700 border-sky-200',
  APROVADA:         'bg-violet-100 text-violet-700 border-violet-200',
  EM_EXECUCAO:      'bg-rose-100 text-rose-700 border-rose-200',
  AGUARD_PECAS:     'bg-amber-100 text-amber-700 border-amber-200',
  CONCLUIDA:        'bg-emerald-100 text-emerald-700 border-emerald-200',
  FATURADA:         'bg-blue-100 text-blue-700 border-blue-200',
  CANCELADA:        'bg-red-100 text-red-700 border-red-200',
  VENDA_PERDIDA:    'bg-gray-100 text-gray-500 border-gray-200',
};

const PRIORITY_BADGE: Record<string, string> = {
  URGENTE: 'bg-red-100 text-red-700',
  ALTA:    'bg-orange-100 text-orange-700',
  NORMAL:  'bg-blue-100 text-blue-700',
  BAIXA:   'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  MECANICA:   '🔧 Mecânica',
  CALDERARIA: '⚙️ Calderaria',
  PINTURA:    '🎨 Pintura',
  MISTA:      '🔀 Mista',
  GARANTIA:   '🛡️ Garantia',
  INSTALACAO: '🏗️ Instalação',
  INTERNA:    '🏭 Interna',
};

const ITEM_TIPO_BADGE: Record<string, string> = {
  PECA:               'bg-rose-100 text-rose-700',
  SERVICO:            'bg-blue-100 text-blue-700',
  MATERIAL_CALDERARIA:'bg-zinc-100 text-zinc-700',
  TERCEIRO:           'bg-purple-100 text-purple-700',
};

const ITEM_TIPO_LABELS: Record<string, string> = {
  PECA:               'Peça',
  SERVICO:            'Serviço',
  MATERIAL_CALDERARIA:'Mat. Calderaria',
  TERCEIRO:           'Terceiro',
};

const SUB_STATUS_BADGE: Record<string, string> = {
  PENDENTE:    'bg-slate-100 text-slate-600',
  EM_EXECUCAO: 'bg-rose-100 text-rose-700',
  PAUSADA:     'bg-amber-100 text-amber-700',
  CONCLUIDA:   'bg-emerald-100 text-emerald-700',
  CANCELADA:   'bg-red-100 text-red-700',
};

const TAREFA_STATUS_BADGE: Record<string, string> = {
  PENDENTE:    'bg-slate-100 text-slate-600',
  EM_EXECUCAO: 'bg-rose-100 text-rose-700',
  PAUSADA:     'bg-amber-100 text-amber-700',
  CONCLUIDA:   'bg-emerald-100 text-emerald-700',
  CANCELADA:   'bg-red-100 text-red-700',
};

// Pipeline step order (terminal states are off-track)
const PIPELINE_STEPS: OSStatus[] = [
  'ORCAMENTO', 'AGUARD_APROVACAO', 'APROVADA', 'EM_EXECUCAO', 'AGUARD_PECAS', 'CONCLUIDA', 'FATURADA',
];

// Priority index for progress calculation (AGUARD_PECAS is between EM_EXECUCAO and CONCLUIDA)
const STEP_ORDER: Record<string, number> = {
  ORCAMENTO: 0, AGUARD_APROVACAO: 1, APROVADA: 2, EM_EXECUCAO: 3, AGUARD_PECAS: 3, CONCLUIDA: 4, FATURADA: 5,
};

const TIPOPAGADOR_LABELS: Record<string, string> = {
  CLIENTE: 'Cliente', FABRICA: 'Fábrica', SEGURADORA: 'Seguradora', TERCEIRO: 'Terceiro', PROPRIA: 'Conta Própria',
};

const REQ_STATUS_BADGE: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600', SOLICITADA: 'bg-cyan-100 text-cyan-700',
  APROVADA:  'bg-blue-100 text-blue-700',  SEPARADA: 'bg-amber-100 text-amber-700',
  ENTREGUE:  'bg-emerald-100 text-emerald-700', CANCELADA: 'bg-red-100 text-red-700',
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-800 text-right font-medium">{children}</span>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── SubtarefaRow ──────────────────────────────────────────────────────────────

function SubtarefaRow({
  sub, osStatus, busy, onApontamento, onShowQr,
}: {
  sub: OsSubtarefa;
  osStatus: OSStatus;
  busy: boolean;
  onApontamento: (id: string, action: 'start' | 'pause' | 'stop') => void;
  onShowQr: (sub: OsSubtarefa) => void;
}) {
  const isRunning = sub.status === 'EM_EXECUCAO';
  const isPaused  = sub.status === 'PAUSADA';
  const isDone    = sub.status === 'CONCLUIDA' || sub.status === 'CANCELADA';
  const isPending = sub.status === 'PENDENTE';

  const horasApont  = Number(sub.horasApontadas ?? 0);
  const horasPadrao = sub.tempoPadraoH ?? 0;
  const progPct     = horasPadrao > 0 ? Math.min(100, (horasApont / horasPadrao) * 100) : 0;
  const canApoint   = osStatus === 'EM_EXECUCAO';

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${isRunning ? 'bg-rose-50/60' : ''}`}>
      {/* Pulse indicator */}
      <div className="shrink-0 w-5 flex items-center justify-center">
        {isRunning ? (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
          </span>
        ) : isDone ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : (
          <span className="w-3 h-3 rounded-full border-2 border-slate-300" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {sub.nome}
          </span>
          <Badge className={SUB_STATUS_BADGE[sub.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}>
            {sub.status.replace('_', ' ')}
          </Badge>
        </div>

        {horasPadrao > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 max-w-[120px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isDone ? 'bg-emerald-500' : isRunning ? 'bg-rose-500' : 'bg-sky-400'
                }`}
                style={{ width: `${progPct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
              {horasApont.toFixed(2)}h / {horasPadrao}h
            </span>
          </div>
        )}
      </div>

      {/* QR Code button */}
      <button
        onClick={() => onShowQr(sub)}
        title="Exibir QR Code para apontamento mobile"
        className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        <QrCode className="w-4 h-4" />
      </button>

      {/* Actions */}
      {canApoint && !isDone && (
        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && (
            <button
              onClick={() => onApontamento(sub.id, 'start')}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Play className="w-3 h-3" />
              Iniciar
            </button>
          )}
          {isRunning && (
            <>
              <button
                onClick={() => onApontamento(sub.id, 'pause')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                <Pause className="w-3 h-3" />
                Pausar
              </button>
              <button
                onClick={() => onApontamento(sub.id, 'stop')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <Square className="w-3 h-3" />
                Concluir
              </button>
            </>
          )}
          {isPaused && (
            <button
              onClick={() => onApontamento(sub.id, 'start')}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Play className="w-3 h-3" />
              Retomar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OrdemServicoDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order,      setOrder]      = useState<OrderData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [apontBusy,  setApontBusy]  = useState(false);
  const [actionErr,  setActionErr]  = useState<string | null>(null);
  const [apontErr,   setApontErr]   = useState<string | null>(null);
  const [qrSubtarefa, setQrSubtarefa] = useState<OsSubtarefa | null>(null);

  // Modals
  const [modal, setModal] = useState<
    null | 'cancelar' | 'venda-perdida' | 'concluir' | 'add-tarefa' | 'faturar'
  >(null);
  const [cancelMotivo,  setCancelMotivo]  = useState('');
  const [vpMotivo,      setVpMotivo]      = useState('');
  const [diagnostico,   setDiagnostico]   = useState('');
  const [solucao,       setSolucao]       = useState('');

  // Faturamento modal state
  const [fatNumParcelas,    setFatNumParcelas]    = useState(1);
  const [fatIntervaloDias,  setFatIntervaloDias]  = useState(30);
  const [fatDataVenc1,      setFatDataVenc1]      = useState(() => new Date().toISOString().slice(0, 10));
  const [fatFormaPgto,      setFatFormaPgto]      = useState('PIX');

  // Add-tarefa modal
  const [tarefasCatalogo,    setTarefasCatalogo]    = useState<TarefaCatalogo[]>([]);
  const [loadingTarefas,     setLoadingTarefas]     = useState(false);
  const [selectedTarefaId,   setSelectedTarefaId]   = useState('');
  const [addingTarefa,       setAddingTarefa]        = useState(false);

  // Eficiência
  const [eficienciaData, setEficienciaData] = useState<EficienciaTarefa[]>([]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      const [orderRes, efRes] = await Promise.all([
        apiFetch(`/api/service-orders/${id}`),
        apiFetch(`/api/workshop/apontamentos/os/${id}/eficiencia`),
      ]);
      if (!orderRes.ok) { setNotFound(true); return; }
      setOrder(await orderRes.json());
      if (efRes.ok) setEficienciaData(await efRes.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const refresh = async () => {
    setActionErr(null);
    await loadOrder();
  };

  // ── Status actions ──────────────────────────────────────────────────────────

  const doStatus = async (endpoint: string, body?: Record<string, unknown>) => {
    setActionErr(null);
    setActionBusy(true);
    try {
      const res = await apiFetch(`/api/service-orders/${id}/${endpoint}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = Array.isArray(d.message) ? d.message.join(' • ') : (d.message || 'Erro ao executar ação.');
        setActionErr(msg);
        return;
      }
      await loadOrder();
    } catch (err: any) {
      setActionErr(err.message || 'Erro ao executar ação.');
    } finally {
      setActionBusy(false);
    }
  };

  // ── Apontamentos ────────────────────────────────────────────────────────────

  const doApontamento = async (subtarefaId: string, action: 'start' | 'pause' | 'stop') => {
    setApontErr(null);
    setApontBusy(true);
    try {
      const res = await apiFetch(
        `/api/workshop/apontamentos/subtarefas/${subtarefaId}/${action}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setApontErr(d.message || 'Erro no apontamento.');
        return;
      }
      await loadOrder();
    } catch (err: any) {
      setApontErr(err.message || 'Erro no apontamento.');
    } finally {
      setApontBusy(false);
    }
  };

  // ── Add tarefa from catalog ─────────────────────────────────────────────────

  const openAddTarefa = async () => {
    setModal('add-tarefa');
    setSelectedTarefaId('');
    setLoadingTarefas(true);
    try {
      const res = await apiFetch('/api/workshop/tarefas-catalogo?limit=200');
      if (res.ok) {
        const d = await res.json();
        setTarefasCatalogo(d.data || d || []);
      }
    } finally {
      setLoadingTarefas(false);
    }
  };

  const confirmAddTarefa = async () => {
    if (!selectedTarefaId || !order) return;
    setAddingTarefa(true);
    try {
      const res = await apiFetch('/api/workshop/tarefas-catalogo/adicionar-na-os', {
        method: 'POST',
        body: JSON.stringify({ serviceOrderId: order.id, tarefaCatalogoId: selectedTarefaId }),
      });
      if (res.ok) {
        setModal(null);
        await loadOrder();
      }
    } finally {
      setAddingTarefa(false);
    }
  };

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        <p className="text-slate-500 text-sm">Carregando ordem de serviço...</p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <XCircle className="w-10 h-10 text-slate-300" />
        <p className="text-slate-700 font-semibold">Ordem de serviço não encontrada.</p>
        <Link href="/oficina/ordens-servico" className="text-sm text-rose-600 hover:text-rose-700 underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const items      = order.items ?? [];
  const osTarefas  = order.osTarefas ?? [];
  const isTerminal = ['FATURADA', 'CANCELADA', 'VENDA_PERDIDA'].includes(order.status);
  const clientName = order.person?.razaoSocial ?? order.person?.nomeFantasia ?? '—';

  const totalPecas    = items.filter((i) => i.tipo === 'PECA' || i.tipo === 'MATERIAL_CALDERARIA')
    .reduce((s, i) => s + Number(i.totalPrice ?? (Number(i.unitPrice) * Number(i.quantity))), 0);
  const totalServicos = items.filter((i) => i.tipo === 'SERVICO' || i.tipo === 'TERCEIRO')
    .reduce((s, i) => s + Number(i.totalPrice ?? (Number(i.unitPrice) * Number(i.quantity))), 0);
  const totalGeral    = totalPecas + totalServicos;

  const hasRunningApontamento = osTarefas.some((t) =>
    t.subtarefas.some((s) => s.status === 'EM_EXECUCAO')
  );

  // Pipeline progress
  const currentOrd = STEP_ORDER[order.status] ?? -1;
  const isOffTrack = ['CANCELADA', 'VENDA_PERDIDA'].includes(order.status);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-24">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Link
          href="/oficina/ordens-servico"
          className="mt-1 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{order.numero}</h1>
            <Badge className={STATUS_BADGE[order.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            <span className="text-sm text-slate-500">{TYPE_LABELS[order.type] ?? order.type}</span>
            <Badge className={PRIORITY_BADGE[order.priority] ?? 'bg-slate-100 text-slate-600 border-slate-200'}>
              {order.priority}
            </Badge>
            {hasRunningApontamento && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                Mecânico trabalhando
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            {clientName}
            {order.dataEntrada && ` · Entrada: ${fmtDateTime(order.dataEntrada)}`}
            {order.dataPrevisao && ` · Previsão: ${fmtDate(order.dataPrevisao)}`}
          </p>
        </div>

        <button
          onClick={refresh}
          title="Atualizar"
          className="mt-1 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Error banners ──────────────────────────────────────────────────── */}
      {actionErr && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{actionErr}</span>
          <button onClick={() => setActionErr(null)} className="ml-auto text-red-400 hover:text-red-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      {apontErr && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{apontErr}</span>
          <button onClick={() => setApontErr(null)} className="ml-auto text-amber-400 hover:text-amber-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Status pipeline ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-600">Fluxo da OS</h2>
          {isOffTrack && (
            <Badge className={STATUS_BADGE[order.status]}>
              {STATUS_LABELS[order.status]}
            </Badge>
          )}
        </div>

        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {PIPELINE_STEPS.map((step, idx) => {
            const stepOrd   = STEP_ORDER[step] ?? -1;
            const isDone    = !isOffTrack && stepOrd < currentOrd;
            const isCurrent = !isOffTrack && step === order.status;
            const isFuture  = isOffTrack || stepOrd > currentOrd;
            return (
              <div key={step} className="flex items-center shrink-0">
                <div className="flex flex-col items-center w-20">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent
                      ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200'
                      : isDone
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-white border-slate-200 text-slate-300'
                  }`}>
                    {isDone
                      ? <CheckCircle className="w-4 h-4" />
                      : <span className="text-[11px] font-bold">{idx + 1}</span>
                    }
                  </div>
                  <span className={`text-[10px] mt-1.5 text-center leading-tight font-medium ${
                    isCurrent ? 'text-rose-600' : isDone ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {STATUS_LABELS[step]}
                  </span>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 w-3 shrink-0 mb-3 ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Info grid (equipamento + cliente) ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Equipamento */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-slate-700">Equipamento</h2>
          </div>
          {order.equipamento ? (
            <>
              <p className="text-base font-bold text-slate-900">
                {[order.equipamento.marca, order.equipamento.modelo].filter(Boolean).join(' ') || '—'}
                {order.equipamento.anoModelo && <span className="text-slate-500 font-normal text-sm"> · {order.equipamento.anoModelo}</span>}
              </p>
              {order.equipamento.tipoCarroceria?.nome && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {order.equipamento.tipoCarroceria.nome}
                  {order.equipamento.modeloCarroceria?.nome && ` · ${order.equipamento.modeloCarroceria.nome}`}
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <Badge className="bg-slate-100 text-slate-600 border-slate-200">{order.equipamento.tipo}</Badge>
                {order.equipamento.placa && (
                  <InfoRow label="Placa">
                    <span className="font-mono font-bold tracking-wider">{order.equipamento.placa}</span>
                  </InfoRow>
                )}
                {order.equipamento.chassi && <InfoRow label="Chassi">{order.equipamento.chassi}</InfoRow>}
                {order.equipamento.serialNumber && (
                  <InfoRow label="Serial"><span className="font-mono">{order.equipamento.serialNumber}</span></InfoRow>
                )}
                {order.kmEntrada != null && (
                  <InfoRow label="KM Entrada">{fmtQty(order.kmEntrada)} km</InfoRow>
                )}
                {order.equipamento.proprietario?.razaoSocial && (
                  <InfoRow label="Proprietário">{order.equipamento.proprietario.razaoSocial}</InfoRow>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1">Nenhum equipamento vinculado</p>
          )}
        </div>

        {/* Cliente */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-slate-700">Cliente</h2>
          </div>
          <p className="text-base font-bold text-slate-900">{clientName}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            {order.person.cpfCnpj && (
              <InfoRow label="CPF / CNPJ">
                <span className="font-mono">{order.person.cpfCnpj}</span>
              </InfoRow>
            )}
            {order.tipoPagador && (
              <InfoRow label="Quem paga">{TIPOPAGADOR_LABELS[order.tipoPagador] ?? order.tipoPagador}</InfoRow>
            )}
            {order.dataEntrada && (
              <InfoRow label="Entrada">{fmtDateTime(order.dataEntrada)}</InfoRow>
            )}
            {order.dataPrevisao && (
              <InfoRow label="Previsão">{fmtDate(order.dataPrevisao)}</InfoRow>
            )}
            {order.dataConclusao && (
              <InfoRow label="Concluída em">
                <span className="text-emerald-700">{fmtDate(order.dataConclusao)}</span>
              </InfoRow>
            )}
            {order.dataEntrega && (
              <InfoRow label="Entregue em">
                <span className="text-blue-700">{fmtDate(order.dataEntrega)}</span>
              </InfoRow>
            )}
          </div>
        </div>
      </div>

      {/* ── Seguradora info ────────────────────────────────────────────────── */}
      {(order as any).tipoPagador === 'SEGURADORA' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm flex-1">
            <p className="font-semibold text-sky-800">
              Seguradora:{' '}
              {(order as any).seguradora?.razaoSocial ?? '—'}
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-sky-600">
              {(order as any).apoliceNumero && <span>Apólice: <strong>{(order as any).apoliceNumero}</strong></span>}
              {(order as any).sinistroNumero && <span>Sinistro: <strong>{(order as any).sinistroNumero}</strong></span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Garantia / Fabricante info ─────────────────────────────────────── */}
      {((order as any).tipoPagador === 'FABRICA' || order.type === 'GARANTIA') && order.garantiaFabricante && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm flex-1">
            <p className="font-semibold text-orange-800">Garantia / Fabricante: {order.garantiaFabricante}</p>
            {(order as any).fabricantePerson && (
              <p className="text-xs text-orange-600">Cadastro: {(order as any).fabricantePerson.razaoSocial}</p>
            )}
            <p className="text-orange-700 text-xs">
              {order.garantiaReembolsaPecas ? '✓ Reembolsa peças' : '✗ Não reembolsa peças'} ·{' '}
              {order.garantiaReembolsaMO ? '✓ Reembolsa MO' : '✗ Não reembolsa MO'}
            </p>
          </div>
        </div>
      )}

      {/* ── Venda Perdida info ─────────────────────────────────────────────── */}
      {order.status === 'VENDA_PERDIDA' && order.motivoVendaPerdida && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-600">Venda Perdida</p>
            <p className="text-sm text-gray-500 mt-0.5">{order.motivoVendaPerdida}</p>
          </div>
        </div>
      )}

      {/* ── Defeito / Diagnóstico / Solução ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-slate-700">Defeito Relatado</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {order.defeitoRelatado || <span className="text-slate-400">—</span>}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-700">Diagnóstico</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {order.diagnostico || <span className="text-slate-400">Não informado</span>}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-700">Solução Aplicada</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {order.solucao || <span className="text-slate-400">Não informado</span>}
          </p>
        </div>
      </div>

      {/* ── Tarefas e Apontamentos ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-slate-700">Tarefas e Apontamentos</h2>
            {osTarefas.length > 0 && (
              <span className="text-xs text-slate-400">({osTarefas.length} tarefa{osTarefas.length > 1 ? 's' : ''})</span>
            )}
          </div>
          {!isTerminal && (
            <button
              onClick={openAddTarefa}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Tarefa
            </button>
          )}
        </div>

        {osTarefas.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <ListChecks className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Nenhuma tarefa vinculada.</p>
            {!isTerminal && (
              <p className="text-xs text-slate-400 mt-1">
                Use <strong>Adicionar Tarefa</strong> para vincular tarefas do catálogo.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {osTarefas.map((tarefa) => {
              const totalHorasPadrao  = tarefa.subtarefas.reduce((s, st) => s + (st.tempoPadraoH ?? 0), 0);
              const totalHorasApont   = tarefa.subtarefas.reduce((s, st) => s + Number(st.horasApontadas ?? 0), 0);
              const concluidasCount   = tarefa.subtarefas.filter((s) => s.status === 'CONCLUIDA').length;

              return (
                <div key={tarefa.id}>
                  {/* Tarefa header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {tarefa.ordem}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{tarefa.titulo}</span>
                      <Badge className={TAREFA_STATUS_BADGE[tarefa.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}>
                        {tarefa.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {tarefa.subtarefas.length > 0 && (
                        <span>{concluidasCount}/{tarefa.subtarefas.length} subtarefas</span>
                      )}
                      {totalHorasPadrao > 0 && (
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {totalHorasApont.toFixed(2)}h / {totalHorasPadrao}h
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subtarefas */}
                  {tarefa.subtarefas.length > 0 ? (
                    <div className="divide-y divide-slate-50">
                      {tarefa.subtarefas.map((sub) => (
                        <SubtarefaRow
                          key={sub.id}
                          sub={sub}
                          osStatus={order.status}
                          busy={apontBusy}
                          onApontamento={doApontamento}
                          onShowQr={setQrSubtarefa}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-10 py-3 text-xs text-slate-400">Sem subtarefas.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Itens / Orçamento ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <Package className="w-4 h-4 text-rose-500" />
          <h2 className="text-sm font-semibold text-slate-700">Itens e Serviços</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit.</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    Nenhum item no orçamento.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`${ITEM_TIPO_BADGE[item.tipo] ?? 'bg-slate-100 text-slate-600'} border-transparent`}>
                        {ITEM_TIPO_LABELS[item.tipo] ?? item.tipo}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{fmtCurrency(Number(item.unitPrice))}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900 text-right">
                      {fmtCurrency(Number(item.totalPrice ?? (Number(item.unitPrice) * Number(item.quantity))))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Peças / Materiais</span>
                <span className="font-medium text-slate-700">{fmtCurrency(totalPecas)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">MO / Terceiros</span>
                <span className="font-medium text-slate-700">{fmtCurrency(totalServicos)}</span>
              </div>
              <div className="flex items-center justify-between text-base pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="font-bold text-rose-700">{fmtCurrency(totalGeral)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Análise de Eficiência ──────────────────────────────────────────── */}
      {eficienciaData.length > 0 && eficienciaData.some(t => t.totalHorasReais > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <TrendingUp className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-slate-700">Análise de Eficiência</h2>
            <span className="text-xs text-slate-400">(horas padrão vs realizadas)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {eficienciaData.map((tarefa) => {
              const ef = tarefa.eficienciaGeral;
              const efColor =
                ef === null      ? 'text-slate-400'
                : ef >= 100      ? 'text-emerald-600'
                : ef >= 75       ? 'text-amber-600'
                : 'text-red-600';
              const efBg =
                ef === null      ? 'bg-slate-100'
                : ef >= 100      ? 'bg-emerald-100'
                : ef >= 75       ? 'bg-amber-100'
                : 'bg-red-100';
              return (
                <div key={tarefa.osTarefaId} className="px-5 py-4">
                  {/* Tarefa header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-800">{tarefa.titulo}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {tarefa.totalHorasReais.toFixed(2)}h real · {tarefa.totalHorasPadrao.toFixed(1)}h padrão
                      </span>
                      {ef !== null && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${efBg} ${efColor}`}>
                          {ef}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subtarefas breakdown */}
                  {tarefa.subtarefas.length > 0 && (
                    <div className="space-y-2">
                      {tarefa.subtarefas.map((sub) => {
                        const subEf = sub.eficiencia;
                        const barColor =
                          subEf === null  ? 'bg-slate-300'
                          : subEf >= 100  ? 'bg-emerald-500'
                          : subEf >= 75   ? 'bg-amber-400'
                          : 'bg-red-500';
                        const pct = sub.horasPadrao > 0
                          ? Math.min(100, (sub.horasReais / sub.horasPadrao) * 100)
                          : 0;
                        return (
                          <div key={sub.subtarefaId} className="flex items-center gap-3">
                            <span className="text-xs text-slate-600 w-44 truncate shrink-0">{sub.nome}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 w-28 text-right shrink-0">
                              {sub.horasReais.toFixed(2)}h / {sub.horasPadrao.toFixed(1)}h
                              {subEf !== null && (
                                <span className={`ml-1.5 font-bold ${
                                  subEf >= 100 ? 'text-emerald-600' : subEf >= 75 ? 'text-amber-600' : 'text-red-600'
                                }`}>{subEf}%</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Requisições ────────────────────────────────────────────────────── */}
      {order.requisitions?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-teal-500" />
            <h2 className="text-sm font-semibold text-slate-700">Requisições de Material</h2>
          </div>
          <div className="space-y-2">
            {order.requisitions.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Link href={`/oficina/requisicoes/${req.id}`} className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                    {req.numero}
                  </Link>
                  <Badge className="bg-teal-100 text-teal-700 border-teal-200">{req.type}</Badge>
                  <Badge className={`${REQ_STATUS_BADGE[req.status] ?? 'bg-slate-100 text-slate-600'} border-transparent`}>
                    {req.status}
                  </Badge>
                </div>
                <span className="text-xs text-slate-400">{fmtDate(req.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ordens de Calderaria ────────────────────────────────────────────── */}
      {order.calderariaOrders?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-slate-700">Ordens de Calderaria</h2>
          </div>
          <div className="space-y-2">
            {order.calderariaOrders.map((cld) => (
              <div key={cld.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Link href={`/oficina/calderaria/${cld.id}`} className="text-sm font-semibold text-zinc-600 hover:text-zinc-700 hover:underline">
                    {cld.numero}
                  </Link>
                  {cld.serviceType && (
                    <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">{cld.serviceType}</Badge>
                  )}
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200">{cld.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Observations ────────────────────────────────────────────────────── */}
      {order.observations && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Observações Internas</p>
          <p className="text-sm text-slate-700">{order.observations}</p>
        </div>
      )}

      {/* ── Sticky action bar ──────────────────────────────────────────────── */}
      {!isTerminal && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            {/* Left: secondary actions */}
            <div className="flex items-center gap-2">
              {(order.status === 'ORCAMENTO' || order.status === 'AGUARD_APROVACAO') && (
                <button
                  onClick={() => setModal('venda-perdida')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Venda Perdida
                </button>
              )}
              <button
                onClick={() => setModal('cancelar')}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Cancelar OS
              </button>
            </div>

            {/* Right: primary action */}
            <div className="flex items-center gap-2">
              {actionBusy && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Processando...
                </span>
              )}

              {order.status === 'ORCAMENTO' && (
                <button
                  onClick={() => doStatus('enviar-aprovacao')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Enviar p/ Aprovação
                </button>
              )}
              {order.status === 'AGUARD_APROVACAO' && (
                <button
                  onClick={() => doStatus('aprovar')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprovar OS
                </button>
              )}
              {order.status === 'APROVADA' && (
                <button
                  onClick={() => doStatus('iniciar')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  Iniciar Execução
                </button>
              )}
              {order.status === 'EM_EXECUCAO' && (
                <>
                  <button
                    onClick={() => doStatus('aguardar-pecas')}
                    disabled={actionBusy}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <Pause className="w-4 h-4" />
                    Aguardar Peças
                  </button>
                  <button
                    onClick={() => { setDiagnostico(''); setSolucao(''); setModal('concluir'); }}
                    disabled={actionBusy}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Concluir OS
                  </button>
                </>
              )}
              {order.status === 'AGUARD_PECAS' && (
                <button
                  onClick={() => doStatus('retornar-execucao')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  Retomar Execução
                </button>
              )}
              {order.status === 'CONCLUIDA' && (
                <button
                  onClick={() => {
                    setFatNumParcelas(1);
                    setFatIntervaloDias(30);
                    setFatDataVenc1(new Date().toISOString().slice(0, 10));
                    setFatFormaPgto('PIX');
                    setModal('faturar');
                  }}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                  <DollarSign className="w-4 h-4" />
                  Faturar / Entregar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Faturar ─────────────────────────────────────────────────── */}
      {modal === 'faturar' && order && (() => {
        const valorTotal   = Number(order.valorTotal ?? 0);
        const valorParcela = fatNumParcelas > 0 ? Math.round((valorTotal / fatNumParcelas) * 100) / 100 : valorTotal;

        // Gera preview das parcelas
        const parcelas = Array.from({ length: fatNumParcelas }, (_, i) => {
          const venc = new Date(fatDataVenc1 + 'T12:00:00');
          venc.setDate(venc.getDate() + i * fatIntervaloDias);
          const valor = i === fatNumParcelas - 1
            ? Math.round((valorTotal - valorParcela * (fatNumParcelas - 1)) * 100) / 100
            : valorParcela;
          return { num: i + 1, venc, valor };
        });

        const formasPgto = [
          { value: 'PIX',            label: 'PIX' },
          { value: 'BOLETO',         label: 'Boleto' },
          { value: 'TRANSFERENCIA',  label: 'Transferência' },
          { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
          { value: 'CARTAO_DEBITO',  label: 'Cartão de Débito' },
          { value: 'DINHEIRO',       label: 'Dinheiro' },
          { value: 'CHEQUE',         label: 'Cheque' },
          { value: 'PROMISSORIA',    label: 'Promissória' },
        ];

        return (
          <Modal title="Faturar Ordem de Serviço" onClose={() => setModal(null)}>
            {/* Resumo financeiro */}
            <div className="bg-slate-50 rounded-lg p-4 mb-5 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Peças</span>
                <span className="font-medium">{fmtCurrency(Number(order.valorPecas ?? 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Mão de Obra</span>
                <span className="font-medium">{fmtCurrency(Number(order.valorMaoDeObra ?? 0))}</span>
              </div>
              {Number(order.valorTerceiros ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Terceiros</span>
                  <span className="font-medium">{fmtCurrency(Number(order.valorTerceiros ?? 0))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1.5 mt-1.5">
                <span className="text-slate-700">Total</span>
                <span className="text-blue-700 text-base">{fmtCurrency(valorTotal)}</span>
              </div>
            </div>

            {/* Forma de pagamento */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Forma de pagamento</label>
                <select
                  value={fatFormaPgto}
                  onChange={(e) => setFatFormaPgto(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {formasPgto.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Parcelas</label>
                <select
                  value={fatNumParcelas}
                  onChange={(e) => setFatNumParcelas(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>À Vista (1×)</option>
                  {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                    <option key={n} value={n}>{n}× de {fmtCurrency(Math.round((valorTotal / n) * 100) / 100)}</option>
                  ))}
                </select>
              </div>
            </div>

            {fatNumParcelas > 1 && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">1º vencimento</label>
                  <input
                    type="date"
                    value={fatDataVenc1}
                    onChange={(e) => setFatDataVenc1(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Intervalo (dias)</label>
                  <select
                    value={fatIntervaloDias}
                    onChange={(e) => setFatIntervaloDias(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={7}>7 dias</option>
                    <option value={14}>14 dias</option>
                    <option value={21}>21 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={45}>45 dias</option>
                    <option value={60}>60 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                </div>
              </div>
            )}

            {/* Preview das parcelas */}
            {fatNumParcelas > 1 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Preview das parcelas</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">#</th>
                        <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Vencimento</th>
                        <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parcelas.map((p) => (
                        <tr key={p.num}>
                          <td className="px-3 py-2 text-slate-500">{p.num}/{fatNumParcelas}</td>
                          <td className="px-3 py-2 text-slate-700">{p.venc.toLocaleDateString('pt-BR')}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{fmtCurrency(p.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={actionBusy}
                onClick={async () => {
                  setModal(null);
                  await doStatus('faturar', {
                    numParcelas:   fatNumParcelas,
                    intervaloDias: fatIntervaloDias,
                    dataVencimento1: fatDataVenc1,
                    formaPagamento: fatFormaPgto,
                  });
                }}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4" />
                {fatNumParcelas === 1 ? 'Confirmar Faturamento' : `Faturar em ${fatNumParcelas}×`}
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ── Modal: Cancelar ────────────────────────────────────────────────── */}
      {modal === 'cancelar' && (
        <Modal title="Cancelar Ordem de Serviço" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600 mb-4">
            Essa ação não pode ser desfeita. A OS será marcada como cancelada.
          </p>
          <textarea
            value={cancelMotivo}
            onChange={(e) => setCancelMotivo(e.target.value)}
            placeholder="Motivo do cancelamento (opcional)"
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none mb-5"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={async () => { setModal(null); await doStatus('cancelar'); }}
              className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Confirmar Cancelamento
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Venda Perdida ───────────────────────────────────────────── */}
      {modal === 'venda-perdida' && (
        <Modal title="Registrar Venda Perdida" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600 mb-4">
            Informe o motivo da perda desta oportunidade.
          </p>
          <textarea
            value={vpMotivo}
            onChange={(e) => setVpMotivo(e.target.value)}
            placeholder="Ex: Preço, cliente optou por concorrente, orçamento reprovado..."
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none mb-5"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={async () => { setModal(null); await doStatus('venda-perdida', { motivo: vpMotivo }); }}
              className="px-4 py-2 text-sm font-semibold bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Confirmar Venda Perdida
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Concluir ────────────────────────────────────────────────── */}
      {modal === 'concluir' && (
        <Modal title="Concluir Ordem de Serviço" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600 mb-4">
            Registre o diagnóstico e a solução antes de concluir.
          </p>
          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Diagnóstico</label>
              <textarea
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                placeholder="O que foi encontrado..."
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Solução Aplicada</label>
              <textarea
                value={solucao}
                onChange={(e) => setSolucao(e.target.value)}
                placeholder="O que foi feito para resolver..."
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={async () => {
                setModal(null);
                // PATCH diagnostico/solucao then concluir
                if (diagnostico || solucao) {
                  await apiFetch(`/api/service-orders/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ diagnostico: diagnostico || undefined, solucao: solucao || undefined }),
                  }).catch(() => {});
                }
                await doStatus('concluir');
              }}
              className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Confirmar Conclusão
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Adicionar Tarefa ────────────────────────────────────────── */}
      {modal === 'add-tarefa' && (
        <Modal title="Adicionar Tarefa do Catálogo" onClose={() => setModal(null)}>
          {loadingTarefas ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando catálogo...
            </div>
          ) : tarefasCatalogo.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              Nenhuma tarefa cadastrada no catálogo.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto mb-5">
              {tarefasCatalogo.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedTarefaId === t.id
                      ? 'border-rose-400 bg-rose-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="tarefa"
                    value={t.id}
                    checked={selectedTarefaId === t.id}
                    onChange={() => setSelectedTarefaId(t.id)}
                    className="text-rose-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{t.codigo}</span>
                      <span className="text-sm font-medium text-slate-900 truncate">{t.nome}</span>
                    </div>
                    {t.tempoPadraoH && (
                      <span className="text-xs text-slate-400">⏱ {t.tempoPadraoH}h padrão</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmAddTarefa}
              disabled={!selectedTarefaId || addingTarefa}
              className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingTarefa ? 'Adicionando...' : 'Adicionar Tarefa'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal QR Code ─────────────────────────────────────────────────── */}
      {qrSubtarefa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setQrSubtarefa(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">QR Code — Apontamento</h3>
              </div>
              <button onClick={() => setQrSubtarefa(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-1 font-medium truncate">{qrSubtarefa.nome}</p>
            <p className="text-xs text-slate-400 mb-4">OS {order?.numero}</p>

            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white border-2 border-slate-200 rounded-xl inline-block">
                <QRCodeSVG
                  value={`${typeof window !== 'undefined' ? window.location.origin : 'https://erp.ndimplementos.com.br'}/mobile/apontar/${qrSubtarefa.id}`}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-4 font-mono break-all">
              /mobile/apontar/{qrSubtarefa.id}
            </p>

            <button
              onClick={() => {
                const printWin = window.open('', '_blank', 'width=400,height=500');
                if (!printWin) return;
                printWin.document.write(`
                  <html><head><title>QR Code — ${qrSubtarefa.nome}</title>
                  <style>body{font-family:sans-serif;text-align:center;padding:20px}h2{font-size:16px;margin-bottom:4px}p{font-size:12px;color:#666;margin:2px 0}</style>
                  </head><body>
                  <h2>${qrSubtarefa.nome}</h2>
                  <p>OS ${order?.numero}</p>
                  <div style="margin:16px auto;display:inline-block">
                    <img src="${document.querySelector('#qr-img-' + qrSubtarefa.id.replace(/-/g,''))?.getAttribute('src') ?? ''}" style="width:180px;height:180px" />
                  </div>
                  <p style="font-size:10px;margin-top:8px">Escaneie para apontar via app mobile</p>
                  </body></html>
                `);
                printWin.document.close();
                printWin.print();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-4 h-4" /> Imprimir QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
