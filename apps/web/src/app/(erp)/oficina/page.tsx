'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wrench,
  ClipboardList,
  AlertTriangle,
  Plus,
  Eye,
  Calendar,
  Clock,
  CheckCircle,
  Truck,
  Play,
  Pause,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface RecentOS {
  id: string;
  number: string;
  client: string;
  vehicle: string;
  plate: string;
  type: string;
  status: string;
  statusColor: string;
  priority: string;
  priorityColor: string;
  entryDate: string;
}

interface UrgentOS {
  id: string;
  number: string;
  vehicle: string;
  priority: string;
  priorityColor: string;
  description: string;
  daysOpen: number;
}

interface VehicleInShop {
  id: string;
  plate: string;
  description: string;
  osNumber: string;
  entryDate: string;
  status: string;
  statusColor: string;
}

const STATUS_COLOR_MAP: Record<string, string> = {
  ORCAMENTO: 'bg-slate-100 text-slate-600',
  AGUARD_APROVACAO: 'bg-sky-100 text-sky-700',
  APROVADA: 'bg-violet-100 text-violet-700',
  EM_EXECUCAO: 'bg-rose-100 text-rose-700',
  AGUARD_PECAS: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  FATURADA: 'bg-blue-100 text-blue-700',
  CANCELADA: 'bg-red-100 text-red-700',
  VENDA_PERDIDA: 'bg-gray-100 text-gray-500',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  AGUARD_APROVACAO: 'Aguard. Aprovação',
  APROVADA: 'Aprovada',
  EM_EXECUCAO: 'Em Execução',
  AGUARD_PECAS: 'Aguard. Peças',
  CONCLUIDA: 'Concluída',
  FATURADA: 'Faturada',
  CANCELADA: 'Cancelada',
  VENDA_PERDIDA: 'Venda Perdida',
};

const PRIORITY_COLOR_MAP: Record<string, string> = {
  URGENTE: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  BAIXA: 'bg-gray-100 text-gray-600',
};

const TYPE_LABEL_MAP: Record<string, string> = {
  MECANICA: 'Mecânica',
  CALDERARIA: 'Calderaria',
  PINTURA: 'Pintura',
  MISTA: 'Mista',
  GARANTIA: 'Garantia',
  INSTALACAO: 'Instalação',
  INTERNA: 'Interna',
};

const ACTIVE_STATUSES = ['APROVADA', 'EM_EXECUCAO', 'AGUARD_PECAS'];

