'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Download,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DreResultado {
  companyId: string;
  periodoReferencia: string;
  tipo: string;
  receitaBrutaVendas: number;
  receitaBrutaServicos: number;
  deducoesReceita: number;
  receitaLiquida: number;
  custoMercadorias: number;
  custoServicos: number;
  lucroBruto: number;
  despesasVendas: number;
  despesasAdm: number;
  despesasGerais: number;
  ebitda: number;
  receitasFinanceiras: number;
  despesasFinanceiras: number;
  resultadoFinanceiro: number;
  lair: number;
  irpj: number;
  csll: number;
  lucroLiquido: number;
  calculadoEm: string;
  fromSnapshot: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function currentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function periodoLabel(p: string): string {
  const [year, month] = p.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year}`;
}

// DRE row component
function DreRow({
  label,
  value,
  isTotal = false,
  isSubtitle = false,
  indent = 0,
  sign = 1,
  collapsible = false,
  defaultOpen = true,
}: {
  label: string;
  value: number;
  isTotal?: boolean;
  isSubtitle?: boolean;
  indent?: number;
  sign?: 1 | -1;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isNegative = value < 0;
  const displayValue = sign * value;

  return (
    <>
      <tr
        className={`${isTotal ? 'bg-slate-100 font-bold' : isSubtitle ? 'bg-slate-50 font-semibold text-slate-600' : 'hover:bg-slate-50'} border-b border-slate-200`}
      >
        <td
          className={`py-2 pr-4 ${isTotal ? 'text-sm' : 'text-sm'}`}
          style={{ paddingLeft: `${(indent + 1) * 16}px` }}
        >
          <div className="flex items-center gap-1">
            {collapsible && (
              <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-slate-600">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {label}
          </div>
        </td>
        <td
          className={`py-2 pl-4 text-right text-sm tabular-nums ${
            isTotal
              ? displayValue >= 0 ? 'text-emerald-700' : 'text-red-600'
              : isNegative ? 'text-red-500' : 'text-slate-800'
          }`}
        >
          {formatCurrency(displayValue)}
        </td>
      </tr>
    </>
  );
}

export default function DrePage() {
  const [periodo, setPeriodo] = useState(currentPeriodo());
  const [dre, setDre] = useState<DreResultado | null>(null);
  const [historico, setHistorico] = useState<DreResultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [view, setView] = useState<'mensal' | 'historico'>('mensal');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    receitas: true, custos: true, despesas: true, financeiro: true,
  });

  const loadDre = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/accounting/dre?periodo=${periodo}`);
      if (res.ok) setDre(await res.json());
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  const loadHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/accounting/dre/historico?meses=12`);
      if (res.ok) setHistorico(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'mensal') loadDre();
    else loadHistorico();
  }, [view, loadDre, loadHistorico]);

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      await apiFetch(`/api/accounting/dre/snapshot?periodo=${periodo}`, { method: 'POST' });
      await loadDre();
    } finally {
      setSavingSnapshot(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderDreTable = (d: DreResultado) => (
    <table className="w-full">
      <tbody>
        {/* Header */}
        <tr className="bg-blue-600 text-white">
          <td className="py-2 px-4 font-bold text-sm">DEMONSTRATIVO DE RESULTADO — {periodoLabel(d.periodoReferencia)}</td>
          <td className="py-2 px-4 text-right font-bold text-sm w-48">Valor (R$)</td>
        </tr>

        {/* RECEITAS */}
        <tr className="bg-emerald-600 text-white cursor-pointer" onClick={() => toggleSection('receitas')}>
          <td className="py-2 px-4 font-bold text-xs tracking-wide flex items-center gap-2">
            {expandedSections.receitas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            RECEITAS
          </td>
          <td className="py-2 px-4 text-right font-bold text-xs"></td>
        </tr>
        {expandedSections.receitas && (
          <>
            <DreRow label="(+) Receita Bruta de Vendas" value={d.receitaBrutaVendas} indent={0} />
            <DreRow label="(+) Receita Bruta de Serviços" value={d.receitaBrutaServicos} indent={0} />
            <DreRow label="(-) Deduções da Receita" value={d.deducoesReceita} indent={0} sign={-1} />
          </>
        )}
        <DreRow label="(=) RECEITA LÍQUIDA" value={d.receitaLiquida} isTotal />

        {/* CUSTOS */}
        <tr className="bg-orange-600 text-white cursor-pointer" onClick={() => toggleSection('custos')}>
          <td className="py-2 px-4 font-bold text-xs tracking-wide flex items-center gap-2">
            {expandedSections.custos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            CUSTOS
          </td>
          <td className="py-2 px-4 text-right font-bold text-xs"></td>
        </tr>
        {expandedSections.custos && (
          <>
            <DreRow label="(-) Custo das Mercadorias Vendidas (CMV)" value={d.custoMercadorias} indent={0} sign={-1} />
            <DreRow label="(-) Custo dos Serviços Prestados (CSP)" value={d.custoServicos} indent={0} sign={-1} />
          </>
        )}
        <DreRow label="(=) LUCRO BRUTO" value={d.lucroBruto} isTotal />

        {/* DESPESAS */}
        <tr className="bg-red-600 text-white cursor-pointer" onClick={() => toggleSection('despesas')}>
          <td className="py-2 px-4 font-bold text-xs tracking-wide flex items-center gap-2">
            {expandedSections.despesas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            DESPESAS OPERACIONAIS
          </td>
          <td className="py-2 px-4 text-right font-bold text-xs"></td>
        </tr>
        {expandedSections.despesas && (
          <>
            <DreRow label="(-) Despesas com Vendas" value={d.despesasVendas} indent={0} sign={-1} />
            <DreRow label="(-) Despesas Administrativas" value={d.despesasAdm} indent={0} sign={-1} />
            <DreRow label="(-) Despesas Gerais" value={d.despesasGerais} indent={0} sign={-1} />
          </>
        )}
        <DreRow label="(=) EBITDA" value={d.ebitda} isTotal />

        {/* FINANCEIRO */}
        <tr className="bg-violet-600 text-white cursor-pointer" onClick={() => toggleSection('financeiro')}>
          <td className="py-2 px-4 font-bold text-xs tracking-wide flex items-center gap-2">
            {expandedSections.financeiro ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            RESULTADO FINANCEIRO
          </td>
          <td className="py-2 px-4 text-right font-bold text-xs"></td>
        </tr>
        {expandedSections.financeiro && (
          <>
            <DreRow label="(+) Receitas Financeiras" value={d.receitasFinanceiras} indent={0} />
            <DreRow label="(-) Despesas Financeiras" value={d.despesasFinanceiras} indent={0} sign={-1} />
          </>
        )}
        <DreRow label="(=) RESULTADO FINANCEIRO" value={d.resultadoFinanceiro} isTotal />

        {/* RESULTADO FINAL */}
        <tr className="bg-slate-700 text-white">
          <td colSpan={2} className="py-1 px-4 text-xs font-bold tracking-wide">RESULTADO FINAL</td>
        </tr>
        <DreRow label="(=) LAIR (Lucro Antes do IR)" value={d.lair} isTotal />
        <DreRow label="(-) IRPJ (15%)" value={d.irpj} indent={0} sign={-1} />
        <DreRow label="(-) CSLL (9%)" value={d.csll} indent={0} sign={-1} />

        <tr className={`border-t-2 border-slate-900 font-black ${d.lucroLiquido >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
          <td className="py-3 px-4 text-base font-black">(=) LUCRO LÍQUIDO</td>
          <td className={`py-3 px-4 text-right text-base font-black tabular-nums ${d.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatCurrency(d.lucroLiquido)}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderHistorico = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-700 text-white">
            <th className="py-2 px-3 text-left font-semibold">Indicador</th>
            {historico.map((h) => (
              <th key={h.periodoReferencia} className="py-2 px-3 text-right font-semibold whitespace-nowrap">
                {periodoLabel(h.periodoReferencia)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { key: 'receitaLiquida', label: 'Receita Líquida', color: 'text-emerald-700' },
            { key: 'custoMercadorias', label: 'CMV', color: 'text-orange-600' },
            { key: 'lucroBruto', label: 'Lucro Bruto', color: 'font-bold' },
            { key: 'despesasAdm', label: 'Despesas Adm', color: 'text-red-500' },
            { key: 'ebitda', label: 'EBITDA', color: 'font-bold' },
            { key: 'resultadoFinanceiro', label: 'Resultado Financeiro', color: '' },
            { key: 'lair', label: 'LAIR', color: 'font-semibold' },
            { key: 'lucroLiquido', label: 'Lucro Líquido', color: 'font-black' },
          ].map(({ key, label, color }) => (
            <tr key={key} className="border-b border-slate-200 hover:bg-slate-50">
              <td className={`py-2 px-3 text-slate-700 ${color}`}>{label}</td>
              {historico.map((h) => {
                const v = (h as any)[key] as number;
                return (
                  <td key={h.periodoReferencia} className={`py-2 px-3 text-right tabular-nums ${v < 0 ? 'text-red-600' : v > 0 ? 'text-emerald-700' : 'text-slate-400'} ${color}`}>
                    {formatCurrency(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">DRE</h1>
          <p className="text-slate-500 text-sm mt-1">Demonstrativo de Resultado do Exercício</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView('mensal')}
              className={`px-4 py-2 text-sm font-medium ${view === 'mensal' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <BarChart3 size={14} className="inline mr-1" />
              Mensal
            </button>
            <button
              onClick={() => setView('historico')}
              className={`px-4 py-2 text-sm font-medium ${view === 'historico' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <TrendingUp size={14} className="inline mr-1" />
              Histórico 12m
            </button>
          </div>

          {/* Period selector (mensal only) */}
          {view === 'mensal' && (
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="input max-w-[180px]"
            />
          )}

          <button
            onClick={() => view === 'mensal' ? loadDre() : loadHistorico()}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            title="Recalcular"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {view === 'mensal' && (
            <button
              onClick={handleSaveSnapshot}
              disabled={savingSnapshot || !dre}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={14} />
              {savingSnapshot ? 'Salvando...' : 'Salvar Snapshot'}
            </button>
          )}
        </div>
      </div>

      {/* KPI cards (mensal only) */}
      {view === 'mensal' && dre && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Receita Líquida', value: dre.receitaLiquida, icon: TrendingUp, color: 'blue' },
            { label: 'Lucro Bruto', value: dre.lucroBruto, icon: BarChart3, color: 'emerald' },
            { label: 'EBITDA', value: dre.ebitda, icon: BarChart3, color: 'violet' },
            { label: 'Lucro Líquido', value: dre.lucroLiquido, icon: dre.lucroLiquido >= 0 ? TrendingUp : TrendingDown, color: dre.lucroLiquido >= 0 ? 'emerald' : 'red' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <Icon size={16} className={`text-${color}-500`} />
              </div>
              <div className={`text-xl font-bold ${value >= 0 ? `text-${color}-700` : 'text-red-600'}`}>
                {formatCurrency(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : view === 'mensal' && dre ? (
          <>
            {dre.fromSnapshot && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                <span>📌 Dados do snapshot salvo em {new Date(dre.calculadoEm).toLocaleString('pt-BR')}</span>
                <button onClick={loadDre} className="underline hover:no-underline">Recalcular ao vivo</button>
              </div>
            )}
            {renderDreTable(dre)}
          </>
        ) : view === 'historico' && historico.length > 0 ? (
          renderHistorico()
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <BarChart3 size={48} className="mb-3 opacity-30" />
            <p className="font-medium">Nenhum dado encontrado</p>
            <p className="text-sm mt-1">Selecione um período ou verifique os lançamentos contábeis</p>
          </div>
        )}
      </div>
    </div>
  );
}
