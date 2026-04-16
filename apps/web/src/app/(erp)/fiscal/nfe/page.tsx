'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, X, Eye, Edit,
  ChevronLeft, ChevronRight, FileText, Calendar, RefreshCw, Hash,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

type NFeStatus = 'RASCUNHO' | 'VALIDADA' | 'TRANSMITIDA' | 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA' | 'REJEITADA';
type NFeTipo  = 'ENTRADA' | 'SAIDA';

interface NFe {
  id: string;
  numero: number | null;
  serie: number;
  chaveAcesso: string | null;
  type: NFeTipo;
  operation: string;
  naturezaOperacao: string | null;
  person: { razaoSocial: string; cpfCnpj: string } | null;
  valorTotal: number;
  status: NFeStatus;
  dataEmissao: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  RASCUNHO:    'Rascunho',
  VALIDADA:    'Validada',
  TRANSMITIDA: 'Transmitida',
  AUTORIZADA:  'Autorizada',
  CANCELADA:   'Cancelada',
  DENEGADA:    'Denegada',
  REJEITADA:   'Rejeitada',
};

const statusColors: Record<string, string> = {
  RASCUNHO:    'bg-slate-100 text-slate-600',
  VALIDADA:    'bg-amber-100 text-amber-700',
  TRANSMITIDA: 'bg-blue-100 text-blue-700',
  AUTORIZADA:  'bg-emerald-100 text-emerald-700',
  CANCELADA:   'bg-red-100 text-red-700',
  DENEGADA:    'bg-red-100 text-red-700',
  REJEITADA:   'bg-red-100 text-red-700',
};

const fmt = (v: number) => fmtCurrency(v);

