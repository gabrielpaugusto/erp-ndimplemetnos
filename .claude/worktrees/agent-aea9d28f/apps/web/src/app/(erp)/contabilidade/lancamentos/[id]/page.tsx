'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  RotateCcw,
  XCircle,
  Send,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

type EntryStatus = 'RASCUNHO' | 'LANCADO' | 'ESTORNADO';

const statusLabels: Record<EntryStatus, string> = {
  RASCUNHO: 'Rascunho',
  LANCADO: 'Lançado',
  ESTORNADO: 'Estornado',
};

const statusColors: Record<EntryStatus, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  LANCADO: 'bg-emerald-100 text-emerald-700',
  ESTORNADO: 'bg-red-100 text-red-700',
};

interface Partida {
  id: string;
  conta: string;
  tipo: 'D' | 'C';
  valor: number;
  centroCusto: string;
  descricao: string;
}

interface TimelineEvent {
  date: string;
  action: string;
  user: string;
  status: EntryStatus;
}

interface EntryDetail {
  id: string;
  numero: string;
  date: string;
  description: string;
  status: EntryStatus;
  createdBy: string;
  createdAt: string;
  partidas: Partida[];
  timeline: TimelineEvent[];
}

interface ApiItem {
  id: string;
  type: 'DEVEDORA' | 'CREDORA';
  value: number;
  description?: string;
  account: { id: string; code: string; name: string };
  costCenter?: { id: string; code: string; name: string } | null;
}

interface ApiEntry {
  id: string;
  numero: string;
  date: string;
  description: string;
  status: EntryStatus;
  createdAt?: string;
  user?: { id: string; name: string };
  items: ApiItem[];
}

function mapApiEntry(e: ApiEntry): EntryDetail {
  const partidas: Partida[] = e.items.map((item) => ({
    id: item.id,
    conta: `${item.account.code} ${item.account.name}`,
    tipo: item.type === 'DEVEDORA' ? 'D' : 'C',
    valor: item.value,
    centroCusto: item.costCenter?.name ?? '',
    descricao: item.description ?? '',
  }));

  const timeline: TimelineEvent[] = [
    {
      date: e.createdAt ? new Date(e.createdAt).toLocaleString('pt-BR') : '',
      action: 'Lancamento criado',
      user: e.user?.name ?? '',
      status: 'RASCUNHO',
    },
  ];

  if (e.status === 'LANCADO' || e.status === 'ESTORNADO') {
    timeline.push({
      date: e.createdAt ? new Date(e.createdAt).toLocaleString('pt-BR') : '',
      action: e.status === 'ESTORNADO' ? 'Lancamento estornado' : 'Lancamento efetivado',
      user: e.user?.name ?? '',
      status: e.status,
    });
  }

  return {
    id: e.id,
    numero: e.numero,
    date: e.date,
    description: e.description,
    status: e.status,
    createdBy: e.user?.name ?? '',
    createdAt: e.createdAt ? new Date(e.createdAt).toLocaleString('pt-BR') : '',
    partidas,
    timeline,
  };
}

export default function LancamentoDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actioning, setActioning] = useState(false);

  const fetchEntry = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await apiFetch(`/api/accounting/journal/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data: ApiEntry = await res.json();
      setEntry(mapApiEntry(data));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const handlePost = async () => {
    if (!entry) return;
    setActioning(true);
    try {
      const res = await apiFetch(`/api/accounting/journal/${id}/post`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao lançar' }));
        alert(err.message || 'Erro ao lançar');
        return;
      }
      await fetchEntry();
    } catch {
      alert('Erro ao lançar');
    } finally {
      setActioning(false);
    }
  };

  const handleReverse = async () => {
    if (!entry) return;
    setActioning(true);
    try {
      const res = await apiFetch(`/api/accounting/journal/${id}/reverse`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao estornar' }));
        alert(err.message || 'Erro ao estornar');
        return;
      }
      await fetchEntry();
    } catch {
      alert('Erro ao estornar');
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/contabilidade/lancamentos"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Lancamento não encontrado</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600">O lancamento solicitado não foi encontrado.</p>
        </div>
      </div>
    );
  }

  const totalDebitos = entry.partidas.filter((p) => p.tipo === 'D').reduce((s, p) => s + p.valor, 0);
  const totalCreditos = entry.partidas.filter((p) => p.tipo === 'C').reduce((s, p) => s + p.valor, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/contabilidade/lancamentos"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{entry.numero}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status]}`}>
              {statusLabels[entry.status]}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Criado em {entry.createdAt} por {entry.createdBy}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entry.status === 'RASCUNHO' && (
            <button
              onClick={handlePost}
              disabled={actioning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Lancar
            </button>
          )}
          {entry.status === 'LANCADO' && (
            <button
              onClick={handleReverse}
              disabled={actioning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              Estornar
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">{new Date(entry.date).toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Debitos</h3>
          </div>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(totalDebitos)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Creditos</h3>
          </div>
          <p className="text-lg font-bold text-purple-700">{formatCurrency(totalCreditos)}</p>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Descricao</h2>
        <p className="text-sm text-slate-700">{entry.description}</p>
      </div>

      {/* Partidas Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Partidas do Lancamento</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conta</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">D/C</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro de Custo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entry.partidas.map((p) => {
                const [contaCodigo, ...contaNomeArr] = p.conta.split(' ');
                const contaNome = contaNomeArr.join(' ');
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-500 mr-2">{contaCodigo}</span>
                      <span className="text-sm text-slate-900">{contaNome}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        p.tipo === 'D' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {p.tipo === 'D' ? 'Debito' : 'Credito'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(p.valor)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.centroCusto || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.descricao || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-300">
                <td className="px-4 py-3 text-sm font-bold text-slate-900">Totais</td>
                <td className="px-4 py-3 text-center text-xs font-bold text-blue-700">D: {formatCurrency(totalDebitos)}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-purple-700">C: {formatCurrency(totalCreditos)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Historico</h2>
        <div className="space-y-4">
          {entry.timeline.map((event, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                event.status === 'LANCADO' ? 'bg-emerald-100' : event.status === 'ESTORNADO' ? 'bg-red-100' : 'bg-slate-100'
              }`}>
                {event.status === 'LANCADO' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : event.status === 'ESTORNADO' ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{event.action}</p>
                <p className="text-xs text-slate-500">{event.date} - {event.user}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
