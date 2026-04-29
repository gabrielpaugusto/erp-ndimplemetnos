'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { fmtPercent } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Play,
  Flame,
  Clock,
  FileText,
  Package,
  Wrench,
  Settings,
  PackagePlus,
  PenLine,
  Printer,
  Save,
  X,
  ExternalLink,
} from 'lucide-react';

// ── Excalidraw (SSR-safe dynamic import) ───────────────────────────────────
const ExcalidrawWrapper = dynamic(() => import('./ExcalidrawWrapper'), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────

type CldStatus = 'ABERTA' | 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA';
type CldModo   = 'SERVICO_INTERNO' | 'INSTALACAO' | 'FABRICACAO_AVULSA';

const statusLabels: Record<string, string> = {
  ABERTA: 'Aberta',
  PENDENTE: 'Pendente',
  EM_EXECUCAO: 'Em Execução',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const statusColors: Record<string, string> = {
  ABERTA: 'bg-blue-100 text-blue-700',
  PENDENTE: 'bg-slate-100 text-slate-600',
  EM_EXECUCAO: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const modoConfig: Record<CldModo, { label: string; color: string; icon: React.ReactNode }> = {
  SERVICO_INTERNO: {
    label: 'Serviço Interno',
    color: 'bg-slate-100 text-slate-700',
    icon: <Settings className="w-3 h-3" />,
  },
  INSTALACAO: {
    label: 'Instalação',
    color: 'bg-blue-100 text-blue-700',
    icon: <Wrench className="w-3 h-3" />,
  },
  FABRICACAO_AVULSA: {
    label: 'Fabricação Avulsa',
    color: 'bg-orange-100 text-orange-700',
    icon: <PackagePlus className="w-3 h-3" />,
  },
};

const serviceTypeColors: Record<string, string> = {
  CORTE: 'bg-zinc-100 text-zinc-700',
  DOBRA: 'bg-slate-100 text-slate-700',
  SOLDA: 'bg-zinc-200 text-zinc-800',
  CONFORMACAO: 'bg-slate-200 text-slate-700',
  USINAGEM: 'bg-zinc-50 text-zinc-600',
  TRATAMENTO_TERMICO: 'bg-amber-100 text-amber-700',
  JATEAMENTO: 'bg-slate-100 text-slate-600',
  MONTAGEM_ESTRUTURAL: 'bg-zinc-100 text-zinc-700',
};

interface LinkedRequisition {
  id: string;
  number: string;
  type: string;
  status: string;
  statusColor: string;
}

interface OrderDetail {
  id: string;
  number: string;
  status: CldStatus;
  modo: CldModo;
  serviceType: string;
  description: string;
  materialDescription: string;
  technicalSpecs: string;
  estimatedTimeHours: number;
  realTimeHours: number;
  linkedOs: { id: string; number: string } | null;
  linkedOp: { id: string; number: string } | null;
  observations: string;
  createdAt: string;
  dataInicio: string | null;
  dataFim: string | null;
  requisitions: LinkedRequisition[];
  // Fabricação Avulsa
  resultadoTipo: string | null;
  resultadoNome: string | null;
  resultadoNcm: string | null;
  resultadoCodigoServico: string | null;
  resultadoUnidade: string | null;
  resultadoQtd: number | null;
  valorVenda: number | null;
  margemPercentual: number | null;
  osItemGeradoId: string | null;
  // Desenho
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  desenhoData: any | null;
  desenhoPng: string | null;
}

const reqStatusColorMap: Record<string, string> = {
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  APROVADA: 'bg-emerald-100 text-emerald-700',
  PENDENTE: 'bg-amber-100 text-amber-700',
  EM_SEPARACAO: 'bg-amber-100 text-amber-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(raw: any): OrderDetail {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requisitions: LinkedRequisition[] = (raw.requisitions || []).map((r: any) => ({
    id: r.id,
    number: r.numero,
    type: r.type || '',
    status: r.status || '',
    statusColor: reqStatusColorMap[r.status] || 'bg-slate-100 text-slate-600',
  }));

  return {
    id: raw.id,
    number: raw.numero,
    status: raw.status as CldStatus,
    modo: (raw.modo || 'SERVICO_INTERNO') as CldModo,
    serviceType: raw.serviceType,
    description: raw.description || '',
    materialDescription: raw.materialDescription || '',
    technicalSpecs: raw.especificacoesTecnicas || '',
    estimatedTimeHours: raw.tempoEstimado ?? 0,
    realTimeHours: raw.tempoReal ?? 0,
    linkedOs: raw.serviceOrder ? { id: raw.serviceOrder.id, number: raw.serviceOrder.numero } : null,
    linkedOp: raw.productionOrder ? { id: raw.productionOrder.id, number: raw.productionOrder.numero } : null,
    observations: raw.observations || '',
    createdAt: raw.createdAt,
    dataInicio: raw.dataInicio || null,
    dataFim: raw.dataFim || null,
    requisitions,
    resultadoTipo: raw.resultadoTipo || null,
    resultadoNome: raw.resultadoNome || null,
    resultadoNcm: raw.resultadoNcm || null,
    resultadoCodigoServico: raw.resultadoCodigoServico || null,
    resultadoUnidade: raw.resultadoUnidade || null,
    resultadoQtd: raw.resultadoQtd ?? null,
    valorVenda: raw.valorVenda != null ? Number(raw.valorVenda) : null,
    margemPercentual: raw.margemPercentual ?? null,
    osItemGeradoId: raw.osItemGeradoId || null,
    desenhoData: raw.desenhoData || null,
    desenhoPng: raw.desenhoPng || null,
  };
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CalderariaOrdemDetailPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Excalidraw state
  const [showDesenho, setShowDesenho] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localDesenhoData, setLocalDesenhoData] = useState<any>(null);
  const [savingDesenho, setSavingDesenho] = useState(false);
  const desenhoChangedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/calderaria/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error('Erro ao carregar ordem');
        const json = await res.json();
        setOrder(mapOrder(json));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Open Excalidraw — seed with saved data
  const openDesenho = () => {
    setLocalDesenhoData(order?.desenhoData || null);
    desenhoChangedRef.current = false;
    setShowDesenho(true);
  };

  // Called by ExcalidrawWrapper whenever elements change
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDesenhoChange = useCallback((elements: readonly any[], appState: any) => {
    setLocalDesenhoData({ elements, appState });
    desenhoChangedRef.current = true;
  }, []);

  // Save drawing to API
  const saveDesenho = useCallback(async () => {
    if (!id || !localDesenhoData) return;
    setSavingDesenho(true);
    try {
      const res = await apiFetch(`/api/calderaria/${id}/desenho`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desenhoData: localDesenhoData }),
      });
      if (!res.ok) throw new Error('Erro ao salvar desenho');
      const saved = await res.json();
      setOrder((prev) => prev ? { ...prev, desenhoData: saved.desenhoData, desenhoPng: saved.desenhoPng } : prev);
      toast.success('Desenho salvo!');
      desenhoChangedRef.current = false;
    } catch {
      toast.error('Erro ao salvar desenho');
    } finally {
      setSavingDesenho(false);
    }
  }, [id, localDesenhoData, toast]);

  // Close modal — auto-save if changed
  const closeDesenho = useCallback(async () => {
    if (desenhoChangedRef.current) {
      await saveDesenho();
    }
    setShowDesenho(false);
  }, [saveDesenho]);

  // Print drawing in a new window
  const printDesenho = () => {
    if (!order?.desenhoPng) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Desenho ${order.number}</title>
      <style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
      img{max-width:100%;max-height:100vh;object-fit:contain}</style></head>
      <body><img src="${order.desenhoPng}" onload="window.print();window.close()" /></body></html>
    `);
    win.document.close();
  };

  const doAction = async (action: 'start' | 'complete' | 'cancel') => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/calderaria/${id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao executar acao');
      }
      const json = await res.json();
      setOrder(mapOrder(json));
      if (action === 'complete') toast.success('Ordem concluída com sucesso!');
      if (action === 'start') toast.success('Ordem iniciada!');
      if (action === 'cancel') toast.success('Ordem cancelada.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar acao');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render guards ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="space-y-4">
        <Link href="/calderaria/ordens" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">Ordem de calderaria não encontrada.</p>
          <button onClick={() => router.push('/calderaria/ordens')} className="mt-4 text-sm text-zinc-600 hover:text-zinc-800 underline">
            Ver todas as ordens
          </button>
        </div>
      </div>
    );
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const statusSteps = ['ABERTA', 'EM_EXECUCAO', 'CONCLUIDA'];
  const statusOrder: Record<string, number> = {
    ABERTA: 0, PENDENTE: 0, EM_EXECUCAO: 1, CONCLUIDA: 2, CANCELADA: -1,
  };
  const currentOrder = statusOrder[order.status] ?? 0;

  const timeProgress = order.estimatedTimeHours > 0
    ? Math.round((order.realTimeHours / order.estimatedTimeHours) * 100)
    : 0;

  const timeline: Record<string, string | null> = {
    ABERTA: order.createdAt,
    EM_EXECUCAO: order.dataInicio,
    CONCLUIDA: order.dataFim,
  };

  const modo = modoConfig[order.modo] || modoConfig.SERVICO_INTERNO;

  const fmtCurrency = (v: number | null) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  return (
    <>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          <Link
            href="/calderaria/ordens"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mt-0.5"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{order.number}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-slate-100 text-slate-600'}`}>
                {statusLabels[order.status] || order.status}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${modo.color}`}>
                {modo.icon}
                {modo.label}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${serviceTypeColors[order.serviceType] || 'bg-slate-100 text-slate-600'}`}>
                {order.serviceType}
              </span>
            </div>
            <p className="text-slate-500 mt-0.5 text-sm">
              Criada em: {new Date(order.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {(order.status === 'ABERTA' || order.status === 'PENDENTE') && (
              <button
                onClick={() => doAction('start')}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" /> Iniciar
              </button>
            )}
            {order.status === 'EM_EXECUCAO' && (
              <button
                onClick={() => doAction('complete')}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" /> Concluir
              </button>
            )}
            {order.status !== 'CONCLUIDA' && order.status !== 'CANCELADA' && (
              <button
                onClick={() => doAction('cancel')}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Cancelar
              </button>
            )}
          </div>
        </div>

        {/* ── Item gerado na OS (Fabricação Avulsa) ───────────────────────── */}
        {order.osItemGeradoId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">Item gerado automaticamente na OS vinculada</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Ao concluir a fabricação avulsa, um item faturável foi criado na Ordem de Serviço.
              </p>
            </div>
            {order.linkedOs && (
              <Link
                href={`/oficina/ordens-servico/${order.linkedOs.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
              >
                Ver OS <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        {/* ── Fabricação Avulsa — Resultado ───────────────────────────────── */}
        {order.modo === 'FABRICACAO_AVULSA' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <PackagePlus className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-orange-900">Resultado da Fabricação</h2>
              {order.resultadoTipo && (
                <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                  {order.resultadoTipo === 'ITEM' ? 'Item Físico' : 'Serviço'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-orange-500 font-medium uppercase tracking-wide mb-1">Nome / Descrição</p>
                <p className="text-sm font-semibold text-orange-900">{order.resultadoNome || '—'}</p>
              </div>
              {order.resultadoTipo === 'ITEM' ? (
                <div>
                  <p className="text-xs text-orange-500 font-medium uppercase tracking-wide mb-1">NCM</p>
                  <p className="text-sm font-mono text-orange-900">{order.resultadoNcm || '—'}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-orange-500 font-medium uppercase tracking-wide mb-1">Cód. Serviço (LC116)</p>
                  <p className="text-sm font-mono text-orange-900">{order.resultadoCodigoServico || '—'}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-orange-500 font-medium uppercase tracking-wide mb-1">Qtd / Unidade</p>
                <p className="text-sm text-orange-900">
                  {order.resultadoQtd != null ? order.resultadoQtd : '—'}{' '}
                  <span className="text-orange-500">{order.resultadoUnidade || ''}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-orange-500 font-medium uppercase tracking-wide mb-1">Preço de Venda</p>
                <p className="text-sm font-bold text-orange-900">{fmtCurrency(order.valorVenda)}</p>
                {order.margemPercentual != null && (
                  <p className="text-xs text-orange-400 mt-0.5">Margem: {order.margemPercentual}%</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Status Timeline ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Status da Ordem</h2>
          <div className="flex items-center gap-2">
            {statusSteps.map((status, index) => {
              const stepOrder = statusOrder[status] ?? 0;
              const isActive = stepOrder <= currentOrder;
              const isCurrent = status === order.status;
              const stepDate = timeline[status];

              return (
                <div key={status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? 'bg-zinc-700 text-white ring-4 ring-zinc-100'
                          : isActive
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isActive && !isCurrent ? <CheckCircle className="w-4 h-4" /> : index + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-zinc-700' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {statusLabels[status] || status}
                    </span>
                    {stepDate && (
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(stepDate).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Desenho Técnico ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-zinc-600" />
              <h2 className="text-lg font-semibold text-slate-900">Desenho Técnico</h2>
            </div>
            <div className="flex items-center gap-2">
              {order.desenhoPng && (
                <button
                  onClick={printDesenho}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
              )}
              <button
                onClick={openDesenho}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" />
                {order.desenhoData ? 'Editar Desenho' : 'Criar Desenho'}
              </button>
            </div>
          </div>

          {order.desenhoPng ? (
            <div className="relative group cursor-pointer" onClick={openDesenho}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={order.desenhoPng}
                alt="Desenho técnico"
                className="w-full max-h-64 object-contain bg-slate-50"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white text-sm px-4 py-2 rounded-lg">
                  Clique para editar
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-16 gap-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={openDesenho}
            >
              <PenLine className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-400">Nenhum desenho técnico. Clique para criar.</p>
            </div>
          )}
        </div>

        {/* ── Service Description + Technical Specs ────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-zinc-600" />
              <h2 className="text-lg font-semibold text-slate-900">Descrição do Serviço</h2>
            </div>
            <div className="mb-3">
              <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${serviceTypeColors[order.serviceType] || 'bg-slate-100 text-slate-600'}`}>
                {order.serviceType}
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{order.description}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-zinc-600" />
              <h2 className="text-lg font-semibold text-slate-900">Especificações Técnicas</h2>
            </div>
            <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">{order.technicalSpecs || '—'}</pre>
          </div>
        </div>

        {/* ── Material ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-slate-900">Material</h2>
          </div>
          <p className="text-sm text-slate-700">{order.materialDescription || '—'}</p>
        </div>

        {/* ── Time Tracking ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-slate-900">Controle de Tempo</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Tempo Estimado</p>
              <p className="text-2xl font-bold text-slate-700">{order.estimatedTimeHours}h</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Tempo Real</p>
              <p className="text-2xl font-bold text-zinc-700">{order.realTimeHours}h</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Progresso</p>
              <p className={`text-2xl font-bold ${timeProgress > 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmtPercent(timeProgress, 0)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all ${
                  timeProgress > 100 ? 'bg-red-500' : timeProgress === 100 ? 'bg-emerald-500' : 'bg-zinc-500'
                }`}
                style={{ width: `${Math.min(timeProgress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-400">0h</span>
              <span className="text-xs text-slate-400">{order.estimatedTimeHours}h estimado</span>
            </div>
          </div>
        </div>

        {/* ── Linked OS / OP ───────────────────────────────────────────────── */}
        {(order.linkedOs || order.linkedOp) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {order.linkedOs && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="w-5 h-5 text-rose-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Ordem de Serviço Vinculada</h2>
                </div>
                <Link href={`/oficina/ordens-servico/${order.linkedOs.id}`} className="text-sm font-medium text-rose-600 hover:text-rose-700">
                  {order.linkedOs.number}
                </Link>
              </div>
            )}
            {order.linkedOp && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Ordem de Produção Vinculada</h2>
                </div>
                <Link href={`/producao/ordens/${order.linkedOp.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  {order.linkedOp.number}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Linked Requisitions ──────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-slate-900">Requisições Vinculadas</h2>
          </div>
          {order.requisitions.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma requisição vinculada.</p>
          ) : (
            <div className="space-y-2">
              {order.requisitions.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Link href={`/requisicoes/${req.id}`} className="text-sm font-medium text-teal-600 hover:text-teal-700">
                      {req.number}
                    </Link>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                      {req.type}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${req.statusColor}`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Observations ────────────────────────────────────────────────── */}
        {order.observations && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Observações</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{order.observations}</p>
          </div>
        )}
      </div>

      {/* ── Excalidraw Full-Screen Modal ────────────────────────────────────── */}
      {showDesenho && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Modal toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shadow-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <PenLine className="w-5 h-5 text-zinc-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Desenho Técnico — {order.number}</p>
                <p className="text-xs text-slate-400">Toque para desenhar • Salvo automaticamente ao fechar</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveDesenho}
                disabled={savingDesenho}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingDesenho ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={closeDesenho}
                disabled={savingDesenho}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" /> Fechar
              </button>
            </div>
          </div>

          {/* Excalidraw canvas — fills remaining height */}
          <div className="flex-1 overflow-hidden touch-none">
            <ExcalidrawWrapper
              initialData={localDesenhoData}
              onChange={handleDesenhoChange}
            />
          </div>
        </div>
      )}
    </>
  );
}
