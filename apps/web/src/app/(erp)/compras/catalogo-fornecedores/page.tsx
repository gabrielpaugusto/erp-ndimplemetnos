'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProductSupplierRow {
  id: string;
  codigoFornecedor: string;
  descricaoFornecedor: string;
  ncmFornecedor: string | null;
  person: {
    id: string;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    cpfCnpj: string | null;
  } | null;
  product: {
    id: string;
    code: string;
    description: string;
    unit: string;
  } | null;
}

interface ApiResponse {
  data: ProductSupplierRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCnpj(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }
  return raw;
}

function supplierName(row: ProductSupplierRow): string {
  return row.person?.razaoSocial || row.person?.nomeFantasia || '—';
}

// ─── NCM Status Badge ────────────────────────────────────────────────────────

// We can only compare ncmFornecedor vs the product's NCM.
// The product select from the service does not include ncm relation —
// we show "—" for NCM Cadastro and skip the status badge in that case.
// If ncmFornecedor is available and ncmCadastro is available, compare them.
// For now, ncmCadastro is not returned by the API — we surface it as "N/A"
// and simply display the supplier NCM column.

function NcmBadge({
  ncmFornecedor,
  ncmCadastro,
}: {
  ncmFornecedor: string | null | undefined;
  ncmCadastro: string | null | undefined;
}) {
  // Both absent or one absent → consider OK (no divergence to flag)
  if (!ncmFornecedor || !ncmCadastro) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        —
      </span>
    );
  }

  const match =
    ncmFornecedor.replace(/\D/g, '') === ncmCadastro.replace(/\D/g, '');

  if (match) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        OK
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <AlertTriangle className="w-3 h-3" />
      Diverge
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function CatalogoFornecedoresPage() {
  const [rows, setRows] = useState<ProductSupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await apiFetch(
        `/api/purchasing/product-suppliers?${params}`,
      );
      if (!res.ok) throw new Error('Erro ao carregar catálogo');
      const json: ApiResponse = await res.json();
      setRows(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Catálogo de Fornecedores
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Mapeamento entre produtos do fornecedor e nosso catálogo interno
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por fornecedor, CNPJ ou código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Summary bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Building2 className="w-4 h-4 text-slate-400" />
            {loading ? (
              'Carregando...'
            ) : (
              <>
                <span className="font-medium text-slate-700">{total}</span>{' '}
                vínculo(s) encontrado(s)
                {debouncedSearch && (
                  <span className="text-slate-400">
                    {' '}
                    para &ldquo;{debouncedSearch}&rdquo;
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Fornecedor
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Cód. Fornecedor
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Descrição Fornecedor
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  NCM Fornecedor
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Nosso Código
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Nossa Descrição
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  NCM Cadastro
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Status NCM
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-400 text-sm"
                  >
                    Carregando...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-400 text-sm"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="w-8 h-8 text-slate-300" />
                      <p>Nenhum mapeamento encontrado.</p>
                      {debouncedSearch && (
                        <button
                          onClick={() => setSearch('')}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Limpar busca
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {/* Fornecedor */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 leading-snug">
                        {supplierName(row)}
                      </p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {formatCnpj(row.person?.cpfCnpj)}
                      </p>
                    </td>

                    {/* Cód. Fornecedor */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {row.codigoFornecedor || '—'}
                    </td>

                    {/* Descrição Fornecedor */}
                    <td className="px-4 py-3 text-slate-700 max-w-[220px]">
                      <span className="line-clamp-2">
                        {row.descricaoFornecedor || '—'}
                      </span>
                    </td>

                    {/* NCM Fornecedor */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {row.ncmFornecedor || '—'}
                    </td>

                    {/* Nosso Código */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {row.product?.code || '—'}
                    </td>

                    {/* Nossa Descrição */}
                    <td className="px-4 py-3 text-slate-700 max-w-[220px]">
                      <span className="line-clamp-2">
                        {row.product?.description || '—'}
                      </span>
                    </td>

                    {/* NCM Cadastro — not returned by current API */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                      —
                    </td>

                    {/* Status NCM */}
                    <td className="px-4 py-3 text-center">
                      <NcmBadge
                        ncmFornecedor={row.ncmFornecedor}
                        ncmCadastro={undefined}
                      />
                    </td>
                  </tr>
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
