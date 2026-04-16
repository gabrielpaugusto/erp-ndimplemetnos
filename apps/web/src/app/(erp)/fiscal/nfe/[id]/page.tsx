'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  CheckCircle,
  FileText,
  User,
  Package,
  Send,
  XCircle,
  Download,
  Printer,
  Key,
  ArrowRightLeft,
  Clock,
  AlertTriangle,
  RefreshCw,
  Calculator,
  PenLine,
  MapPin,
  Brain,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

import { fmtCurrency as formatCurrency, fmtPercent } from '@/lib/format';

const formatPct = (v: number | null | undefined) =>
  v != null ? fmtPercent(v) : '—';

type NFeStatus = 'RASCUNHO' | 'VALIDADA' | 'ASSINADA' | 'ENVIADA' | 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA' | 'REJEITADA';

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  VALIDADA: 'Validada',
  ASSINADA: 'Assinada',
  ENVIADA: 'Enviada',
  AUTORIZADA: 'Autorizada',
  CANCELADA: 'Cancelada',
  DENEGADA: 'Denegada',
  REJEITADA: 'Rejeitada',
};

const statusColors: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  VALIDADA: 'bg-amber-100 text-amber-700',
  ASSINADA: 'bg-indigo-100 text-indigo-700',
  ENVIADA: 'bg-blue-100 text-blue-700',
  AUTORIZADA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
  DENEGADA: 'bg-red-100 text-red-700',
  REJEITADA: 'bg-red-100 text-red-700',
};

interface NFeItem {
  id: string;
  itemNumber: number;
  description: string;
  ncmCode: string;
  cfopCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
  cstIcms?: string;
  bcIcms?: number;
  aliqIcms?: number;
  valorIcms?: number;
  cstIpi?: string;
  bcIpi?: number;
  aliqIpi?: number;
  valorIpi?: number;
  cstPis?: string;
  bcPis?: number;
  aliqPis?: number;
  valorPis?: number;
  cstCofins?: string;
  bcCofins?: number;
  aliqCofins?: number;
  valorCofins?: number;
  aliqIbs?: number;
  valorIbs?: number;
  aliqCbs?: number;
  valorCbs?: number;
  valorIs?: number;
  product?: { description: string; code: string; unit: string } | null;
}

interface NFe {
  id: string;
  numero: number | null;
  serie: number;
  type: 'ENTRADA' | 'SAIDA';
  operation: string;
  finality: string;
  naturezaOperacao: string | null;
  chaveAcesso: string | null;
  protocoloAutorizacao: string | null;
  dataAutorizacao: string | null;
  motivoCancelamento: string | null;
  status: NFeStatus;
  dataEmissao: string | null;
  valorProdutos: number;
  valorFrete: number;
  valorSeguro: number;
  valorDesconto: number;
  valorOutros: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  valorIbs: number;
  valorCbs: number;
  valorIs: number;
  valorTotal: number;
  // DIFAL
  valorDifal?: number;
  valorDifalDestino?: number;
  valorDifalOrigem?: number;
  valorFcp?: number;
  ufDestino?: string | null;
  aliqInterestadual?: number | null;
  aliqInternaDestino?: number | null;
  // CC-e
  cceNumero?: number | null;
  cceDataEvento?: string | null;
  cceDescricao?: string | null;
  cceProtocolo?: string | null;
  informacoesComplementares: string | null;
  createdAt: string;
  updatedAt: string;
  person: {
    id: string;
    cpfCnpj: string | null;
    razaoSocial: string;
    nomeFantasia: string | null;
    rgIe: string | null;
  } | null;
  items: NFeItem[];
  saleOrder?: { id: string; numero: string; status: string } | null;
  serviceOrder?: { id: string; numero: string; status: string } | null;
}

