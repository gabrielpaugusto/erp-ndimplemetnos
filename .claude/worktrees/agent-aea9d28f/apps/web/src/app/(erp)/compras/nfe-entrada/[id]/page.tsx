'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, FileCheck, LogIn, XCircle,
  AlertCircle, CheckCircle2, Package, DollarSign,
  BookOpen, Receipt, ChevronDown, BadgeCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDENTE:    { label: 'Pendente',    color: 'bg-yellow-100 text-yellow-700' },
  MANIFESTADA: { label: 'Manifestada', color: 'bg-blue-100 text-blue-700' },
  VINCULADA:   { label: 'Vinculada',   color: 'bg-purple-100 text-purple-700' },
  LANCADA:     { label: 'Lançada',     color: 'bg-emerald-100 text-emerald-700' },
  REJEITADA:   { label: 'Rejeitada',   color: 'bg-red-100 text-red-700' },
  DEVOLVIDA:   { label: 'Devolvida',   color: 'bg-orange-100 text-orange-700' },
};

const MANIFESTACAO_OPTIONS = [
  { value: 'CONFIRMACAO_OPERACAO',    label: 'Confirmação da Operação' },
  { value: 'CIENCIA_EMISSAO',         label: 'Ciência da Emissão' },
  { value: 'DESCONHECIMENTO_OPERACAO',label: 'Desconhecimento da Operação' },
  { value: 'OPERACAO_NAO_REALIZADA',  label: 'Operação Não Realizada' },
];

interface NFeInboxItem {
  id: string;
  numeroItem: number;
  codigoProdutoFornecedor: string;
  descricaoProduto: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  mapeado: boolean;
  productId?: string;
  product?: { code: string; description: string; unit: string } | null;
}

interface NFeInbox {
  id: string;
  numero: string;
  serie: string;
  chaveAcesso: string;
  emitenteCnpj: string;
  emitenteNome: string;
  emitentePessoaId?: string;
  dataEmissao: string;
  valorTotal: number;
  valorFrete: number;
  valorSeguro: number;
  valorOutrasDespesas: number;
  valorDesconto: number;
  status: string;
  manifestacao?: string;
  dataManifestacao?: string;
  nfeDocumentId?: string;
  items: NFeInboxItem[];
  purchaseOrder?: { id: string; numero: string; status: string } | null;
}

