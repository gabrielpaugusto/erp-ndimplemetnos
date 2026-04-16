'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Eye,
  DollarSign,
  User,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type StageKey = 'NOVO' | 'QUALIFICADO' | 'PROPOSTA' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';

interface Lead {
  id: string;
  title: string;
  clientName: string;
  estimatedValue: number;
  salesperson: string;
  createdAt: string;
  stage: StageKey;
}

const stages: { key: StageKey; label: string; color: string; borderColor: string; bgColor: string }[] = [
  { key: 'NOVO', label: 'Novo', color: 'text-blue-700', borderColor: 'border-blue-500', bgColor: 'bg-blue-50' },
  { key: 'QUALIFICADO', label: 'Qualificado', color: 'text-yellow-700', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-50' },
  { key: 'PROPOSTA', label: 'Proposta', color: 'text-purple-700', borderColor: 'border-purple-500', bgColor: 'bg-purple-50' },
  { key: 'NEGOCIACAO', label: 'Negociação', color: 'text-orange-700', borderColor: 'border-orange-500', bgColor: 'bg-orange-50' },
  { key: 'GANHO', label: 'Ganho', color: 'text-emerald-700', borderColor: 'border-emerald-500', bgColor: 'bg-emerald-50' },
  { key: 'PERDIDO', label: 'Perdido', color: 'text-red-700', borderColor: 'border-red-500', bgColor: 'bg-red-50' },
];


const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function daysSince(dateStr: string): number {
  const now = new Date();
  const created = new Date(dateStr);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/crm/leads?limit=200')
      .then((res) => res.json())
      .then((json) => {
        const mapped: Lead[] = (json.data ?? []).map((item: any) => ({
          id: item.id,
          title: item.title,
          clientName: item.person?.razaoSocial ?? item.companyName ?? '',
          estimatedValue: item.valorEstimado ?? 0,
          salesperson: item.vendedor?.name ?? '',
          createdAt: item.createdAt ? item.createdAt.slice(0, 10) : '',
          stage: item.status as StageKey,
        }));
        setLeads(mapped);
        setTotal(json.meta?.total ?? mapped.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const moveLeadForward = (leadId: string) => {
    const stageOrder: StageKey[] = ['NOVO', 'QUALIFICADO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO'];
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const idx = stageOrder.indexOf(l.stage);
        if (idx >= 0 && idx < stageOrder.length - 1) {
          return { ...l, stage: stageOrder[idx + 1] };
        }
        return l;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline de Vendas</h1>
          <p className="text-slate-500 mt-1">
            Gerencie seus leads e oportunidades de venda
          </p>
        </div>
        <Link
          href="/crm/pipeline/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
              <p className="text-xs text-slate-500">Total de Leads</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(leads.reduce((sum, l) => sum + l.estimatedValue, 0))}
              </p>
              <p className="text-xs text-slate-500">Valor Total Pipeline</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {leads.filter((l) => l.stage === 'NEGOCIACAO').length}
              </p>
              <p className="text-xs text-slate-500">Em Negociação</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(
                  leads.filter((l) => l.stage === 'GANHO').reduce((sum, l) => sum + l.estimatedValue, 0)
                )}
              </p>
              <p className="text-xs text-slate-500">Ganhos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400">
          Carregando leads...
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.key);
          const stageTotal = stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0);

          return (
            <div key={stage.key} className="flex-shrink-0 w-72">
              {/* Column header */}
              <div
                className={`bg-white rounded-t-lg border border-slate-200 border-t-4 ${stage.borderColor} p-3`}
              >
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${stage.color}`}>
                    {stage.label}
                  </h3>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${stage.bgColor} ${stage.color}`}
                  >
                    {stageLeads.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{formatCurrency(stageTotal)}</p>
              </div>

              {/* Column body */}
              <div className="space-y-2 mt-2 min-h-[200px]">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-900 leading-tight flex-1">
                        {lead.title}
                      </h4>
                      <Link
                        href={`/crm/pipeline/${lead.id}`}
                        className="p-1 text-slate-300 hover:text-blue-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-600">{lead.clientName}</span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-2">
                      <DollarSign className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">
                        {formatCurrency(lead.estimatedValue)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">
                          {daysSince(lead.createdAt)}d atrás
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{lead.salesperson.split(' ')[0]}</span>
                    </div>

                    {stage.key !== 'GANHO' && stage.key !== 'PERDIDO' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLeadForward(lead.id);
                        }}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Avançar
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {stageLeads.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
