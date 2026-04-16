'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Truck, FileCheck, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, BookOpen, ChevronDown,
  DollarSign, Package, Receipt, BadgeCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency as fmt, fmtPercent } from '@/lib/format';

const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');
const fmtDatetime = (s: string) => new Date(s).toLocaleString('pt-BR');

const STATUS_LABELS: Record<string, string> = {
  REGISTRADO: 'Registrado', MANIFESTADO: 'Manifestado',
  ESCRITURADO: 'Escriturado', CANCELADO: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  REGISTRADO: 'bg-slate-100 text-slate-600',
  MANIFESTADO: 'bg-blue-100 text-blue-700',
  ESCRITURADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-red-100 text-red-600',
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  REGISTRADO: <Truck className="w-4 h-4" />,
  MANIFESTADO: <FileCheck className="w-4 h-4" />,
  ESCRITURADO: <CheckCircle2 className="w-4 h-4" />,
  CANCELADO: <XCircle className="w-4 h-4" />,
};

const MANIFESTACAO_OPTIONS = [
  { value: 'CIENCIA', label: 'Ciência da Operação' },
  { value: 'CONFIRMACAO', label: 'Confirmação da Operação' },
  { value: 'DESCONHECIMENTO', label: 'Desconhecimento da Operação' },
  { value: 'NAO_REALIZADO', label: 'Operação Não Realizada' },
];

interface CteDetail {
  id: string;
  chaveAcesso?: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  transportadoraCnpj: string;
  transportadoraNome: string;
  transportadoraIe?: string;
  remetenteNome?: string;
  destinatarioNome?: string;
  modalidade: string;
  cfop: string;
  valorFrete: number;
  valorSeguro?: number;
  valorOutrasDespesas?: number;
  valorDesconto?: number;
  valorIcms: number;
  aliqIcms: number;
  valorTotal: number;
  creditoIcms: boolean;
  condicaoPagamento?: string;
  dataVencimentoFrete?: string;
  status: string;
  manifestacao?: string;
  custoRateado: boolean;
  observacoes?: string;
  financialMovementId?: string;
  journalEntryId?: string;
  fiscalEntryId?: string;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: { id: string; numero: string; status: string } | null;
  nfeInbox?: { id: string; numero: string; emitenteNome: string } | null;
}

