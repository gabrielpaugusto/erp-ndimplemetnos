'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings, Layers, Route, ClipboardList, Plus, Eye, Calendar,
  Factory, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type OPStatus = 'PLANEJADA' | 'LIBERADA' | 'EM_PRODUCAO' | 'CONCLUIDA' | 'CANCELADA' | string;

interface ProductionOrder {
  id: string;
  number?: string;
  status: OPStatus;
  plannedStartDate?: string;
  startDate?: string;
  strategy?: string;
  plannedQuantity?: number;
  quantity?: number;
  product?: { code: string; name: string } | null;
  bom?: { product?: { name: string } } | null;
}

const statusColors: Record<string, string> = {
  PLANEJADA: 'bg-slate-100 text-slate-600', LIBERADA: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-amber-100 text-amber-700', CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};
const statusLabels: Record<string, string> = {
  PLANEJADA: 'Planejada', LIBERADA: 'Liberada', EM_PRODUCAO: 'Em Produção',
  CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
};

const fmtDate = (s?: string) => s ? new Date(s + (s.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') : '—';

export default function PCPDashboardPage() {
  const [recentOPs, setRecentOPs] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ centros: 0, boms: 0, roteiros: 0, opsPendentes: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const [centrosRes, bomsRes, roteirosRes, opsRes, recentRes] = await Promise.all([
      apiFetch('/api/industrial/pcp/work-centers?limit=1&active=true'),
      apiFetch('/api/industrial/pcp/bom?limit=1'),
      apiFetch('/api/industrial/pcp/routings?limit=1'),
      apiFetch('/api/industrial/production/orders?limit=1&status=PLANEJADA,LIBERADA'),
      apiFetch('/api/industrial/production/orders?limit=8&orderBy=createdAt&order=desc'),
    ]);

    const centros = centrosRes.ok ? (await centrosRes.json()) : {};
    const boms = bomsRes.ok ? (await bomsRes.json()) : {};
    const roteiros = roteirosRes.ok ? (await roteirosRes.json()) : {};
    const ops = opsRes.ok ? (await opsRes.json()) : {};
    const recent = recentRes.ok ? (await recentRes.json()) : {};

    setKpis({
      centros: centros.meta?.total ?? centros.total ?? (centros.data ?? []).length,
      boms: boms.meta?.total ?? boms.total ?? (boms.data ?? []).length,
      roteiros: roteiros.meta?.total ?? roteiros.total ?? (roteiros.data ?? []).length,
      opsPendentes: ops.meta?.total ?? ops.total ?? (ops.data ?? []).length,
    });
    setRecentOPs(Array.isArray(recent.data) ? recent.data : Array.isArray(recent) ? recent : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PCP — Planejamento e Controle de Producao</h1>
          <p className="text-slate-500 mt-1">Gestao de centros de trabalho, estruturas de produto e roteiros de fabricacao</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Factory className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Centros de Trabalho</h3>
            </div>
            <Link href="/pcp/centros-trabalho" className="text-xs text-amber-600 hover:text-amber-700 font-medium">Ver todos</Link>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Ativos</span>
            <span className="text-lg font-bold text-slate-900">{loading ? '—' : kpis.centros}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">BOMs Cadastradas</h3>
            </div>
            <Link href="/pcp/bom" className="text-xs text-orange-600 hover:text-orange-700 font-medium">Ver todas</Link>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Total</span>
            <span className="text-lg font-bold text-slate-900">{loading ? '—' : kpis.boms}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Route className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Roteiros</h3>
            </div>
            <Link href="/pcp/roteiros" className="text-xs text-amber-600 hover:text-amber-700 font-medium">Ver todos</Link>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Cadastrados</span>
            <span className="text-lg font-bold text-slate-900">{loading ? '—' : kpis.roteiros}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">OPs Pendentes</h3>
            </div>
            <Link href="/producao/ordens" className="text-xs text-orange-600 hover:text-orange-700 font-medium">Ver todas</Link>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Aguardando</span>
            <span className="text-lg font-bold text-amber-600 flex items-center gap-1">
              {!loading && kpis.opsPendentes > 0 && <AlertTriangle className="w-3.5 h-3.5" />}
              {loading ? '—' : kpis.opsPendentes}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/pcp/centros-trabalho/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Centro de Trabalho
        </Link>
        <Link href="/pcp/bom/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nova BOM
        </Link>
        <Link href="/pcp/roteiros/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Roteiro
        </Link>
        <Link href="/producao/ordens/nova" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nova Ordem de Producao
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Ordens de Producao Recentes</h2>
          </div>
          <Link href="/producao/ordens" className="text-sm text-amber-600 hover:text-amber-700 font-medium">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Numero', 'Produto', 'Qtd', 'Estrategia', 'Inicio', 'Status', 'Acoes'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></td></tr>
              ) : recentOPs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma ordem de producao encontrada.</td></tr>
              ) : recentOPs.map((op) => {
                const productName = op.product?.name ?? op.bom?.product?.name ?? '—';
                const qty = op.plannedQuantity ?? op.quantity ?? 0;
                const startDate = op.plannedStartDate ?? op.startDate;
                return (
                  <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{op.number ?? op.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{productName}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-center font-semibold">{qty}</td>
                    <td className="px-4 py-3">
                      {op.strategy ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${op.strategy === 'MTO' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                          {op.strategy}
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {fmtDate(startDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[op.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[op.status] ?? op.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/producao/ordens/${op.id}`} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
