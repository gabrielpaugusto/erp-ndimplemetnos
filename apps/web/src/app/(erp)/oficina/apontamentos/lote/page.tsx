'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ListChecks, Plus, Trash2, Save, RefreshCw,
  AlertTriangle, CheckCircle2, Clock, Search, ChevronDown,
  User, Wrench, X, Info,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  matricula: string;
  nome: string;
  cargo: string;
}

interface Subtarefa {
  id: string;
  nome: string;
  status: string;
  tempoPadraoH: number;
  horasApontadas: number;
  tarefaTitulo: string;
  osNumero: string;
  osId: string;
}

interface LoteItem {
  rowId: string;
  osSubtarefaId: string;
  horaInicio: string;
  horaFim: string;
  concluir: boolean;
  totalHoras: number | null; // calculado
  subtarefa?: Subtarefa;
}

interface ApontamentoAberto {
  apontamentoId: string;
  pausado: boolean;
  inicio: string;
  subtarefaNome: string | null;
  tarefaTitulo: string | null;
  osNumero: string | null;
  osId: string | null;
}

interface ResultadoItem {
  osSubtarefaId: string;
  ok: boolean;
  erro?: string;
  totalHoras?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcHoras(ini: string, fim: string): number | null {
  if (!ini || !fim || !/^\d{2}:\d{2}$/.test(ini) || !/^\d{2}:\d{2}$/.test(fim)) return null;
  const [hI, mI] = ini.split(':').map(Number);
  const [hF, mF] = fim.split(':').map(Number);
  let minutos = (hF * 60 + mF) - (hI * 60 + mI);
  if (minutos <= 0) minutos += 24 * 60; // virou meia-noite
  return Math.round((minutos / 60) * 100) / 100;
}

function fmtHoras(h: number | null): string {
  if (h === null) return '—';
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  return `${horas}h${min > 0 ? ` ${min}min` : ''}`;
}

function getUser(): { employeeId?: string; companyId?: string } {
  try { return JSON.parse(localStorage.getItem('user') ?? '{}'); } catch { return {}; }
}

// ── SubtarefaCombobox ─────────────────────────────────────────────────────────

function SubtarefaCombobox({
  subtarefas, value, onChange,
}: {
  subtarefas: Subtarefa[];
  value: string;
  onChange: (id: string, sub: Subtarefa | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);

  const selected = subtarefas.find((s) => s.id === value);
  const filtered = query.trim()
    ? subtarefas.filter((s) =>
        s.nome.toLowerCase().includes(query.toLowerCase()) ||
        s.osNumero.toLowerCase().includes(query.toLowerCase()) ||
        s.tarefaTitulo.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 40)
    : subtarefas.slice(0, 40);

  return (
    <div className="relative">
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 w-full px-3 py-2 border rounded-lg text-sm cursor-pointer transition-colors ${
          open ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {selected ? (
          <span className="flex-1 min-w-0 truncate">
            <span className="font-medium text-slate-900">{selected.nome}</span>
            <span className="text-slate-400 text-xs ml-2">{selected.osNumero} · {selected.tarefaTitulo}</span>
          </span>
        ) : (
          <span className="flex-1 text-slate-400 text-xs">Selecione subtarefa...</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-72">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar subtarefa, OS..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              onClick={() => { onChange('', null); setOpen(false); setQuery(''); }}
              className="w-full px-4 py-2 text-left text-xs text-slate-400 hover:bg-slate-50"
            >
              — Nenhuma —
            </button>
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id, s); setOpen(false); setQuery(''); }}
                className={`w-full flex flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-rose-50 transition-colors ${s.id === value ? 'bg-rose-50' : ''}`}
              >
                <span className="text-sm font-medium text-slate-900">{s.nome}</span>
                <span className="text-xs text-slate-400">
                  OS {s.osNumero} · {s.tarefaTitulo}
                  {s.tempoPadraoH > 0 && ` · padrão ${s.tempoPadraoH}h`}
                  {s.status === 'CONCLUIDA' && ' · ✅ Concluída'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ApontamentosLotePage() {
  const [employees, setEmployees]           = useState<Employee[]>([]);
  const [subtarefas, setSubtarefas]         = useState<Subtarefa[]>([]);
  const [loadingData, setLoadingData]       = useState(true);
  const [abertos, setAbertos]               = useState<ApontamentoAberto[]>([]);
  const [loadingAbertos, setLoadingAbertos] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [dataReferencia, setDataReferencia]      = useState(new Date().toISOString().slice(0, 10));
  const [itens, setItens]                        = useState<LoteItem[]>([]);

  const [saving, setSaving]       = useState(false);
  const [resultado, setResultado] = useState<ResultadoItem[] | null>(null);
  const [erro, setErro]           = useState<string | null>(null);

  // ── Carrega dados ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [empRes, subRes] = await Promise.all([
        apiFetch('/api/hr/employees?limit=200&apontamentoRole=MECANICO,OPERADOR'),
        apiFetch('/api/workshop/apontamentos/subtarefas-pendentes'),
      ]);

      if (empRes.ok) {
        const d = await empRes.json();
        setEmployees((d.data || d || []).map((e: any) => ({
          id: e.id,
          matricula: e.matricula,
          nome: e.person?.razaoSocial ?? e.cargo ?? '—',
          cargo: e.cargo ?? '',
        })));
      }

      if (subRes.ok) {
        setSubtarefas(await subRes.json());
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-seleciona o próprio funcionário logado
  useEffect(() => {
    const { employeeId } = getUser();
    if (employeeId && !selectedEmployee) setSelectedEmployee(employeeId);
  }, [employees, selectedEmployee]);

  // Carrega apontamentos em aberto quando muda o funcionário
  useEffect(() => {
    if (!selectedEmployee) { setAbertos([]); return; }
    setLoadingAbertos(true);
    apiFetch('/api/workshop/apontamentos/abertos')
      .then(r => r.ok ? r.json() : [])
      .then(setAbertos)
      .catch(() => setAbertos([]))
      .finally(() => setLoadingAbertos(false));
  }, [selectedEmployee]);

  // ── Manipulação dos itens ──────────────────────────────────────────────────

  const addItem = () => {
    const turnoInicio = '07:00';
    const turnoFim    = '17:00';
    setItens((prev) => [...prev, {
      rowId: String(Date.now()),
      osSubtarefaId: '',
      horaInicio: turnoInicio,
      horaFim: turnoFim,
      concluir: true,
      totalHoras: calcHoras(turnoInicio, turnoFim),
    }]);
  };

  const removeItem = (rowId: string) => setItens((p) => p.filter((i) => i.rowId !== rowId));

  const updateItem = (rowId: string, patch: Partial<LoteItem>) => {
    setItens((prev) => prev.map((item) => {
      if (item.rowId !== rowId) return item;
      const updated = { ...item, ...patch };
      updated.totalHoras = calcHoras(updated.horaInicio, updated.horaFim);
      return updated;
    }));
  };

  const setSubtarefa = (rowId: string, id: string, sub: Subtarefa | null) => {
    updateItem(rowId, { osSubtarefaId: id, subtarefa: sub ?? undefined });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSalvar = async () => {
    setErro(null);
    setResultado(null);

    const validos = itens.filter((i) => i.osSubtarefaId && i.horaInicio && i.horaFim);
    if (validos.length === 0) { setErro('Adicione pelo menos um item com subtarefa e horários.'); return; }
    if (!dataReferencia) { setErro('Informe a data de referência.'); return; }

    const invalidos = validos.filter((i) => (i.totalHoras ?? 0) <= 0);
    if (invalidos.length > 0) { setErro('Verifique os horários — fim deve ser após o início.'); return; }

    setSaving(true);
    try {
      const res = await apiFetch('/api/workshop/apontamentos/lote', {
        method: 'POST',
        body: JSON.stringify({
          dataReferencia,
          itens: validos.map((i) => ({
            osSubtarefaId: i.osSubtarefaId,
            horaInicio: i.horaInicio,
            horaFim: i.horaFim,
            concluir: i.concluir,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErro(Array.isArray(data.message) ? data.message.join(' • ') : (data.message || 'Erro ao registrar.'));
        return;
      }

      setResultado(data);
      // Remove itens que deram OK
      const okIds = new Set((data as ResultadoItem[]).filter((r) => r.ok).map((r) => r.osSubtarefaId));
      setItens((prev) => prev.filter((i) => !okIds.has(i.osSubtarefaId)));
      // Recarrega abertos
      apiFetch('/api/workshop/apontamentos/abertos').then(r => r.ok ? r.json() : []).then(setAbertos).catch(() => {});
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar.');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalHorasLote = itens.reduce((s, i) => s + (i.totalHoras ?? 0), 0);
  const empSelecionado = employees.find((e) => e.id === selectedEmployee);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/oficina/ordens-servico" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-rose-500" />
            Apontamentos em Lote
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Registre múltiplas subtarefas ao fim do turno</p>
        </div>
      </div>

      {/* Erros e resultados */}
      {erro && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {resultado && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700 mb-2">Resultado do registro:</p>
          {resultado.map((r) => {
            const sub = subtarefas.find((s) => s.id === r.osSubtarefaId);
            return (
              <div key={r.osSubtarefaId} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg ${r.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {r.ok
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span className="font-medium">{sub?.nome ?? r.osSubtarefaId.slice(0, 8)}</span>
                {r.ok
                  ? <span className="text-xs ml-auto">{fmtHoras(r.totalHoras ?? null)} registradas</span>
                  : <span className="text-xs ml-auto">{r.erro}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Alerta — Apontamentos em Aberto */}
      {abertos.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {abertos.length} apontamento{abertos.length > 1 ? 's' : ''} em aberto — feche antes de lançar o lote
            </p>
          </div>
          <div className="space-y-1.5">
            {abertos.map((a) => (
              <div key={a.apontamentoId} className="flex items-center gap-3 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">{a.subtarefaNome ?? '—'}</span>
                {a.osNumero && <span className="text-amber-500">OS {a.osNumero}</span>}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${a.pausado ? 'bg-amber-200 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
                  {a.pausado ? 'Pausado' : 'Em andamento'}
                </span>
                {a.osId && (
                  <Link href={`/oficina/ordens-servico/${a.osId}`} className="ml-auto text-amber-600 hover:text-amber-800 underline">
                    Ver OS
                  </Link>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">
            💡 Esses apontamentos serão <strong>encerrados automaticamente</strong> com o horário que você informar no lote abaixo.
          </p>
        </div>
      )}

      {/* Configuração: funcionário + data */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-rose-500" />
          Turno
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Mecânico / Operador</label>
            {loadingData ? (
              <div className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-400">Carregando...</div>
            ) : (
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">— Selecione —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.matricula} · {e.nome} ({e.cargo})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Data de Referência</label>
            <input
              type="date"
              value={dataReferencia}
              onChange={(e) => setDataReferencia(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {empSelecionado && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Registrando para: <strong>{empSelecionado.nome}</strong> — {empSelecionado.cargo}
            {loadingAbertos && <RefreshCw className="w-3 h-3 animate-spin ml-2 text-slate-400" />}
          </div>
        )}
      </div>

      {/* Tabela de itens */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-slate-700">Subtarefas do Turno</h2>
            {itens.length > 0 && (
              <span className="text-xs text-slate-400">
                {itens.length} item{itens.length > 1 ? 's' : ''} · {fmtHoras(totalHorasLote)} total
              </span>
            )}
          </div>
          <button
            onClick={addItem}
            disabled={!selectedEmployee}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>

        {itens.length === 0 ? (
          <div className="py-12 text-center">
            <ListChecks className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Nenhum item adicionado.</p>
            <p className="text-xs text-slate-400 mt-1">
              {!selectedEmployee
                ? 'Selecione o mecânico primeiro.'
                : 'Clique em "+ Adicionar" para incluir subtarefas do turno.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Cabeçalho */}
            <div className="hidden md:grid grid-cols-[1fr_90px_90px_80px_100px_36px] gap-3 px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Subtarefa</span>
              <span>Início</span>
              <span>Fim</span>
              <span className="text-center">Horas</span>
              <span className="text-center">Concluir?</span>
              <span />
            </div>

            {itens.map((item) => {
              const horas = item.totalHoras;
              const horasOk = horas !== null && horas > 0;
              return (
                <div key={item.rowId} className="grid grid-cols-1 md:grid-cols-[1fr_90px_90px_80px_100px_36px] gap-3 px-5 py-3 items-center">
                  {/* Subtarefa */}
                  <div>
                    <label className="md:hidden text-xs font-medium text-slate-500 mb-1 block">Subtarefa</label>
                    <SubtarefaCombobox
                      subtarefas={subtarefas}
                      value={item.osSubtarefaId}
                      onChange={(id, sub) => setSubtarefa(item.rowId, id, sub)}
                    />
                    {item.subtarefa && (
                      <p className="text-[10px] text-slate-400 mt-0.5 ml-0.5">
                        Padrão: {item.subtarefa.tempoPadraoH}h · Apontado: {fmtHoras(item.subtarefa.horasApontadas)}
                      </p>
                    )}
                  </div>

                  {/* Hora início */}
                  <div>
                    <label className="md:hidden text-xs font-medium text-slate-500 mb-1 block">Início</label>
                    <input
                      type="time"
                      value={item.horaInicio}
                      onChange={(e) => updateItem(item.rowId, { horaInicio: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>

                  {/* Hora fim */}
                  <div>
                    <label className="md:hidden text-xs font-medium text-slate-500 mb-1 block">Fim</label>
                    <input
                      type="time"
                      value={item.horaFim}
                      onChange={(e) => updateItem(item.rowId, { horaFim: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>

                  {/* Horas calculadas */}
                  <div className="text-center">
                    <label className="md:hidden text-xs font-medium text-slate-500 mb-1 block">Horas</label>
                    <span className={`text-sm font-bold font-mono ${horasOk ? 'text-emerald-600' : 'text-red-400'}`}>
                      {fmtHoras(horas)}
                    </span>
                  </div>

                  {/* Concluir subtarefa */}
                  <div className="text-center">
                    <label className="md:hidden text-xs font-medium text-slate-500 mb-1 block">Concluir?</label>
                    <button
                      onClick={() => updateItem(item.rowId, { concluir: !item.concluir })}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        item.concluir
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {item.concluir ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {item.concluir ? 'Sim' : 'Não'}
                    </button>
                  </div>

                  {/* Remover */}
                  <div className="flex justify-end md:justify-center">
                    <button
                      onClick={() => removeItem(item.rowId)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Totais */}
            {itens.length > 1 && (
              <div className="px-5 py-3 bg-slate-50 flex items-center justify-end gap-4">
                <span className="text-xs text-slate-500">{itens.length} subtarefas</span>
                <span className="text-sm font-bold text-slate-700">Total: {fmtHoras(totalHorasLote)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dica */}
      {itens.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
          <span>
            Apontamentos com <strong>Concluir = Sim</strong> marcam a subtarefa como concluída.
            Se o horário de fim for menor que o início, o sistema assume que virou meia-noite.
            Apontamentos em aberto serão encerrados automaticamente com o horário informado.
          </span>
        </div>
      )}

      {/* Botão salvar */}
      {itens.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              <span className="font-semibold">{itens.filter(i => i.osSubtarefaId).length}</span> subtarefa{itens.filter(i => i.osSubtarefaId).length !== 1 ? 's' : ''} prontas ·{' '}
              <span className="font-semibold text-emerald-600">{fmtHoras(totalHorasLote)}</span> total
            </div>
            <button
              onClick={handleSalvar}
              disabled={saving || !selectedEmployee || itens.filter(i => i.osSubtarefaId).length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Registrando...' : 'Registrar Turno'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
