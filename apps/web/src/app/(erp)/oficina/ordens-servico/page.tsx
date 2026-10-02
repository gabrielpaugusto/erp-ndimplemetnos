'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Wrench,
  AlertTriangle,
  Clock,
  RefreshCw,
  CalendarX,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type OSStatus =
  | 'ORCAMENTO'
  | 'AGUARD_APROVACAO'
  | 'APROVADA'
  | 'EM_EXECUCAO'
  | 'AGUARD_PECAS'
  | 'CONCLUIDA'
  | 'FATURADA'
  | 'CANCELADA'
  | 'VENDA_PERDIDA';

type OSType =
  | 'MECANICA'
  | 'CALDERARIA'
  | 'PINTURA'
  | 'MISTA'
  | 'GARANTIA'
  | 'INSTALACAO'
  | 'INTERNA';

type Priority = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

interface ServiceOrder {
  id: string;
  number: string;
  client: string;
  defeitoRelatado: string;
  equipamento: string;
  placa: string;
  type: OSType;
  status: OSStatus;
  priority: Priority;
  entryDate: string;   // YYYY-MM-DD
  expectedDate: string; // YYYY-MM-DD
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OSStatus, string> = {
  ORCAMENTO:        'Orçamento',
  AGUARD_APROVACAO: 'Aguard. Aprovação',
  APROVADA:         'Aprovada',
  EM_EXECUCAO:      'Em Execução',
  AGUARD_PECAS:     'Aguard. Peças',
  CONCLUIDA:        'Concluída',
  FATURADA:         'Faturada',
  CANCELADA:        'Cancelada',
  VENDA_PERDIDA:    'Venda Perdida',
};

// Tailwind classes for badges
const STATUS_BADGE: Record<OSStatus, string> = {
  ORCAMENTO:        'bg-slate-100 text-slate-600',
  AGUARD_APROVACAO: 'bg-sky-100 text-sky-700',
  APROVADA:         'bg-violet-100 text-violet-700',
  EM_EXECUCAO:      'bg-rose-100 text-rose-700',
  AGUARD_PECAS:     'bg-amber-100 text-amber-700',
  CONCLUIDA:        'bg-emerald-100 text-emerald-700',
  FATURADA:         'bg-blue-100 text-blue-700',
  CANCELADA:        'bg-red-100 text-red-700',
  VENDA_PERDIDA:    'bg-gray-100 text-gray-500',
};

// Left border color on each row (use border-{color} — border-l-4 ensures only left is visible)
const STATUS_ROW_BORDER: Record<OSStatus, string> = {
  ORCAMENTO:        'border-slate-300',
  AGUARD_APROVACAO: 'border-sky-400',
  APROVADA:         'border-violet-400',
  EM_EXECUCAO:      'border-rose-500',
  AGUARD_PECAS:     'border-amber-400',
  CONCLUIDA:        'border-emerald-500',
  FATURADA:         'border-blue-500',
  CANCELADA:        'border-red-400',
  VENDA_PERDIDA:    'border-gray-300',
};

const TYPE_LABELS: Record<OSType, string> = {
  MECANICA:   'Mecânica',
  CALDERARIA: 'Calderaria',
  PINTURA:    'Pintura',
  MISTA:      'Mista',
  GARANTIA:   'Garantia',
  INSTALACAO: 'Instalação',
  INTERNA:    'Interna',
};

const TYPE_BADGE: Record<OSType, string> = {
  MECANICA:   'bg-rose-50 text-rose-700',
  CALDERARIA: 'bg-zinc-100 text-zinc-700',
  PINTURA:    'bg-indigo-50 text-indigo-700',
  MISTA:      'bg-purple-50 text-purple-700',
  GARANTIA:   'bg-orange-50 text-orange-700',
  INSTALACAO: 'bg-teal-50 text-teal-700',
  INTERNA:    'bg-slate-100 text-slate-600',
};

const PRIORITY_DOT: Record<Priority, string> = {
  URGENTE: 'bg-red-500',
  ALTA:    'bg-orange-400',
  NORMAL:  'bg-blue-400',
  BAIXA:   'bg-gray-300',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  URGENTE: 'Urgente',
  ALTA:    'Alta',
  NORMAL:  'Normal',
  BAIXA:   'Baixa',
};

// Status pill order (terminal states excluded from pills)
const STATUS_PILL_ORDER: OSStatus[] = [
  'ORCAMENTO', 'AGUARD_APROVACAO', 'APROVADA', 'EM_EXECUCAO',
  'AGUARD_PECAS', 'CONCLUIDA', 'FATURADA', 'CANCELADA', 'VENDA_PERDIDA',
];

const TERMINAL_STATUSES: OSStatus[] = ['FATURADA', 'CANCELADA', 'VENDA_PERDIDA'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEquipamentoLabel(eq: any): string {
  if (!eq) return '—';
  const parts: string[] = [];
  if (eq.marca) parts.push(eq.marca);
  if (eq.modelo) parts.push(eq.modelo);
  if (eq.tipoCarroceria?.nome) parts.push(eq.tipoCarroceria.nome);
  return parts.join(' ') || '—';
}

function daysAgo(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr + 'T12:00:00');
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OrdensServicoListPage() {
  const router = useRouter();

  const [orders,       setOrders]       = useState<ServiceOrder[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const limit = 20;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)         params.set('search', search);
      if (statusFilter)   params.set('status', statusFilter);
      if (typeFilter)     params.set('type', typeFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (dateFrom)       params.set('startDate', dateFrom);
      if (dateTo)         params.set('endDate', dateTo);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const [res, statsRes] = await Promise.all([
        apiFetch(`/api/service-orders?${params}`),
        apiFetch('/api/service-orders/stats'),
      ]);

      if (!res.ok) return;
      const json = await res.json();

      const mapped: ServiceOrder[] = (json.data ?? []).map((o: any) => ({
        id:              o.id,
        number:          o.numero,
        client:          o.person?.razaoSocial ?? o.person?.nomeFantasia ?? '—',
        defeitoRelatado: o.defeitoRelatado ?? '',
        equipamento:     buildEquipamentoLabel(o.equipamento),
        placa:           o.equipamento?.placa ?? o.equipamento?.serialNumber ?? '—',
        type:            o.type as OSType,
        status:          o.status as OSStatus,
        priority:        (o.priority ?? 'NORMAL') as Priority,
        entryDate:       o.dataEntrada  ? o.dataEntrada.slice(0, 10)  : '',
        expectedDate:    o.dataPrevisao ? o.dataPrevisao.slice(0, 10) : '',
      }));

      setOrders(mapped);
      setTotal(json.meta?.total ?? mapped.length);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const byStatus: { status: string; count: number }[] = statsData.byStatus || [];
        const counts: Record<string, number> = {};
        byStatus.forEach(({ status, count }) => { counts[status] = count; });
        setStatusCounts(counts);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, priorityFilter, dateFrom, dateTo, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, priorityFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || statusFilter || typeFilter || priorityFilter || dateFrom || dateTo;
  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setTypeFilter('');
    setPriorityFilter(''); setDateFrom(''); setDateTo('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Serviço</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {loading ? 'Carregando...' : `${total} OS encontrada${total !== 1 ? 's' : ''}${statusFilter ? ` · ${STATUS_LABELS[statusFilter as OSStatus] ?? statusFilter}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/oficina/ordens-servico/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova OS
          </Link>
        </div>
      </div>

      {/* ── Status KPI pills ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pb-1">
        {/* "Todas" pill */}
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            statusFilter === ''
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          Todas
          {totalAll > 0 && (
            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] ${
              statusFilter === '' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {totalAll}
            </span>
          )}
        </button>

        {STATUS_PILL_ORDER.map((st) => {
          const count = statusCounts[st] ?? 0;
          if (count === 0 && !loading) return null;
          const active = statusFilter === st;
          // Use the full badge class directly when active; a tinted version when inactive
          const activeCls  = STATUS_BADGE[st];
          const inactiveCls = activeCls.split(' ').find(c => c.startsWith('text-')) ?? 'text-slate-600';
          return (
            <button
              key={st}
              onClick={() => { setStatusFilter(st === statusFilter ? '' : st); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? `${activeCls} border-current shadow-sm`
                  : `bg-white ${inactiveCls} border-slate-200 hover:bg-slate-50 hover:border-slate-300`
              }`}
            >
              {/* Pulsing dot for EM_EXECUCAO */}
              {st === 'EM_EXECUCAO' && count > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
              )}
              {STATUS_LABELS[st]}
              {count > 0 && (
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] ${
                  active ? 'bg-black/10' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search + Filters bar ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar número, cliente, placa, chassi, defeito..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shrink-0 ${
              showFilters || (hasActiveFilters && !search)
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {(typeFilter || priorityFilter || dateFrom || dateTo) && (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full">
                {[typeFilter, priorityFilter, dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
              >
                <option value="">Todos</option>
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Prioridade</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
              >
                <option value="">Todas</option>
                <option value="URGENTE">🔴 Urgente</option>
                <option value="ALTA">🟠 Alta</option>
                <option value="NORMAL">🔵 Normal</option>
                <option value="BAIXA">⚪ Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Entrada a partir de</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Entrada até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── OS List ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando ordens de serviço...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Wrench className="w-10 h-10 text-slate-200" />
            <p className="text-slate-500 text-sm font-medium">Nenhuma OS encontrada</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-rose-600 hover:text-rose-700 underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => {
              const dias         = order.entryDate ? daysAgo(order.entryDate) : 0;
              const isTerminal   = TERMINAL_STATUSES.includes(order.status);
              const isOverdue    = !isTerminal && order.expectedDate && new Date(order.expectedDate + 'T23:59:59') < new Date();
              const isRunning    = order.status === 'EM_EXECUCAO';
              const isUrgent     = order.priority === 'URGENTE';

              // Days-open badge color
              const diasColor =
                isTerminal     ? 'text-slate-400'
                : dias >= 30   ? 'text-red-600 font-bold'
                : dias >= 14   ? 'text-amber-600 font-semibold'
                : 'text-slate-500';

              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/oficina/ordens-servico/${order.id}`)}
                  className={`flex items-stretch border-l-4 cursor-pointer hover:bg-rose-50/40 transition-colors group ${
                    STATUS_ROW_BORDER[order.status] ?? 'border-slate-200'
                  } ${isUrgent && !isTerminal ? 'bg-red-50/30' : ''}`}
                >
                  {/* ── Left: OS number + type + priority ── */}
                  <div className="px-4 py-3.5 flex flex-col justify-center w-40 shrink-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {/* Priority dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[order.priority] ?? 'bg-gray-300'}`} title={PRIORITY_LABEL[order.priority]} />
                      <span className="text-sm font-bold text-slate-900 font-mono group-hover:text-rose-700 transition-colors">
                        {order.number}
                      </span>
                    </div>
                    <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_BADGE[order.type] ?? 'bg-slate-100 text-slate-600'}`}>
                      {TYPE_LABELS[order.type] ?? order.type}
                    </span>
                  </div>

                  {/* ── Center: client + defeito + equipamento ── */}
                  <div className="flex-1 px-3 py-3.5 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{order.client}</p>
                        {order.defeitoRelatado && (
                          <p className="text-xs text-slate-500 truncate mt-0.5 max-w-sm">
                            {order.defeitoRelatado.length > 80
                              ? order.defeitoRelatado.slice(0, 80) + '…'
                              : order.defeitoRelatado}
                          </p>
                        )}
                      </div>
                    </div>
                    {order.equipamento !== '—' && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs text-slate-400">
                          {order.equipamento}
                        </span>
                        {order.placa !== '—' && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {order.placa}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Right: status + dates + alerts ── */}
                  <div className="px-4 py-3.5 flex flex-col items-end justify-center gap-1.5 shrink-0 w-48">
                    {/* Status badge */}
                    <div className="flex items-center gap-1.5">
                      {isRunning && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>

                    {/* Overdue warning */}
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                        <CalendarX className="w-2.5 h-2.5" />
                        Atrasada
                      </span>
                    )}

                    {/* Dates + days open */}
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 justify-end">
                        <Clock className="w-2.5 h-2.5" />
                        <span>Entrada: {order.entryDate ? fmtDate(order.entryDate) : '—'}</span>
                      </div>
                      {!isTerminal && (
                        <p className={`text-[10px] mt-0.5 ${diasColor}`}>
                          {dias === 0 ? 'Hoje' : `${dias} dia${dias !== 1 ? 's' : ''} aberta`}
                        </p>
                      )}
                      {order.expectedDate && !isTerminal && (
                        <p className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                          Prev: {fmtDate(order.expectedDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-500">
            {orders.length > 0
              ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total}`
              : `0 de ${total}`}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <span className="text-xs text-slate-600 px-1">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400 px-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Urgente</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Alta</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Normal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Baixa</span>
        <span className="mx-2 text-slate-200">|</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5 text-red-400" /> Atrasada = previsão vencida</span>
        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Dias em aberto (vermelho ≥30)</span>
      </div>
    </div>
  );
}
