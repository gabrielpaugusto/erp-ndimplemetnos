'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, RefreshCw, Clock, TrendingUp,
  Users, AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

interface ComercialData {
  funil: {
    orcamentosAbertos:  number;
    orcamentosAceitos:  number;
    pedidosAbertos:     number;
    pedidosFaturados:   number;
  };
  ticketMedio:      number;
  taxaConversao:    number;
  top10Clientes:    { nome: string; total: number; pedidos: number }[];
  expirandoEm3Dias: { id: string; numero: number; total: number; validadeOrcamento: string; person: { razaoSocial: string } }[];
  totalFaturadoMes: number;
}

const EMPTY: ComercialData = {
  funil:            { orcamentosAbertos: 0, orcamentosAceitos: 0, pedidosAbertos: 0, pedidosFaturados: 0 },
  ticketMedio:      0,
  taxaConversao:    0,
  top10Clientes:    [],
  expirandoEm3Dias: [],
  totalFaturadoMes: 0,
};

export default function ComercialDashboard() {
  const [data, setData]       = useState<ComercialData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await apiFetch('/api/dashboard/comercial');
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setErro((msg as any)?.message ?? `Erro ${res.status}`);
        return;
      }
      const json = await res.json();
      setData({
        funil:            json.funil            ?? EMPTY.funil,
        ticketMedio:      json.ticketMedio      ?? 0,
        taxaConversao:    json.taxaConversao    ?? 0,
        top10Clientes:    json.top10Clientes    ?? [],
        expirandoEm3Dias: json.expirandoEm3Dias ?? [],
        totalFaturadoMes: json.totalFaturadoMes ?? 0,
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

  const { funil, ticketMedio, taxaConversao, top10Clientes, expirandoEm3Dias, totalFaturadoMes } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-7 w-7 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold">Dashboard Comercial</h1>
            <p className="text-sm text-muted-foreground">Funil, faturamento e clientes</p>
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

      {/* KPIs linha 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Faturado no Mês</p>
          <p className="text-xl font-bold text-green-600">{fmtCurrency(totalFaturadoMes)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ticket Médio</p>
          <p className="text-xl font-bold">{fmtCurrency(ticketMedio)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
          <p className="text-xl font-bold">{taxaConversao}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Orçamentos a Vencer</p>
          <p className={`text-xl font-bold ${expirandoEm3Dias.length > 0 ? 'text-amber-600' : ''}`}>
            {expirandoEm3Dias.length}
          </p>
        </div>
      </div>

      {/* Funil de Vendas */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Funil de Vendas</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x">
          <FunilStep label="Orçamentos Abertos" value={funil.orcamentosAbertos}  color="bg-blue-50"   textColor="text-blue-700"  />
          <FunilStep label="Orçamentos Aceitos" value={funil.orcamentosAceitos}  color="bg-indigo-50" textColor="text-indigo-700"/>
          <FunilStep label="Pedidos em Aberto"  value={funil.pedidosAbertos}     color="bg-amber-50"  textColor="text-amber-700" />
          <FunilStep label="Pedidos Faturados"  value={funil.pedidosFaturados}   color="bg-green-50"  textColor="text-green-700" />
        </div>
      </div>

      {/* Orçamentos expirando */}
      {expirandoEm3Dias.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-amber-700">Orçamentos expirando em 3 dias</span>
          </div>
          <div className="divide-y divide-amber-100">
            {expirandoEm3Dias.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">#{o.numero} — {o.person?.razaoSocial}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{fmtCurrency(o.total)}</p>
                  <p className="text-xs text-amber-600">
                    Válido até {new Date(o.validadeOrcamento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 Clientes */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Top 10 Clientes por Faturamento</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-right px-4 py-2">Pedidos</th>
                <th className="text-right px-4 py-2">Faturado</th>
              </tr>
            </thead>
            <tbody>
              {top10Clientes.map((c, i) => (
                <tr key={c.nome} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{c.nome}</td>
                  <td className="px-4 py-2 text-right">{c.pedidos}</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmtCurrency(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {top10Clientes.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Sem dados de faturamento</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FunilStep({ label, value, color, textColor }: { label: string; value: number; color: string; textColor: string }) {
  return (
    <div className={`${color} px-4 py-5 text-center`}>
      <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
