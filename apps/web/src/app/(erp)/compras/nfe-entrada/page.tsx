'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Inbox, RefreshCw, Search, Eye, FileCheck, LogIn,
  Calendar, AlertCircle, CheckCircle2, XCircle, Clock, FileText, Bell,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency as fmt } from '@/lib/format';

const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDENTE:     { label: 'Pendente',     color: 'bg-yellow-100 text-yellow-700',  icon: <Clock className="w-3 h-3" /> },
  MANIFESTADA:  { label: 'Manifestada',  color: 'bg-blue-100 text-blue-700',      icon: <FileCheck className="w-3 h-3" /> },
  FINANCEIRO:   { label: 'Financeiro',   color: 'bg-violet-100 text-violet-700',  icon: <AlertCircle className="w-3 h-3" /> },
  ESCRITURACAO: { label: 'Escrituração', color: 'bg-orange-100 text-orange-700',  icon: <AlertCircle className="w-3 h-3" /> },
  FINALIZADA:   { label: 'Finalizada',   color: 'bg-emerald-100 text-emerald-700',icon: <CheckCircle2 className="w-3 h-3" /> },
  LANCADA:      { label: 'Lançada',      color: 'bg-emerald-100 text-emerald-700',icon: <CheckCircle2 className="w-3 h-3" /> },
  VINCULADA:    { label: 'Vinculada',    color: 'bg-purple-100 text-purple-700',  icon: <AlertCircle className="w-3 h-3" /> },
  REJEITADA:    { label: 'Rejeitada',    color: 'bg-red-100 text-red-700',        icon: <XCircle className="w-3 h-3" /> },
  DEVOLVIDA:    { label: 'Devolvida',    color: 'bg-orange-100 text-orange-700',  icon: <XCircle className="w-3 h-3" /> },
  CANCELADA:    { label: 'Cancelada',    color: 'bg-gray-100 text-gray-600',      icon: <XCircle className="w-3 h-3" /> },
};

interface NFeInbox {
  id: string;
  numero: string;
  serie: string;
  chaveAcesso: string;
  emitenteCnpj: string;
  emitenteNome: string;
  dataEmissao: string;
  valorTotal: number;
  valorFrete: number;
  status: string;
  manifestacao?: string;
  eventosCount?: number;
  _count?: { items: number };
  purchaseOrder?: { id: string; numero: string } | null;
  cteDocuments?: { id: string; numero: string; serie: string; transportadoraNome: string; valorFrete: number | null }[];
}

interface Stats {
  byStatus: { status: string; count: number; valorTotal: number | null }[];
  total: number;
}

const TABS = ['TODAS','PENDENTE','MANIFESTADA','FINANCEIRO','ESCRITURACAO','FINALIZADA','REJEITADA','CANCELADA'];

interface SyncStatus {
  ultimaSincronizacao: string | null;
  bloqueado: boolean;
  bloqueadoAte: string | null;
  segundosRestantes: number;
  totalDocsUltima: number;
  origemBloqueio: 'ERP' | 'EXTERNO' | null;
}

