'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Factory, Handshake, Landmark, Wrench, Receipt, DollarSign,
  Sparkles, AlertTriangle, AlertCircle, Info, X, ArrowRight,
  RefreshCw, Package, Users, TrendingUp, AlertOctagon,
  ShoppingCart, ClipboardList, Zap, GitBranch, CheckCircle2, XCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type InsightSeverity = 'info' | 'warning' | 'critical';

interface AiInsight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  category: string;
  actionUrl?: string;
}

interface KPIs {
  totalProdutos: number;
  totalPessoas: number;
  ordensProducao: number;
  titulosVencidos: number;
}

interface PendingItem {
  label: string;
  count: number;
  href: string;
  color: string;
  icon: typeof ClipboardList;
}

interface ModulePending {
  module: string;
  icon: typeof Factory;
  color: string;
  items: PendingItem[];
}

interface ApprovalRequestItem {
  id: string;
  module: string;
  documentType: string;
  documentId: string;
  status: string;
  nivelAtual: number;
  totalNiveis: number;
  criadoEm: string;
  solicitante: { id: string; name: string; email: string };
  policy: { levels: { ordem: number; roleId: string; role: { id: string; name: string } }[] };
}

const APPROVAL_MODULE_LABELS: Record<string, string> = {
  COMPRAS:    'Compras',
  VENDAS:     'Vendas',
  RH:         'RH',
  FINANCEIRO: 'Financeiro',
  ESTOQUE:    'Estoque',
};

const APPROVAL_DOC_TYPE_LABELS: Record<string, string> = {
  SOLICITACAO_COMPRA: 'Solicitação de Compra',
  COTACAO:            'Cotação',
  ORDEM_COMPRA:       'Ordem de Compra',
  PEDIDO_VENDA:       'Pedido de Venda',
  PAGAMENTO:          'Pagamento',
  FERIAS:             'Férias',
  ADMISSAO:           'Admissão',
  DEMISSAO:           'Demissão',
  AJUSTE_ESTOQUE:     'Ajuste de Estoque',
};

const severityConfig: Record<InsightSeverity, {
  bg: string; border: string; icon: typeof Info; iconColor: string; badgeBg: string;
}> = {
  info:     { bg: 'bg-blue-50',  border: 'border-blue-200',  icon: Info,          iconColor: 'text-blue-500',  badgeBg: 'bg-blue-100 text-blue-700'  },
  warning:  { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle,  iconColor: 'text-amber-500', badgeBg: 'bg-amber-100 text-amber-700' },
  critical: { bg: 'bg-red-50',   border: 'border-red-200',   icon: AlertCircle,   iconColor: 'text-red-500',   badgeBg: 'bg-red-100 text-red-700'    },
};

const actionLabelByCategory: Record<string, string> = {
  financeiro: 'Ver títulos vencidos',
  estoque:    'Ver saldos de estoque',
  producao:   'Ver ordens de produção',
  compras:    'Ver solicitações',
};

const modules = [
  { name: 'Industrial',  description: 'Engenharia, PCP, Produção, Qualidade',   icon: Factory,   color: 'bg-blue-500',    href: '/producao/ordens'  },
  { name: 'Comercial',   description: 'CRM, Vendas, Orçamentos',                icon: Handshake, color: 'bg-emerald-500', href: '/crm/pessoas'      },
  { name: 'F&I',         description: 'Financiamento, Consórcio, Seguro',       icon: Landmark,  color: 'bg-violet-500',  href: '/fi'               },
  { name: 'Oficina',     description: 'Ordens de Serviço, Calderaria',          icon: Wrench,    color: 'bg-orange-500',  href: '/oficina/os'       },
  { name: 'Fiscal',      description: 'NF-e, CT-e, Escrituração',               icon: Receipt,   color: 'bg-rose-500',    href: '/fiscal'           },
  { name: 'Financeiro',  description: 'Contas a Pagar/Receber, Fluxo de Caixa', icon: DollarSign, color: 'bg-amber-500', href: '/financeiro'       },
];

function getCompanyId() {
  try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.company?.id ?? ''; } catch { return ''; }
}

