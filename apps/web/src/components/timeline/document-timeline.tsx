'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  ArrowRightLeft,
  MessageSquare,
  Link2,
  AlertTriangle,
  PackageCheck,
  PackageX,
  Package,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type DocumentEventType =
  | 'CRIADO'
  | 'ALTERADO'
  | 'STATUS_MUDOU'
  | 'APROVADO'
  | 'REJEITADO'
  | 'COMENTARIO'
  | 'DOCUMENTO_VINCULADO'
  | 'ALERTA_GERADO'
  | 'ITEM_APROVADO'
  | 'ITEM_REJEITADO'
  | 'RESERVA_CRIADA'
  | 'RESERVA_LIBERADA'
  | 'RESERVA_CONSUMIDA';

export interface TimelineEvent {
  id: string;
  eventType: DocumentEventType;
  fieldChanged?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  motivoAlteracao?: string | null;
  description?: string | null;
  user?: { id: string; name: string } | null;
  ipAddress?: string | null;
  createdAt: string;
}

interface DocumentTimelineProps {
  /** URL base da API, ex: /api/requisitions/abc123 */
  apiPath: string;
  /** Título opcional exibido no topo do painel */
  title?: string;
  /** Mostra um botão de recarregar */
  refreshable?: boolean;
}

// ── Ícone e cor por tipo de evento ───────────────────────────────────────────

const EVENT_CONFIG: Record<
  DocumentEventType,
  { icon: React.ElementType; color: string; label: string }
> = {
  CRIADO:             { icon: Clock,           color: 'text-blue-500 bg-blue-50',    label: 'Criado' },
  ALTERADO:           { icon: Edit3,           color: 'text-amber-500 bg-amber-50',  label: 'Alterado' },
  STATUS_MUDOU:       { icon: ArrowRightLeft,  color: 'text-indigo-500 bg-indigo-50',label: 'Status alterado' },
  APROVADO:           { icon: CheckCircle2,    color: 'text-emerald-500 bg-emerald-50', label: 'Aprovado' },
  REJEITADO:          { icon: XCircle,         color: 'text-red-500 bg-red-50',      label: 'Rejeitado' },
  COMENTARIO:         { icon: MessageSquare,   color: 'text-slate-500 bg-slate-50',  label: 'Comentário' },
  DOCUMENTO_VINCULADO:{ icon: Link2,           color: 'text-cyan-500 bg-cyan-50',    label: 'Documento vinculado' },
  ALERTA_GERADO:      { icon: AlertTriangle,   color: 'text-orange-500 bg-orange-50',label: 'Alerta' },
  ITEM_APROVADO:      { icon: PackageCheck,    color: 'text-emerald-500 bg-emerald-50', label: 'Item aprovado' },
  ITEM_REJEITADO:     { icon: PackageX,        color: 'text-red-500 bg-red-50',      label: 'Item rejeitado' },
  RESERVA_CRIADA:     { icon: Package,         color: 'text-blue-500 bg-blue-50',    label: 'Reserva criada' },
  RESERVA_LIBERADA:   { icon: Package,         color: 'text-slate-500 bg-slate-50',  label: 'Reserva liberada' },
  RESERVA_CONSUMIDA:  { icon: Package,         color: 'text-emerald-500 bg-emerald-50', label: 'Reserva consumida' },
};

// ── Formata data/hora ────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Item da linha do tempo ───────────────────────────────────────────────────

function TimelineItem({ event }: { event: TimelineEvent }) {
  const config = EVENT_CONFIG[event.eventType] ?? {
    icon: Clock,
    color: 'text-slate-500 bg-slate-50',
    label: event.eventType,
  };
  const Icon = config.icon;

  return (
    <div className="flex gap-3 group">
      {/* Ícone + linha vertical */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="w-px flex-1 bg-slate-200 mt-1 group-last:hidden" />
      </div>

      {/* Conteúdo */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-slate-800">{config.label}</span>
            {event.fieldChanged && (
              <span className="ml-1.5 text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                {event.fieldChanged}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
            {formatDate(event.createdAt)}
          </span>
        </div>

        {/* Descrição */}
        {event.description && (
          <p className="text-sm text-slate-600 mt-0.5">{event.description}</p>
        )}

        {/* Motivo de alteração */}
        {event.motivoAlteracao && (
          <p className="text-xs text-slate-500 mt-1 italic">
            Motivo: {event.motivoAlteracao}
          </p>
        )}

        {/* Diff de valor */}
        {event.oldValue !== undefined && event.newValue !== undefined && (
          <div className="flex items-center gap-2 mt-1.5 text-xs">
            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through">
              {String(event.oldValue)}
            </span>
            <span className="text-slate-400">→</span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
              {String(event.newValue)}
            </span>
          </div>
        )}

        {/* Usuário */}
        {event.user && (
          <p className="text-xs text-slate-400 mt-1">por {event.user.name}</p>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function DocumentTimeline({
  apiPath,
  title = 'Linha do Tempo',
  refreshable = true,
}: DocumentTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiPath}/timeline`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data: TimelineEvent[] = await res.json();
      setEvents(data);
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          {title}
        </h3>
        {refreshable && (
          <button
            onClick={fetchTimeline}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Recarregar histórico"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando histórico…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 text-red-500 text-sm py-4">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">
          Nenhum evento registrado ainda.
        </p>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="mt-2">
          {events.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
