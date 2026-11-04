'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalLevel {
  id: string;
  ordem: number;
  roleId: string;
  role: { id: string; name: string };
}

interface ApprovalAction {
  id: string;
  nivelOrdem: number;
  userId: string;
  roleId: string;
  acao: 'APROVADO' | 'REJEITADO';
  comentario: string | null;
  atuadoEm: string;
}

interface ApprovalRequest {
  id: string;
  module: string;
  documentType: string;
  documentId: string;
  nivelAtual: number;
  totalNiveis: number;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  criadoEm: string;
  valorDocumento: number | null;
  policy: {
    description?: string;
    levels: ApprovalLevel[];
  };
  solicitante: { id: string; name: string; email: string };
  actions: ApprovalAction[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  SOLICITACAO_COMPRA: 'Solicitacao de Compra',
  ORDEM_COMPRA: 'Ordem de Compra',
  PEDIDO_VENDA: 'Pedido de Venda',
  PAGAMENTO: 'Pagamento',
  FOLHA_PAGAMENTO: 'Folha de Pagamento',
  REQUISICAO: 'Requisicao',
};

function fmtDocType(dt: string): string {
  return DOC_TYPE_LABELS[dt] ?? dt;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtCurrency(val: number | null): string {
  if (val == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// ---------------------------------------------------------------------------
// ApprovalCard
// ---------------------------------------------------------------------------

interface ApprovalCardProps {
  request: ApprovalRequest;
  onRefresh: () => void;
}

function ApprovalCard({ request, onRefresh }: ApprovalCardProps) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Find the current level to know which roleId to send
  const currentLevel = request.policy.levels.find(
    (l) => l.ordem === request.nivelAtual,
  );
  const roleId = currentLevel?.roleId ?? '';

  async function handleSubmit() {
    if (action === 'reject' && comment.trim().length < 10) {
      toast.warning('O comentario de rejeicao deve ter pelo menos 10 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      const endpoint =
        action === 'approve'
          ? `/api/approvals/${request.id}/approve`
          : `/api/approvals/${request.id}/reject`;

      const body: Record<string, string> = { roleId };
      if (comment.trim()) body.comentario = comment.trim();

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || 'Erro ao processar aprovacao');
      }

      toast.success(
        action === 'approve' ? 'Documento aprovado com sucesso.' : 'Documento rejeitado.',
      );
      setAction(null);
      setComment('');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao processar aprovacao');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-4 p-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-amber-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">
              {fmtDocType(request.documentType)}
            </span>
            {request.policy.description && (
              <span className="text-xs text-slate-500">— {request.policy.description}</span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <Clock className="w-3 h-3" />
              Nivel {request.nivelAtual} / {request.totalNiveis}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span>
              Solicitante:{' '}
              <span className="font-medium text-slate-700">{request.solicitante.name}</span>
            </span>
            {request.valorDocumento != null && (
              <span>
                Valor:{' '}
                <span className="font-medium text-slate-700">
                  {fmtCurrency(request.valorDocumento)}
                </span>
              </span>
            )}
            <span>Criado em: {fmtDate(request.criadoEm)}</span>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
          title={expanded ? 'Recolher' : 'Expandir'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable section — approval levels */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Fluxo de aprovacao
          </p>
          <ol className="space-y-2">
            {request.policy.levels.map((level) => {
              const done = request.actions.filter(
                (a) => a.nivelOrdem === level.ordem,
              );
              const lastAction = done[done.length - 1];
              const isCurrent = level.ordem === request.nivelAtual;

              let statusIcon = (
                <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">
                  {level.ordem}
                </span>
              );
              if (lastAction?.acao === 'APROVADO') {
                statusIcon = (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                );
              } else if (lastAction?.acao === 'REJEITADO') {
                statusIcon = <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />;
              } else if (isCurrent) {
                statusIcon = (
                  <Clock className="w-6 h-6 text-amber-500 animate-pulse flex-shrink-0" />
                );
              }

              return (
                <li key={level.id} className="flex items-start gap-3">
                  {statusIcon}
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-800">
                      {level.role.name}
                    </span>
                    {lastAction && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {lastAction.acao === 'APROVADO' ? 'Aprovado' : 'Rejeitado'} em{' '}
                        {fmtDate(lastAction.atuadoEm)}
                        {lastAction.comentario && (
                          <span className="italic"> — &quot;{lastAction.comentario}&quot;</span>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Action area */}
      {action == null ? (
        <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-3 bg-white">
          <button
            onClick={() => setAction('approve')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Aprovar
          </button>
          <button
            onClick={() => setAction('reject')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-100 px-4 py-3 bg-white space-y-3">
          <div className="flex items-center gap-2">
            {action === 'approve' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium text-slate-800">
              {action === 'approve' ? 'Confirmar aprovacao' : 'Confirmar rejeicao'}
            </span>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              action === 'approve'
                ? 'Comentario (opcional)'
                : 'Motivo da rejeicao (obrigatorio, min. 10 caracteres)'
            }
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />

          {action === 'reject' && comment.trim().length > 0 && comment.trim().length < 10 && (
            <p className="text-xs text-red-500">
              O comentario deve ter pelo menos 10 caracteres ({comment.trim().length}/10).
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || (action === 'reject' && comment.trim().length < 10)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                action === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : action === 'approve' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {submitting ? 'Processando...' : action === 'approve' ? 'Confirmar Aprovacao' : 'Confirmar Rejeicao'}
            </button>

            <button
              onClick={() => {
                setAction(null);
                setComment('');
              }}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AprovacoesPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPending = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch('/api/approvals/pending');
      if (!res.ok) throw new Error('Erro ao carregar aprovacoes pendentes');
      const data: ApprovalRequest[] = await res.json();
      setRequests(data);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao carregar aprovacoes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aprovacoes</h1>
          <p className="text-slate-500 mt-1">
            Documentos aguardando a sua aprovacao
          </p>
        </div>
        <button
          onClick={() => fetchPending(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Carregando aprovacoes pendentes...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">
            Nenhuma aprovacao pendente
          </h2>
          <p className="text-sm text-slate-500">
            Voce esta em dia! Nao ha documentos aguardando a sua aprovacao no momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{requests.length}</span>{' '}
            {requests.length === 1 ? 'documento aguarda' : 'documentos aguardam'} sua aprovacao.
          </p>
          {requests.map((req) => (
            <ApprovalCard
              key={req.id}
              request={req}
              onRefresh={() => fetchPending(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
