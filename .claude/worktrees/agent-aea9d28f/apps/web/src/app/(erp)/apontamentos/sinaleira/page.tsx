'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { api } from '@/lib/api';

interface ApontamentoAtivo {
  id: string;
  status: 'EM_ANDAMENTO' | 'PAUSADO';
  inicio: string;
  employee: {
    matricula: string;
    cargo: string;
    person: { razaoSocial: string };
  };
  productionOrder?: { numero: string } | null;
  routingStep?: { description: string } | null;
  serviceOrder?: { numero: string; veiculoDescricao: string } | null;
  etapaOs?: { descricao: string } | null;
  calderariaOrder?: { numero: string; description: string } | null;
  etapaCalderaria?: { descricao: string } | null;
}

interface SemApontamento {
  id: string;
  matricula: string;
  cargo: string;
  person: { razaoSocial: string };
}

function TempoDecorrido({ inicio }: { inicio: string }) {
  const [tempo, setTempo] = useState(0);

  useEffect(() => {
    const inicioMs = new Date(inicio).getTime();
    const interval = setInterval(() => setTempo(Date.now() - inicioMs), 1000);
    return () => clearInterval(interval);
  }, [inicio]);

  const totalSec = Math.floor(tempo / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return <span className="font-mono text-sm">{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>;
}

function ordemLabel(a: ApontamentoAtivo) {
  if (a.productionOrder) return a.productionOrder.numero;
  if (a.serviceOrder) return `${a.serviceOrder.numero} · ${a.serviceOrder.veiculoDescricao}`;
  if (a.calderariaOrder) return `${a.calderariaOrder.numero} · ${a.calderariaOrder.description}`;
  return '—';
}

function etapaLabel(a: ApontamentoAtivo) {
  if (a.routingStep) return a.routingStep.description;
  if (a.etapaOs) return a.etapaOs.descricao;
  if (a.etapaCalderaria) return a.etapaCalderaria.descricao;
  return '';
}

export default function SinaleiraPage() {
  const [ativos, setAtivos] = useState<ApontamentoAtivo[]>([]);
  const [semApontamento, setSemApontamento] = useState<SemApontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [countdown, setCountdown] = useState(10);

  const carregar = useCallback(async () => {
    try {
      const data = await api<{ ativos: ApontamentoAtivo[]; semApontamento: SemApontamento[] }>('/apontamentos/ativos');
      setAtivos(data.ativos ?? []);
      setSemApontamento(data.semApontamento ?? []);
      setLastUpdate(new Date());
      setCountdown(10);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 10000);
    return () => clearInterval(interval);
  }, [carregar]);

  useEffect(() => {
    const cd = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(cd);
  }, [lastUpdate]);

  const andando = ativos.filter((a) => a.status === 'EM_ANDAMENTO');
  const pausados = ativos.filter((a) => a.status === 'PAUSADO');

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sinaleira ao Vivo</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')} · próxima em {countdown}s
          </p>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{andando.length}</p>
          <p className="text-sm text-green-600">Trabalhando</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-yellow-700">{pausados.length}</p>
          <p className="text-sm text-yellow-600">Pausados</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{semApontamento.length}</p>
          <p className="text-sm text-red-600">Sem apontamento</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      )}

      {/* Grid de cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Trabalhando */}
          {andando.map((a) => (
            <div key={a.id} className="border-2 border-green-400 bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-700">TRABALHANDO</span>
              </div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{a.employee.person.razaoSocial}</p>
              <p className="text-xs text-slate-500 mb-2">{a.employee.cargo}</p>
              <p className="text-xs font-medium text-slate-700">{ordemLabel(a)}</p>
              {etapaLabel(a) && <p className="text-xs text-slate-500 mt-0.5 truncate">{etapaLabel(a)}</p>}
              <div className="mt-3 text-green-700">
                <TempoDecorrido inicio={a.inicio} />
              </div>
            </div>
          ))}

          {/* Pausados */}
          {pausados.map((a) => (
            <div key={a.id} className="border-2 border-yellow-400 bg-yellow-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-xs font-medium text-yellow-700">PAUSADO</span>
              </div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{a.employee.person.razaoSocial}</p>
              <p className="text-xs text-slate-500 mb-2">{a.employee.cargo}</p>
              <p className="text-xs font-medium text-slate-700">{ordemLabel(a)}</p>
              {etapaLabel(a) && <p className="text-xs text-slate-500 mt-0.5 truncate">{etapaLabel(a)}</p>}
            </div>
          ))}

          {/* Sem apontamento */}
          {semApontamento.map((emp) => (
            <div key={emp.id} className="border-2 border-slate-200 bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-xs font-medium text-slate-500">DISPONÍVEL</span>
              </div>
              <p className="font-bold text-slate-600 text-sm leading-tight">{emp.person.razaoSocial}</p>
              <p className="text-xs text-slate-400">{emp.cargo}</p>
            </div>
          ))}

          {ativos.length === 0 && semApontamento.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
              <Users className="w-12 h-12 mb-3" />
              <p>Nenhum funcionário ativo cadastrado no sistema.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
