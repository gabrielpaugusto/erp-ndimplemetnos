'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, FileCheck,
  AlertCircle, CheckCircle2, Package, DollarSign,
  BookOpen, ChevronDown, BadgeCheck, Download, FileText, Truck,
  X, Link2, PlusCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency as fmt } from '@/lib/format';
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');
const fmtCnpj = (c: string) => {
  const d = (c ?? '').replace(/\D/g, '').padStart(14, '0');
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDENTE:     { label: 'Pendente',     color: 'bg-yellow-100 text-yellow-700' },
  MANIFESTADA:  { label: 'Manifestada',  color: 'bg-blue-100 text-blue-700' },
  FINANCEIRO:   { label: 'Financeiro',   color: 'bg-violet-100 text-violet-700' },
  ESCRITURACAO: { label: 'Escrituração', color: 'bg-orange-100 text-orange-700' },
  FINALIZADA:   { label: 'Finalizada',   color: 'bg-emerald-100 text-emerald-700' },
  LANCADA:      { label: 'Lançada',      color: 'bg-emerald-100 text-emerald-700' },
  VINCULADA:    { label: 'Vinculada',    color: 'bg-purple-100 text-purple-700' },
  REJEITADA:    { label: 'Rejeitada',    color: 'bg-red-100 text-red-700' },
  DEVOLVIDA:    { label: 'Devolvida',    color: 'bg-orange-100 text-orange-700' },
  CANCELADA:    { label: 'Cancelada',    color: 'bg-gray-100 text-gray-600' },
};

const MANIFESTACAO_OPTIONS = [
  { value: 'CONFIRMACAO_OPERACAO',    label: 'Confirmação da Operação' },
  { value: 'CIENCIA_OPERACAO',        label: 'Ciência da Emissão' },
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
  cteDocuments?: {
    id: string; numero: string; serie: string;
    transportadoraNome: string; transportadoraCnpj: string;
    valorTotal: number | null; valorFrete: number | null;
    status: string; dataEmissao: string;
  }[];
}