function InutilizarModal({ onClose }: { onClose: () => void }) {
  const [serie, setSerie]             = useState('1');
  const [numInicio, setNumInicio]     = useState('');
  const [numFim, setNumFim]           = useState('');
  const [justificativa, setJust]      = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<{ ok?: boolean; protocolo?: string; xMotivo?: string } | null>(null);
  const [erro, setErro]               = useState('');

  async function handleSubmit() {
    setErro(''); setLoading(true);
    try {
      const res = await apiFetch('/api/fiscal/nfe/inutilizar', {
        method: 'POST',
        body: JSON.stringify({
          serie: Number(serie),
          numeroInicial: Number(numInicio),
          numeroFinal: Number(numFim),
          justificativa,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.message || 'Erro ao inutilizar numeração'); return; }
      setResult(data);
    } catch { setErro('Erro de conexão ao inutilizar numeração'); }
    finally { setLoading(false); }
  }

  const canSubmit = serie && numInicio && numFim && justificativa.length >= 15 && Number(numFim) >= Number(numInicio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Hash className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Inutilizar Numeração</h3>
            <p className="text-xs text-slate-500">Inutiliza faixa de números junto ao SEFAZ</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
              <p className="font-semibold mb-1">Inutilização registrada com sucesso!</p>
              {result.protocolo && <p>Protocolo: <span className="font-mono">{result.protocolo}</span></p>}
              {result.xMotivo && <p className="text-xs mt-1 text-emerald-600">{result.xMotivo}</p>}
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium">
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <strong>Atenção:</strong> A inutilização é irreversível. Use apenas para números pulados por falha de sistema ou erro operacional. A faixa será comunicada ao SEFAZ.
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Série</label>
                <input type="number" min={1} value={serie} onChange={(e) => setSerie(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Núm. Inicial</label>
                <input type="number" min={1} value={numInicio} onChange={(e) => setNumInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Núm. Final</label>
                <input type="number" min={1} value={numFim} onChange={(e) => setNumFim(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Justificativa <span className="text-slate-400">(mín. 15 caracteres)</span>
              </label>
              <textarea value={justificativa} onChange={(e) => setJust(e.target.value)} rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                placeholder="Ex: Números gerados por falha no sistema em 25/03/2026 não foram utilizados." />
              <p className="text-xs text-slate-400 mt-0.5">{justificativa.length} car. {justificativa.length < 15 ? '(mín. 15)' : '✓'}</p>
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={!canSubmit || loading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Processando...' : 'Inutilizar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NFeListPage() {
  const [nfes, setNfes]         = useState<NFe[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter]     = useState('');
  const [dataInicio, setDataInicio]     = useState('');
  const [dataFim, setDataFim]           = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [showInutilizar, setShowInutilizar] = useState(false);
  const [page, setPage]         = useState(1);
  const limit = 15;

  const fetchNfes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search     && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(tipoFilter && { type: tipoFilter }),
        ...(dataInicio && { startDate: dataInicio }),
        ...(dataFim    && { endDate: dataFim }),
      });
      const res  = await apiFetch(`/api/fiscal/nfe?${params}`);
      const json = await res.json();
      setNfes(json.data  ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch {
      setError('Erro ao carregar NF-es. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tipoFilter, dataInicio, dataFim]);

  useEffect(() => { fetchNfes(); }, [fetchNfes]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, tipoFilter, dataInicio, dataFim]);

  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setTipoFilter('');
    setDataInicio(''); setDataFim('');
  };

  const hasActiveFilters = search || statusFilter || tipoFilter || dataInicio || dataFim;

  const truncateChave = (chave: string | null) => {
    if (!chave) return '—';
    return chave.substring(0, 8) + '...' + chave.substring(chave.length - 8);
  };

  return (
    <>
      {showInutilizar && <InutilizarModal onClose={() => setShowInutilizar(false)} />}
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notas Fiscais Eletrônicas</h1>
          <p className="text-slate-500 mt-1">
            {loading ? 'Carregando...' : `${total} NF-e${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNfes}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowInutilizar(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
            title="Inutilizar faixa de numeração"
          >
            <Hash className="w-4 h-4" />
            Inutilizar
          </button>
          <Link
            href="/fiscal/nfe/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova NF-e
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={fetchNfes} className="ml-auto underline">Tentar novamente</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, chave de acesso, destinatário ou operação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>
            )}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Todos</option>
                <option value="SAIDA">Saída</option>
                <option value="ENTRADA">Entrada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Emissão Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Emissão Fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinatário / Remetente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Operação</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Chave Acesso</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Emissão</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : nfes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Nenhuma NF-e encontrada</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {hasActiveFilters ? 'Tente remover os filtros.' : 'Clique em "Nova NF-e" para emitir a primeira nota.'}
                    </p>
                  </td>
                </tr>
              ) : (
                nfes.map((nfe, index) => (
                  <tr key={nfe.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-sm font-semibold text-slate-900">
                            {nfe.numero ? String(nfe.numero).padStart(6, '0') : 'Rascunho'}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">/ {nfe.serie}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        nfe.type === 'SAIDA' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {nfe.type === 'SAIDA' ? 'Saída' : 'Entrada'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900 font-medium truncate max-w-[180px]">
                        {nfe.person?.razaoSocial ?? <span className="italic text-slate-400">Sem destinatário</span>}
                      </p>
                      {nfe.person?.cpfCnpj && (
                        <p className="text-xs text-slate-400 font-mono">{nfe.person.cpfCnpj}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[160px]">
                      {nfe.naturezaOperacao ?? nfe.operation}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-slate-400 font-mono">{truncateChave(nfe.chaveAcesso)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                      {fmt(Number(nfe.valorTotal ?? 0))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[nfe.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[nfe.status] ?? nfe.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {nfe.dataEmissao
                          ? new Date(nfe.dataEmissao).toLocaleDateString('pt-BR')
                          : new Date(nfe.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/fiscal/nfe/${nfe.id}`}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Visualizar / Transmitir">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {nfe.status === 'RASCUNHO' && (
                          <Link href={`/fiscal/nfe/${nfe.id}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar">
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            {loading ? '...' : `${total} registro${total !== 1 ? 's' : ''} — página ${page} de ${totalPages || 1}`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm text-slate-700">Página {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
