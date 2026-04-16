'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function IcmsInterestadualPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ufOrigem, setUfOrigem] = useState('');
  const [ufDestino, setUfDestino] = useState('');
  const [tipo, setTipo] = useState('NORMAL');
  const [page, setPage] = useState(1);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (ufOrigem) params.set('ufOrigem', ufOrigem.toUpperCase());
      if (ufDestino) params.set('ufDestino', ufDestino.toUpperCase());
      if (tipo) params.set('tipo', tipo);
      const res = await apiFetch(`/api/ref-tables/icms-interestadual?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
        setTotal(json.meta?.total ?? (json.data ?? json).length);
      }
    } catch {} finally { setLoading(false); }
  }, [page, ufOrigem, ufDestino, tipo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [ufOrigem, ufDestino, tipo]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ICMS Interestadual</h1>
          <p className="text-slate-500 text-sm mt-0.5">Alíquotas de ICMS aplicáveis em operações entre estados</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="UF Origem (ex: SP)"
            value={ufOrigem}
            onChange={e => setUfOrigem(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            className="w-36 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
          />
          <input
            type="text"
            placeholder="UF Destino (ex: MG)"
            value={ufDestino}
            onChange={e => setUfDestino(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            className="w-36 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
          />
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos os tipos</option>
            <option value="NORMAL">Normal</option>
            <option value="IMPORTADO">Importado</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-600 w-32">UF Origem</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 w-32">UF Destino</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 w-32">Alíquota</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 w-32">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : data.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold text-slate-800">{item.ufOrigem}</td>
                <td className="px-4 py-3 font-mono font-semibold text-slate-800">{item.ufDestino}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-900">{Number(item.aliquota).toFixed(0)}%</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    item.tipo === 'IMPORTADO' ? 'bg-orange-50 text-orange-700' : 'bg-teal-50 text-teal-700'
                  }`}>
                    {item.tipo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
            <span>{total} registros</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:bg-slate-100 rounded disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 hover:bg-slate-100 rounded disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
