'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, RefreshCw, ChevronLeft, ChevronRight, Tag, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function NcmPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const res = await apiFetch(`/api/fiscal/ncm?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
        setTotal(json.meta?.total ?? (json.data ?? json).length);
      }
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Tag className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">NCM</h1>
            <p className="text-slate-500 text-sm mt-0.5">Nomenclatura Comum do Mercosul — classificação fiscal de produtos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/fiscal/indices/ncm/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Novo NCM
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar por código ou descrição..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Código NCM</th>
              <th className="px-4 py-3 font-medium text-slate-600">Descrição</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">IPI %</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">CST ICMS</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">CSOSN</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">PIS%/COF%</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">ST</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">CBS%</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">IBS%</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">IS</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center">Ativo</th>
              <th className="px-4 py-3 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={12} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" /></td></tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">Nenhum NCM encontrado</td></tr>
            ) : data.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-blue-600 whitespace-nowrap">{item.code}</td>
                <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={item.description}>{item.description}</td>
                <td className="px-4 py-3 text-center text-slate-600">{item.aliquotaIpi != null ? `${Number(item.aliquotaIpi).toFixed(2)}%` : '—'}</td>
                <td className="px-4 py-3 text-center">
                  {item.cstIcms ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-semibold">{item.cstIcms}</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.csosn ? <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-mono font-semibold">{item.csosn}</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">
                  {item.aliquotaPis != null ? `${Number(item.aliquotaPis).toFixed(2)} / ${Number(item.aliquotaCofins).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.temSt ? <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-semibold">ST</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{item.aliquotaCbs != null ? `${Number(item.aliquotaCbs).toFixed(2)}%` : '—'}</td>
                <td className="px-4 py-3 text-center text-slate-600">{item.aliquotaIbs != null ? `${Number(item.aliquotaIbs).toFixed(2)}%` : '—'}</td>
                <td className="px-4 py-3 text-center">
                  {item.temIs ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold">IS</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.active ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/fiscal/indices/ncm/${item.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
            <span>{total} NCMs cadastrados</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <span>Pág. {page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
