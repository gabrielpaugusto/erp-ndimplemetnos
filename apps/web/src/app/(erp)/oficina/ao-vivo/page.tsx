'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RefreshCw, Radio, LayoutGrid, List } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: 'TRABALHANDO' | 'PAUSADO' | 'PARADO' }) {
  if (estado === 'TRABALHANDO') return (
    <span className="flex items-center gap-1.5 text-green-700 font-semibold text-sm">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
      </span>
      Trabalhando
    </span>
  );
  if (estado === 'PAUSADO') return (
    <span className="flex items-center gap-1.5 text-yellow-700 font-semibold text-sm">
      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 inline-block"></span>
      Pausado
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-red-600 font-semibold text-sm">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block"></span>
      Parado
    </span>
  );
}

function TempoDecorrido({ inicio }: { inicio: string | null }) {
  const [diff, setDiff] = useState('—');

  useEffect(() => {
    if (!inicio) return;
    const update = () => {
      const ms = Date.now() - new Date(inicio).getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setDiff(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [inicio]);

  return <span className="font-mono text-xs">{diff}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AoVivoPage() {
  const [view, setView] = useState<'tabela' | 'sinaleira'>('sinaleira');
  const [sinaleira, setSinaleira] = useState<{ totais: Record<string, number>; mecanicos: any[] }>({ totais: {}, mecanicos: [] });
  const [tabela, setTabela] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    try {
      const [sinRes, tabRes] = await Promise.all([
        apiFetch('/api/workshop/apontamentos/sinaleira'),
        apiFetch('/api/workshop/apontamentos/ao-vivo'),
      ]);
      if (sinRes.ok) setSinaleira(await sinRes.json());
      if (tabRes.ok) setTabela(await tabRes.json());
    } catch {
      alert('Erro ao carregar painel ao vivo');
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualiza a cada 10 segundos (igual ao sistema original)
  useEffect(() => {
    fetchDados();
    const id = setInterval(fetchDados, 10_000);
    return () => clearInterval(id);
  }, [fetchDados]);

  const { totais = {}, mecanicos = [] } = sinaleira;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-6 w-6 text-green-600 animate-pulse" />
          <div>
            <h1 className="text-xl font-bold">Painel Ao Vivo</h1>
            <p className="text-sm text-slate-500">Atualiza automaticamente a cada 10 segundos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              view === 'sinaleira'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => setView('sinaleira')}
          >
            <LayoutGrid className="h-4 w-4" />
            Sinaleira
          </button>
          <button
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              view === 'tabela'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => setView('tabela')}
          >
            <List className="h-4 w-4" />
            Tabela
          </button>
          <button
            className="p-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
            onClick={fetchDados}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 text-center bg-green-50">
          <div className="text-3xl font-bold text-green-700">{totais.trabalhando ?? 0}</div>
          <div className="text-sm text-green-600 mt-1">Trabalhando</div>
        </div>
        <div className="rounded-lg border p-4 text-center bg-yellow-50">
          <div className="text-3xl font-bold text-yellow-700">{totais.pausados ?? 0}</div>
          <div className="text-sm text-yellow-600 mt-1">Pausados</div>
        </div>
        <div className="rounded-lg border p-4 text-center bg-red-50">
          <div className="text-3xl font-bold text-red-700">{totais.parados ?? 0}</div>
          <div className="text-sm text-red-600 mt-1">Parados</div>
        </div>
      </div>

      {/* Sinaleira — cards */}
      {view === 'sinaleira' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mecanicos.length === 0 ? (
            <div className="col-span-full text-center text-slate-400 py-12">
              Nenhum mecânico ativo cadastrado
            </div>
          ) : mecanicos.map((m: any) => (
            <div
              key={m.employeeId}
              className={`rounded-xl border-2 p-4 space-y-2 ${
                m.estado === 'TRABALHANDO' ? 'border-green-400 bg-green-50' :
                m.estado === 'PAUSADO'     ? 'border-yellow-400 bg-yellow-50' :
                                             'border-red-300 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm leading-tight">{m.nome}</div>
                  <div className="text-xs text-slate-500">{m.matricula} · {m.cargo}</div>
                </div>
              </div>
              <EstadoBadge estado={m.estado} />
              {m.inicio && (
                <div className="text-xs text-slate-500">
                  <TempoDecorrido inicio={m.inicio} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabela detalhada */}
      {view === 'tabela' && (
        <div className="rounded-lg border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-600">Mecânico</th>
                <th className="text-left p-3 font-medium text-slate-600">OS</th>
                <th className="text-left p-3 font-medium text-slate-600">Atividade</th>
                <th className="text-left p-3 font-medium text-slate-600">Estado</th>
                <th className="text-left p-3 font-medium text-slate-600">Tempo</th>
              </tr>
            </thead>
            <tbody>
              {tabela.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Nenhum apontamento em aberto
                  </td>
                </tr>
              ) : tabela.map((a: any) => (
                <tr key={a.apontamentoId} className="border-t hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-medium">{a.employeeNome}</div>
                    <div className="text-xs text-slate-400">{a.employeeMatricula}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-xs font-semibold">{a.osNumero}</div>
                    {a.equipamento?.placa && (
                      <div className="text-xs text-slate-400">{a.equipamento.placa}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div>{a.tarefaTitulo}</div>
                    <div className="text-xs text-slate-400">{a.subtarefaNome}</div>
                  </td>
                  <td className="p-3">
                    <EstadoBadge estado={a.estado} />
                  </td>
                  <td className="p-3">
                    <TempoDecorrido inicio={a.inicio} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
