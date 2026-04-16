'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Clock, Calendar, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtHours } from '@/lib/format';

interface Jornada {
  id: string;
  nome: string;
  horaInicio: string;
  horaFim: string;
  intervaloH: number;
  segSex: boolean;
  sabado: boolean;
  domingo: boolean;
  ativo: boolean;
  _count?: { employees: number };
}

interface Feriado {
  id: string;
  data: string;
  descricao: string;
  tipo: 'FERIADO' | 'FERIAS_COLETIVAS' | 'PONTO_FACULTATIVO';
}

interface CargaItem {
  jornada: { id: string; nome: string };
  diasUteis: number;
  horasPorDia: number;
  cargaHoras: number;
  funcionarios: number;
}

const TIPO_LABELS = {
  FERIADO: 'Feriado',
  FERIAS_COLETIVAS: 'Férias Coletivas',
  PONTO_FACULTATIVO: 'Ponto Facultativo',
};

const TIPO_CORES = {
  FERIADO: 'bg-red-100 text-red-700',
  FERIAS_COLETIVAS: 'bg-blue-100 text-blue-700',
  PONTO_FACULTATIVO: 'bg-orange-100 text-orange-700',
};

function getMesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function getAnoAtual() {
  return String(new Date().getFullYear());
}

export default function JornadaPage() {
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [carga, setCarga] = useState<CargaItem[]>([]);
  const [ano, setAno] = useState(getAnoAtual());
  const [mes, setMes] = useState(getMesAtual());
  const [loading, setLoading] = useState(true);

  // Nova jornada
  const [showNovaJornada, setShowNovaJornada] = useState(false);
  const [novaJornada, setNovaJornada] = useState({
    nome: '', horaInicio: '07:00', horaFim: '17:00', intervaloH: 1,
    segSex: true, sabado: false, domingo: false,
  });

  // Novo feriado
  const [showNovoFeriado, setShowNovoFeriado] = useState(false);
  const [novoFeriado, setNovoFeriado] = useState({
    data: '', descricao: '', tipo: 'FERIADO' as Feriado['tipo'],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const carregarJornadas = useCallback(async () => {
    const data = await api<Jornada[]>('/hr/jornada').catch(() => [] as Jornada[]);
    setJornadas(data);
  }, []);

  const carregarFeriados = useCallback(async () => {
    const data = await api<Feriado[]>(`/hr/jornada/feriados?ano=${ano}`).catch(() => [] as Feriado[]);
    setFeriados(data);
  }, [ano]);

  const carregarCarga = useCallback(async () => {
    const data = await api<CargaItem[]>(`/hr/jornada/carga-horaria?mes=${mes}`).catch(() => [] as CargaItem[]);
    setCarga(data);
  }, [mes]);

  useEffect(() => {
    Promise.all([carregarJornadas(), carregarFeriados(), carregarCarga()]).finally(() => setLoading(false));
  }, [carregarJornadas, carregarFeriados, carregarCarga]);

  const salvarJornada = async () => {
    setSaving(true);
    setError('');
    try {
      await api<unknown>('/hr/jornada', { method: 'POST', body: JSON.stringify(novaJornada) });
      setShowNovaJornada(false);
      setNovaJornada({ nome: '', horaInicio: '07:00', horaFim: '17:00', intervaloH: 1, segSex: true, sabado: false, domingo: false });
      await carregarJornadas();
      await carregarCarga();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar jornada');
    } finally {
      setSaving(false);
    }
  };

  const excluirJornada = async (id: string) => {
    if (!confirm('Excluir esta jornada?')) return;
    await api<unknown>(`/hr/jornada/${id}`, { method: 'DELETE' });
    await carregarJornadas();
    await carregarCarga();
  };

  const salvarFeriado = async () => {
    setSaving(true);
    setError('');
    try {
      await api<unknown>('/hr/jornada/feriados', { method: 'POST', body: JSON.stringify(novoFeriado) });
      setShowNovoFeriado(false);
      setNovoFeriado({ data: '', descricao: '', tipo: 'FERIADO' });
      await carregarFeriados();
      await carregarCarga();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar feriado');
    } finally {
      setSaving(false);
    }
  };

  const excluirFeriado = async (id: string) => {
    await api<unknown>(`/hr/jornada/feriados/${id}`, { method: 'DELETE' });
    await carregarFeriados();
    await carregarCarga();
  };

  const diasSemana = (j: Jornada) => {
    const dias = [];
    if (j.segSex) dias.push('Seg-Sex');
    if (j.sabado) dias.push('Sáb');
    if (j.domingo) dias.push('Dom');
    return dias.join(', ');
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">Carregando...</div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Jornada de Trabalho</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          {error} <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* JORNADAS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" /> Turnos Cadastrados
          </h2>
          <button
            onClick={() => setShowNovaJornada(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nova Jornada
          </button>
        </div>

        {jornadas.length === 0 && <p className="text-slate-400 text-sm">Nenhuma jornada cadastrada.</p>}

        <div className="space-y-2">
          {jornadas.map((j) => (
            <div key={j.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{j.nome}</p>
                <p className="text-sm text-slate-500">
                  {j.horaInicio}–{j.horaFim} · {diasSemana(j)} · {j.intervaloH}h intervalo
                  {j._count && <span className="ml-3 text-xs bg-slate-100 px-2 py-0.5 rounded-full">{j._count.employees} funcionários</span>}
                </p>
              </div>
              <button onClick={() => excluirJornada(j.id)} className="text-slate-300 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {showNovaJornada && (
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Nova Jornada</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 block mb-1">Nome</label>
                <input
                  type="text"
                  value={novaJornada.nome}
                  onChange={(e) => setNovaJornada((p) => ({ ...p, nome: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Integral, Turno A..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Hora Início</label>
                <input
                  type="time"
                  value={novaJornada.horaInicio}
                  onChange={(e) => setNovaJornada((p) => ({ ...p, horaInicio: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Hora Fim</label>
                <input
                  type="time"
                  value={novaJornada.horaFim}
                  onChange={(e) => setNovaJornada((p) => ({ ...p, horaFim: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Intervalo (horas)</label>
                <input
                  type="number"
                  step="0.5"
                  value={novaJornada.intervaloH}
                  onChange={(e) => setNovaJornada((p) => ({ ...p, intervaloH: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <label className="text-xs font-medium text-slate-600">Dias de trabalho</label>
                {(['segSex', 'sabado', 'domingo'] as const).map((campo) => (
                  <label key={campo} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={novaJornada[campo]}
                      onChange={(e) => setNovaJornada((p) => ({ ...p, [campo]: e.target.checked }))}
                      className="rounded"
                    />
                    {campo === 'segSex' ? 'Segunda a Sexta' : campo === 'sabado' ? 'Sábado' : 'Domingo'}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowNovaJornada(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={salvarJornada} disabled={saving || !novaJornada.nome} className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* CARGA HORÁRIA */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Carga Horária do Mês</h2>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {carga.length === 0 && <p className="text-slate-400 text-sm">Sem dados de carga para este mês.</p>}
        <div className="space-y-2">
          {carga.map((c) => (
            <div key={c.jornada.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{c.jornada.nome}</p>
                <p className="text-sm text-slate-500">{c.diasUteis} dias úteis × {fmtHours(c.horasPorDia)} = <strong>{fmtHours(c.cargaHoras)}</strong></p>
              </div>
              <span className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full font-medium">{c.funcionarios} func.</span>
            </div>
          ))}
        </div>
      </section>

      {/* FERIADOS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" /> Calendário de Datas
            </h2>
            <select
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1 text-sm"
            >
              {[2024, 2025, 2026, 2027].map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowNovoFeriado(true)}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" /> Adicionar Data
          </button>
        </div>

        {feriados.length === 0 && <p className="text-slate-400 text-sm">Nenhuma data cadastrada para {ano}.</p>}

        <div className="space-y-2">
          {feriados.map((f) => (
            <div key={f.id} className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="font-mono text-sm font-medium text-slate-700">
                  {new Date(f.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}
                </p>
                <p className="text-sm text-slate-700">{f.descricao}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_CORES[f.tipo]}`}>
                  {TIPO_LABELS[f.tipo]}
                </span>
              </div>
              <button onClick={() => excluirFeriado(f.id)} className="text-slate-300 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {showNovoFeriado && (
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Nova Data</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Data</label>
                <input
                  type="date"
                  value={novoFeriado.data}
                  onChange={(e) => setNovoFeriado((p) => ({ ...p, data: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tipo</label>
                <select
                  value={novoFeriado.tipo}
                  onChange={(e) => setNovoFeriado((p) => ({ ...p, tipo: e.target.value as Feriado['tipo'] }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {Object.entries(TIPO_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Descrição</label>
                <input
                  type="text"
                  value={novoFeriado.descricao}
                  onChange={(e) => setNovoFeriado((p) => ({ ...p, descricao: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Natal, Férias Coletivas..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowNovoFeriado(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={salvarFeriado} disabled={saving || !novoFeriado.data || !novoFeriado.descricao} className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
