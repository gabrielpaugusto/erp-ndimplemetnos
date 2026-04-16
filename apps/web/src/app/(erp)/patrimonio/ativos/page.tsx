'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { fmtPercent, fmtCurrency } from '@/lib/format';
import { Plus, Search, Filter } from 'lucide-react';

interface FixedAsset {
  id: string;
  plaqueta: string;
  descricao: string;
  type: string;
  marca: string | null;
  localizacao: string | null;
  costCenterCode: string;
  valorAquisicao: number;
  valorResidual: number;
  valorDepreciacaoAcumulada: number;
  status: 'ATIVO' | 'BAIXADO' | 'EM_MANUTENCAO';
  dataAquisicao: string;
  _count: { depreciacoes: number };
}

interface PaginatedResponse {
  data: FixedAsset[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const TYPE_LABELS: Record<string, string> = {
  MAQUINA_EQUIPAMENTO: 'Máquina/Equipamento',
  VEICULO: 'Veículo',
  MOVEL_UTENSILIO: 'Móvel/Utensílio',
  IMOVEL: 'Imóvel',
  INFORMATICA: 'Informática',
  FERRAMENTA: 'Ferramenta',
  OUTRO: 'Outro',
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  ATIVO: { label: 'Ativo', class: 'bg-green-100 text-green-800' },
  BAIXADO: { label: 'Baixado', class: 'bg-gray-100 text-gray-600' },
  EM_MANUTENCAO: { label: 'Em Manutenção', class: 'bg-yellow-100 text-yellow-800' },
};

const CC_LABELS: Record<string, string> = {
  CC_IND: 'Industrial',
  CC_COM: 'Comercial',
  CC_OFI: 'Oficina',
  CC_ADM: 'Administrativo',
  CC_FI: 'F&I',
};

function formatCurrency(value: number) { return fmtCurrency(value); }

export default function AtivosPage() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ccFilter, setCcFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (ccFilter) params.set('costCenter', ccFilter);
      const res = await apiFetch(`/api/patrimonio?${params}`);
      const result = await (res as any).json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, ccFilter, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ativos Patrimoniais</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.meta.total ?? 0} ativo(s) cadastrado(s)
          </p>
        </div>
        <Link
          href="/patrimonio/ativos/novo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Ativo
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por plaqueta, descrição, marca..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativo</option>
            <option value="EM_MANUTENCAO">Em Manutenção</option>
            <option value="BAIXADO">Baixado</option>
          </select>
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={ccFilter}
            onChange={e => { setCcFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os CC</option>
            {Object.entries(CC_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Plaqueta</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Descrição</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Localização</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Vl. Aquisição</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Vl. Residual</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">% Deprec.</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Nenhum ativo encontrado
                  </td>
                </tr>
              ) : (
                data?.data.map(asset => {
                  const valorAquisicao = Number(asset.valorAquisicao);
                  const valorDeprecAcum = Number(asset.valorDepreciacaoAcumulada);
                  const pct = valorAquisicao > 0 ? (valorDeprecAcum / valorAquisicao) * 100 : 0;
                  const statusInfo = STATUS_LABELS[asset.status] || { label: asset.status, class: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3">
                        <Link href={`/patrimonio/ativos/${asset.id}`} className="font-mono font-medium text-blue-700 hover:underline">
                          {asset.plaqueta}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/patrimonio/ativos/${asset.id}`} className="text-gray-900 hover:text-blue-600">
                          <div className="font-medium">{asset.descricao}</div>
                          {asset.marca && <div className="text-xs text-gray-500">{asset.marca}</div>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[asset.type] || asset.type}</td>
                      <td className="px-4 py-3 text-gray-600">{asset.localizacao || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(valorAquisicao)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(asset.valorResidual))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${pct > 80 ? 'text-red-600' : 'text-gray-600'}`}>
                            {fmtPercent(pct, 0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.class}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              Mostrando {((page - 1) * 20) + 1}–{Math.min(page * 20, data.meta.total)} de {data.meta.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
                disabled={page === data.meta.totalPages}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
