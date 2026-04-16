'use client';

/**
 * NcmPicker — modal de pesquisa de NCM.
 *
 * Uso:
 *   <NcmPicker
 *     value="84089000"
 *     readOnly={!canConfigurar('FISCAL')}
 *     onSelect={(ncm) => updateForm('ncm', ncm.code)}
 *   />
 *
 * - Campo sempre exibe o código selecionado.
 * - Ícone de lupa abre o modal de busca (bloqueado se readOnly).
 * - Modal pesquisa em /api/fiscal/ncm?search=...
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, X, ExternalLink, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface NcmItem {
  id: string;
  code: string;
  description: string;
}

interface NcmPickerProps {
  /** Código NCM atual (ex: "84089000") */
  value: string;
  /** Quando true, exibe cadeado e desabilita abertura do modal */
  readOnly?: boolean;
  /** Chamado ao confirmar seleção */
  onSelect: (ncm: NcmItem) => void;
  placeholder?: string;
  className?: string;
}

export function NcmPicker({
  value,
  readOnly = false,
  onSelect,
  placeholder = '00000000',
  className = '',
}: NcmPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<NcmItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const LIMIT = 15;

  const fetchNcm = useCallback(async (q: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), page: String(pg) });
      if (q.trim()) params.set('search', q.trim());
      const res = await apiFetch(`/api/fiscal/ncm?${params}`);
      const json = await res.json();
      setItems(Array.isArray(json.data) ? json.data : []);
      setTotal(json.meta?.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Abre modal e carrega primeiros resultados
  const openModal = () => {
    if (readOnly) return;
    setSearch('');
    setPage(1);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    fetchNcm(search, page);
  }, [open, search, page, fetchNcm]);

  // Foca o campo de busca quando abre
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Debounce para search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (open) fetchNcm(debouncedSearch, 1);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (ncm: NcmItem) => {
    onSelect(ncm);
    setOpen(false);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      {/* Campo display */}
      <div className={`relative flex items-center ${className}`}>
        <input
          type="text"
          value={value}
          readOnly
          placeholder={placeholder}
          className={`input pr-9 font-mono text-sm ${readOnly ? 'bg-slate-50 text-slate-500 cursor-default' : 'cursor-pointer hover:border-blue-400'}`}
          onClick={openModal}
          title={readOnly ? 'Sem permissão para alterar o NCM' : 'Clique para pesquisar NCM'}
        />
        <button
          type="button"
          onClick={openModal}
          disabled={readOnly}
          className="absolute right-2 p-1 text-slate-400 hover:text-blue-600 transition-colors disabled:cursor-default"
          title={readOnly ? 'Sem permissão para alterar o NCM' : 'Pesquisar NCM'}
        >
          {readOnly ? <Lock className="w-3.5 h-3.5 text-slate-300" /> : <Search className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Pesquisar NCM</h3>
                <p className="text-xs text-slate-500 mt-0.5">Nomenclatura Comum do Mercosul — selecione o código do produto</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por código ou descrição..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Search className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">Nenhum NCM encontrado</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-5 py-2 text-left text-xs font-semibold text-slate-500 w-32">Código</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold text-slate-500">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((ncm) => (
                      <tr
                        key={ncm.id}
                        onClick={() => handleSelect(ncm)}
                        className={`hover:bg-blue-50 cursor-pointer transition-colors ${value === ncm.code ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-5 py-2.5 font-mono text-slate-800 font-semibold whitespace-nowrap">
                          {ncm.code}
                          {value === ncm.code && (
                            <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-sans font-bold">ATUAL</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-slate-600">{ncm.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginação + info */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <span className="text-xs text-slate-500">
                {total} NCM{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition-colors"
                  >
                    ← Ant.
                  </button>
                  <span className="text-xs text-slate-500 px-2">{page}/{totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition-colors"
                  >
                    Próx. →
                  </button>
                </div>
              )}
              <Link
                href="/fiscal/indices/ncm"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3 h-3" /> Gerenciar NCMs
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
