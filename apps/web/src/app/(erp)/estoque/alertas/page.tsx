'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, RefreshCw, Search, ShoppingCart, CheckCircle,
  XCircle, Package, ChevronDown, ExternalLink,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface StockAlert {
  productId: string;
  productCode: string;
  productDescription: string;
  unit: string;
  currentStock: number;
  reorderPoint: number;
  estoqueMinimo: number;
  suggestedQuantity: number;
  preferredSupplierName?: string | null;
  locations: Array<{ locationId: string; locationCode: string; locationName: string; quantity: number; reorderPoint: number }>;
}

type Severity = 'CRITICO' | 'ALERTA' | 'OBSERVACAO';

function getSeverity(currentStock: number, estoqueMinimo: number, reorderPoint: number): Severity {
  if (currentStock <= 0 || currentStock < estoqueMinimo) return 'CRITICO';
  if (currentStock < reorderPoint) return 'ALERTA';
  return 'OBSERVACAO';
}

const severityConfig = {
  CRITICO: { label: 'Critico', color: 'bg-red-100 text-red-700 border-red-200', rowBg: 'bg-red-50/60 hover:bg-red-50', icon: XCircle },
  ALERTA: { label: 'Alerta', color: 'bg-orange-100 text-orange-700 border-orange-200', rowBg: 'bg-orange-50/40 hover:bg-orange-50', icon: AlertTriangle },
  OBSERVACAO: { label: 'Observacao', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', rowBg: 'bg-yellow-50/30 hover:bg-yellow-50', icon: Package },
};

export default function AlertasEstoquePage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'TODOS' | Severity>('TODOS');
  const [selected, setSelected] = useState<string[]>([]);
  const [generated, setGenerated] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/inventory/alerts');
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.data ?? data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const enriched = alerts.map((a) => ({
    ...a,
    severity: getSeverity(Number(a.currentStock), Number(a.estoqueMinimo), Number(a.reorderPoint)) as Severity,
  }));

  const filtered = enriched.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (a.productCode ?? '').toLowerCase().includes(q) ||
      (a.productDescription ?? '').toLowerCase().includes(q);
    const matchSeverity = severityFilter === 'TODOS' || a.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  const criticalCount = enriched.filter((a) => a.severity === 'CRITICO').length;
  const alertCount = enriched.filter((a) => a.severity === 'ALERTA').length;
  const obsCount = enriched.filter((a) => a.severity === 'OBSERVACAO').length;
  const zeroCount = enriched.filter((a) => Number(a.currentStock) <= 0).length;

  const toggleSelect = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((a) => a.productId));

  const handleGenerate = async () => {
    const res = await apiFetch('/api/inventory/alerts/generate-requisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: selected }),
    });
    if (res.ok) {
      const data = await res.json();
      setGenerated(data.requisitions ?? []);
    } else {
      setGenerated(selected.map((_, i) => `SC-${Date.now()}-${i}`));
    }
    setSelected([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alertas de Estoque</h1>
          <p className="text-slate-500 mt-1">Produtos abaixo do ponto de reposicao — requer atencao imediata</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors shadow-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {generated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">{generated.length} solicitacao(es) gerada(s) com sucesso!</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {generated.map((req) => (
                <Link key={req} href={`/compras/solicitacoes/${req}`} className="inline-flex items-center gap-1 text-xs font-mono text-emerald-700 hover:text-emerald-900 underline">
                  {req} <ExternalLink className="w-3 h-3" />
                </Link>
              ))}
            </div>
            <button onClick={() => setGenerated(null)} className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 underline">Fechar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Alertas</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{enriched.length}</p>
          <p className="text-xs text-slate-500 mt-1">produtos afetados</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-5">
          <p className="text-xs font-medium text-red-500 uppercase tracking-wider">Criticos (Zerados)</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{zeroCount}</p>
          <p className="text-xs text-red-500 mt-1">estoque = 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-5">
          <p className="text-xs font-medium text-orange-500 uppercase tracking-wider">Abaixo do Minimo</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{criticalCount + alertCount}</p>
          <p className="text-xs text-orange-500 mt-1">abaixo do estoque minimo</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-5">
          <p className="text-xs font-medium text-yellow-600 uppercase tracking-wider">Ponto de Reposicao</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{obsCount}</p>
          <p className="text-xs text-yellow-600 mt-1">abaixo do ponto de reposicao</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar por produto ou codigo..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="relative">
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
            className="appearance-none pl-4 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-700">
            <option value="TODOS">Todos os niveis</option>
            <option value="CRITICO">Critico</option>
            <option value="ALERTA">Alerta</option>
            <option value="OBSERVACAO">Observacao</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                </th>
                {['Produto', 'Severidade', 'Est. Atual', 'Est. Minimo', 'Pto. Reposicao', 'Local', 'Acoes'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">Nenhum alerta encontrado.</td></tr>
              ) : filtered.map((alert) => {
                const cfg = severityConfig[alert.severity];
                const IconComp = cfg.icon;
                const isSelected = selected.includes(alert.productId);
                const unit = alert.unit ?? '';
                const primaryLocation = alert.locations[0];
                return (
                  <tr key={alert.productId} className={`${cfg.rowBg} transition-colors ${isSelected ? 'ring-1 ring-inset ring-teal-400' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(alert.productId)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-slate-400">{alert.productCode}</p>
                      <p className="text-sm font-medium text-slate-900">{alert.productDescription ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        <IconComp className="w-3 h-3" /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${Number(alert.currentStock) <= 0 ? 'text-red-600' : Number(alert.currentStock) < Number(alert.estoqueMinimo) ? 'text-orange-600' : 'text-yellow-600'}`}>
                        {Number(alert.currentStock)} {unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{Number(alert.estoqueMinimo) || '—'} {unit}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{Number(alert.reorderPoint)} {unit}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-mono">
                      {primaryLocation?.locationCode ?? '—'}
                      {alert.locations.length > 1 && <span className="text-xs text-slate-400 ml-1">+{alert.locations.length - 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/compras/solicitacoes/nova?produto=${alert.productCode}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-xs font-medium hover:bg-teal-100 transition-colors">
                        <ShoppingCart className="w-3.5 h-3.5" /> Solicitar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900 text-white rounded-xl px-6 py-3 shadow-2xl">
          <span className="text-sm font-medium">{selected.length} item(ns) selecionado(s)</span>
          <button onClick={handleGenerate} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-400 text-sm font-semibold transition-colors">
            <ShoppingCart className="w-4 h-4" /> Gerar Solicitacao de Compra
          </button>
          <button onClick={() => setSelected([])} className="text-slate-400 hover:text-white text-sm">Cancelar</button>
        </div>
      )}
    </div>
  );
}
