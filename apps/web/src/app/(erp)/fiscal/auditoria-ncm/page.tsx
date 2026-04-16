'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuditoriaStatus =
  | 'PENDENTE'
  | 'ERRO_INTERNO'
  | 'ERRO_FORNECEDOR'
  | 'RESOLVIDO';

interface NcmAuditoria {
  id: string;
  ncmNota: string;
  ncmCadastro: string;
  status: AuditoriaStatus;
  origemErro: string | null;
  observacoes: string | null;
  createdAt: string;
  nfeInbox: {
    numero: string;
    serie: string;
    emitenteNome: string;
  } | null;
  nfeInboxItem: {
    descricaoProduto: string;
    ncm: string | null;
    codigoProdutoFornecedor: string | null;
  } | null;
  product: {
    code: string;
    description: string;
  } | null;
}

interface ApiResponse {
  data: NcmAuditoria[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '', label: 'Todos' },
  { key: 'PENDENTE', label: 'Pendente' },
  { key: 'ERRO_INTERNO', label: 'Erro Interno' },
  { key: 'ERRO_FORNECEDOR', label: 'Erro Fornecedor' },
  { key: 'RESOLVIDO', label: 'Resolvido' },
] as const;

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  PENDENTE: {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-700',
  },
  ERRO_INTERNO: {
    label: 'Erro Interno',
    className: 'bg-red-100 text-red-700',
  },
  ERRO_FORNECEDOR: {
    label: 'Erro Fornecedor',
    className: 'bg-orange-100 text-orange-700',
  },
  RESOLVIDO: {
    label: 'Resolvido',
    className: 'bg-emerald-100 text-emerald-700',
  },
};

const ORIGEM_LABEL: Record<string, string> = {
  ERRO_INTERNO: 'Erro Interno',
  ERRO_FORNECEDOR: 'Erro Fornecedor',
};

const RESOLVE_STATUS_OPTIONS: AuditoriaStatus[] = [
  'ERRO_INTERNO',
  'ERRO_FORNECEDOR',
  'RESOLVIDO',
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status];
  if (!cfg) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        {status}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

interface ResolveFormProps {
  auditId: string;
  onSaved: () => void;
  onCancel: () => void;
}

function ResolveForm({ auditId, onSaved, onCancel }: ResolveFormProps) {
  const [status, setStatus] = useState<AuditoriaStatus>('ERRO_INTERNO');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/purchasing/nfe-inbox/ncm-auditorias/${auditId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, observacoes: observacoes || undefined }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || 'Erro ao salvar');
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Resolver auditoria</p>
        <button
          onClick={onCancel}
          className="p-1 text-slate-400 hover:text-slate-600 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Status *
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AuditoriaStatus)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {RESOLVE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_BADGE[s]?.label ?? s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Observações
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Detalhe a resolução..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AuditoriaNCMPage() {
  const [rows, setRows] = useState<NcmAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (activeTab) params.set('status', activeTab);

      const res = await apiFetch(
        `/api/purchasing/nfe-inbox/ncm-auditorias?${params}`,
      );
      if (!res.ok) throw new Error('Erro ao carregar auditorias');
      const json: ApiResponse = await res.json();
      setRows(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
    setResolvingId(null);
  };

  const handleSaved = () => {
    setResolvingId(null);
    load();
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('pt-BR');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Auditoria de NCM</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Divergências de NCM entre notas fiscais recebidas e nosso cadastro de
          produtos
        </p>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Summary */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50 text-sm text-slate-500">
          <AlertTriangle className="w-4 h-4 text-slate-400" />
          {loading ? (
            'Carregando...'
          ) : (
            <>
              <span className="font-medium text-slate-700">{total}</span>{' '}
              divergência(s) encontrada(s)
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  NF-e
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Emitente
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Produto
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  NCM da Nota
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  NCM Cadastro
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Origem
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    Carregando...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-slate-300" />
                      <p>Nenhuma divergência encontrada.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => (
                  <>
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* NF-e */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-mono text-xs text-slate-700">
                          {row.nfeInbox
                            ? `${row.nfeInbox.numero}/${row.nfeInbox.serie}`
                            : '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fmtDate(row.createdAt)}
                        </p>
                      </td>

                      {/* Emitente */}
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="line-clamp-2 text-slate-700">
                          {row.nfeInbox?.emitenteNome || '—'}
                        </span>
                      </td>

                      {/* Produto */}
                      <td className="px-4 py-3 max-w-[200px]">
                        {row.product ? (
                          <>
                            <p className="font-mono text-xs text-slate-400">
                              {row.product.code}
                            </p>
                            <p className="text-slate-700 line-clamp-2 mt-0.5">
                              {row.product.description}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* NCM da Nota */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {row.ncmNota || '—'}
                      </td>

                      {/* NCM Cadastro */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {row.ncmCadastro || '—'}
                      </td>

                      {/* Origem */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.origemErro ? (
                          <span className="text-xs text-slate-600">
                            {ORIGEM_LABEL[row.origemErro] ?? row.origemErro}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <StatusBadge status={row.status} />
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {row.status !== 'RESOLVIDO' && (
                          <button
                            onClick={() =>
                              setResolvingId(
                                resolvingId === row.id ? null : row.id,
                              )
                            }
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {resolvingId === row.id ? 'Cancelar' : 'Resolver'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Inline resolve form */}
                    {resolvingId === row.id && (
                      <tr key={`resolve-${row.id}`}>
                        <td
                          colSpan={8}
                          className="px-4 pb-4 bg-slate-50 border-b border-slate-200"
                        >
                          <ResolveForm
                            auditId={row.id}
                            onSaved={handleSaved}
                            onCancel={() => setResolvingId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
