'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Factory, RefreshCw, AlertTriangle, Clock, CheckCircle2,
  PlayCircle, PauseCircle, ListChecks, AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface OpItem {
  id:          string;
  numero:      string;
  produto:     string;
  status:      string;
  quantidade:  number;
  dataFim:     string;
  progressoPct: number;
  atrasada:    boolean;
  diasAtraso:  number;
}

interface ChaoFabricaData {
  resumo:  { total: number; emProducao: number; atrasadas: number; planejadas: number; liberadas: number };
  ops:     OpItem[];
  centros: { id: string; name: string; code: string; opsAtivas: number }[];
}

const EMPTY: ChaoFabricaData = {
  resumo:  { total: 0, emProducao: 0, atrasadas: 0, planejadas: 0, liberadas: 0 },
  ops:     [],
  centros: [],
};

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  PLANEJADA:   { label: 'Planejada',   color: 'text-slate-500',   Icon: Clock        },
  LIBERADA:    { label: 'Liberada',    color: 'text-blue-500',    Icon: PlayCircle   },
  EM_PRODUCAO: { label: 'Em Produção', color: 'text-green-600',   Icon: Factory      },
  PAUSADA:     { label: 'Pausada',     color: 'text-amber-500',   Icon: PauseCircle  },
  CONCLUIDA:   { label: 'Concluída',   color: 'text-emerald-600', Icon: CheckCircle2 },
};

export default function ChaoFabricaDashboard() {
  const [data, setData]       = useState<ChaoFabricaData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await apiFetch('/api/dashboard/chao-fabrica');
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setErro((msg as any)?.message ?? `Erro ${res.status}`);
        return;
      }
      const json = await res.json();
      setData({
        resumo:  json.resumo  ?? EMPTY.resumo,
        ops:     json.ops     ?? [],
        centros: json.centros ?? [],
      });
    } catch (e: any) {
      setErro(e?.message ?? 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const { resumo, ops, centros } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Factory className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Chão de Fábrica</h1>
            <p className="text-sm text-muted-foreground">Ordens de produção em andamento</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KpiCard label="Total OPs"    value={resumo.total}      color="bg-slate-100"  />
        <KpiCard label="Em Produção"  value={resumo.emProducao} color="bg-green-100"  />
        <KpiCard label="Atrasadas"    value={resumo.atrasadas}  color="bg-red-100"    />
        <KpiCard label="Planejadas"   value={resumo.planejadas} color="bg-blue-100"   />
        <KpiCard label="Liberadas"    value={resumo.liberadas}  color="bg-indigo-100" />
      </div>

      {/* OPs atrasadas — destaque */}
      {resumo.atrasadas > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-700">{resumo.atrasadas} OP(s) com atraso</span>
          </div>
          <div className="space-y-2">
            {ops.filter((o) => o.atrasada).slice(0, 5).map((op) => (
              <div key={op.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">OP #{op.numero} — {op.produto}</span>
                <span className="text-red-600 font-semibold">{op.diasAtraso}d atraso</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de OPs */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Ordens Ativas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2">OP</th>
                <th className="text-left px-4 py-2">Produto</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Progresso</th>
                <th className="text-left px-4 py-2">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {ops.slice(0, 20).map((op) => {
                const cfg = STATUS_CONFIG[op.status] ?? { label: op.status, color: 'text-gray-500', Icon: Clock };
                return (
                  <tr key={op.id} className={`border-t hover:bg-muted/30 ${op.atrasada ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 font-mono font-medium">#{op.numero}</td>
                    <td className="px-4 py-3">{op.produto}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 ${cfg.color}`}>
                        <cfg.Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${op.progressoPct}%` }} />
                        </div>
                        <span className="text-xs w-8 text-right">{op.progressoPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={op.atrasada ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {new Date(op.dataFim).toLocaleDateString('pt-BR')}
                        {op.atrasada && <span className="ml-1">({op.diasAtraso}d)</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ops.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma OP ativa</p>
          )}
        </div>
      </div>

      {/* Centros de Trabalho */}
      {centros.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b font-semibold">Centros de Trabalho Ativos</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y">
            {centros.map((c) => (
              <div key={c.id} className="p-4">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.code}</p>
                <p className="text-sm mt-1">{c.opsAtivas} OP(s) ativas</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg ${color} px-4 py-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