export default function DashboardPage() {
  const [insights, setInsights]         = useState<AiInsight[]>([]);
  const [kpis, setKpis]                 = useState<KPIs>({ totalProdutos: 0, totalPessoas: 0, ordensProducao: 0, titulosVencidos: 0 });
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [userName, setUserName]         = useState('');
  const [modulePendings, setModulePendings] = useState<ModulePending[]>([]);
  const [loadingPendings, setLoadingPendings] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequestItem[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [approvingId, setApprovingId]   = useState<string | null>(null);
  const [rejectingId, setRejectingId]   = useState<string | null>(null);

  // ── carrega insights reais ──────────────────────────────────────────────────
  const loadInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const res = await apiFetch('/api/ai/insights');
      if (res.ok) setInsights(await res.json());
    } catch { /* ignore */ } finally { setLoadingInsights(false); }
  }, []);

  // ── gera novos insights analisando dados reais ──────────────────────────────
  const generateInsights = async () => {
    setGenerating(true);
    try {
      await apiFetch('/api/ai/insights/generate', { method: 'POST' });
      await loadInsights();
    } catch { /* ignore */ } finally { setGenerating(false); }
  };

  // ── descarta insight ────────────────────────────────────────────────────────
  const dismissInsight = async (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    await apiFetch(`/api/ai/insights/${id}/dismiss`, { method: 'PATCH' }).catch(() => {});
  };

  // ── Pendências por módulo ───────────────────────────────────────────────────
  const loadPendings = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) { setLoadingPendings(false); return; }
    setLoadingPendings(true);
    try {
      const safeCount = async (res: PromiseSettledResult<Response>): Promise<number> => {
        if (res.status !== 'fulfilled' || !res.value.ok) return 0;
        const j = await res.value.json().catch(() => ({}));
        return j.meta?.total ?? (Array.isArray(j.data) ? j.data.length : Array.isArray(j) ? j.length : 0);
      };

      const [rPurchReq, rPurchOrd, rProdPlan, rProdExec, rStockAlert, rSaleOrd] = await Promise.allSettled([
        apiFetch(`/api/purchasing/requests?companyId=${companyId}&status=SOLICITADA&limit=1`),
        apiFetch(`/api/purchasing/orders?companyId=${companyId}&status=CONFIRMADA&limit=1`),
        apiFetch(`/api/production/orders?companyId=${companyId}&status=PLANEJADA&limit=1`),
        apiFetch(`/api/production/orders?companyId=${companyId}&status=EM_PRODUCAO&limit=1`),
        apiFetch(`/api/stock/alerts?companyId=${companyId}&active=true&limit=1`),
        apiFetch(`/api/sale-orders?companyId=${companyId}&status=APROVADO&limit=1`),
      ]);

      const [cPurchReq, cPurchOrd, cProdPlan, cProdExec, cStockAlert, cSaleOrd] = await Promise.all([
        safeCount(rPurchReq), safeCount(rPurchOrd), safeCount(rProdPlan),
        safeCount(rProdExec), safeCount(rStockAlert), safeCount(rSaleOrd),
      ]);

      const pendings: ModulePending[] = [];

      if (cPurchReq > 0 || cPurchOrd > 0) {
        pendings.push({
          module: 'Compras', icon: ShoppingCart, color: 'bg-amber-500',
          items: [
            { label: 'Solicitações aguardando aprovação', count: cPurchReq, href: '/compras/solicitacoes', color: 'text-amber-600', icon: ClipboardList },
            { label: 'Pedidos confirmados aguardando entrega', count: cPurchOrd, href: '/compras/pedidos', color: 'text-amber-700', icon: ShoppingCart },
          ].filter(i => i.count > 0),
        });
      }

      if (cProdPlan > 0 || cProdExec > 0) {
        pendings.push({
          module: 'Produção', icon: Factory, color: 'bg-blue-500',
          items: [
            { label: 'Ordens planejadas aguardando liberação', count: cProdPlan, href: '/producao/ordens', color: 'text-blue-600', icon: ClipboardList },
            { label: 'Ordens em produção', count: cProdExec, href: '/producao/ordens', color: 'text-blue-700', icon: Zap },
          ].filter(i => i.count > 0),
        });
      }

      if (cStockAlert > 0) {
        pendings.push({
          module: 'Estoque', icon: Package, color: 'bg-rose-500',
          items: [
            { label: 'Alertas de estoque mínimo', count: cStockAlert, href: '/estoque/alertas', color: 'text-rose-600', icon: AlertTriangle },
          ],
        });
      }

      if (cSaleOrd > 0) {
        pendings.push({
          module: 'Comercial', icon: Handshake, color: 'bg-emerald-500',
          items: [
            { label: 'Pedidos de venda aprovados (não faturados)', count: cSaleOrd, href: '/comercial/pedidos', color: 'text-emerald-600', icon: Receipt },
          ],
        });
      }

      setModulePendings(pendings);
    } catch { /* ignore */ } finally { setLoadingPendings(false); }
  }, []);

  // ── Aprovações pendentes ────────────────────────────────────────────────────
  const loadApprovals = useCallback(async () => {
    setLoadingApprovals(true);
    try {
      const res = await apiFetch('/api/approvals/pending');
      if (res.ok) {
        const data = await res.json();
        setPendingApprovals(Array.isArray(data) ? data.slice(0, 5) : []);
      }
    } catch { /* ignore */ } finally { setLoadingApprovals(false); }
  }, []);

  const handleApprove = async (request: ApprovalRequestItem) => {
    const currentLevel = request.policy.levels.find((l) => l.ordem === request.nivelAtual);
    if (!currentLevel) return;
    setApprovingId(request.id);
    try {
      await apiFetch(`/api/approvals/${request.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ roleId: currentLevel.roleId }),
      });
      await loadApprovals();
    } catch { /* ignore */ } finally { setApprovingId(null); }
  };

  const handleReject = async (request: ApprovalRequestItem) => {
    const motivo = prompt('Informe o motivo da rejeição:');
    if (!motivo) return;
    const currentLevel = request.policy.levels.find((l) => l.ordem === request.nivelAtual);
    if (!currentLevel) return;
    setRejectingId(request.id);
    try {
      await apiFetch(`/api/approvals/${request.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ roleId: currentLevel.roleId, comentario: motivo }),
      });
      await loadApprovals();
    } catch { /* ignore */ } finally { setRejectingId(null); }
  };

  // ── KPIs reais em paralelo ──────────────────────────────────────────────────
  const loadKpis = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    try {
      const [rProd, rPess, rOP] = await Promise.allSettled([
        apiFetch(`/api/products?companyId=${companyId}&limit=1`),
        apiFetch(`/api/persons?companyId=${companyId}&limit=1&active=true`),
        apiFetch(`/api/production/orders?companyId=${companyId}&limit=1&status=PLANEJADA`),
      ]);

      const parse = async (r: PromiseSettledResult<Response>) => {
        if (r.status === 'fulfilled' && r.value.ok) {
          const j = await r.value.json();
          return j.meta?.total ?? 0;
        }
        return 0;
      };

      setKpis({
        totalProdutos:   await parse(rProd),
        totalPessoas:    await parse(rPess),
        ordensProducao:  await parse(rOP),
        titulosVencidos: insights.filter(i => i.category === 'financeiro').length,
      });
    } catch { /* ignore */ }
  }, [insights]);

  useEffect(() => {
    try { setUserName(JSON.parse(localStorage.getItem('user') ?? '{}')?.name ?? ''); } catch { /**/ }
    loadInsights();
    loadPendings();
    loadApprovals();
  }, [loadInsights, loadPendings, loadApprovals]);

  useEffect(() => { loadKpis(); }, [loadKpis]);

  const kpiCards = [
    { label: 'Produtos Cadastrados', value: kpis.totalProdutos, icon: Package,       color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Clientes Ativos',      value: kpis.totalPessoas,  icon: Users,         color: 'text-emerald-600', bg: 'bg-emerald-50'},
    { label: 'Ordens de Produção',   value: kpis.ordensProducao,icon: TrendingUp,    color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Alertas Ativos',       value: insights.length,    icon: AlertOctagon,  color: 'text-rose-600',   bg: 'bg-rose-50'   },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            {userName ? `Bem-vindo, ${userName}. ` : 'Bem-vindo ao '}ERP Implementos — selecione um módulo para começar.
          </p>
        </div>
        <button
          onClick={generateInsights}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Analisando...' : 'Atualizar Insights'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`${k.bg} p-2.5 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pendências por Módulo */}
      {(loadingPendings || modulePendings.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-900">Pendências</h2>
            {!loadingPendings && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {modulePendings.reduce((s, m) => s + m.items.reduce((ss, i) => ss + i.count, 0), 0)} itens
              </span>
            )}
          </div>

          {loadingPendings ? (
            <div className="text-sm text-slate-400 py-3 text-center">Carregando pendências...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {modulePendings.map((mod) => {
                const ModIcon = mod.icon;
                return (
                  <div key={mod.module} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className={`${mod.color} px-4 py-2.5 flex items-center gap-2`}>
                      <ModIcon className="w-4 h-4 text-white" />
                      <span className="text-sm font-semibold text-white">{mod.module}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {mod.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link key={item.label} href={item.href}
                            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <ItemIcon className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
                              <span className="text-xs text-slate-600 truncate">{item.label}</span>
                            </div>
                            <span className={`text-sm font-bold ${item.color} shrink-0 ml-2`}>{item.count}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Aprovações Pendentes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-semibold text-slate-900">Aprovações Pendentes</h2>
          {!loadingApprovals && pendingApprovals.length > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              {pendingApprovals.length} {pendingApprovals.length === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>

        {loadingApprovals ? (
          <div className="text-sm text-slate-400 py-3 text-center">Carregando aprovações...</div>
        ) : pendingApprovals.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Nenhuma aprovação pendente. Tudo em dia!
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {pendingApprovals.map((req) => {
                const currentLevel = req.policy.levels.find((l) => l.ordem === req.nivelAtual);
                return (
                  <div key={req.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                        <GitBranch className="w-4 h-4 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                            {APPROVAL_MODULE_LABELS[req.module] ?? req.module}
                          </span>
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {APPROVAL_DOC_TYPE_LABELS[req.documentType] ?? req.documentType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>Por: <span className="font-medium text-slate-700">{req.solicitante.name}</span></span>
                          <span className="text-slate-300">·</span>
                          <span>{new Date(req.criadoEm).toLocaleDateString('pt-BR')}</span>
                          <span className="text-slate-300">·</span>
                          <span>Nível {req.nivelAtual}/{req.totalNiveis}: {currentLevel?.role?.name ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={approvingId === req.id}
                        title="Aprovar"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50"
                      >
                        {approvingId === req.id
                          ? <div className="animate-spin w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full" />
                          : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        disabled={rejectingId === req.id}
                        title="Rejeitar"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        {rejectingId === req.id
                          ? <div className="animate-spin w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full" />
                          : <XCircle className="w-3.5 h-3.5" />}
                        Rejeitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* AI Insights */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Insights IA</h2>
          {!loadingInsights && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {insights.length} {insights.length === 1 ? 'alerta' : 'alertas'}
            </span>
          )}
        </div>

        {loadingInsights ? (
          <div className="text-sm text-slate-400 py-4 text-center">Carregando insights...</div>
        ) : insights.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-700 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Nenhum alerta ativo no momento. Sistema operando normalmente.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {insights.map((insight) => {
              const sev = (insight.severity as InsightSeverity) in severityConfig
                ? (insight.severity as InsightSeverity) : 'info';
              const config = severityConfig[sev];
              const SeverityIcon = config.icon;
              const actionLabel = actionLabelByCategory[insight.category] || 'Ver detalhes';
              return (
                <div key={insight.id} className={`${config.bg} border ${config.border} rounded-lg p-4 relative`}>
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded transition-colors"
                    title="Dispensar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start gap-3 pr-6">
                    <SeverityIcon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">{insight.title}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${config.badgeBg} mb-2`}>
                        {insight.category}
                      </span>
                      <p className="text-xs text-slate-600 mt-1">{insight.description}</p>
                      {insight.actionUrl && (
                        <Link href={insight.actionUrl}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 mt-2">
                          {actionLabel} <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.name} href={mod.href}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between">
                <div className={`${mod.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1" title="Ativo" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mt-4">{mod.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{mod.description}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium">● Ativo</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