export default function NFeEntradaPage() {
  const [data, setData]     = useState<NFeInbox[]>([]);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; type: 'success' | 'info' | 'warn' | 'error' } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tab, setTab]         = useState('TODAS');
  const [search, setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const startCountdown = useCallback((seconds: number, onExpire?: () => void) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(seconds);
    if (seconds <= 0) return;
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/purchasing/nfe-inbox/sync-status');
      if (res.ok) {
        const status: SyncStatus = await res.json();
        setSyncStatus(status);
        if (status.bloqueado && status.segundosRestantes > 0) {
          startCountdown(status.segundosRestantes, fetchSyncStatus);
        } else if (!status.bloqueado) {
          setSyncStatus(status);
        }
      }
    } catch {
      // silently ignore
    }
  }, [startCountdown]);

  const load = useCallback(async () => {
    setLoading(true);
    const statsRes = await apiFetch('/api/purchasing/nfe-inbox/stats');
    if (statsRes.ok) setStats(await statsRes.json());

    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (tab !== 'TODAS') params.set('status', tab);
    if (search) params.set('search', search);
    if (dateFrom) params.set('startDate', dateFrom);
    if (dateTo) params.set('endDate', dateTo);
    const listRes = await apiFetch(`/api/purchasing/nfe-inbox?${params}`);
    if (listRes.ok) {
      const json = await listRes.json();
      setData(json.data ?? []);
      setTotalPages(json.meta?.totalPages ?? 1);
    }
    setLoading(false);
  }, [tab, search, dateFrom, dateTo, page]);

  useEffect(() => { setPage(1); }, [tab, search, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchSyncStatus();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [fetchSyncStatus]);

  const handleSync = async () => {
    if (syncStatus?.bloqueado) {
      const mins = Math.floor(countdown / 60);
      const secs = String(countdown % 60).padStart(2, '0');
      setSyncMsg({ text: `⚠️ Aguarde. Próxima sincronização em ${mins}:${secs}.`, type: 'warn' });
      return;
    }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await apiFetch('/api/purchasing/nfe-inbox/sync', { method: 'POST' });
      const json = await res.json();
      if (json.rateLimited) {
        setSyncMsg({ text: json.message, type: 'warn' });
        await fetchSyncStatus();
      } else if (res.ok) {
        setSyncMsg({ text: json.message, type: (json.nfe ?? json.found ?? 0) > 0 ? 'success' : 'info' });
        await fetchSyncStatus();
        await load();
      } else {
        setSyncMsg({ text: json.message ?? 'Erro na sincronização', type: 'error' });
      }
    } catch {
      setSyncMsg({ text: 'Erro ao conectar com o servidor', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleFixStatuses = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
        apiFetch('/api/purchasing/nfe-inbox/fix-manifested',     { method: 'POST' }),
        apiFetch('/api/purchasing/nfe-inbox/fix-cancelled',      { method: 'POST' }),
        apiFetch('/api/purchasing/nfe-inbox/fix-cte-links',      { method: 'POST' }),
        apiFetch('/api/purchasing/nfe-inbox/fix-numbers',        { method: 'POST' }),
        apiFetch('/api/purchasing/nfe-inbox/fix-ciencia',        { method: 'POST' }),
        apiFetch('/api/purchasing/nfe-inbox/fix-resnfe',         { method: 'POST' }),
        apiFetch('/api/purchasing/nfe-inbox/fix-emitente-links', { method: 'POST' }),
      ]);
      const [j1, j2, j3, j4, j5, j6, j7] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json(), r5.json(), r6.json(), r7.json()]);
      const totalStatus = (j1.updated ?? 0) + (j2.updated ?? 0);
      const totalCte = j3.linked ?? 0;
      const totalNumbers = j4.updated ?? 0;
      const totalCiencia = j5.enviadas ?? 0;
      const totalXmls = j6.downloaded ?? 0;
      const totalVinculos = j7.linked ?? 0;
      const parts: string[] = [];
      if (totalStatus > 0) parts.push(`${totalStatus} status corrigido(s)`);
      if (totalCte > 0) parts.push(`${totalCte} CT-e(s) vinculado(s)`);
      if (totalNumbers > 0) parts.push(`${totalNumbers} número(s) preenchido(s)`);
      if (totalCiencia > 0) parts.push(`${totalCiencia} Ciência(s) reenviada(s)`);
      if (totalXmls > 0) parts.push(`${totalXmls} XML(s) completo(s) baixado(s)`);
      if (totalVinculos > 0) parts.push(`${totalVinculos} fornecedor(es) vinculado(s)`);
      setSyncMsg({ text: parts.length > 0 ? parts.join(', ') + '.' : 'Nenhuma correção necessária.', type: parts.length > 0 ? 'success' : 'info' });
      await load();
    } catch {
      setSyncMsg({ text: 'Erro ao corrigir status', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const openDanfe = (id: string) => {
    apiFetch(`/api/purchasing/nfe-inbox/${id}/danfe`).then(async (res) => {
      if (!res.ok) { alert('Erro ao gerar DANFE'); return; }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    }).catch(() => alert('Erro ao gerar DANFE'));
  };

  const countFor = (s: string) => {
    if (!stats) return 0;
    if (s === 'TODAS') return stats.total;
    return stats.byStatus.find(b => b.status === s)?.count ?? 0;
  };

  const STATUSES_ENCERRADOS = ['FINALIZADA', 'LANCADA', 'REJEITADA', 'DEVOLVIDA', 'CANCELADA'];
  const totalPendente = stats?.byStatus
    .filter(b => !STATUSES_ENCERRADOS.includes(b.status))
    .reduce((sum, b) => sum + (b.valorTotal ?? 0), 0) ?? 0;

  const totalLancada = stats?.byStatus
    .filter(b => b.status === 'FINALIZADA' || b.status === 'LANCADA')
    .reduce((sum, b) => sum + (b.valorTotal ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NF-e de Entrada</h1>
          <p className="text-slate-500 text-sm mt-0.5">Notas fiscais recebidas via SEFAZ</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleFixStatuses}
              disabled={syncing}
              title="Corrige o status das NF-es com base nos eventos já recebidos (manifestação, cancelamento)"
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              Corrigir Status
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || (syncStatus?.bloqueado ?? false)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${syncStatus?.bloqueado ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing
                ? 'Processando...'
                : syncStatus?.bloqueado
                ? `Aguarde ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`
                : 'Sincronizar SEFAZ'}
            </button>
          </div>
          {syncStatus && (
            <div className="text-xs text-gray-500">
              {syncStatus.ultimaSincronizacao && (
                <p>Última sync: {new Date(syncStatus.ultimaSincronizacao).toLocaleString('pt-BR')}</p>
              )}
              {syncStatus.bloqueado && syncStatus.origemBloqueio === 'EXTERNO' && (
                <p className="text-amber-600 font-medium">⚠️ Cota consumida por sistema externo</p>
              )}
            </div>
          )}
        </div>
      </div>

      {syncMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${
          syncMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          syncMsg.type === 'warn'    ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
          syncMsg.type === 'error'   ? 'bg-red-50 border-red-200 text-red-700' :
                                       'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {syncMsg.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total NF-e</p>
          <p className="text-2xl font-bold text-slate-900">{stats?.total ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <p className="text-xs text-yellow-600">Em Processamento</p>
          <p className="text-2xl font-bold text-yellow-700">{countFor('PENDENTE') + countFor('MANIFESTADA') + countFor('FINANCEIRO') + countFor('ESCRITURACAO')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Vl. Pendente</p>
          <p className="text-lg font-bold text-slate-900">{fmt(totalPendente)}</p>
        </div>
        <div className="bg-white rounded-lg border border-emerald-200 p-4">
          <p className="text-xs text-emerald-600">Finalizadas</p>
          <p className="text-lg font-bold text-emerald-700">{fmt(totalLancada)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'TODAS' ? 'Todas' : STATUS_CFG[t]?.label ?? t}
              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-bold ${
                tab === t ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {countFor(t)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número, CNPJ, emitente ou chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <span className="text-slate-400 text-sm">até</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Carregando NF-es...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma NF-e encontrada</p>
            <p className="text-slate-400 text-sm mt-1">Clique em "Sincronizar SEFAZ" para buscar novas notas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['NF-e','Emitente','Emissão','Valor Total','Frete','Status','Eventos','Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(nfe => {
                  const sc = STATUS_CFG[nfe.status] ?? { label: nfe.status, color: 'bg-slate-100 text-slate-600', icon: null };
                  const canEntrada = nfe.status === 'MANIFESTADA' || nfe.status === 'PENDENTE';
                  const evCount = nfe.eventosCount ?? 0;
                  return (
                    <tr key={nfe.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono font-semibold text-slate-900">{nfe.numero ? String(parseInt(nfe.numero, 10) || nfe.numero) : '—'}/{nfe.serie || '—'}</p>
                        <p className="text-xs text-slate-400 font-mono">{nfe.chaveAcesso.slice(0,20)}…</p>
                        {nfe.purchaseOrder && (
                          <Link href={`/compras/pedidos/${nfe.purchaseOrder.id}`} className="text-xs text-amber-600 hover:underline">
                            {nfe.purchaseOrder.numero}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{nfe.emitenteNome}</p>
                        <p className="text-xs text-slate-400 font-mono">{nfe.emitenteCnpj}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtDate(nfe.dataEmissao)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{fmt(nfe.valorTotal)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {nfe.cteDocuments && nfe.cteDocuments.length > 0 ? (
                          nfe.cteDocuments.map(cte => (
                            <Link key={cte.id} href={`/compras/cte/${cte.id}`} className="block text-blue-600 hover:underline font-mono text-xs">
                              CT-e {cte.numero}/{cte.serie}
                            </Link>
                          ))
                        ) : nfe.valorFrete > 0 ? fmt(nfe.valorFrete) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          {sc.icon}{sc.label}
                        </span>
                      </td>
                      {/* Coluna Eventos */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/compras/nfe-entrada/${nfe.id}#eventos`}
                          title={`${evCount} evento(s) registrado(s)`}
                          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-amber-600 transition-colors"
                        >
                          <Bell className="w-4 h-4" />
                          {evCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                              {evCount}
                            </span>
                          )}
                        </Link>
                      </td>
                      {/* Coluna Ações — apenas ícones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/compras/nfe-entrada/${nfe.id}`}
                            title="Detalhes"
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => openDanfe(nfe.id)}
                            title="Visualizar DANFE"
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {canEntrada && (
                            <Link
                              href={`/compras/nfe-entrada/${nfe.id}`}
                              title="Dar Entrada"
                              className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors"
                            >
                              <LogIn className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 text-sm">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">Anterior</button>
          <span className="text-slate-500">Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">Próxima</button>
        </div>
      )}
    </div>
  );
}
