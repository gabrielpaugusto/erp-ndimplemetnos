'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package, RefreshCw, AlertTriangle, BarChart3, Truck, AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface CriticoItem {
  productId:   string;
  code:        string;
  descricao:   string;
  disponivel:  number;
  reservado:   number;
  total:       number;
  pontoRessupr: number;
  localidade:  string;
}

interface GiroItem {
  grupo:  string;
  saidas: number;
  saldo:  number;
  giro:   number;
}

interface FornecedorItem {
  nome:       string;
  ocs:        number;
  valorTotal: number;
}

interface ComprasEstoqueData {
  resumo:        { itensCriticos: number; ordensAbertas: number; totalProdutosEstoque: number };
  criticos:      CriticoItem[];
  giroEstoque:   GiroItem[];
  porFornecedor: FornecedorItem[];
}

const EMPTY: ComprasEstoqueData = {
  resumo:        { itensCriticos: 0, ordensAbertas: 0, totalProdutosEstoque: 0 },
  criticos:      [],
  giroEstoque:   [],
  porFornecedor: [],
};

export default function ComprasEstoqueDashboard() {
  const [data, setData]       = useState<ComprasEstoqueData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await apiFetch('/api/dashboard/compras-estoque');
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setErro((msg as any)?.message ?? `Erro ${res.status}`);
        return;
      }
      const json = await res.json();
      setData({
        resumo:        json.resumo        ?? EMPTY.resumo,
        criticos:      json.criticos      ?? [],
        giroEstoque:   json.giroEstoque   ?? [],
        porFornecedor: json.porFornecedor ?? [],
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

  const { resumo, criticos, giroEstoque, porFornecedor } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold">Compras / Estoque</h1>
            <p className="text-sm text-muted-foreground">Itens críticos, giro e ordens de compra</p>
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
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-lg border p-4 ${resumo.itensCriticos > 0 ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
          <p className="text-xs text-muted-foreground">Itens Críticos</p>
          <p className={`text-2xl font-bold ${resumo.itensCriticos > 0 ? 'text-red-600' : ''}`}>
            {resumo.itensCriticos}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">OCs em Aberto</p>
          <p className="text-2xl font-bold">{resumo.ordensAbertas}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Produtos em Estoque</p>
          <p className="text-2xl font-bold">{resumo.totalProdutosEstoque}</p>
        </div>
      </div>

      {/* Itens Críticos */}
      {criticos.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="font-semibold">Itens Abaixo do Ponto de Resuprimento</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Código</th>
                  <th className="text-left px-4 py-2">Descrição</th>
                  <th className="text-right px-4 py-2">Disponível</th>
                  <th className="text-right px-4 py-2">Ponto Res.</th>
                  <th className="text-left px-4 py-2">Local</th>
                </tr>
              </thead>
              <tbody>
                {criticos.map((c) => (
                  <tr key={c.productId} className={`border-t hover:bg-muted/30 ${c.disponivel <= 0 ? 'bg-red-50/60' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-2">{c.descricao}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${c.disponivel <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {c.disponivel}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{c.pontoRessupr}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{c.localidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Giro de Estoque por Grupo */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Giro de Estoque por Grupo (30 dias)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2">Grupo</th>
                <th className="text-right px-4 py-2">Saídas (30d)</th>
                <th className="text-right px-4 py-2">Saldo</th>
                <th className="text-right px-4 py-2">Giro</th>
              </tr>
            </thead>
            <tbody>
              {giroEstoque.slice(0, 10).map((g) => (
                <tr key={g.grupo} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{g.grupo}</td>
                  <td className="px-4 py-2 text-right">{Number(g.saidas).toFixed(0)}</td>
                  <td className="px-4 py-2 text-right">{Number(g.saldo).toFixed(0)}</td>
                  <td className="px-4 py-2 text-right">
                    <GiroBadge giro={Number(g.giro)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {giroEstoque.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Sem dados de movimentação</p>
          )}
        </div>
      </div>

      {/* OCs por Fornecedor */}
      {porFornecedor.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Ordens de Compra Abertas por Fornecedor</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Fornecedor</th>
                  <th className="text-right px-4 py-2">OCs</th>
                </tr>
              </thead>
              <tbody>
                {porFornecedor.slice(0, 10).map((f) => (
                  <tr key={f.nome} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{f.nome}</td>
                    <td className="px-4 py-2 text-right">{f.ocs}</td>
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

function GiroBadge({ giro }: { giro: number }) {
  const color =
    giro >= 2   ? 'bg-green-100 text-green-700' :
    giro >= 0.5 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {giro.toFixed(2)}x
    </span>
  );
}
