'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Truck, FileCheck, AlertCircle,
  CheckCircle2, XCircle, BookOpen, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const STATUS_LABELS: Record<string, string> = {
  REGISTRADO:  'Registrado',
  MANIFESTADO: 'Manifestado',
  ESCRITURADO: 'Escriturado',
  CANCELADO:   'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  REGISTRADO:  'bg-slate-100 text-slate-600',
  MANIFESTADO: 'bg-blue-100 text-blue-700',
  ESCRITURADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO:   'bg-red-100 text-red-600',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  REGISTRADO:  <Truck className="w-3.5 h-3.5" />,
  MANIFESTADO: <FileCheck className="w-3.5 h-3.5" />,
  ESCRITURADO: <CheckCircle2 className="w-3.5 h-3.5" />,
  CANCELADO:   <XCircle className="w-3.5 h-3.5" />,
};

interface CteDoc {
  id: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  transportadoraNome: string;
  transportadoraCnpj: string;
  modalidade: string;
  cfop: string;
  valorFrete: number;
  valorIcms: number;
  valorTotal: number;
  creditoIcms: boolean;
  status: string;
  custoRateado: boolean;
  purchaseOrder?: { id: string; numero: string } | null;
  nfeInbox?: { id: string; numero: string; emitenteNome: string } | null;
}

interface Stats {
  byStatus: { status: string; count: number; valorTotal: number }[];
  totais: {
    count: number;
    totalFrete: number;
    totalIcms: number;
    totalGeral: number;
    creditoIcmsRecuperavel: number;
  };
}

export default function CtePage() {
  const [ctes, setCtes]         = useState<CteDoc[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    const [listRes, statsRes] = await Promise.all([
      apiFetch(`/api/purchasing/cte?${params}`),
      apiFetch('/api/purchasing/cte/stats'),
    ]);

    if (listRes.ok) {
      const data = await listRes.json();
      setCtes(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
    }
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CT-e Recebidos</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Conhecimentos de Transporte Eletrônico — fretes contratados
          </p>
        </div>
        <Link
          href="/compras/cte/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar CT-e
        </Link>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total CT-e</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totais.count}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total Fretes</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.totais.totalFrete)}</p>
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 p-4">
            <p className="text-xs text-emerald-600">Crédito ICMS Recuperável</p>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(stats.totais.creditoIcmsRecuperavel)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total Geral</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.totais.totalGeral)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, transportadora..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Carregando CT-e...</p>
          </div>
        ) : ctes.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum CT-e encontrado</p>
            <p className="text-slate-400 text-sm mt-1">Registre os CT-e de frete recebidos das transportadoras</p>
            <Link
              href="/compras/cte/novo"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />Registrar primeiro CT-e
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Número', 'Transportadora', 'Emissão', 'Modal', 'CFOP', 'Vl. Frete', 'ICMS', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ctes.map((cte) => (
                  <tr key={cte.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-900 text-sm">{cte.numero}-{cte.serie}</div>
                      {cte.nfeInbox && (
                        <div className="text-xs text-slate-400">NF-e: {cte.nfeInbox.emitenteNome}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{cte.transportadoraNome}</div>
                      <div className="text-xs text-slate-400 font-mono">{cte.transportadoraCnpj}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(cte.dataEmissao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        {cte.modalidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{cte.cfop}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(cte.valorFrete)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-emerald-700">{formatCurrency(cte.valorIcms)}</div>
                      {cte.creditoIcms && (
                        <div className="text-xs text-emerald-500">Crédito</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cte.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_ICONS[cte.status]}
                        {STATUS_LABELS[cte.status] ?? cte.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/compras/cte/${cte.id}`}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                      >
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-sm text-slate-500">{total} registros</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-white disabled:opacity-40"
                  >Anterior</button>
                  <span className="px-3 py-1 text-sm text-slate-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-white disabled:opacity-40"
                  >Próxima</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Como funciona o CT-e de Frete</p>
          <p>Ao <strong>Escriturar</strong> um CT-e, o sistema automaticamente: (1) lança o crédito de ICMS sobre o frete no livro fiscal, (2) gera o título no Contas a Pagar para a transportadora, (3) rateia o custo do frete proporcionalmente nos itens da NF-e vinculada, e (4) gera o lançamento contábil.</p>
        </div>
      </div>
    </div>
  );
}
