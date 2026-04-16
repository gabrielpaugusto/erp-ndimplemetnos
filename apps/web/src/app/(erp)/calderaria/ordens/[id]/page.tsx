'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

type CldStatus = 'ABERTA' | 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA';

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
  EM_EXECUCAO: 'bg-zinc-100 text-zinc-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
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
  serviceType: string;
  description: string;
  materialDescription: string;
  technicalSpecs: string;
  estimatedTimeHours: number;
  realTimeHours: number;
  linkedOs: { id: string; number: string; description: string } | null;
  linkedOp: { id: string; number: string; description: string } | null;
  observations: string;
  createdAt: string;
  dataInicio: string | null;
  dataFim: string | null;
  requisitions: LinkedRequisition[];
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
    serviceType: raw.serviceType,
    description: raw.description || '',
    materialDescription: raw.materialDescription || '',
    technicalSpecs: raw.especificacoesTecnicas || '',
    estimatedTimeHours: raw.tempoEstimado ?? 0,
    realTimeHours: raw.tempoReal ?? 0,
    linkedOs: raw.serviceOrder
      ? {
          id: raw.serviceOrder.id,
          number: raw.serviceOrder.numero,
          description: raw.serviceOrder.veiculoDescricao || '',
        }
      : null,
    linkedOp: raw.productionOrder
      ? {
          id: raw.productionOrder.id,
          number: raw.productionOrder.numero,
          description: '',
        }
      : null,
    observations: raw.observations || '',
    createdAt: raw.createdAt,
    dataInicio: raw.dataInicio || null,
    dataFim: raw.dataFim || null,
    requisitions,
  };
}

export default function CalderariaOrdemDetailPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  const doAction = async (action: 'start' | 'complete' | 'cancel') => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/calderaria/${id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Erro ao executar acao`);
      }
      const json = await res.json();
      setOrder(mapOrder(json));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar acao');
    } finally {
      setActionLoading(false);
    }
  };

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
        <Link
          href="/calderaria/ordens"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">Ordem de calderaria nao encontrada.</p>
          <button
            onClick={() => router.push('/calderaria/ordens')}
            className="mt-4 text-sm text-zinc-600 hover:text-zinc-800 underline"
          >
            Ver todas as ordens
          </button>
        </div>
      </div>
    );
  }

  // Status steps based on known flow: ABERTA -> EM_EXECUCAO -> CONCLUIDA
  const statusSteps: string[] = ['ABERTA', 'EM_EXECUCAO', 'CONCLUIDA'];
  const statusOrder: Record<string, number> = {
    ABERTA: 0, PENDENTE: 0, EM_EXECUCAO: 1, CONCLUIDA: 2, CANCELADA: -1,
  };
  const currentOrder = statusOrder[order.status] ?? 0;

  const timeProgress = order.estimatedTimeHours > 0
    ? Math.round((order.realTimeHours / order.estimatedTimeHours) * 100)
    : 0;

  const timeline = {
    ABERTA: order.createdAt,
    EM_EXECUCAO: order.dataInicio,
    CONCLUIDA: order.dataFim,
  } as Record<string, string | null>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/calderaria/ordens"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.number}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[order.status] || order.status}
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
        <div className="flex items-center gap-2">
          {(order.status === 'ABERTA' || order.status === 'PENDENTE') && (
            <button
              onClick={() => doAction('start')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Iniciar
            </button>
          )}
          {order.status === 'EM_EXECUCAO' && (
            <button
              onClick={() => doAction('complete')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Concluir
            </button>
          )}
          {(order.status !== 'CONCLUIDA' && order.status !== 'CANCELADA') && (
            <button
              onClick={() => doAction('cancel')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
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
                    {isActive && !isCurrent ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
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

      {/* Service Type & Technical Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-slate-900">Descricao do Servico</h2>
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
            <h2 className="text-lg font-semibold text-slate-900">Especificacoes Tecnicas</h2>
          </div>
          <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">{order.technicalSpecs || '—'}</pre>
        </div>
      </div>

      {/* Material Info */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-zinc-600" />
          <h2 className="text-lg font-semibold text-slate-900">Material</h2>
        </div>
        <p className="text-sm text-slate-700">{order.materialDescription || '—'}</p>
      </div>

      {/* Time Tracking */}
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
            <p className={`text-2xl font-bold ${timeProgress > 100 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtPercent(timeProgress, 0)}</p>
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

      {/* Linked OS/OP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {order.linkedOs && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-5 h-5 text-rose-600" />
              <h2 className="text-lg font-semibold text-slate-900">Ordem de Servico Vinculada</h2>
            </div>
            <Link href={`/oficina/ordens-servico/${order.linkedOs.id}`} className="text-sm font-medium text-rose-600 hover:text-rose-700">
              {order.linkedOs.number}
            </Link>
            <p className="text-xs text-slate-500 mt-1">{order.linkedOs.description}</p>
          </div>
        )}

        {order.linkedOp && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Ordem de Producao Vinculada</h2>
            </div>
            <Link href={`/producao/ordens/${order.linkedOp.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
              {order.linkedOp.number}
            </Link>
            <p className="text-xs text-slate-500 mt-1">{order.linkedOp.description}</p>
          </div>
        )}
      </div>

      {/* Linked Requisitions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-zinc-600" />
          <h2 className="text-lg font-semibold text-slate-900">Requisicoes Vinculadas</h2>
        </div>
        {order.requisitions.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma requisicao vinculada.</p>
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

      {/* Observations */}
      {order.observations && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Observacoes</h2>
          <p className="text-sm text-slate-700 leading-relaxed">{order.observations}</p>
        </div>
      )}
    </div>
  );
}
