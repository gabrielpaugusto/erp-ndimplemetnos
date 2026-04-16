'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtHours, fmtPercent } from '@/lib/format';

interface ProdutividadeItem {
  employee: {
    id: string;
    nome: string;
    matricula: string;
    cargo: string;
  };
  cargaEsperada: number;
  horasApontadas: number;
  percentual: number;
}

function getCorPercentual(pct: number) {
  if (pct >= 95) return { badge: 'bg-green-100 text-green-700', icon: TrendingUp, iconClass: 'text-green-600', bar: 'bg-green-500' };
  if (pct >= 75) return { badge: 'bg-yellow-100 text-yellow-700', icon: Minus, iconClass: 'text-yellow-600', bar: 'bg-yellow-500' };
  return { badge: 'bg-red-100 text-red-700', icon: TrendingDown, iconClass: 'text-red-600', bar: 'bg-red-500' };
}

function getMesesDisponiveis() {
  const meses = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    meses.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return meses;
}

export default function ProdutividadePage() {
  const meses = getMesesDisponiveis();
  const [mesSelecionado, setMesSelecionado] = useState(meses[0].val);
  const [dados, setDados] = useState<ProdutividadeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<ProdutividadeItem[]>(`/apontamentos/produtividade?mes=${mesSelecionado}`);
      setDados(data);
    } catch {
      setDados([]);
    } finally {
      setLoading(false);
    }
  }, [mesSelecionado]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalCarga = dados.reduce((s, d) => s + d.cargaEsperada, 0);
  const totalApontado = dados.reduce((s, d) => s + d.horasApontadas, 0);
  const totalPct = totalCarga > 0 ? Math.round((totalApontado / totalCarga) * 1000) / 10 : 0;
  const totalCor = getCorPercentual(totalPct);

  const mesLabel = meses.find((m) => m.val === mesSelecionado)?.label ?? mesSelecionado;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtividade</h1>
          <p className="text-sm text-slate-500 mt-0.5">Horas apontadas vs. carga prevista</p>
        </div>
        <div className="relative">
          <select
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm bg-white text-slate-700 cursor-pointer"
          >
            {meses.map((m) => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Totalizador */}
      {dados.length > 0 && (
        <div className={`rounded-xl border p-5 mb-6 flex items-center justify-between ${totalCor.badge.replace('text-', 'border-').replace('-100', '-200').replace('-700', '-400')} bg-white`}>
          <div>
            <p className="text-sm text-slate-500">Total da equipe — {mesLabel}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">
              {fmtHours(totalApontado)} de {fmtHours(totalCarga)} previstas
            </p>
          </div>
          <div className={`text-3xl font-bold px-6 py-2 rounded-xl ${totalCor.badge}`}>
            {fmtPercent(totalPct, 1)}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <span className="animate-spin mr-2">⟳</span> Carregando...
        </div>
      )}

      {!loading && dados.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3" />
          <p>Nenhum dado para {mesLabel}</p>
        </div>
      )}

      {!loading && dados.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Funcionário</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600 whitespace-nowrap">Carga Prevista</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600 whitespace-nowrap">Horas Apontadas</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Produtividade</th>
                <th className="px-5 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dados
                .sort((a, b) => b.percentual - a.percentual)
                .map((item) => {
                  const cor = getCorPercentual(item.percentual);
                  const Icon = cor.icon;
                  return (
                    <tr key={item.employee.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">{item.employee.nome}</p>
                        <p className="text-xs text-slate-400">{item.employee.matricula} · {item.employee.cargo}</p>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-600 font-mono">
                        {fmtHours(item.cargaEsperada)}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-700 font-mono font-medium">
                        {fmtHours(item.horasApontadas)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cor.badge}`}>
                          <Icon className={`w-3 h-3 ${cor.iconClass}`} />
                          {fmtPercent(item.percentual)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cor.bar}`}
                            style={{ width: `${Math.min(item.percentual, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
