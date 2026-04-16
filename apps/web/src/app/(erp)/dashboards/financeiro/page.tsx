'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, RefreshCw, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Calendar, AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

interface FluxoJanela { entradas: number; saidas: number }

interface FinanceiroData {
  fluxoCaixa:   { d30: FluxoJanela; d60: FluxoJanela; d90: FluxoJanela };
  inadimplencia: { valor: number; qtd: number; pct: number };
  dreMes:       { receitas: number; despesas: number; resultado: number };
  aVencer7dias: { tipo: string; valor: number; vencimento: string; status: string }[];
}

const EMPTY_FLUXO: FluxoJanela = { entradas: 0, saidas: 0 };
const EMPTY: FinanceiroData = {
  fluxoCaixa:   { d30: EMPTY_FLUXO, d60: EMPTY_FLUXO, d90: EMPTY_FLUXO },
  inadimplencia: { valor: 0, qtd: 0, pct: 0 },
  dreMes:       { receitas: 0, despesas: 0, resultado: 0 },
  aVencer7dias: [],
};

export default function FinanceiroDashboard() {
  const [data, setData]       = useState<FinanceiroData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await apiFetch('/api/dashboard/financeiro');
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setErro((msg as any)?.message ?? `Erro ${res.status}`);
        return;
      }
      const json = await res.json();
      setData({
        fluxoCaixa:    json.fluxoCaixa   ?? EMPTY.fluxoCaixa,
        inadimplencia: json.inadimplencia ?? EMPTY.inadimplencia,
        dreMes:        json.dreMes       ?? EMPTY.dreMes,
        aVencer7dias:  json.aVencer7dias ?? [],
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

  const { fluxoCaixa, inadimplencia, dreMes, aVencer7dias } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-7 w-7 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">Financeiro Executivo</h1>
            <p className="text-sm text-muted-foreground">Fluxo de caixa, inadimplência e DRE</p>
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

      {/* DRE do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="h-4 w-4 text-green-500" />
            <p className="text-xs text-muted-foreground">Receitas do Mês</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmtCurrency(dreMes.receitas)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownRight className="h-4 w-4 text-red-500" />
            <p className="text-xs text-muted-foreground">Despesas do Mês</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmtCurrency(dreMes.despesas)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${dreMes.resultado >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-muted-foreground mb-1">Resultado do Mês</p>
          <p className={`text-2xl font-bold ${dreMes.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fmtCurrency(dreMes.resultado)}
          </p>
        </div>
      </div>

      {/* Inadimplência */}
      {inadimplencia.qtd > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-700">Inadimplência</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Títulos vencidos</p>
              <p className="text-lg font-bold text-red-700">{inadimplencia.qtd}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor em atraso</p>
              <p className="text-lg font-bold text-red-700">{fmtCurrency(inadimplencia.valor)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">% da carteira</p>
              <p className="text-lg font-bold text-red-700">{inadimplencia.pct}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Fluxo de Caixa Previsto */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b font-semibold">Fluxo de Caixa Previsto (títulos em aberto)</div>
        <div className="grid grid-cols-3 divide-x">
          {(
            [
              { label: '30 dias', d: fluxoCaixa.d30 },
              { label: '60 dias', d: fluxoCaixa.d60 },
              { label: '90 dias', d: fluxoCaixa.d90 },
            ]
          ).map(({ label, d }) => {
            const f = d ?? EMPTY_FLUXO;
            const saldo = f.entradas - f.saidas;
            return (
              <div key={label} className="p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-3">Próximos {label}</p>
                <div className="flex items-center gap-1 text-green-600 text-sm mb-1">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>Entradas</span>
                  <span className="ml-auto font-semibold">{fmtCurrency(f.entradas)}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600 text-sm mb-2">
                  <ArrowDownRight className="h-3 w-3" />
                  <span>Saídas</span>
                  <span className="ml-auto font-semibold">{fmtCurrency(f.saidas)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className={`flex items-center justify-between font-bold text-sm ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    <span>Saldo</span>
                    <span>{fmtCurrency(saldo)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* A vencer em 7 dias */}
      {aVencer7dias.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Títulos a Vencer em 7 Dias</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Tipo</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Vencimento</th>
                  <th className="text-right px-4 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {aVencer7dias.map((m, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <span className={`font-medium ${m.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.tipo === 'RECEITA' ? 'A Receber' : 'A Pagar'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{m.status}</td>
                    <td className="px-4 py-2">{new Date(m.vencimento).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmtCurrency(m.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
