'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  ClipboardList,
  CheckCircle,
  Plus,
  Eye,
  Calendar,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface RecentRequisition {
  id: string;
  number: string;
  type: string;
  typeColor: string;
  description: string;
  linkedRef: string;
  solicitante: string;
  status: string;
  statusColor: string;
  date: string;
}

interface ApprovalItem {
  id: string;
  number: string;
  type: string;
  typeColor: string;
  solicitante: string;
  linkedRef: string;
  itemCount: number;
  date: string;
}

const typeColorMap: Record<string, string> = {
  INTERNA: 'bg-teal-100 text-teal-700',
  COMPRA: 'bg-purple-100 text-purple-700',
  TRANSFERENCIA: 'bg-blue-100 text-blue-700',
};

const statusLabelMap: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  SOLICITADA: 'Solicitada',
  APROVADA: 'Aprovada',
  SEPARADA: 'Em Separacao',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

const statusColorMap: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600',
  SOLICITADA: 'bg-cyan-100 text-cyan-700',
  APROVADA: 'bg-blue-100 text-blue-700',
  SEPARADA: 'bg-amber-100 text-amber-700',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

function getLinkedRef(r: any): string {
  if (r.serviceOrder) return r.serviceOrder.numero;
  if (r.calderariaOrder) return r.calderariaOrder.numero;
  if (r.productionOrder) return r.productionOrder.numero;
  return '—';
}

export default function RequisicoesDashboardPage() {
  const [recentRequisitions, setRecentRequisitions] = useState<RecentRequisition[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);
  const [pendentesAprovacao, setPendentesAprovacao] = useState(0);
  const [emSeparacao, setEmSeparacao] = useState(0);
  const [entreguesHoje, setEntreguesHoje] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        // Fetch stats
        const statsRes = await apiFetch('/api/requisitions/stats');
        if (statsRes.ok) {
          const stats = await statsRes.json();
          const byStatus: { status: string; count: number }[] = stats.byStatus ?? [];
          setPendentesAprovacao(
            byStatus.find((s) => s.status === 'SOLICITADA')?.count ?? 0
          );
          setEmSeparacao(
            byStatus.find((s) => s.status === 'SEPARADA')?.count ?? 0
          );
        }

        // Fetch recent requisitions (last 10)
        const recentRes = await apiFetch('/api/requisitions?limit=10&page=1');
        if (recentRes.ok) {
          const json = await recentRes.json();
          const mapped: RecentRequisition[] = (json.data ?? []).map((r: any) => ({
            id: r.id,
            number: r.numero,
            type: r.type,
            typeColor: typeColorMap[r.type] ?? 'bg-slate-100 text-slate-600',
            description: r.justificativa ?? '',
            linkedRef: getLinkedRef(r),
            solicitante: r.solicitante?.name ?? '',
            status: statusLabelMap[r.status] ?? r.status,
            statusColor: statusColorMap[r.status] ?? 'bg-slate-100 text-slate-600',
            date: r.createdAt ? r.createdAt.slice(0, 10) : '',
          }));
          setRecentRequisitions(mapped);

          // Approval queue = SOLICITADA items from the recent list
          const approvals: ApprovalItem[] = (json.data ?? [])
            .filter((r: any) => r.status === 'SOLICITADA')
            .map((r: any) => ({
              id: r.id,
              number: r.numero,
              type: r.type,
              typeColor: typeColorMap[r.type] ?? 'bg-slate-100 text-slate-600',
              solicitante: r.solicitante?.name ?? '',
              linkedRef: getLinkedRef(r),
              itemCount: r._count?.items ?? 0,
              date: r.createdAt ? r.createdAt.slice(0, 10) : '',
            }));
          setApprovalQueue(approvals);
        }

        // Count today's deliveries via a targeted query
        const today = new Date().toISOString().slice(0, 10);
        const todayRes = await apiFetch(`/api/requisitions?status=ENTREGUE&limit=100&page=1`);
        if (todayRes.ok) {
          const todayJson = await todayRes.json();
          const todayCount = (todayJson.data ?? []).filter(
            (r: any) => r.updatedAt && r.updatedAt.slice(0, 10) === today
          ).length;
          setEntreguesHoje(todayCount);
        }
      } catch {
        // silently fail — UI will show 0 counts
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requisicoes - Painel de Controle</h1>
          <p className="text-slate-500 mt-1">
            Acompanhe requisicoes internas, compras e transferencias entre setores
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-cyan-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Pendentes Aprovacao</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Aguardando</span>
            <span className="text-2xl font-bold text-cyan-700">{pendentesAprovacao}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Em Separacao</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Sendo preparadas</span>
            <span className="text-2xl font-bold text-teal-700">{emSeparacao}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Entregues Hoje</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Finalizadas</span>
            <span className="text-2xl font-bold text-emerald-700">{entreguesHoje}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/requisicoes/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Requisicao
        </Link>
        <Link
          href="/requisicoes/lista"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 text-sm font-medium transition-colors"
        >
          <ClipboardList className="w-4 h-4" />
          Ver Todas
        </Link>
      </div>

      {/* Approval Queue */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-cyan-600" />
          <h2 className="text-lg font-semibold text-slate-900">Fila de Aprovacao</h2>
        </div>
        {approvalQueue.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma requisicao pendente de aprovacao.</p>
        ) : (
          <div className="space-y-3">
            {approvalQueue.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-cyan-50 rounded-lg border border-cyan-100">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${item.typeColor}`}>
                    {item.type}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.number}</p>
                    <p className="text-xs text-slate-500">Solicitante: {item.solicitante} | Vinculo: {item.linkedRef} | {item.itemCount} itens</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}</span>
                  <Link
                    href={`/requisicoes/${item.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-xs font-medium transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Avaliar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Requisitions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900">Requisicoes Recentes</h2>
          </div>
          <Link href="/requisicoes/lista" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vinculo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhuma requisicao encontrada.
                  </td>
                </tr>
              ) : (
                recentRequisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{req.number}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${req.typeColor}`}>
                        {req.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{req.description}</td>
                    <td className="px-4 py-3 text-sm font-medium text-teal-600">{req.linkedRef}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{req.solicitante}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${req.statusColor}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {req.date ? new Date(req.date).toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/requisicoes/${req.id}`}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
