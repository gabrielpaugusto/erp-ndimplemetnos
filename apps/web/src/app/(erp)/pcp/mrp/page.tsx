'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ListChecks, RefreshCw, Play, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface MrpSugestao {
  id:                 string;
  productId:          string;
  product:            { code: string; description: string; unit: string };
  supplier?:          { razaoSocial: string } | null;
  necessidadeBruta:   number;
  estoqueDisponivel:  number;
  estoqueReservado:   number;
  necessidadeLiquida: number;
  quantidadeSugerida: number;
  dataNecessidade:    string;
  leadTimeDias:       number;
  status:             string;
  opsOrigem:          string[];
}

type RunResult = {
  sugestoes:    number;
  message:      string;
  necessidades?: any[];
};

const STATUS_BADGE: Record<string, string> = {
  PENDENTE:   'bg-amber-100 text-amber-700',
  CONVERTIDA: 'bg-green-100 text-green-700',
  REJEITADA:  'bg-red-100 text-red-700',
  CANCELADA:  'bg-slate-100 text-slate-500',
};

export default function MrpPage() {
  const [sugestoes, setSugestoes] = useState<MrpSugestao[]>([]);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [filter, setFilter]       = useState('PENDENTE');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch(`/api/mrp/sugestoes?status=${filter}`);
      const data = await res.json();
      setSugestoes(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const runMrp = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await apiFetch('/api/mrp/run', { method: 'POST' });
      setRunResult(await res.json());
      await load();
    } catch { /* ignore */ }
    finally { setRunning(false); }
  };

  const accept = async (id: string) => {
    try {
      await apiFetch(`/api/mrp/sugestoes/${id}/aceitar`, { method: 'POST' }).then(r => r.json());
      await load();
    } catch { /* ignore */ }
  };

  const reject = async (id: string) => {
    try {
      await apiFetch(`/api/mrp/sugestoes/${id}/rejeitar`, {
        method: 'PATCH',
        body:   JSON.stringify({ motivo: 'Rejeitado manualmente' }),
      }).then(r => r.json());
      await load();
    } catch { /* ignore */ }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ListChecks className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">MRP — Planejamento de Materiais</h1>
            <p className="text-sm text-muted-foreground">
              Calcula necessidades de compra com base nas OPs ativas
            </p>
          </div>
        </div>
        <button
          onClick={runMrp}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Calculando...' : 'Executar MRP'}
        </button>
      </div>

      {/* Resultado do último run */}
      {runResult && (
        <div className={`rounded-lg border p-4 ${runResult.sugestoes > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2">
            {runResult.sugestoes > 0
              ? <AlertTriangle className="h-5 w-5 text-amber-600" />
              : <CheckCircle2 className="h-5 w-5 text-green-600" />
            }
            <span className="font-medium">{runResult.message}</span>
          </div>
        </div>
      )}

      {/* Filtro de status */}
      <div className="flex gap-2">
        {['PENDENTE', 'CONVERTIDA', 'REJEITADA', 'CANCELADA'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Tabela de sugestões */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sugestoes.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {filter === 'PENDENTE'
                ? 'Nenhuma sugestão pendente — execute o MRP para calcular necessidades'
                : `Nenhuma sugestão com status "${filter}"`}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Produto</th>
                  <th className="text-left px-4 py-2">Fornecedor</th>
                  <th className="text-right px-4 py-2">Nec. Líquida</th>
                  <th className="text-right px-4 py-2">Qtd Sugerida</th>
                  <th className="text-left px-4 py-2">Prazo</th>
                  <th className="text-left px-4 py-2">OPs Origem</th>
                  <th className="text-left px-4 py-2">Status</th>
                  {filter === 'PENDENTE' && <th className="px-4 py-2">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {sugestoes.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.product?.description}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.product?.code}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {s.supplier?.razaoSocial ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">
                      {Number(s.necessidadeLiquida).toFixed(2)} {s.product?.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {Number(s.quantidadeSugerida).toFixed(2)} {s.product?.unit}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(s.dataNecessidade).toLocaleDateString('pt-BR')}
                      <p className="text-xs text-muted-foreground">Lead {s.leadTimeDias}d</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {(s.opsOrigem ?? []).join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? ''}`}>
                        {s.status}
                      </span>
                    </td>
                    {filter === 'PENDENTE' && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => accept(s.id)}
                            title="Gerar Pedido de Compra"
                            className="p-1.5 rounded hover:bg-green-100 text-green-600"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => reject(s.id)}
                            title="Rejeitar sugestão"
                            className="p-1.5 rounded hover:bg-red-100 text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