function CancelModal({ onConfirm, onClose, loading }: {
  onConfirm: (motivo: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Cancelar NF-e</h3>
        <p className="text-sm text-slate-500 mb-4">Informe o motivo do cancelamento (mínimo 15 caracteres):</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          placeholder="Ex: Erro nos dados do destinatário..."
        />
        <p className="text-xs text-slate-400 mt-1">{motivo.length} car. {motivo.length < 15 ? '(mín. 15)' : '✓'}</p>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">Fechar</button>
          <button
            onClick={() => onConfirm(motivo)}
            disabled={motivo.length < 15 || loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CceModal({ onConfirm, onClose, loading, cceNumero }: {
  onConfirm: (descricao: string) => void;
  onClose: () => void;
  loading: boolean;
  cceNumero: number;
}) {
  const [descricao, setDescricao] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Carta de Correção Eletrônica (CC-e)</h3>
        <p className="text-xs text-slate-500 mb-4">CC-e nº {cceNumero} — mín. 15 / máx. 1.000 caracteres</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
          <strong>Atenção:</strong> A CC-e não pode corrigir dados que alterem o valor total do imposto, a base de cálculo, o destinatário, o emitente, nem a data de emissão. Máximo 20 CC-e por NF-e.
        </div>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={5}
          maxLength={1000}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Descreva o campo incorreto e o valor correto. Ex: Onde se lê: placa ABC-1234, leia-se: placa ABC-5678"
        />
        <p className="text-xs text-slate-400 mt-1">{descricao.length}/1000 {descricao.length < 15 ? '(mín. 15)' : '✓'}</p>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">Cancelar</button>
          <button
            onClick={() => onConfirm(descricao)}
            disabled={descricao.length < 15 || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Emitindo...' : 'Emitir CC-e'}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusSteps: NFeStatus[] = ['RASCUNHO', 'VALIDADA', 'AUTORIZADA'];
const statusOrder: Record<string, number> = {
  RASCUNHO: 0, VALIDADA: 1, AUTORIZADA: 2,
  CANCELADA: -1, DENEGADA: -1, REJEITADA: -1, ASSINADA: 1, ENVIADA: 1,
};

// ── FiscalBrain types ────────────────────────────────────────────────────
interface FbItem {
  itemId: string;
  itemNumber: number;
  descricao: string;
  ncm: string;
  cfopAtual: string;
  classificado: boolean;
  autoAplicado: boolean;
  confianca: number | null;
  cfopSugerido: string | null;
  cstIcms: string | null;
  cstPis: string | null;
  cstCofins: string | null;
  aliquotaIcms: number | null;
  aliquotaPis: number | null;
  aliquotaCofins: number | null;
  beneficioFiscal: string | null;
  fundamentoLegal: string[];
  alertas: string[];
  raciocinio: string | null;
  decisionId: string | null;
}

interface FbStatus {
  nfeId: string;
  totalItems: number;
  classificados: number;
  autoAplicados: number;
  pendentesExcecao: number;
  naoClassificados: number;
  prontoParaEmitir: boolean;
  items: FbItem[];
}

export default function NFeDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [nfe, setNfe]                       = useState<NFe | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [actionLoading, setActionLoading]   = useState(false);
  const [actionError, setActionError]       = useState('');
  const [actionSuccess, setActionSuccess]   = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCceModal, setShowCceModal]     = useState(false);

  // FiscalBrain Saída
  const [fbLoading, setFbLoading]           = useState(false);
  const [fbStatus, setFbStatus]             = useState<FbStatus | null>(null);
  const [fbExpanded, setFbExpanded]         = useState(true);
  const [fbApplyingId, setFbApplyingId]     = useState<string | null>(null);

  const fetchNfe = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'NF-e não encontrada');
        return;
      }
      setNfe(await res.json());
    } catch {
      setError('Erro ao carregar NF-e. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchNfe(); }, [fetchNfe]);

  async function handleValidate() {
    setActionLoading(true); setActionError(''); setActionSuccess('');
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/validate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setActionError(data.errors?.join('; ') || data.message || 'Erro ao validar'); return; }
      setNfe(data);
    } catch { setActionError('Erro de conexão ao validar NF-e'); }
    finally { setActionLoading(false); }
  }

  async function handleAuthorize() {
    setActionLoading(true); setActionError(''); setActionSuccess('');
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/authorize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Erro ao autorizar NF-e junto ao SEFAZ'); return; }
      setNfe(data);
    } catch { setActionError('Erro de conexão ao transmitir NF-e'); }
    finally { setActionLoading(false); }
  }

  async function handleCancel(motivo: string) {
    setActionLoading(true); setActionError('');
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/cancel`, { method: 'POST', body: JSON.stringify({ motivo }) });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Erro ao cancelar NF-e'); setShowCancelModal(false); return; }
      setNfe(data);
      setShowCancelModal(false);
    } catch { setActionError('Erro de conexão ao cancelar NF-e'); setShowCancelModal(false); }
    finally { setActionLoading(false); }
  }

  async function handleCalculateTaxes() {
    setActionLoading(true); setActionError(''); setActionSuccess('');
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/calculate-taxes`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Erro ao calcular impostos'); return; }
      setNfe(data);
    } catch { setActionError('Erro de conexão ao calcular impostos'); }
    finally { setActionLoading(false); }
  }

  async function handleCce(descricao: string) {
    setActionLoading(true); setActionError(''); setActionSuccess('');
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/cce`, {
        method: 'POST',
        body: JSON.stringify({ descricaoCorrecao: descricao }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Erro ao emitir CC-e'); setShowCceModal(false); return; }
      setNfe(prev => prev ? { ...prev, cceNumero: data.cceNumero, cceDataEvento: data.cceDataEvento, cceDescricao: data.cceDescricao, cceProtocolo: data.cceProtocolo ?? null } : prev);
      setShowCceModal(false);
      const obs: string = data.cce?.observacao ?? '';
      setActionSuccess(obs || 'CC-e emitida com sucesso.');
    } catch { setActionError('Erro de conexão ao emitir CC-e'); setShowCceModal(false); }
    finally { setActionLoading(false); }
  }

  function handleDanfe() {
    window.open(`/api/fiscal/nfe/${id}/danfe`, '_blank');
  }

  async function handleFiscalBrainClassificar() {
    setFbLoading(true); setActionError(''); setActionSuccess('');
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/fiscalbrain/classificar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Erro ao classificar com FiscalBrain'); return; }
      // Recarrega status após classificação
      const statusRes = await apiFetch(`/api/fiscal/nfe/${id}/fiscalbrain/status`);
      if (statusRes.ok) setFbStatus(await statusRes.json());
      setFbExpanded(true);
      await fetchNfe(); // Recarrega itens com CST/alíquotas preenchidos
      const auto = data.autoClassificados ?? 0;
      const total = data.totalItems ?? 0;
      setActionSuccess(`FiscalBrain: ${auto}/${total} item(s) classificados automaticamente.${data.excecoes > 0 ? ` ${data.excecoes} exceção(ões) requerem revisão.` : ''}`);
    } catch { setActionError('Erro ao chamar FiscalBrain'); }
    finally { setFbLoading(false); }
  }

  async function handleFiscalBrainStatus() {
    setFbLoading(true);
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/fiscalbrain/status`);
      if (res.ok) { setFbStatus(await res.json()); setFbExpanded(true); }
    } catch { /* ignore */ }
    finally { setFbLoading(false); }
  }

  async function handleAplicarDecisao(itemId: string, decisionId: string) {
    setFbApplyingId(itemId);
    try {
      const res = await apiFetch(`/api/fiscal/nfe/${id}/fiscalbrain/aplicar`, {
        method: 'POST',
        body: JSON.stringify({ itemId, decisionId }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setActionError((err as any).message || 'Erro ao aplicar decisão'); return; }
      await handleFiscalBrainStatus();
      await fetchNfe();
      setActionSuccess('Decisão FiscalBrain aplicada ao item.');
    } catch { setActionError('Erro ao aplicar decisão'); }
    finally { setFbApplyingId(null); }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-200 animate-pulse rounded w-64" />
        <div className="h-32 bg-slate-100 animate-pulse rounded" />
        <div className="h-48 bg-slate-100 animate-pulse rounded" />
      </div>
    );
  }

  if (error || !nfe) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
        <p className="font-semibold text-slate-700">{error || 'NF-e não encontrada'}</p>
        <Link href="/fiscal/nfe" className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium">← Voltar para lista</Link>
      </div>
    );
  }

  const currentOrder  = statusOrder[nfe.status] ?? 0;
  const totalProdutos = nfe.valorProdutos || nfe.items.reduce((s, i) => s + i.totalPrice, 0);
  const totalIcms     = Number(nfe.valorIcms   ?? 0);
  const totalIpi      = Number(nfe.valorIpi    ?? 0);
  const totalPis      = Number(nfe.valorPis    ?? 0);
  const totalCofins   = Number(nfe.valorCofins ?? 0);
  const totalIbs      = Number(nfe.valorIbs    ?? 0);
  const totalCbs      = Number(nfe.valorCbs    ?? 0);
  const totalIs       = Number(nfe.valorIs     ?? 0);
  const valorFrete    = Number(nfe.valorFrete    ?? 0);
  const valorSeguro   = Number(nfe.valorSeguro   ?? 0);
  const valorDesconto = Number(nfe.valorDesconto ?? 0);
  const valorDifal    = Number(nfe.valorDifal  ?? 0);
  const valorFcp      = Number(nfe.valorFcp    ?? 0);

  const canValidate  = nfe.status === 'RASCUNHO';
  const canTransmit  = nfe.status === 'VALIDADA' || nfe.status === 'RASCUNHO';
  const canCancel    = nfe.status === 'AUTORIZADA';
  const isAuthorized = nfe.status === 'AUTORIZADA';
  const isCancelable = nfe.status !== 'CANCELADA' && nfe.status !== 'DENEGADA' && nfe.status !== 'REJEITADA';
  const hasDifal     = valorDifal > 0;

  return (
    <>
      {showCancelModal && (
        <CancelModal onConfirm={handleCancel} onClose={() => setShowCancelModal(false)} loading={actionLoading} />
      )}
      {showCceModal && (
        <CceModal
          onConfirm={handleCce}
          onClose={() => setShowCceModal(false)}
          loading={actionLoading}
          cceNumero={(nfe.cceNumero ?? 0) + 1}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/fiscal/nfe" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">
                NF-e {nfe.numero ? String(nfe.numero).padStart(6, '0') : 'Rascunho'}-{nfe.serie}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[nfe.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {statusLabels[nfe.status] ?? nfe.status}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${nfe.type === 'SAIDA' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                {nfe.type === 'SAIDA' ? 'Saída' : 'Entrada'}
              </span>
              {hasDifal && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                  <MapPin className="w-3 h-3" /> DIFAL
                </span>
              )}
            </div>
            <p className="text-slate-500 mt-0.5 text-sm">
              {nfe.naturezaOperacao || nfe.operation} — Emissão:{' '}
              {nfe.dataEmissao ? new Date(nfe.dataEmissao).toLocaleDateString('pt-BR') : new Date(nfe.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {nfe.status === 'RASCUNHO' && (
              <button onClick={handleCalculateTaxes} disabled={actionLoading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50">
                <Calculator className="w-4 h-4" />Calcular Impostos
              </button>
            )}
            {/* FiscalBrain — apenas para saída em rascunho ou validada */}
            {nfe.type === 'SAIDA' && ['RASCUNHO', 'VALIDADA'].includes(nfe.status) && (
              <button
                onClick={fbStatus ? handleFiscalBrainStatus : handleFiscalBrainClassificar}
                disabled={fbLoading || actionLoading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors disabled:opacity-50"
                title="Classificar CFOP, CST e alíquotas com Inteligência Artificial"
              >
                {fbLoading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Classificando...</>
                  : fbStatus
                    ? <><Brain className="w-4 h-4" />Ver FiscalBrain</>
                    : <><Sparkles className="w-4 h-4" />Classificar com IA</>
                }
              </button>
            )}
            {canValidate && (
              <button onClick={handleValidate} disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50">
                <CheckCircle className="w-4 h-4" />{actionLoading ? 'Validando...' : 'Validar'}
              </button>
            )}
            {canTransmit && (
              <button onClick={handleAuthorize} disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50">
                <Send className="w-4 h-4" />{actionLoading ? 'Transmitindo...' : 'Transmitir SEFAZ'}
              </button>
            )}

            {/* DANFE — disponível para qualquer status (rascunho: marca d'água "SEM VALOR FISCAL") */}
            <button onClick={handleDanfe}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
              title={isAuthorized ? 'Imprimir DANFE' : 'Visualizar prévia do DANFE (sem valor fiscal)'}>
              <Printer className="w-4 h-4" />DANFE
            </button>

            {isAuthorized && (
              <>
                <button onClick={() => window.open(`/api/fiscal/nfe/${id}/xml`, '_blank')}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" />XML
                </button>
                <button onClick={() => setShowCceModal(true)} disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 text-sm font-medium transition-colors disabled:opacity-50"
                  title="Carta de Correção Eletrônica">
                  <PenLine className="w-4 h-4" />CC-e
                </button>
              </>
            )}
            {isCancelable && (
              <button onClick={() => setShowCancelModal(true)} disabled={actionLoading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50">
                <XCircle className="w-4 h-4" />Cancelar
              </button>
            )}
            <button onClick={fetchNfe} disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action error */}
        {actionError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Erro na operação</p>
              <p className="text-sm text-red-700 mt-0.5">{actionError}</p>
            </div>
            <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        {/* Action success */}
        {actionSuccess && (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Operação concluída</p>
              <p className="text-sm text-emerald-700 mt-0.5">{actionSuccess}</p>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-emerald-400 hover:text-emerald-600"><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        {/* Motivo cancelamento */}
        {(nfe.status === 'CANCELADA' || nfe.status === 'DENEGADA') && nfe.motivoCancelamento && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">{nfe.status === 'CANCELADA' ? 'Motivo do Cancelamento' : 'Motivo da Denegação'}</p>
              <p className="text-sm text-red-700 mt-0.5">{nfe.motivoCancelamento}</p>
            </div>
          </div>
        )}

        {/* CC-e existente */}
        {nfe.cceNumero && nfe.cceDescricao && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <PenLine className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-semibold text-blue-800">Carta de Correção nº {nfe.cceNumero}</p>
                {nfe.cceProtocolo ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    <CheckCircle className="w-3 h-3" /> SEFAZ Autorizado
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    Registrado localmente
                  </span>
                )}
              </div>
              {nfe.cceDataEvento && <p className="text-xs text-blue-600 mt-0.5">{new Date(nfe.cceDataEvento).toLocaleString('pt-BR')}</p>}
              {nfe.cceProtocolo && <p className="text-xs text-emerald-700 font-mono mt-0.5">Protocolo: {nfe.cceProtocolo}</p>}
              <p className="text-sm text-blue-700 mt-1">{nfe.cceDescricao}</p>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Status da NF-e</h2>
          <div className="flex items-center gap-2">
            {statusSteps.map((status, index) => {
              const stepOrder  = statusOrder[status] ?? 0;
              const isActive   = stepOrder <= currentOrder;
              const isCurrent  = nfe.status === status || (status === 'AUTORIZADA' && nfe.status === 'AUTORIZADA');
              return (
                <div key={status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent && isActive ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {isActive && !isCurrent ? <CheckCircle className="w-4 h-4" /> : index + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center ${isCurrent && isActive ? 'font-bold text-emerald-600' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{statusLabels[status]}</span>
                  </div>
                  {index < statusSteps.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${stepOrder < currentOrder ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
          {(nfe.status === 'CANCELADA' || nfe.status === 'DENEGADA' || nfe.status === 'REJEITADA') && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[nfe.status]}`}>{statusLabels[nfe.status]}</span>
              <span className="text-xs text-slate-500">Esta NF-e não seguirá o fluxo normal</span>
            </div>
          )}
        </div>

        {/* Document Info + Destinatário */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Dados do Documento</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Número / Série:</span>
                <span className="font-bold text-slate-900">{nfe.numero ? `${String(nfe.numero).padStart(6, '0')}-${nfe.serie}` : 'Não numerado'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Natureza da Operação:</span>
                <span className="font-medium text-slate-700 text-right max-w-[55%]">{nfe.naturezaOperacao || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Finalidade:</span>
                <span className="font-medium text-slate-700">{nfe.finality}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Operação:</span>
                <span className="font-medium text-slate-700">{nfe.operation}</span>
              </div>
              {nfe.chaveAcesso && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">Chave de Acesso:</span>
                  </div>
                  <p className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded break-all">{nfe.chaveAcesso}</p>
                </div>
              )}
              {nfe.protocoloAutorizacao && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Protocolo SEFAZ:</span>
                    <span className="font-mono font-medium text-slate-700">{nfe.protocoloAutorizacao}</span>
                  </div>
                  {nfe.dataAutorizacao && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-slate-500">Autorizado em:</span>
                      <span className="text-slate-700">{new Date(nfe.dataAutorizacao).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Destinatário / Remetente</h2>
            </div>
            {nfe.person ? (
              <>
                <p className="text-sm font-semibold text-slate-900">{nfe.person.razaoSocial}</p>
                {nfe.person.nomeFantasia && <p className="text-xs text-slate-500">{nfe.person.nomeFantasia}</p>}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">CPF/CNPJ:</span>
                    <span className="font-medium text-slate-700">{nfe.person.cpfCnpj || '—'}</span>
                  </div>
                  {nfe.person.rgIe && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">RG/IE:</span>
                      <span className="font-medium text-slate-700">{nfe.person.rgIe}</span>
                    </div>
                  )}
                  {nfe.ufDestino && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">UF Destino:</span>
                      <span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">{nfe.ufDestino}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Nenhum destinatário informado</p>
            )}
          </div>
        </div>

        {/* DIFAL Panel */}
        {hasDifal && (
          <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-slate-900">DIFAL — Diferencial de Alíquota</h2>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">EC 87/2015 — 100% Destino</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600 mb-1">Alíquota Interestadual</p>
                <p className="text-xl font-bold text-orange-900">{formatPct(nfe.aliqInterestadual)}</p>
                <p className="text-xs text-orange-600 mt-1">aplicada na saída</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600 mb-1">Alíquota Interna {nfe.ufDestino}</p>
                <p className="text-xl font-bold text-orange-900">{formatPct(nfe.aliqInternaDestino)}</p>
                <p className="text-xs text-orange-600 mt-1">do estado destino</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600 mb-1">Valor DIFAL</p>
                <p className="text-xl font-bold text-orange-900">{formatCurrency(valorDifal)}</p>
                <p className="text-xs text-orange-600 mt-1">recolher GNRE</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600 mb-1">FCP ({nfe.ufDestino})</p>
                <p className="text-xl font-bold text-orange-900">{formatCurrency(valorFcp)}</p>
                <p className="text-xs text-orange-600 mt-1">Fundo de Combate à Pobreza</p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              O emitente deve recolher o DIFAL via GNRE antes da saída da mercadoria quando o destinatário <strong>não for contribuinte</strong> de ICMS no estado de destino. A partir de 2019, 100% do DIFAL é devido ao estado de destino.
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Itens da Nota ({nfe.items.length})</h2>
          </div>
          {nfe.items.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum item adicionado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['#', 'Descrição', 'NCM', 'CFOP', 'Qtd', 'Unit.', 'Total', 'ICMS', 'IPI', 'PIS', 'COFINS', 'IBS', 'CBS'].map(h => (
                      <th key={h} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${['IBS', 'CBS'].includes(h) ? 'text-teal-600' : 'text-slate-500'} ${['#', 'NCM', 'CFOP', 'Qtd'].includes(h) ? 'text-center' : ['Unit.', 'Total', 'ICMS', 'IPI', 'PIS', 'COFINS', 'IBS', 'CBS'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nfe.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-slate-500 text-xs text-center">{item.itemNumber}</td>
                      <td className="px-3 py-2 text-slate-900 max-w-[200px]">
                        <p className="truncate" title={item.description}>{item.description}</p>
                        {item.unit && <p className="text-xs text-slate-400">{item.unit}</p>}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-600 text-xs">{item.ncmCode || '—'}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-600 text-xs">{item.cfopCode || '—'}</td>
                      <td className="px-3 py-2 text-center text-slate-900">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(item.totalPrice)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.valorIcms   != null ? formatCurrency(Number(item.valorIcms))   : '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.valorIpi    != null ? formatCurrency(Number(item.valorIpi))    : '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.valorPis    != null ? formatCurrency(Number(item.valorPis))    : '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.valorCofins != null ? formatCurrency(Number(item.valorCofins)) : '—'}</td>
                      <td className="px-3 py-2 text-right text-teal-700 font-medium">{item.valorIbs != null ? formatCurrency(Number(item.valorIbs)) : '—'}</td>
                      <td className="px-3 py-2 text-right text-teal-700 font-medium">{item.valorCbs != null ? formatCurrency(Number(item.valorCbs)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── FiscalBrain Panel (saída) ──────────────────────────────────── */}
        {nfe.type === 'SAIDA' && fbStatus && (
          <div className="bg-white rounded-lg shadow-sm border border-violet-200">
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-violet-50 transition-colors rounded-lg"
              onClick={() => setFbExpanded(v => !v)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Brain className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">FiscalBrain — Classificação Fiscal IA</h2>
                  <p className="text-xs text-slate-500">
                    {fbStatus.autoAplicados}/{fbStatus.totalItems} itens classificados automaticamente
                    {fbStatus.pendentesExcecao > 0 && <span className="ml-2 text-amber-600 font-medium">· {fbStatus.pendentesExcecao} exceção(ões)</span>}
                    {fbStatus.prontoParaEmitir && <span className="ml-2 text-emerald-600 font-medium">· Pronto para emitir</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); handleFiscalBrainClassificar(); }}
                  disabled={fbLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {fbLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Reclassificar
                </button>
                {fbExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {/* Items */}
            {fbExpanded && (
              <div className="border-t border-violet-100 divide-y divide-slate-100">
                {fbStatus.items.map((item) => {
                  const conf = item.confianca ?? 0;
                  const confColor = conf >= 92 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : conf >= 70 ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-red-700 bg-red-50 border-red-200';
                  const confBar = conf >= 92 ? 'bg-emerald-500' : conf >= 70 ? 'bg-amber-400' : 'bg-red-400';

                  return (
                    <div key={item.itemId} className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        {/* Item number + status icon */}
                        <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                          <span className="text-xs font-mono text-slate-400">#{item.itemNumber}</span>
                          {item.autoAplicado
                            ? <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            : item.classificado
                              ? <AlertTriangle className="w-5 h-5 text-amber-500" />
                              : <Info className="w-5 h-5 text-slate-300" />
                          }
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.descricao}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">NCM {item.ncm}</p>

                          {item.classificado && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {/* CFOP */}
                              <div className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-xs text-slate-500 mb-0.5">CFOP</p>
                                <div className="flex items-center gap-1">
                                  {item.cfopAtual && item.cfopAtual !== item.cfopSugerido && (
                                    <span className="text-xs font-mono text-slate-400 line-through">{item.cfopAtual}</span>
                                  )}
                                  <span className="text-sm font-bold text-violet-700 font-mono">{item.cfopSugerido || '—'}</span>
                                </div>
                              </div>
                              {/* CST ICMS */}
                              <div className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-xs text-slate-500 mb-0.5">CST ICMS</p>
                                <span className="text-sm font-bold text-slate-700 font-mono">{item.cstIcms || '—'}</span>
                                {item.aliquotaIcms != null && item.aliquotaIcms > 0 && (
                                  <span className="text-xs text-slate-500 ml-1">{item.aliquotaIcms}%</span>
                                )}
                              </div>
                              {/* CST PIS */}
                              <div className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-xs text-slate-500 mb-0.5">CST PIS</p>
                                <span className="text-sm font-bold text-slate-700 font-mono">{item.cstPis || '—'}</span>
                                {item.aliquotaPis != null && <span className="text-xs text-slate-500 ml-1">{item.aliquotaPis}%</span>}
                              </div>
                              {/* CST COFINS */}
                              <div className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-xs text-slate-500 mb-0.5">CST COFINS</p>
                                <span className="text-sm font-bold text-slate-700 font-mono">{item.cstCofins || '—'}</span>
                                {item.aliquotaCofins != null && <span className="text-xs text-slate-500 ml-1">{item.aliquotaCofins}%</span>}
                              </div>
                            </div>
                          )}

                          {/* Benefício fiscal */}
                          {item.beneficioFiscal && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                              <ShieldCheck className="w-3 h-3" />
                              pBenef: {item.beneficioFiscal}
                            </div>
                          )}

                          {/* Alertas */}
                          {item.alertas.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.alertas.map((a, i) => (
                                <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{a}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Fundamento legal */}
                          {item.fundamentoLegal.length > 0 && (
                            <p className="mt-1.5 text-xs text-slate-400 italic">
                              📋 {item.fundamentoLegal.slice(0, 2).join(' · ')}
                            </p>
                          )}

                          {/* Raciocínio (collapsible) */}
                          {item.raciocinio && (
                            <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{item.raciocinio}</p>
                          )}
                        </div>

                        {/* Confiança + ação */}
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          {item.confianca != null && (
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${confColor}`}>
                                {item.confianca}%
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${confBar}`} style={{ width: `${item.confianca}%` }} />
                              </div>
                            </div>
                          )}

                          {/* Botão aplicar — apenas para exceções (conf < 92%) */}
                          {item.classificado && !item.autoAplicado && item.decisionId && (
                            <button
                              onClick={() => handleAplicarDecisao(item.itemId, item.decisionId!)}
                              disabled={fbApplyingId === item.itemId}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                              {fbApplyingId === item.itemId
                                ? <RefreshCw className="w-3 h-3 animate-spin" />
                                : <CheckCircle className="w-3 h-3" />
                              }
                              Aplicar
                            </button>
                          )}

                          {item.autoAplicado && (
                            <span className="text-xs text-emerald-600 font-medium">✓ Aplicado</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Footer summary */}
                <div className="px-6 py-3 bg-violet-50 rounded-b-lg flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {fbStatus.autoAplicados} auto</span>
                    {fbStatus.pendentesExcecao > 0 && <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> {fbStatus.pendentesExcecao} exceção</span>}
                    {fbStatus.naoClassificados > 0 && <span className="text-slate-400">{fbStatus.naoClassificados} sem classif.</span>}
                  </div>
                  {fbStatus.prontoParaEmitir && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Pronto para emitir
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tax Totals */}
        {(totalIcms > 0 || totalIpi > 0 || totalPis > 0 || totalCofins > 0 || totalIbs > 0 || totalCbs > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-900">Tributos — Sistema Atual</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'ICMS',   valor: totalIcms   },
                  { label: 'IPI',    valor: totalIpi    },
                  { label: 'PIS',    valor: totalPis    },
                  { label: 'COFINS', valor: totalCofins },
                  ...(hasDifal ? [{ label: 'DIFAL',  valor: valorDifal }, { label: 'FCP', valor: valorFcp }] : []),
                ].map(({ label, valor }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{label}:</span>
                    <span className={`font-semibold ${label === 'DIFAL' || label === 'FCP' ? 'text-orange-700' : 'text-slate-900'}`}>{formatCurrency(valor)}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-900">Total Tributos:</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(totalIcms + totalIpi + totalPis + totalCofins + valorDifal + valorFcp)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-teal-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ArrowRightLeft className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-slate-900">Tributos — Reforma Tributária</h2>
              </div>
              <div className="space-y-3">
                {[{ label: 'IBS', valor: totalIbs }, { label: 'CBS', valor: totalCbs }, { label: 'IS', valor: totalIs }].map(({ label, valor }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-teal-700">{label}:</span>
                    <span className="font-semibold text-teal-900">{formatCurrency(valor)}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-teal-200 flex items-center justify-between text-sm">
                  <span className="font-bold text-teal-900">Total Reforma:</span>
                  <span className="font-bold text-teal-700">{formatCurrency(totalIbs + totalCbs + totalIs)}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-teal-50 rounded-lg">
                <p className="text-xs text-teal-800">2026: 90% sistema atual / 10% IBS+CBS. Calculado conforme LC 214/2025.</p>
              </div>
            </div>
          </div>
        )}

        {/* NF-e Totals */}
        <div className="bg-white rounded-lg shadow-sm border border-emerald-200 p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-slate-500">Total Produtos</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(totalProdutos)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Frete</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(valorFrete)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Seguro</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(valorSeguro)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">IPI / Desconto</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(totalIpi)} / -{formatCurrency(valorDesconto)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 -m-1">
              <p className="text-xs text-emerald-600 font-medium">Total da NF-e</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(Number(nfe.valorTotal))}</p>
            </div>
          </div>
        </div>

        {/* Informações Complementares */}
        {nfe.informacoesComplementares && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Informações Complementares</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{nfe.informacoesComplementares}</p>
          </div>
        )}
      </div>
    </>
  );
}
