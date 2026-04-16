'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function CsosnPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      const res = await apiFetch(`/api/ref-tables/csosn?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
        setTotal(json.meta?.total ?? (json.data ?? json).length);
      }
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CSOSN</h1>
          <p className="text-slate-500 text-sm mt-0.5">Código de Situação de Operação no Simples Nacional</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-700">
          Aplicável exclusivamente a empresas optantes pelo Simples Nacional
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-600 w-20">Código</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Descrição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={2} className="px-4 py-3">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-slate-400 text-sm">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : data.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold text-slate-800">{item.code}</td>
                <td className="px-4 py-3 text-slate-600">{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-400">
          {total} registros
        </div>
      </div>
    </div>
  );
}
