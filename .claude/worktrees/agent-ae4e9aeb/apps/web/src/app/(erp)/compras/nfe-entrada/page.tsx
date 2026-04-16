'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Inbox, RefreshCw, Search, Eye, FileCheck, LogIn,
  Calendar, AlertCircle, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDENTE:   { label: 'Pendente',   color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
  MANIFESTADA:{ label: 'Manifestada',color: 'bg-blue-100 text-blue-700',    icon: <FileCheck className="w-3 h-3" /> },
  VINCULADA:  { label: 'Vinculada',  color: 'bg-purple-100 text-purple-700',icon: <AlertCircle className="w-3 h-3" /> },
  LANCADA:    { label: 'Lançada',    color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  REJEITADA:  { label: 'Rejeitada',  color: 'bg-red-100 text-red-700',      icon: <XCircle className="w-3 h-3" /> },
  DEVOLVIDA:  { label: 'Devolvida',  color: 'bg-orange-100 text-orange-700',icon: <XCircle className="w-3 h-3" /> },
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
  _count?: { items: number };
  purchaseOrder?: { id: string; numero: string } | null;
}

interface Stats {
  byStatus: { status: string; count: number; valorTotal: number | null }[];
  total: number;
}

const TABS = ['TODAS','PENDENTE','MANIFESTADA','VINCULADA','LANCADA','REJEITADA'];

export default function NFeEntradaPage() {
  const [data, setData]     = useState<NFeInbox[]>([]);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab]         = useState('TODAS');
  const [search, setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (tab !== 'TODAS') params.set('status', tab);
    if (search) params.set('search', search);
    if (dateFrom) params.set('startDate', dateFrom);
    if (dateTo) params.set('endDate', dateTo);

    const [listRes, statsRes] = await Promise.all([
      apiFetch(`/api/purchasing/nfe-inbox?${params}`),
      apiFetch('/api/purchasing/nfe-inbox/stats'),
    ]);

    if (listRes.ok) {
      const json = await listRes.json();
      setData(json.data ?? []);
      setTotalPages(json.meta?.totalPages ?? 1);
    }
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }, [tab, search, dateFrom, dateTo, page]);

  useEffect(() => { setPage(1); }, [tab, search, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    await apiFetch('/api/purchasing/nfe-inbox/sync', { method: 'POST' });
    await load();
    setSyncing(false);
  };

  const countFor = (s: string) => {
    if (!stats) return 0;
    if (s === 'TODAS') return stats.total;
    return stats.byStatus.find(b => b.status === s)?.count ?? 0;
  };

  const totalPendente = stats?.byStatus
    .filter(b => b.status !== 'LANCADA' && b.status !== 'REJEITADA' && b.status !== 'DEVOLVIDA')
    .reduce((sum, b) => sum + (b.valorTotal ?? 0), 0) ?? 0;

  const totalLancada = stats?.byStatus
    .find(b => b.status === 'LANCADA')?.valorTotal ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NF-e de Entrada</h1>
          <p className="text-slate-500 text-sm mt-0.5">Notas fiscais recebidas via SEFAZ</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar SEFAZ'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total NF-e</p>
          <p className="text-2xl font-bold text-slate-900">{stats?.total ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <p className="text-xs text-yellow-600">Pendentes de Lançamento</p>
          <p className="text-2xl font-bold text-yellow-700">{countFor('PENDENTE') + countFor('MANIFESTADA')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Vl. Pendente</p>
          <p className="text-lg font-bold text-slate-900">{fmt(totalPendente)}</p>
        </div>
        <div className="bg-white rounded-lg border border-emerald-200 p-4">
          <p className="text-xs text-emerald-600">Lançadas</p>
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
              {STATUS_CFG[t]?.label ?? t}
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
                  {['NF-e','Emitente','Emissão','Valor Total','Frete','Status','Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(nfe => {
                  const sc = STATUS_CFG[nfe.status] ?? { label: nfe.status, color: 'bg-slate-100 text-slate-600', icon: null };
                  const canEntrada = nfe.status === 'MANIFESTADA' || nfe.status === 'PENDENTE';
                  return (
                    <tr key={nfe.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono font-semibold text-slate-900">{nfe.numero}/{nfe.serie}</p>
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
                      <td className="px-4 py-3 text-sm text-slate-700">{nfe.valorFrete > 0 ? fmt(nfe.valorFrete) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          {sc.icon}{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/compras/nfe-entrada/${nfe.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors">
                            <Eye className="w-3.5 h-3.5" /> Detalhes
                          </Link>
                          {canEntrada && (
                            <Link href={`/compras/nfe-entrada/${nfe.id}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors">
                              <LogIn className="w-3.5 h-3.5" /> Dar Entrada
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