// ── CancelModal ──────────────────────────────────────────────────────────────
function CancelModal({ onConfirm, onClose, loading }: { onConfirm: (motivo: string) => void; onClose: () => void; loading: boolean }) {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Cancelar CT-e</h2>
        <p className="text-sm text-slate-500">Informe o motivo do cancelamento (mínimo 15 caracteres).</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          placeholder="Motivo do cancelamento..."
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Voltar</button>
          <button
            onClick={() => onConfirm(motivo)}
            disabled={motivo.length < 15 || loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EscriturarModal ──────────────────────────────────────────────────────────
function EscriturarModal({ cte, onConfirm, onClose, loading }: { cte: CteDetail; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Escriturar CT-e</h2>
        </div>
        <p className="text-sm text-slate-600">
          Ao escriturar este CT-e, o sistema executará <strong>automaticamente</strong>:
        </p>
        <div className="space-y-2">
          {[
            { icon: <Receipt className="w-4 h-4 text-emerald-600" />, text: `Crédito de ICMS sobre o frete (${fmt(cte.valorIcms)}) no livro fiscal` },
            { icon: <DollarSign className="w-4 h-4 text-blue-600" />, text: `Título no Contas a Pagar para ${cte.transportadoraNome} — ${fmt(cte.valorTotal)}` },
            { icon: <Package className="w-4 h-4 text-orange-600" />, text: cte.nfeInbox ? `Rateio do custo do frete nos itens da NF-e ${cte.nfeInbox.numero}` : 'Rateio de custo (sem NF-e vinculada)' },
            { icon: <BadgeCheck className="w-4 h-4 text-purple-600" />, text: 'Lançamento contábil (D: Estoque/C: Fornecedores + D: ICMS a Recuperar/C: Redução Custo)' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
              {item.icon}
              <span className="text-sm text-slate-700">{item.text}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Atenção: esta operação é irreversível. Após a escrituração não é possível cancelar.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Voltar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            <BookOpen className="w-4 h-4" />
            {loading ? 'Escriturando...' : 'Confirmar Escrituração'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cte, setCte] = useState<CteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEscriturarModal, setShowEscriturarModal] = useState(false);
  const [showManifestMenu, setShowManifestMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/api/purchasing/cte/${id}`);
    if (res.ok) setCte(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doManifest = async (tipo: string) => {
    setShowManifestMenu(false);
    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/cte/${id}/manifestar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      setSuccess('Manifestação registrada com sucesso.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setActionLoading(false);
    }
  };

  const doEscriturar = async () => {
    setShowEscriturarModal(false);
    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/cte/${id}/escriturar`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      setSuccess('CT-e escriturado com sucesso! Todas as integrações foram executadas.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setActionLoading(false);
    }
  };

  const doCancelar = async (motivo: string) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/cte/${id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      setShowCancelModal(false);
      setSuccess('CT-e cancelado.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (!cte) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">CT-e não encontrado.</p>
        <Link href="/compras/cte" className="mt-4 inline-block text-emerald-600 hover:underline text-sm">Voltar à lista</Link>
      </div>
    );
  }

  const canManifest  = cte.status === 'REGISTRADO';
  const canEscriturar = ['REGISTRADO', 'MANIFESTADO'].includes(cte.status);
  const canCancelar  = cte.status !== 'ESCRITURADO' && cte.status !== 'CANCELADO';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Modals */}
      {showCancelModal && (
        <CancelModal
          onConfirm={doCancelar}
          onClose={() => setShowCancelModal(false)}
          loading={actionLoading}
        />
      )}
      {showEscriturarModal && (
        <EscriturarModal
          cte={cte}
          onConfirm={doEscriturar}
          onClose={() => setShowEscriturarModal(false)}
          loading={actionLoading}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/compras/cte" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">CT-e {cte.numero}-{cte.serie}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[cte.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUS_ICONS[cte.status]}
                {STATUS_LABELS[cte.status] ?? cte.status}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{cte.transportadoraNome} — emitido em {fmtDate(cte.dataEmissao)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {canManifest && (
            <div className="relative">
              <button
                onClick={() => setShowManifestMenu(!showManifestMenu)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <FileCheck className="w-4 h-4" />
                Manifestar
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showManifestMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  {MANIFESTACAO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => doManifest(opt.value)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {canEscriturar && (
            <button
              onClick={() => setShowEscriturarModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <BookOpen className="w-4 h-4" />
              Escriturar
            </button>
          )}

          {canCancelar && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}
        </div>
      )}

      {/* Integrations result (ESCRITURADO) */}
      {cte.status === 'ESCRITURADO' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">CT-e escriturado — integrações executadas</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {cte.fiscalEntryId && (
              <div className="bg-white border border-emerald-200 rounded-lg p-3">
                <p className="text-emerald-600 font-medium flex items-center gap-1"><Receipt className="w-3 h-3" /> Entrada Fiscal</p>
                <p className="text-slate-500 mt-0.5 font-mono">{cte.fiscalEntryId.slice(0, 12)}…</p>
              </div>
            )}
            {cte.financialMovementId && (
              <div className="bg-white border border-emerald-200 rounded-lg p-3">
                <p className="text-blue-600 font-medium flex items-center gap-1"><DollarSign className="w-3 h-3" /> Contas a Pagar</p>
                <p className="text-slate-500 mt-0.5 font-mono">{cte.financialMovementId.slice(0, 12)}…</p>
              </div>
            )}
            {cte.journalEntryId && (
              <div className="bg-white border border-emerald-200 rounded-lg p-3">
                <p className="text-purple-600 font-medium flex items-center gap-1"><BookOpen className="w-3 h-3" /> Lançamento Contábil</p>
                <p className="text-slate-500 mt-0.5 font-mono">{cte.journalEntryId.slice(0, 12)}…</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transportadora */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-500" /> Transportadora
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">CNPJ</dt>
                <dd className="font-mono font-medium text-slate-900">{cte.transportadoraCnpj}</dd>
              </div>
              {cte.transportadoraIe && (
                <div>
                  <dt className="text-slate-500">IE</dt>
                  <dd className="text-slate-700">{cte.transportadoraIe}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-slate-500">Razão Social</dt>
                <dd className="font-medium text-slate-900">{cte.transportadoraNome}</dd>
              </div>
              {cte.remetenteNome && (
                <div>
                  <dt className="text-slate-500">Remetente</dt>
                  <dd className="text-slate-700">{cte.remetenteNome}</dd>
                </div>
              )}
              {cte.destinatarioNome && (
                <div>
                  <dt className="text-slate-500">Destinatário</dt>
                  <dd className="text-slate-700">{cte.destinatarioNome}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Transporte */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Dados do Transporte</h2>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Modalidade</dt>
                <dd>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">{cte.modalidade}</span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">CFOP</dt>
                <dd className="font-mono font-medium text-slate-900">{cte.cfop}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Cond. Pagamento</dt>
                <dd className="text-slate-700">{cte.condicaoPagamento ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Data Emissão</dt>
                <dd className="text-slate-700">{fmtDate(cte.dataEmissao)}</dd>
              </div>
              {cte.dataVencimentoFrete && (
                <div>
                  <dt className="text-slate-500">Vencimento</dt>
                  <dd className="text-slate-700">{fmtDate(cte.dataVencimentoFrete)}</dd>
                </div>
              )}
              {cte.manifestacao && (
                <div>
                  <dt className="text-slate-500">Manifestação</dt>
                  <dd>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{cte.manifestacao}</span>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Chave */}
          {cte.chaveAcesso && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-2">Chave de Acesso</h2>
              <p className="font-mono text-sm text-slate-700 break-all bg-slate-50 rounded p-3">{cte.chaveAcesso}</p>
            </div>
          )}

          {/* Observações */}
          {cte.observacoes && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-2">Observações</h2>
              <p className="text-sm text-slate-600">{cte.observacoes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Valores */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Valores</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Frete', value: cte.valorFrete },
                ...(cte.valorSeguro ? [{ label: 'Seguro', value: cte.valorSeguro }] : []),
                ...(cte.valorOutrasDespesas ? [{ label: 'Outras Despesas', value: cte.valorOutrasDespesas }] : []),
                ...(cte.valorDesconto ? [{ label: 'Desconto', value: -cte.valorDesconto }] : []),
              ].map(item => (
                <div key={item.label} className="flex justify-between text-slate-600">
                  <span>{item.label}</span>
                  <span className={item.value < 0 ? 'text-red-600' : ''}>{fmt(Math.abs(item.value))}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold text-slate-900">
                <span>Total</span>
                <span>{fmt(cte.valorTotal)}</span>
              </div>
            </div>
          </div>

          {/* ICMS */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">ICMS</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Alíquota</span>
                <span>{fmtPercent(cte.aliqIcms)}</span>
              </div>
              <div className="flex justify-between font-medium text-emerald-700">
                <span>Valor ICMS</span>
                <span>{fmt(cte.valorIcms)}</span>
              </div>
              <div className="mt-3 p-2 rounded-lg text-xs font-medium text-center"
                style={{ background: cte.creditoIcms ? '#ecfdf5' : '#f8fafc', color: cte.creditoIcms ? '#065f46' : '#64748b' }}>
                {cte.creditoIcms ? '✓ Crédito de ICMS aproveitado' : '✗ Sem aproveitamento de crédito'}
              </div>
            </div>
          </div>

          {/* Vínculos */}
          {(cte.purchaseOrder || cte.nfeInbox) && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Vínculos</h2>
              <div className="space-y-3 text-sm">
                {cte.purchaseOrder && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Pedido de Compra</p>
                    <Link
                      href={`/compras/pedidos/${cte.purchaseOrder.id}`}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      #{cte.purchaseOrder.numero}
                    </Link>
                  </div>
                )}
                {cte.nfeInbox && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">NF-e de Entrada</p>
                    <Link
                      href={`/compras/nfe-entrada/${cte.nfeInbox.id}`}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      #{cte.nfeInbox.numero}
                    </Link>
                    <p className="text-xs text-slate-400">{cte.nfeInbox.emitenteNome}</p>
                    {cte.custoRateado && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Custo rateado
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Registro</h2>
            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Criado em</span>
                <span>{fmtDatetime(cte.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Atualizado</span>
                <span>{fmtDatetime(cte.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