// ── Modal: Recepcionar (Almoxarifado) ────────────────────────────────────────
function RecepcionarModal({ nfe, onConfirm, onClose, loading }: {
  nfe: NFeInbox; onConfirm: (purchaseOrderId?: string, obs?: string) => void; onClose: () => void; loading: boolean;
}) {
  const [obs, setObs]   = useState('');
  const [poSearch, setPoSearch] = useState(nfe.purchaseOrder?.numero ?? '');
  const [poResults, setPoResults] = useState<{id: string; numero: string; status: string}[]>([]);
  const [poSearching, setPoSearching] = useState(false);
  const [selectedPo, setSelectedPo] = useState<{id: string; numero: string; status: string} | null>(
    nfe.purchaseOrder ? { id: nfe.purchaseOrder.id, numero: nfe.purchaseOrder.numero, status: nfe.purchaseOrder.status } : null
  );
  const unmapped = nfe.items.filter(i => !i.mapeado).length;

  const searchPOs = async (q: string) => {
    setPoSearch(q);
    if (!q.trim()) { setPoResults([]); return; }
    setPoSearching(true);
    try {
      const res = await apiFetch(`/api/purchasing/orders?search=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setPoResults(data.data ?? data ?? []);
      }
    } finally { setPoSearching(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Recepcionar Mercadoria</h2>
        </div>
        <p className="text-sm text-slate-500">Etapa 1/3 — Almoxarifado</p>

        {unmapped > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {unmapped} item(ns) não mapeado(s) — não gerarão movimentação de estoque.
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
          <p className="font-medium">O sistema irá:</p>
          <p>✓ Registrar entrada no estoque com custo real da NF-e</p>
          {nfe.purchaseOrder && <p>✓ Ajustar custo do kardex da OC {nfe.purchaseOrder.numero}</p>}
          <p>✓ Criar Recibo de Recepção e vincular à NF-e</p>
        </div>

        {/* Ordem de Compra */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ordem de Compra (opcional)
          </label>
          {selectedPo ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium text-emerald-800">{selectedPo.numero}</span>
                <span className="ml-2 text-xs text-emerald-600">{selectedPo.status}</span>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedPo(null); setPoSearch(''); setPoResults([]); }}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                ✕ remover
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={poSearch}
                onChange={(e) => searchPOs(e.target.value)}
                placeholder="Buscar por número da OC..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {poSearching && <span className="absolute right-3 top-2.5 text-xs text-slate-400 animate-pulse">buscando...</span>}
              {poResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {poResults.map(po => (
                    <button
                      key={po.id}
                      type="button"
                      onClick={() => { setSelectedPo(po); setPoSearch(''); setPoResults([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-800">{po.numero}</span>
                      <span className="ml-2 text-xs text-slate-500">{po.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações (opcional)</label>
          <input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: conferido com nota fiscal"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onConfirm(selectedPo?.id || undefined, obs || undefined)} disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Package className="w-4 h-4" />
            {loading ? 'Recepcionando...' : 'Confirmar Recepção'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Lançar Financeiro ─────────────────────────────────────────────────
function LancarFinanceiroModal({ nfe, onConfirm, onClose, loading }: {
  nfe: NFeInbox; onConfirm: (dataVencimento: string, parcelas: number, obs?: string) => void; onClose: () => void; loading: boolean;
}) {
  const [vencimento, setVencimento] = useState('');
  const [parcelas, setParcelas]     = useState(1);
  const [obs, setObs]               = useState('');

  if (!nfe.emitentePessoaId) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Lançar no Financeiro</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          Fornecedor não está vinculado ao cadastro de pessoas. Cadastre-o antes de lançar.
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Fechar</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">Lançar no Financeiro</h2>
        </div>
        <p className="text-sm text-slate-500">Etapa 2/3 — Departamento Financeiro</p>

        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm text-violet-800 space-y-1">
          <p className="font-medium">O sistema irá criar:</p>
          <p>✓ {parcelas} título(s) no Contas a Pagar para {nfe.emitenteNome}</p>
          <p>✓ Valor: {fmt(nfe.valorTotal)}{parcelas > 1 ? ` ÷ ${parcelas} = ${fmt(nfe.valorTotal / parcelas)}/parcela` : ''}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">1º Vencimento *</label>
            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
            <select value={parcelas} onChange={e => setParcelas(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {[1,2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n}x</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações (opcional)</label>
          <input type="text" value={obs} onChange={e => setObs(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onConfirm(vencimento, parcelas, obs || undefined)} disabled={loading || !vencimento}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            <DollarSign className="w-4 h-4" />
            {loading ? 'Lançando...' : 'Lançar no Financeiro'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Escriturar (Fiscal) ───────────────────────────────────────────────
function EscriturarModal({ nfe, onConfirm, onClose, loading }: {
  nfe: NFeInbox; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  const totalIcms   = nfe.items.reduce((s, i) => s + Number(i.valorIcms), 0);
  const totalIpi    = nfe.items.reduce((s, i) => s + Number(i.valorIpi), 0);
  const totalPis    = nfe.items.reduce((s, i) => s + Number(i.valorPis), 0);
  const totalCofins = nfe.items.reduce((s, i) => s + Number(i.valorCofins), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-slate-900">Escriturar NF-e</h2>
        </div>
        <p className="text-sm text-slate-500">Etapa 3/3 — Departamento Fiscal · O motor de regras fiscais (TES) determinará créditos por item.</p>

        {/* Tabela por item */}
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-2 py-1.5 text-left">#</th>
                <th className="px-2 py-1.5 text-left">Produto</th>
                <th className="px-2 py-1.5 text-center">CFOP</th>
                <th className="px-2 py-1.5 text-right">Vlr Total</th>
                <th className="px-2 py-1.5 text-right">ICMS</th>
                <th className="px-2 py-1.5 text-right">IPI</th>
                <th className="px-2 py-1.5 text-right">PIS</th>
                <th className="px-2 py-1.5 text-right">COFINS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nfe.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-2 py-1.5 text-slate-400">{item.numeroItem}</td>
                  <td className="px-2 py-1.5 max-w-[220px]">
                    <p className="truncate font-medium text-slate-800">{item.descricaoProduto}</p>
                    <p className="text-slate-400">{item.codigoProdutoFornecedor} · NCM {item.ncm}</p>
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono font-bold text-blue-700">{item.cfop || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(Number(item.valorTotal))}</td>
                  <td className="px-2 py-1.5 text-right">{Number(item.valorIcms) > 0 ? fmt(Number(item.valorIcms)) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-1.5 text-right">{Number(item.valorIpi) > 0 ? fmt(Number(item.valorIpi)) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-1.5 text-right">{Number(item.valorPis) > 0 ? fmt(Number(item.valorPis)) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-1.5 text-right">{Number(item.valorCofins) > 0 ? fmt(Number(item.valorCofins)) : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-slate-700 text-xs">
              <tr>
                <td colSpan={4} className="px-2 py-1.5 text-right">Totais NF-e:</td>
                <td className="px-2 py-1.5 text-right">{fmt(totalIcms)}</td>
                <td className="px-2 py-1.5 text-right">{fmt(totalIpi)}</td>
                <td className="px-2 py-1.5 text-right">{fmt(totalPis)}</td>
                <td className="px-2 py-1.5 text-right">{fmt(totalCofins)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 space-y-1">
          <p className="font-medium">O sistema irá registrar automaticamente:</p>
          <p>✓ Créditos fiscais por item (ICMS / IPI / PIS-COFINS) conforme Motor de Regras Fiscais</p>
          <p>✓ Lançamento contábil: D: Estoque/Despesa por tipo de destinação | C: Fornecedores</p>
          <p>✓ Documento fiscal oficial (NFeDocument) no Livro Fiscal de Entradas</p>
          <p>✓ NF-e movida para <strong>FINALIZADA</strong></p>
          {!nfe.items.every((i) => i.mapeado) && (
            <p className="text-amber-700 font-medium">⚠ {nfe.items.filter((i) => !i.mapeado).length} item(ns) sem produto vinculado — créditos podem não ser gerados corretamente.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={onConfirm} disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
            <BookOpen className="w-4 h-4" />
            {loading ? 'Escriturando...' : 'Confirmar Escrituração'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page (inner) ────────────────────────────────────────────────────────
function NFeEntradaDetailPageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParamsObj = useSearchParams();

  const [nfe, setNfe]               = useState<NFeInbox | null>(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [showRecepcionar, setShowRecepcionar]           = useState(false);
  const [showLancarFinanceiro, setShowLancarFinanceiro] = useState(false);
  const [showEscriturar, setShowEscriturar]             = useState(false);
  const [showManifestMenu, setShowManifestMenu] = useState(false);
  const [downloadingXml, setDownloadingXml] = useState(false);
  const [eventos, setEventos]       = useState<any[]>([]);
  const autoDownloadDone = useRef(false);

  // Drawer state
  const [mapDrawer, setMapDrawer] = useState<{ open: boolean; item: NFeInboxItem | null }>({ open: false, item: null });
  const [mapTab, setMapTab] = useState<'vincular' | 'criar'>('vincular');

  // Tab A: vincular produto existente
  const [prodSearch, setProdSearch] = useState('');
  const [prodResults, setProdResults] = useState<{ id: string; code: string; description: string; unit: string; ncmCode?: string }[]>([]);
  const [prodSearching, setProdSearching] = useState(false);
  const [selectedProd, setSelectedProd] = useState<{ id: string; code: string; description: string; unit: string; ncmCode?: string } | null>(null);
  const [saveLink, setSaveLink] = useState(true);
  const [ncmDivAStatus, setNcmDivAStatus] = useState<'ERRO_INTERNO' | 'ERRO_FORNECEDOR' | ''>('');
  const [ncmDivAObs, setNcmDivAObs] = useState('');

  // Tab B: criar novo produto
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('');
  const [newProdNcm, setNewProdNcm] = useState('');
  const [ncmDivBStatus, setNcmDivBStatus] = useState<'ERRO_INTERNO' | 'ERRO_FORNECEDOR' | ''>('');
  const [ncmDivBObs, setNcmDivBObs] = useState('');

  const [mapping, setMapping] = useState(false);
  const [mapError, setMapError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [res, evRes] = await Promise.all([
      apiFetch(`/api/purchasing/nfe-inbox/${id}`),
      apiFetch(`/api/purchasing/nfe-inbox/${id}/events`),
    ]);
    if (res.ok) setNfe(await res.json());
    if (evRes.ok) setEventos(await evRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-baixa o XML completo quando a NF-e não tem itens (resNFe) — silencioso, não mostra erro
  useEffect(() => {
    if (nfe && nfe.items.length === 0 && !loading && !autoDownloadDone.current) {
      autoDownloadDone.current = true;
      apiFetch(`/api/purchasing/nfe-inbox/${id}/download-xml`, { method: 'POST' })
        .then(async (res) => { if (res.ok) await load(); })
        .catch(() => { /* silencioso — usuário pode tentar manualmente */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfe?.id, loading]);

  // Auto-open drawer when returning from product creation page
  useEffect(() => {
    const nfeItemId = searchParamsObj.get('mapear');
    const productId = searchParamsObj.get('produto');
    const productCode = searchParamsObj.get('produtoCode');
    const productDesc = searchParamsObj.get('produtoDesc');
    if (!nfeItemId || !nfe) return;
    const item = nfe.items.find(i => i.id === nfeItemId);
    if (!item || item.mapeado) return;
    openMapDrawer(item);
    setMapTab('vincular');
    if (productId && productCode) {
      setSelectedProd({ id: productId, code: productCode, description: productDesc || '', unit: item.unidade });
      setSaveLink(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfe]);

  const doManifest = async (manifestacao: string, justificativa?: string) => {
    setShowManifestMenu(false);
    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestacao, justificativa }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      const data = await res.json();
      const sefaz = data?.sefaz as { cStat: string; xMotivo: string; dhRegEvento?: string; nProt?: string; enviado: boolean } | undefined;
      if (sefaz && !sefaz.enviado) {
        setSuccess(`Manifestação registrada localmente. SEFAZ: ${sefaz.xMotivo} (cStat ${sefaz.cStat})`);
      } else if (sefaz?.enviado) {
        const proto = sefaz.nProt ? ` — Protocolo: ${sefaz.nProt}` : '';
        setSuccess(`Manifestação enviada ao SEFAZ com sucesso${proto}.`);
      } else {
        setSuccess('Manifestação registrada com sucesso.');
      }
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

  const doDownloadXml = async () => {
    setDownloadingXml(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/download-xml`, { method: 'POST' });
      const r = await res.json();
      if (!res.ok) throw new Error(r.message ?? 'Erro ao buscar XML');
      setSuccess(r.message);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setDownloadingXml(false);
    }
  };

  const openDanfe = () => {
    apiFetch(`/api/purchasing/nfe-inbox/${id}/danfe`).then(async (res) => {
      if (!res.ok) { setError('Erro ao gerar DANFE'); return; }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    }).catch(() => setError('Erro ao gerar DANFE'));
  };

  const doRecepcionar = async (purchaseOrderId?: string, obs?: string) => {
    setActionLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/recepcionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId, observacoes: obs }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      setShowRecepcionar(false);
      setSuccess('Mercadoria recepcionada! Estoque atualizado. Próxima etapa: Lançar no Financeiro.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally { setActionLoading(false); }
  };

  const doLancarFinanceiro = async (dataVencimento: string, parcelas: number, obs?: string) => {
    setActionLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/lancar-financeiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataVencimento, parcelas, observacoes: obs }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      setShowLancarFinanceiro(false);
      setSuccess(`${parcelas} título(s) lançado(s) no Contas a Pagar. Próxima etapa: Escriturar.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally { setActionLoading(false); }
  };

  const doEscriturar = async () => {
    setActionLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/escriturar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro');
      setShowEscriturar(false);
      setSuccess('NF-e escriturada e FINALIZADA! Créditos fiscais e lançamento contábil registrados.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally { setActionLoading(false); }
  };

  const openMapDrawer = (item: NFeInboxItem) => {
    setMapDrawer({ open: true, item });
    setMapTab('vincular');
    setProdSearch('');
    setProdResults([]);
    setSelectedProd(null);
    setSaveLink(true);
    setNcmDivAStatus('');
    setNcmDivAObs('');
    setNewProdCode('');
    setNewProdDesc('');
    setNewProdUnit(item.unidade || '');
    setNewProdNcm('');
    setNcmDivBStatus('');
    setNcmDivBObs('');
    setMapError('');
  };

  const closeMapDrawer = () => setMapDrawer({ open: false, item: null });

  const searchProducts = async (q: string) => {
    if (!q.trim()) { setProdResults([]); return; }
    setProdSearching(true);
    try {
      const userObj = JSON.parse(localStorage.getItem('user') ?? '{}');
      const companyId = userObj?.company?.id ?? userObj?.companyId ?? '';
      const res = await apiFetch(`/api/products?companyId=${companyId}&search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setProdResults(data.data ?? data ?? []);
      }
    } finally { setProdSearching(false); }
  };

  const ncmDiverge = (ncmNota?: string, ncmProd?: string) => {
    if (!ncmNota || !ncmProd) return false;
    return ncmNota.replace(/\D/g, '') !== ncmProd.replace(/\D/g, '');
  };

  const handleLinkProduct = async () => {
    if (!selectedProd || !mapDrawer.item) return;
    setMapping(true);
    setMapError('');
    try {
      const diverge = ncmDiverge(mapDrawer.item.ncm, selectedProd.ncmCode);
      if (diverge && !ncmDivAStatus) {
        setMapError('Identifique a origem da divergência de NCM antes de continuar.');
        return;
      }
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/link-item`, {
        method: 'POST',
        body: JSON.stringify({
          inboxItemId: mapDrawer.item.id,
          productId: selectedProd.id,
          saveLink,
          ncmDivergenciaStatus: diverge ? ncmDivAStatus : undefined,
          ncmDivergenciaObs: diverge && ncmDivAObs ? ncmDivAObs : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erro ao vincular');
      await load();
      closeMapDrawer();
    } catch (e: any) {
      setMapError(e.message);
    } finally { setMapping(false); }
  };

  const handleCreateAndLink = async () => {
    if (!mapDrawer.item || !newProdCode || !newProdDesc || !newProdUnit) {
      setMapError('Preencha código, descrição e unidade.');
      return;
    }
    setMapping(true);
    setMapError('');
    try {
      const diverge = ncmDiverge(mapDrawer.item.ncm, newProdNcm);
      if (diverge && !ncmDivBStatus) {
        setMapError('Identifique a origem da divergência de NCM antes de continuar.');
        return;
      }
      const res = await apiFetch(`/api/purchasing/nfe-inbox/${id}/create-and-link`, {
        method: 'POST',
        body: JSON.stringify({
          inboxItemId: mapDrawer.item.id,
          code: newProdCode,
          description: newProdDesc,
          unit: newProdUnit,
          ncmCode: newProdNcm || undefined,
          ncmDivergenciaStatus: diverge ? ncmDivBStatus : undefined,
          ncmDivergenciaObs: diverge && ncmDivBObs ? ncmDivBObs : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erro ao criar produto');
      await load();
      closeMapDrawer();
    } catch (e: any) {
      setMapError(e.message);
    } finally { setMapping(false); }
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
  const isActive   = !['FINALIZADA','LANCADA','CANCELADA','REJEITADA','DEVOLVIDA'].includes(nfe.status);
  const canManifest = isActive;
  const totalIcms   = nfe.items.reduce((s, i) => s + Number(i.valorIcms), 0);
  const totalPis    = nfe.items.reduce((s, i) => s + Number(i.valorPis), 0);
  const totalCofins = nfe.items.reduce((s, i) => s + Number(i.valorCofins), 0);
  const totalIpi    = nfe.items.reduce((s, i) => s + Number(i.valorIpi), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {showRecepcionar && (
        <RecepcionarModal nfe={nfe} onConfirm={doRecepcionar} onClose={() => setShowRecepcionar(false)} loading={actionLoading} />
      )}
      {showLancarFinanceiro && (
        <LancarFinanceiroModal nfe={nfe} onConfirm={doLancarFinanceiro} onClose={() => setShowLancarFinanceiro(false)} loading={actionLoading} />
      )}
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
          {/* DANFE */}
          <button onClick={openDanfe}
            className="inline-flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors">
            <FileText className="w-4 h-4" /> DANFE
          </button>

          {/* Auto-map — disponível enquanto não finalizada */}
          {isActive && (
            <button onClick={doAutoMap} disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg text-sm transition-colors disabled:opacity-50">
              <BadgeCheck className="w-4 h-4" /> Auto-mapear
            </button>
          )}

          {/* Manifestar — disponível enquanto não finalizada */}
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

          {/* Ação principal — muda conforme a etapa */}
          {(nfe.status === 'PENDENTE' || nfe.status === 'MANIFESTADA' || nfe.status === 'VINCULADA') && (
            <button onClick={() => setShowRecepcionar(true)} disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50">
              <Package className="w-4 h-4" /> Recepcionar
            </button>
          )}
          {nfe.status === 'FINANCEIRO' && (
            <button onClick={() => setShowLancarFinanceiro(true)} disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors disabled:opacity-50">
              <DollarSign className="w-4 h-4" /> Lançar no Financeiro
            </button>
          )}
          {nfe.status === 'ESCRITURACAO' && (
            <button onClick={() => setShowEscriturar(true)} disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors disabled:opacity-50">
              <BookOpen className="w-4 h-4" /> Escriturar
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

      {/* Status progress bar */}
      {['PENDENTE','MANIFESTADA','FINANCEIRO','ESCRITURACAO','FINALIZADA'].includes(nfe.status) && (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-4">
          <div className="flex items-center gap-0">
            {[
              { key: 'PENDENTE',     label: '1. Pendente',     color: 'bg-yellow-500' },
              { key: 'MANIFESTADA',  label: '2. Manifestada',  color: 'bg-blue-500' },
              { key: 'FINANCEIRO',   label: '3. Financeiro',   color: 'bg-violet-500' },
              { key: 'ESCRITURACAO', label: '4. Escrituração', color: 'bg-orange-500' },
              { key: 'FINALIZADA',   label: '5. Finalizada',   color: 'bg-emerald-500' },
            ].map((step, i, arr) => {
              const statuses = ['PENDENTE','MANIFESTADA','FINANCEIRO','ESCRITURACAO','FINALIZADA'];
              const currentIdx = statuses.indexOf(nfe.status);
              const stepIdx = statuses.indexOf(step.key);
              const done = stepIdx < currentIdx;
              const active = stepIdx === currentIdx;
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex flex-col items-center gap-1`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white
                      ${done ? 'bg-emerald-500' : active ? step.color : 'bg-slate-200 text-slate-400'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs whitespace-nowrap ${active ? 'font-semibold text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400'}`}>{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Itens */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Itens da NF-e ({nfe.items.length})</h2>
              {nfe.items.length === 0 && (
                <button
                  onClick={doDownloadXml}
                  disabled={downloadingXml}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  <Download className={`w-3.5 h-3.5 ${downloadingXml ? 'animate-spin' : ''}`} />
                  {downloadingXml ? 'Buscando na SEFAZ...' : 'Baixar Itens da SEFAZ'}
                </button>
              )}
            </div>
            {nfe.items.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Itens não disponíveis</p>
                <p className="text-xs text-slate-400 mt-1">
                  Esta NF-e foi importada como resumo (resNFe) pela SEFAZ.<br />
                  Clique em &quot;Baixar Itens da SEFAZ&quot; para buscar o XML completo.
                </p>
              </div>
            ) : (
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
                      <td className="px-3 py-2 text-slate-700">{fmt(Number(item.valorUnitario))}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{fmt(Number(item.valorTotal))}</td>
                      <td className="px-3 py-2 text-emerald-700">{Number(item.valorIcms) > 0 ? fmt(Number(item.valorIcms)) : '—'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{fmt(Number(item.valorPis) + Number(item.valorCofins))}</td>
                      <td className="px-3 py-2">
                        {item.mapeado && item.product ? (
                          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />{item.product.code}
                          </span>
                        ) : (
                          <button
                            onClick={() => openMapDrawer(item)}
                            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 hover:underline"
                          >
                            <AlertCircle className="w-3 h-3" />Não mapeado — mapear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Chave */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Chave de Acesso</h2>
            <p className="font-mono text-sm text-slate-700 break-all bg-slate-50 rounded p-3">{nfe.chaveAcesso}</p>
          </div>

          {/* Eventos DF-e */}
          <div id="eventos" className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Eventos DF-e</h2>
              {eventos.length > 0 && (
                <span className="text-xs font-semibold text-white bg-amber-500 px-2 py-0.5 rounded-full">{eventos.length}</span>
              )}
            </div>
            {eventos.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-400 italic">Nenhum evento registrado para esta NF-e.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Tipo de Evento','Seq.','Data/Hora','NSU','Chave DF-e'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {eventos.map((ev) => {
                      const tpMap: Record<string, { label: string; color: string }> = {
                        '110111': { label: 'Cancelamento',            color: 'bg-red-100 text-red-700' },
                        '110110': { label: 'Carta de Correção (CCe)', color: 'bg-blue-100 text-blue-700' },
                        '210200': { label: 'Confirmação da Operação', color: 'bg-emerald-100 text-emerald-700' },
                        '210210': { label: 'Ciência da Emissão',      color: 'bg-sky-100 text-sky-700' },
                        '210220': { label: 'Desconhecimento',         color: 'bg-orange-100 text-orange-700' },
                        '210240': { label: 'Op. Não Realizada',       color: 'bg-red-100 text-red-700' },
                        '610600': { label: 'Lançamento Contábil',     color: 'bg-slate-100 text-slate-600' },
                      };
                      const cfg = tpMap[ev.tpEvento] ?? { label: ev.xEvento || `Evento ${ev.tpEvento}`, color: 'bg-slate-100 text-slate-600' };
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <p className="text-xs text-slate-400 mt-0.5">{ev.tipoDocumento || 'NFe'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">#{ev.nSeqEvento}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {ev.dhRegistro ? new Date(ev.dhRegistro).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">{ev.nsu || '—'}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-mono text-slate-500 truncate max-w-[180px]" title={ev.chDFe}>{ev.chDFe}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                <dd className="font-mono text-slate-700">{nfe.emitenteCnpj ? fmtCnpj(nfe.emitenteCnpj) : '—'}</dd>
              </div>
              {nfe.emitentePessoaId ? (
                <div className="flex items-center gap-1 text-emerald-700 text-xs">
                  <CheckCircle2 className="w-3 h-3" /> Fornecedor Cadastrado
                </div>
              ) : (
                <Link
                  href={`/crm/pessoas/novo?nome=${encodeURIComponent(nfe.emitenteNome || '')}&cnpj=${nfe.emitenteCnpj || ''}&role=FORNECEDOR`}
                  className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-xs hover:underline"
                >
                  <AlertCircle className="w-3 h-3" /> Não vinculado — cadastre o fornecedor
                </Link>
              )}
            </dl>
          </div>

          {/* Totais */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Totais</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Produtos', value: nfe.items.reduce((s, i) => s + Number(i.valorTotal), 0) },
                { label: 'Frete', value: Number(nfe.valorFrete) },
                { label: 'Seguro', value: Number(nfe.valorSeguro) },
                { label: 'Outras Desp.', value: Number(nfe.valorOutrasDespesas) },
                ...(Number(nfe.valorDesconto) > 0 ? [{ label: 'Desconto', value: -Number(nfe.valorDesconto) }] : []),
              ].map(r => (
                <div key={r.label} className="flex justify-between text-slate-600">
                  <span>{r.label}</span>
                  <span className={r.value < 0 ? 'text-red-600' : ''}>{fmt(Math.abs(r.value))}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold text-slate-900">
                <span>Total NF-e</span><span>{fmt(Number(nfe.valorTotal))}</span>
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

          {/* CT-es de Frete vinculados */}
          {nfe.cteDocuments && nfe.cteDocuments.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">CT-e de Frete</h2>
              </div>
              <div className="space-y-2">
                {nfe.cteDocuments.map(cte => (
                  <Link key={cte.id} href={`/compras/cte/${cte.id}`} className="block border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-mono font-semibold text-blue-600">CT-e {cte.numero}/{cte.serie}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{cte.transportadoraNome || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{cte.valorTotal != null ? fmt(Number(cte.valorTotal)) : '—'}</p>
                        <p className="text-xs text-slate-400">frete: {cte.valorFrete != null ? fmt(Number(cte.valorFrete)) : '—'}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Drawer de Mapeamento de Produto */}
      {mapDrawer.open && mapDrawer.item && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeMapDrawer} />
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Mapear Produto</h2>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{mapDrawer.item.descricaoProduto}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {mapDrawer.item.codigoProdutoFornecedor && (
                    <span className="text-xs text-slate-500">Cód. Forn.: <span className="font-mono font-medium">{mapDrawer.item.codigoProdutoFornecedor}</span></span>
                  )}
                  {mapDrawer.item.ncm && (
                    <span className="text-xs text-slate-500">NCM: <span className="font-mono font-medium">{mapDrawer.item.ncm}</span></span>
                  )}
                </div>
              </div>
              <button onClick={closeMapDrawer} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-5">
              <button
                onClick={() => setMapTab('vincular')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${mapTab === 'vincular' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Link2 className="w-3.5 h-3.5 inline mr-1.5" />Vincular existente
              </button>
              <button
                onClick={() => setMapTab('criar')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${mapTab === 'criar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <PlusCircle className="w-3.5 h-3.5 inline mr-1.5" />Criar produto
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {mapTab === 'vincular' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Buscar produto no catálogo</label>
                    <input
                      type="text"
                      value={prodSearch}
                      onChange={(e) => { setProdSearch(e.target.value); searchProducts(e.target.value); }}
                      placeholder="Código ou descrição..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {prodSearching && <p className="text-xs text-slate-400 animate-pulse">Buscando...</p>}

                  {prodResults.length > 0 && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {prodResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProd(p)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${selectedProd?.id === p.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-medium text-slate-700">{p.code}</span>
                            <span className="text-xs text-slate-400">{p.unit}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{p.description}</p>
                          {p.ncmCode && <span className="text-xs text-slate-400">NCM: {p.ncmCode}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* NCM divergence alert for tab A */}
                  {selectedProd && ncmDiverge(mapDrawer.item.ncm, selectedProd.ncmCode) && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800">Divergência de NCM detectada</p>
                          <p className="text-xs text-amber-700 mt-0.5">NCM da Nota Fiscal: <span className="font-mono font-medium">{mapDrawer.item.ncm}</span></p>
                          <p className="text-xs text-amber-700">NCM do Nosso Cadastro: <span className="font-mono font-medium">{selectedProd.ncmCode}</span></p>
                          <p className="text-xs text-amber-600 mt-1">O departamento fiscal será notificado.</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-amber-800">Origem do erro:</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="ncmDivA" checked={ncmDivAStatus === 'ERRO_INTERNO'} onChange={() => setNcmDivAStatus('ERRO_INTERNO')} className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs text-slate-700">Erro interno — nosso cadastro está incorreto</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="ncmDivA" checked={ncmDivAStatus === 'ERRO_FORNECEDOR'} onChange={() => setNcmDivAStatus('ERRO_FORNECEDOR')} className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs text-slate-700">Erro do fornecedor — NF-e emitida com NCM incorreto</span>
                        </label>
                        <textarea
                          value={ncmDivAObs}
                          onChange={(e) => setNcmDivAObs(e.target.value)}
                          placeholder="Observações (opcional)..."
                          rows={2}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedProd && !ncmDiverge(mapDrawer.item.ncm, selectedProd.ncmCode) && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />NCM compatível com o cadastro interno
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={saveLink} onChange={(e) => setSaveLink(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                    Salvar no catálogo do fornecedor (auto-mapeamento futuro)
                  </label>
                </>
              )}

              {mapTab === 'criar' && (
                <>
                  {/* Reference from NF-e */}
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dados da NF-e para referência</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      <div>
                        <p className="text-xs text-slate-400">Cód. Fornecedor</p>
                        <p className="text-sm font-mono font-medium text-slate-700">{mapDrawer.item.codigoProdutoFornecedor || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Unidade</p>
                        <p className="text-sm font-medium text-slate-700">{mapDrawer.item.unidade || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400">Descrição</p>
                        <p className="text-sm text-slate-700">{mapDrawer.item.descricaoProduto}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">NCM</p>
                        <p className="text-sm font-mono font-medium text-slate-700">{mapDrawer.item.ncm || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Package className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Cadastrar produto no catálogo interno</p>
                        <p className="text-xs text-blue-600 mt-0.5">
                          Você será direcionado para a tela de cadastro de produtos. A descrição, unidade e NCM serão pré-preenchidos com os dados da NF-e. Após salvar, o sistema retornará aqui para confirmar o vínculo automaticamente.
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/estoque/produtos/novo?descricao=${encodeURIComponent(mapDrawer.item.descricaoProduto)}&unidade=${encodeURIComponent(mapDrawer.item.unidade || '')}&ncm=${encodeURIComponent(mapDrawer.item.ncm || '')}&nfeId=${id}&nfeItemId=${mapDrawer.item.id}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Abrir Cadastro de Produtos
                    </a>
                  </div>

                  <p className="text-xs text-slate-400 text-center">
                    O código do produto será gerado conforme o padrão interno de classificação.
                  </p>
                </>
              )}

              {mapError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{mapError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-4 flex items-center justify-end gap-3">
              <button onClick={closeMapDrawer} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              {mapTab === 'vincular' && (
                <button
                  onClick={handleLinkProduct}
                  disabled={!selectedProd || mapping}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {mapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  Vincular produto
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function NFeEntradaDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-slate-300 animate-spin" /></div>}>
      <NFeEntradaDetailPageInner />
    </Suspense>
  );
}
