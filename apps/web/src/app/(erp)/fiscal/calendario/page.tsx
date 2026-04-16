'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Clock, CheckCircle2, Calendar, CalendarOff } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface Evento {
  codigo: string;
  nome: string;
  tipo: string;
  frequencia: string;
  diaVencimento: number;
  mes: number;
  ano: number;
  vencimento: string;
  diasRestantes: number;
  atrasado: boolean;
  urgente: boolean;
  antesDoInicio?: boolean; // vencimento anterior à data de início de operação
}

interface CalendarioResult {
  ano: number;
  eventos: Evento[];
  proximas: Evento[];
  urgentes: Evento[];
  atrasadas: Evento[];
  total: number;
}

const TIPO_COLOR: Record<string, string> = {
  FEDERAL:  'bg-blue-100 text-blue-700',
  ESTADUAL: 'bg-orange-100 text-orange-700',
  MUNICIPAL:'bg-purple-100 text-purple-700',
};

const FREQ_COLOR: Record<string, string> = {
  MENSAL:      'bg-slate-100 text-slate-600',
  TRIMESTRAL:  'bg-indigo-100 text-indigo-700',
  ANUAL:       'bg-pink-100 text-pink-700',
};

function EventoRow({ ev }: { ev: Evento }) {
  const rowBg = ev.antesDoInicio
    ? 'bg-slate-50 opacity-60'
    : ev.atrasado ? 'bg-red-50' : ev.urgente ? 'bg-amber-50' : '';
  return (
    <tr className={`${rowBg} hover:opacity-100 transition-colors border-b border-slate-100`}>
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs font-bold text-slate-700">{ev.codigo}</span>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-900">{ev.nome}</td>
      <td className="px-4 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[ev.tipo] ?? 'bg-slate-100 text-slate-600'}`}>{ev.tipo}</span>
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FREQ_COLOR[ev.frequencia] ?? 'bg-slate-100 text-slate-600'}`}>{ev.frequencia}</span>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-700 font-medium">{fmtDate(ev.vencimento)}</td>
      <td className="px-4 py-2.5">
        {ev.antesDoInicio ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <CalendarOff className="w-3.5 h-3.5" /> Antes do início
          </span>
        ) : ev.atrasado ? (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" /> {Math.abs(ev.diasRestantes)}d atrasado
          </span>
        ) : ev.urgente ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold">
            <Clock className="w-3.5 h-3.5" /> {ev.diasRestantes}d restantes
          </span>
        ) : (
          <span className="text-xs text-slate-400">{ev.diasRestantes}d</span>
        )}
      </td>
    </tr>
  );
}

export default function CalendarioFiscalPage() {
  const [ano, setAno]       = useState(new Date().getFullYear());
  const [data, setData]     = useState<CalendarioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState(0); // 0 = todos

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/api/fiscal/books/calendario-obrigacoes?ano=${ano}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [ano]);

  useEffect(() => { load(); }, [load]);

  const eventos = data?.eventos ?? [];
  const filtered = mesFiltro > 0 ? eventos.filter(e => e.mes === mesFiltro) : eventos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário Fiscal</h1>
          <p className="text-slate-500 text-sm mt-0.5">Obrigações acessórias e principais — Lucro Real</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={load} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-center py-16 text-slate-400">Erro ao carregar calendário.</div>
      ) : (
        <>
          {/* Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`rounded-lg border p-4 ${data.atrasadas.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${data.atrasadas.length > 0 ? 'text-red-600' : 'text-slate-300'}`} />
                <p className="text-sm font-semibold text-slate-700">Atrasadas</p>
              </div>
              <p className={`text-2xl font-bold ${data.atrasadas.length > 0 ? 'text-red-700' : 'text-slate-400'}`}>{data.atrasadas.length}</p>
            </div>
            <div className={`rounded-lg border p-4 ${data.urgentes.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className={`w-4 h-4 ${data.urgentes.length > 0 ? 'text-amber-600' : 'text-slate-300'}`} />
                <p className="text-sm font-semibold text-slate-700">Próximas 10 dias</p>
              </div>
              <p className={`text-2xl font-bold ${data.urgentes.length > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{data.urgentes.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-emerald-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-700">Total no Ano</p>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{data.total}</p>
            </div>
          </div>

          {/* Upcoming alert box */}
          {data.urgentes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Vencimentos nos próximos 10 dias
              </p>
              <div className="space-y-1">
                {data.urgentes.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-amber-900"><strong>{ev.codigo}</strong> — {ev.nome}</span>
                    <span className="text-amber-700 font-semibold">{fmtDate(ev.vencimento)} ({ev.diasRestantes}d)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Month filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setMesFiltro(0)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mesFiltro === 0 ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              Todos
            </button>
            {MESES.map((m, i) => (
              <button key={i} onClick={() => setMesFiltro(i + 1)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mesFiltro === i + 1 ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                {m}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Código','Obrigação','Esfera','Frequência','Vencimento','Situação'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ev, i) => <EventoRow key={i} ev={ev} />)}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            * Datas baseadas na legislação vigente para empresas Lucro Real. Confirme com seu contador.
          </p>
        </>
      )}
    </div>
  );
}