// ── EscriturarModal ─────────────────────────────────────────────────────────
function EscriturarModal({ nfe, onConfirm, onClose, loading }: {
  nfe: NFeInbox; onConfirm: (vencimento: string) => void; onClose: () => void; loading: boolean;
}) {
  const [vencimento, setVencimento] = useState('');
  const unmapped = nfe.items.filter(i => !i.mapeado).length;
  const totalIcms   = nfe.items.reduce((s, i) => s + i.valorIcms, 0);
  const totalPis    = nfe.items.reduce((s, i) => s + i.valorPis, 0);
  const totalCofins = nfe.items.reduce((s, i) => s + i.valorCofins, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <LogIn className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dar Entrada / Escriturar NF-e</h2>
        </div>

        {unmapped > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {unmapped} item(ns) não mapeado(s). A escrituração irá prosseguir sem movimentar estoque para esses itens.
          </div>
        )}

        {!nfe.emitentePessoaId && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Emitente não vinculado a um cadastro de pessoas. Cadastre o fornecedor antes de escriturar.
          </div>
        )}

        <p className="text-sm text-slate-600">Ao escriturar esta NF-e o sistema irá <strong>automaticamente</strong>:</p>
        <div className="space-y-2">
          {[
            { icon: <Package className="w-4 h-4 text-blue-600" />,    text: `Entrada no estoque para ${nfe.items.filter(i => i.mapeado).length} itens mapeados` },
            { icon: <DollarSign className="w-4 h-4 text-orange-600" />, text: `Título no Contas a Pagar — ${nfe.emitenteNome} — ${fmt(nfe.valorTotal)}` },
            { icon: <Receipt className="w-4 h-4 text-emerald-600" />,  text: `Créditos fiscais: ICMS ${fmt(totalIcms)}, PIS ${fmt(totalPis)}, COFINS ${fmt(totalCofins)}` },
            { icon: <BookOpen className="w-4 h-4 text-purple-600" />,  text: 'Lançamento contábil (D: Estoque / C: Fornecedores)' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
              {item.icon}
              <span className="text-sm text-slate-700">{item.text}</span>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data de Vencimento (Contas a Pagar)</label>
          <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <p className="text-xs text-slate-400 mt-1">Deixe em branco para usar D+30.</p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Voltar</button>
          <button
            onClick={() => onConfirm(vencimento)}
            disabled={loading || !nfe.emitentePessoaId}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Escriturando...' : 'Confirmar Escrituração'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function NFeEntradaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [nfe, setNfe]               = useState<NFeInbox | null>(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [showEscriturar, setShowEscriturar] = useState(false);
  const [showManifestMenu, setShowManifestMenu] = useState(false);
  const [entryResult, setEntryResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}`);
    if (res.ok) setNfe(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doManifest = async (manifestacao: string) => {
    setShowManifestMenu(false);
    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestacao }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      setSuccess('Manifestação registrada com sucesso.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally { setActionLoading(false); }
  };

  const doAutoMap = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/auto-map`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      const r = await res.json();
      setSuccess(`Auto-mapeamento: ${r.mapped} item(ns) mapeado(s), ${r.pending} pendente(s).`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally { setActionLoading(false); }
  };

  const doEscriturar = async (dataVencimento: string) => {
    setActionLoading(true);
    setError('');
    try {
      const body: any = { inboxId: id };
      if (dataVencimento) body.dataVencimento = dataVencimento;

      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/post-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      const result = await res.json();
      setEntryResult(result);
      setShowEscriturar(false);
      setSuccess('NF-e escriturada com sucesso! Todas as integrações foram executadas.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally { setActionLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
    </div>
  );

  if (!nfe) return (
    <div className="text-center py-20">
      <p className="text-slate-500">NF-e não encontrada.</p>
      <Link href="/compras/nfe-entrada" className="mt-4 inline-block text-amber-600 hover:underline text-sm">Voltar</Link>
    </div>
  );

  const sc = STATUS_CFG[nfe.status] ?? { label: nfe.status, color: 'bg-slate-100 text-slate-600' };
  const canManifest    = nfe.status !== 'LANCADA' && nfe.status !== 'REJEITADA' && nfe.status !== 'DEVOLVIDA';
  const canEscriturar  = nfe.status !== 'LANCADA' && nfe.status !== 'REJEITADA' && nfe.status !== 'DEVOLVIDA';
  const totalIcms   = nfe.items.reduce((s, i) => s + i.valorIcms, 0);
  const totalPis    = nfe.items.reduce((s, i) => s + i.valorPis, 0);
  const totalCofins = nfe.items.reduce((s, i) => s + i.valorCofins, 0);
  const totalIpi    = nfe.items.reduce((s, i) => s + i.valorIpi, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {showEscriturar && (
        <EscriturarModal nfe={nfe} onConfirm={doEscriturar} onClose={() => setShowEscriturar(false)} loading={actionLoading} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/compras/nfe-entrada" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">NF-e {nfe.numero}/{nfe.serie}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${sc.color}`}>{sc.label}</span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{nfe.emitenteNome} — emitida em {fmtDate(nfe.dataEmissao)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-map */}
          {canEscriturar && (
            <button onClick={doAutoMap} disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg text-sm transition-colors disabled:opacity-50">
              <BadgeCheck className="w-4 h-4" /> Auto-mapear
            </button>
          )}

          {/* Manifestar */}
          {canManifest && (
            <div className="relative">
              <button onClick={() => setShowManifestMenu(!showManifestMenu)} disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                <FileCheck className="w-4 h-4" /> Manifestar <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showManifestMenu && (
                <div className="absolute right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  {MANIFESTACAO_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => doManifest(opt.value)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Escriturar */}
          {canEscriturar && (
            <button onClick={() => setShowEscriturar(true)} disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50">
              <LogIn className="w-4 h-4" /> Dar Entrada
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

      {/* Integrations result */}
      {(nfe.status === 'LANCADA' || entryResult) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">NF-e escriturada — integrações executadas</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {[
              { label: 'Movimentações Estoque', icon: <Package className="w-3 h-3 text-blue-600" />, value: entryResult?.stockMovements != null ? `${entryResult.stockMovements} itens` : 'Concluído' },
              { label: 'Contas a Pagar', icon: <DollarSign className="w-3 h-3 text-orange-600" />, value: entryResult?.financialMovementId ? entryResult.financialMovementId.slice(0,12)+'…' : 'Concluído' },
              { label: 'Lançamento Contábil', icon: <BookOpen className="w-3 h-3 text-purple-600" />, value: 'Concluído' },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-emerald-200 rounded-lg p-3">
                <p className="text-emerald-700 font-medium flex items-center gap-1">{item.icon}{item.label}</p>
                <p className="text-slate-500 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Itens */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Itens da NF-e ({nfe.items.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['#','Cód. Fornecedor','Descrição','NCM/CFOP','Qtd','Vl. Unit','Total','ICMS','PIS+COFINS','Nosso Produto'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {nfe.items.map(item => (
                    <tr key={item.id} className={item.mapeado ? '' : 'bg-amber-50'}>
                      <td className="px-3 py-2 text-slate-500">{item.numeroItem}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{item.codigoProdutoFornecedor}</td>
                      <td className="px-3 py-2 text-slate-900 max-w-[180px] truncate">{item.descricaoProduto}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.ncm}<br />{item.cfop}</td>
                      <td className="px-3 py-2 text-slate-700">{item.quantidade} {item.unidade}</td>
                      <td className="px-3 py-2 text-slate-700">{fmt(item.valorUnitario)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{fmt(item.valorTotal)}</td>
                      <td className="px-3 py-2 text-emerald-700">{item.valorIcms > 0 ? fmt(item.valorIcms) : '—'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{fmt(item.valorPis + item.valorCofins)}</td>
                      <td className="px-3 py-2">
                        {item.mapeado && item.product ? (
                          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />{item.product.code}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />Não mapeado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chave */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Chave de Acesso</h2>
            <p className="font-mono text-sm text-slate-700 break-all bg-slate-50 rounded p-3">{nfe.chaveAcesso}</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Emitente */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Emitente</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500 text-xs">Razão Social</dt>
                <dd className="font-medium text-slate-900">{nfe.emitenteNome}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">CNPJ</dt>
                <dd className="font-mono text-slate-700">{nfe.emitenteCnpj}</dd>
              </div>
              {nfe.emitentePessoaId ? (
                <div className="flex items-center gap-1 text-emerald-700 text-xs">
                  <CheckCircle2 className="w-3 h-3" /> Vinculado ao cadastro
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-600 text-xs">
                  <AlertCircle className="w-3 h-3" /> Não vinculado — cadastre o fornecedor
                </div>
              )}
            </dl>
          </div>

          {/* Totais */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Totais</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Produtos', value: nfe.items.reduce((s, i) => s + i.valorTotal, 0) },
                { label: 'Frete', value: nfe.valorFrete },
                { label: 'Seguro', value: nfe.valorSeguro },
                { label: 'Outras Desp.', value: nfe.valorOutrasDespesas },
                ...(nfe.valorDesconto > 0 ? [{ label: 'Desconto', value: -nfe.valorDesconto }] : []),
              ].map(r => (
                <div key={r.label} className="flex justify-between text-slate-600">
                  <span>{r.label}</span>
                  <span className={r.value < 0 ? 'text-red-600' : ''}>{fmt(Math.abs(r.value))}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold text-slate-900">
                <span>Total NF-e</span><span>{fmt(nfe.valorTotal)}</span>
              </div>
            </div>
          </div>

          {/* Créditos Fiscais */}
          <div className="bg-white rounded-lg border border-emerald-200 p-5">
            <h2 className="text-sm font-semibold text-emerald-800 mb-3">Créditos Fiscais</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'ICMS', value: totalIcms },
                { label: 'IPI', value: totalIpi },
                { label: 'PIS', value: totalPis },
                { label: 'COFINS', value: totalCofins },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-slate-600">
                  <span>{r.label}</span>
                  <span className={r.value > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                    {r.value > 0 ? fmt(r.value) : '—'}
                  </span>
                </div>
              ))}
              <div className="border-t border-emerald-100 pt-2 flex justify-between font-semibold text-emerald-800">
                <span>Total Créditos</span>
                <span>{fmt(totalIcms + totalIpi + totalPis + totalCofins)}</span>
              </div>
            </div>
          </div>

          {/* Manifestação */}
          {nfe.manifestacao && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Manifestação</h2>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">{nfe.manifestacao}</span>
              {nfe.dataManifestacao && (
                <p className="text-xs text-slate-400 mt-1">{fmtDate(nfe.dataManifestacao)}</p>
              )}
            </div>
          )}

          {/* Vínculo PO */}
          {nfe.purchaseOrder && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Pedido de Compra</h2>
              <Link href={`/compras/pedidos/${nfe.purchaseOrder.id}`} className="text-amber-600 hover:underline text-sm font-medium">
                {nfe.purchaseOrder.numero}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
