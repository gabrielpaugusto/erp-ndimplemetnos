'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Brain, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  BookOpen, Zap, ArrowRight, RefreshCw, MessageSquare,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Metricas {
  totalDecisoes: number;
  autoAplicadas: number;
  revisadasHumano: number;
  taxaAutoAplicacao: number;
  taxaAcertoIA: number;
  mediaConfianca: number;
  excecoesPendentes: number;
}

interface KbStatus {
  totalItens: number;
  populada: boolean;
}

const EMPTY_METRICAS: Metricas = {
  totalDecisoes: 0, autoAplicadas: 0, revisadasHumano: 0,
  taxaAutoAplicacao: 0, taxaAcertoIA: 0, mediaConfianca: 0, excecoesPendentes: 0,
};

export default function IaFiscalHubPage() {
  const [metricas, setMetricas]   = useState<Metricas>(EMPTY_METRICAS);
  const [kbStatus, setKbStatus]   = useState<KbStatus>({ totalItens: 0, populada: false });
  const [seeding, setSeeding]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [erro, setErro]           = useState('');
  const [seedMsg, setSeedMsg]     = useState('');

  async function load() {
    setLoading(true);
    setErro('');
    try {
      const [rMet, rKb] = await Promise.all([
        apiFetch('/api/fiscal-brain/metricas'),
        apiFetch('/api/fiscal-brain/knowledge-base/status'),
      ]);
      if (rMet.ok) setMetricas(await rMet.json());
      if (rKb.ok)  setKbStatus(await rKb.json());
    } catch {
      setErro('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg('');
    try {
      const res = await apiFetch('/api/fiscal-brain/seed-legislacao', { method: 'POST' });
      const json = await res.json();
      setSeedMsg(`Base populada: ${json.criados} itens criados, ${json.ignorados} já existiam.`);
      load();
    } catch {
      setSeedMsg('Erro ao popular base de conhecimento.');
    } finally {
      setSeeding(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cards = [
    {
      href:  '/fiscal/ia/chat',
      icon:  <MessageSquare className="w-6 h-6 text-violet-600" />,
      bg:    'bg-violet-50 border-violet-200',
      title: 'Chat FiscalBrain',
      desc:  'Consultor fiscal inteligente — tire dúvidas de CFOP, CST, alíquotas e ensine regras da operação.',
      badge: null,
      urgent: false,
    },
    {
      href:  '/fiscal/ia/painel-decisoes',
      icon:  <Brain className="w-6 h-6 text-indigo-600" />,
      bg:    'bg-indigo-50 border-indigo-200',
      title: 'Painel de Decisões',
      desc:  'Monitor em tempo real de todas as classificações feitas pela IA.',
      badge: metricas.totalDecisoes > 0 ? `${metricas.totalDecisoes} decisões` : null,
      urgent: false,
    },
    {
      href:  '/fiscal/ia/excecoes',
      icon:  <AlertTriangle className="w-6 h-6 text-amber-500" />,
      bg:    'bg-amber-50 border-amber-200',
      title: 'Fila de Exceções',
      desc:  'Documentos com baixa confiança aguardando revisão humana.',
      badge: metricas.excecoesPendentes > 0 ? `${metricas.excecoesPendentes} pendentes` : null,
      urgent: metricas.excecoesPendentes > 0,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            <Brain className="w-7 h-7 text-violet-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IA Fiscal — Fase 1</h1>
            <p className="text-sm text-gray-500">Classificação automática de documentos fiscais via Claude AI</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Zap className="w-5 h-5 text-violet-500" />}
          label="Taxa Auto-Aplicação"
          value={`${metricas.taxaAutoAplicacao}%`}
          sub="último mês"
          color="violet"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
          label="Acerto da IA"
          value={`${metricas.taxaAcertoIA}%`}
          sub="decisões revisadas"
          color="green"
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
          label="Confiança Média"
          value={`${metricas.mediaConfianca}%`}
          sub="último mês"
          color="blue"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          label="Exceções Pendentes"
          value={String(metricas.excecoesPendentes)}
          sub="aguardando revisão"
          color={metricas.excecoesPendentes > 0 ? 'amber' : 'gray'}
        />
      </div>

      {/* Nav Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`flex items-start gap-4 p-5 rounded-xl border ${c.bg} hover:shadow-md transition-shadow`}
          >
            <div className="p-2 bg-white rounded-lg shadow-sm">{c.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{c.title}</h3>
                {c.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.urgent ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {c.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{c.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
          </Link>
        ))}
      </div>

      {/* Base de Conhecimento */}
      <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Base de Conhecimento Fiscal</h2>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className={`flex items-center gap-1.5 font-medium ${kbStatus.populada ? 'text-green-700' : 'text-amber-600'}`}>
            {kbStatus.populada
              ? <><CheckCircle2 className="w-4 h-4" /> Populada — {kbStatus.totalItens} itens legislativos</>
              : <><AlertTriangle className="w-4 h-4" /> Base vazia — popule antes de usar a IA</>
            }
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          A base contém trechos de RICMS, RIPI, Resoluções do Senado, Convênios CONFAZ,
          Instruções Normativas da RFB e LC 214/2025 (Reforma Tributária). A IA usa esses
          trechos como contexto para fundamentar cada classificação.
        </p>

        {seedMsg && (
          <p className="text-sm text-green-700 font-medium">{seedMsg}</p>
        )}

        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
          {kbStatus.populada ? 'Atualizar Base Legislativa' : 'Popular Base Legislativa'}
        </button>
      </div>

      {/* Status do Regime */}
      <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Regime Tributário Ativo — 2026
        </h3>
        <div className="flex flex-wrap gap-2">
          {['PIS/COFINS', 'ICMS', 'ISS', 'IPI'].map((t) => (
            <span key={t} className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              ■ {t}
            </span>
          ))}
          {['CBS (teste — 0,9%)', 'IBS (teste — 0,1%)'].map((t) => (
            <span key={t} className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
              ◆ {t}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-700 mt-2">
          Em 2026 CBS e IBS estão em período de teste. A IA classifica os dois regimes simultaneamente.
        </p>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  const border = {
    violet: 'border-violet-200', green: 'border-green-200',
    blue: 'border-blue-200', amber: 'border-amber-200', gray: 'border-gray-200',
  }[color] ?? 'border-gray-200';

  return (
    <div className={`p-4 bg-white border ${border} rounded-xl`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