export default function OficinaDashboardPage() {
  const [recentOS, setRecentOS] = useState<RecentOS[]>([]);
  const [urgentOS, setUrgentOS] = useState<UrgentOS[]>([]);
  const [vehicles, setVehicles] = useState<VehicleInShop[]>([]);
  const [osAbertas, setOsAbertas] = useState(0);
  const [osEmExecucao, setOsEmExecucao] = useState(0);
  const [osAguardandoPecas, setOsAguardandoPecas] = useState(0);
  const [osConcluidasHoje, setOsConcluidasHoje] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [recentRes, urgentRes, statsRes] = await Promise.all([
          apiFetch('/api/service-orders?limit=5&page=1'),
          apiFetch('/api/service-orders?limit=10&page=1'),
          apiFetch('/api/service-orders/stats'),
        ]);

        if (recentRes.ok) {
          const recentData = await recentRes.json();
          const items = recentData.data || [];
          setRecentOS(
            items.map((os: any) => ({
              id: os.id,
              number: os.numero,
              client: os.person?.razaoSocial ?? os.person?.nomeFantasia ?? '—',
              vehicle: os.equipamento
                ? [os.equipamento.marca, os.equipamento.modelo].filter(Boolean).join(' ') || os.equipamento.tipoCarroceria?.nome || '—'
                : '—',
              plate: os.equipamento?.placa ?? os.equipamento?.serialNumber ?? '—',
              type: TYPE_LABEL_MAP[os.type] ?? os.type,
              status: STATUS_LABEL_MAP[os.status] ?? os.status,
              statusColor: STATUS_COLOR_MAP[os.status] ?? 'bg-slate-100 text-slate-600',
              priority: os.priority ?? 'NORMAL',
              priorityColor: PRIORITY_COLOR_MAP[os.priority] ?? 'bg-blue-100 text-blue-700',
              entryDate: os.dataEntrada,
            }))
          );
        }

        if (urgentRes.ok) {
          const urgentData = await urgentRes.json();
          const allItems: any[] = urgentData.data || [];
          const activeItems = allItems.filter((os) => ACTIVE_STATUSES.includes(os.status));
          const sorted = [...activeItems].sort((a, b) => {
            const priorityOrder: Record<string, number> = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAIXA: 3 };
            return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
          });

          setUrgentOS(
            sorted.slice(0, 3).map((os: any) => {
              const entryDate = os.dataEntrada ? new Date(os.dataEntrada) : new Date();
              const daysOpen = Math.floor((Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
              const equip = os.equipamento;
              const equipLabel = equip
                ? [equip.marca, equip.modelo].filter(Boolean).join(' ') + (equip.placa ? ` — ${equip.placa}` : '')
                : '—';
              return {
                id: os.id,
                number: os.numero,
                vehicle: equipLabel,
                priority: os.priority ?? 'NORMAL',
                priorityColor: PRIORITY_COLOR_MAP[os.priority] ?? 'bg-blue-100 text-blue-700',
                description: os.defeitoRelatado ?? '—',
                daysOpen,
              };
            })
          );

          setVehicles(
            activeItems.map((os: any) => ({
              id: os.id,
              plate: os.equipamento?.placa ?? os.equipamento?.serialNumber ?? '—',
              description: os.equipamento
                ? [os.equipamento.marca, os.equipamento.modelo].filter(Boolean).join(' ') || os.equipamento.tipoCarroceria?.nome || '—'
                : '—',
              osNumber: os.numero,
              entryDate: os.dataEntrada,
              status: STATUS_LABEL_MAP[os.status] ?? os.status,
              statusColor: STATUS_COLOR_MAP[os.status] ?? 'bg-slate-100 text-slate-600',
            }))
          );
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          const byStatus: { status: string; count: number }[] = statsData.byStatus || [];
          const getCount = (s: string) => byStatus.find((x) => x.status === s)?.count ?? 0;
          setOsAbertas(getCount('ORCAMENTO') + getCount('AGUARD_APROVACAO') + getCount('APROVADA'));
          setOsEmExecucao(getCount('EM_EXECUCAO'));
          setOsAguardandoPecas(getCount('AGUARD_PECAS'));
          setOsConcluidasHoje(getCount('CONCLUIDA'));
        }
      } catch (err) {
        console.error('Erro ao carregar painel oficina:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Oficina - Painel de Controle</h1>
          <p className="text-slate-500 mt-1">
            Acompanhe ordens de servico, veiculos na oficina e indicadores
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">OS Ativas</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Orç + Aprovadas</span>
            <span className="text-2xl font-bold text-rose-700">{loading ? '—' : osAbertas}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Play className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Em Execução</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Sendo trabalhadas</span>
            <span className="text-2xl font-bold text-red-600">{loading ? '—' : osEmExecucao}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Pause className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Aguardando Pecas</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Paradas</span>
            <span className="text-2xl font-bold text-amber-600">{loading ? '—' : osAguardandoPecas}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Concluídas Hoje</h3>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Finalizadas</span>
            <span className="text-2xl font-bold text-emerald-700">{loading ? '—' : osConcluidasHoje}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/oficina/ordens-servico/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem de Servico
        </Link>
        <Link
          href="/oficina/ordens-servico"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-rose-700 border border-rose-300 rounded-lg hover:bg-rose-50 text-sm font-medium transition-colors"
        >
          <ClipboardList className="w-4 h-4" />
          Ver Todas as OSs
        </Link>
      </div>

      {/* Urgency List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-slate-900">OSs por Prioridade</h2>
        </div>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : urgentOS.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma OS ativa.</p>
          ) : (
            urgentOS.map((os) => (
              <div key={os.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${os.priorityColor}`}>
                    {os.priority}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{os.number} — {os.vehicle}</p>
                    <p className="text-xs text-slate-500">{os.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{os.daysOpen} dias aberta</span>
                  <Link
                    href={`/oficina/ordens-servico/${os.id}`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Vehicles in Workshop */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-slate-900">Veiculos na Oficina</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum veículo na oficina.</p>
          ) : (
            vehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-rose-200 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 font-mono">{v.plate}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.statusColor}`}>
                      {v.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{v.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{v.osNumber}</span>
                    <span className="text-xs text-slate-400">|</span>
                    <span className="text-xs text-slate-400">Entrada: {new Date(v.entryDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <Link
                  href={`/oficina/ordens-servico/${v.id}`}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent OS Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-semibold text-slate-900">Ordens de Servico Recentes</h2>
          </div>
          <Link href="/oficina/ordens-servico" className="text-sm text-rose-600 hover:text-rose-700 font-medium">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Numero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Veiculo / Placa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrada</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">Carregando...</td>
                </tr>
              ) : recentOS.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma ordem de serviço encontrada.</td>
                </tr>
              ) : (
                recentOS.map((os) => (
                  <tr key={os.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{os.number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{os.client}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {os.vehicle} <span className="font-mono text-xs text-slate-500">({os.plate})</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{os.type}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${os.priorityColor}`}>
                        {os.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${os.statusColor}`}>
                        {os.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(os.entryDate).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/oficina/ordens-servico/${os.id}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors inline-flex"
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
