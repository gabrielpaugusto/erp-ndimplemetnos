'use client';

import { useState } from 'react';
import {
  Zap, Plus, Trash2, AlertTriangle, CheckCircle2, Info,
  ArrowRight, ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
];

const OPERATION_TYPES = [
  { value: 'SAIDA_VENDA_PRODUCAO',      label: 'Venda de Produção Própria',    dir: 'SAIDA' },
  { value: 'SAIDA_VENDA_MERCADORIA',    label: 'Venda de Mercadoria (Revenda)', dir: 'SAIDA' },
  { value: 'SAIDA_VENDA_PECA',          label: 'Venda de Peça de Reposição',   dir: 'SAIDA' },
  { value: 'SAIDA_SERVICO',             label: 'Prestação de Serviço',         dir: 'SAIDA' },
  { value: 'SAIDA_DEVOLUCAO_COMPRA',    label: 'Devolução a Fornecedor',       dir: 'SAIDA' },
  { value: 'SAIDA_REMESSA_INDUSTRIA',   label: 'Remessa para Industrialização',dir: 'SAIDA' },
  { value: 'SAIDA_REMESSA_CONSERTO',    label: 'Remessa para Conserto',        dir: 'SAIDA' },
  { value: 'ENTRADA_COMPRA_INDUSTRIA',  label: 'Compra para Industrialização', dir: 'ENTRADA' },
  { value: 'ENTRADA_COMPRA_COMERCIO',   label: 'Compra para Comercialização',  dir: 'ENTRADA' },
  { value: 'ENTRADA_DEVOLUCAO_VENDA',   label: 'Devolução de Venda Recebida',  dir: 'ENTRADA' },
];

interface ItemInput {
  id: string;
  description: string;
  ncmCode: string;
  quantity: string;
  unitPrice: string;
  origem: string;
}

interface ResolvedItem {
  ncmCode: string;
  cfopCode: string;
  naturezaOperacao: string;
  origem: string;
  cstIcms?: string;
  csosn?: string;
  aliqIcms: number;
  reducaoBcIcms: number;
  bcIcms: number;
  valorIcms: number;
  temSt: boolean;
  cstIpi: string;
  aliqIpi: number;
  valorIpi: number;
  cstPis: string;
  aliqPis: number;
  valorPis: number;
  cstCofins: string;
  aliqCofins: number;
  valorCofins: number;
  aliqIbs: number;
  valorIbs: number;
  aliqCbs: number;
  valorCbs: number;
  temIs: boolean;
  aliqIs: number;
  valorIs: number;
  valorBruto: number;
  valorTotal: number;
  fonte: string;
  avisos: string[];
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtPct = (v: number) => v > 0 ? `${v.toFixed(2)}%` : '-';

const fonteColors: Record<string, string> = {
  REGRA_TRIBUTARIA: 'bg-emerald-100 text-emerald-700',
  NCM_DEFAULTS: 'bg-blue-100 text-blue-700',
  ICMS_INTERESTADUAL: 'bg-amber-100 text-amber-700',
  SISTEMA_PADRAO: 'bg-slate-100 text-slate-600',
};

const fonteLabels: Record<string, string> = {
  REGRA_TRIBUTARIA: 'Regra Tributária',
  NCM_DEFAULTS: 'Padrão do NCM',
  ICMS_INTERESTADUAL: 'Matriz Interestadual',
  SISTEMA_PADRAO: 'Padrão do Sistema',
};

function newItem(): ItemInput {
  return { id: Math.random().toString(36).slice(2), description: '', ncmCode: '', quantity: '1', unitPrice: '0', origem: '0' };
}

function getCompanyId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    return u?.company?.id ?? u?.companyId ?? '';
  } catch { return ''; }
}

function getCompanyUf() {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    return u?.company?.uf ?? 'RS';
  } catch { return 'RS'; }
}

export default function SimuladorFiscalPage() {
  const [ufEmitente] = useState(getCompanyUf);
  const [ufDestinatario, setUfDestinatario] = useState('SP');
  const [contribuinte, setContribuinte] = useState(true);
  const [exterior, setExterior] = useState(false);
  const [operationType, setOperationType] = useState('SAIDA_VENDA_PRODUCAO');
  const [items, setItems] = useState<ItemInput[]>([newItem()]);
  const [results, setResults] = useState<ResolvedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const updateItem = (id: string, field: keyof ItemInput, value: string) =>
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((item) => item.id !== id));

  const simulate = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const companyId = getCompanyId();
      const res = await apiFetch('/api/fiscal/engine/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ufEmitente,
          ufDestinatario: exterior ? 'EX' : ufDestinatario,
          destinatarioContribuinte: contribuinte,
          exterior,
          operationType,
          items: items.map((it) => ({
            description: it.description || 'Item sem descrição',
            ncmCode: it.ncmCode || undefined,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            origem: it.origem,
          })),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResults(json.items ?? []);
        setExpandedIdx(0);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? 'Erro ao simular operação fiscal');
      }
    } catch {
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const totalGeral = results.reduce((acc, r) => acc + r.valorTotal, 0);
  const totalIcms = results.reduce((acc, r) => acc + r.valorIcms, 0);
  const totalPis = results.reduce((acc, r) => acc + r.valorPis, 0);
  const totalCofins = results.reduce((acc, r) => acc + r.valorCofins, 0);
  const totalIbs = results.reduce((acc, r) => acc + r.valorIbs, 0);
  const totalCbs = results.reduce((acc, r) => acc + r.valorCbs, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          Simulador Fiscal Automático
        </h1>
        <p className="text-slate-500 mt-1">
          Teste a resolução automática de CFOP, CST e alíquotas para qualquer combinação de produto × operação × destino
        </p>
      </div>

      {/* Context */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Contexto da Operação</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">UF Emitente</label>
            <input
              readOnly
              value={ufEmitente}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 cursor-not-allowed text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">UF Destinatário</label>
            <select
              value={ufDestinatario}
              onChange={(e) => setUfDestinatario(e.target.value)}
              disabled={exterior}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Operação</label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {OPERATION_TYPES.filter((o) => o.dir === 'SAIDA').length > 0 && (
                <optgroup label="─── Saídas ───">
                  {OPERATION_TYPES.filter((o) => o.dir === 'SAIDA').map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="─── Entradas ───">
                {OPERATION_TYPES.filter((o) => o.dir === 'ENTRADA').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={contribuinte}
                onChange={(e) => setContribuinte(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded"
              />
              <span className="text-sm text-slate-700">Destinatário é contribuinte ICMS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={exterior}
                onChange={(e) => setExterior(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded"
              />
              <span className="text-sm text-slate-700">Operação com exterior (exportação)</span>
            </label>
          </div>
        </div>

        {/* UF badge */}
        {!exterior && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{ufEmitente}</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className={`font-medium px-2 py-0.5 rounded ${ufEmitente === ufDestinatario ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ufDestinatario}</span>
            <span className={`text-xs ${ufEmitente === ufDestinatario ? 'text-emerald-600' : 'text-amber-600'}`}>
              {ufEmitente === ufDestinatario ? '(operação intraestadual)' : '(operação interestadual — ICMS diferenciado)'}
            </span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Itens da Operação</h2>
          <button
            onClick={() => setItems((prev) => [...prev, newItem()])}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 border border-emerald-300 rounded-lg hover:bg-emerald-50"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="col-span-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                <input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Ex: Carroceria baú"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">NCM</label>
                <input
                  value={item.ncmCode}
                  onChange={(e) => updateItem(item.id, 'ncmCode', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="87079090"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Qtd × Preço Unit.</label>
                <div className="flex gap-1">
                  <input
                    type="number" min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    className="w-1/3 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    type="number" min="0" step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                    className="w-2/3 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Origem</label>
                <select
                  value={item.origem}
                  onChange={(e) => updateItem(item.id, 'origem', e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="0">0 – Nacional</option>
                  <option value="1">1 – Estrangeira (importação direta)</option>
                  <option value="2">2 – Estrangeira (adquirida no mercado interno)</option>
                </select>
              </div>
              <div className="col-span-1">
                <p className="text-xs text-slate-500 mb-1">Total</p>
                <p className="text-sm font-medium text-slate-700">
                  {fmt(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
                </p>
              </div>
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button onClick={() => removeItem(item.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <button
        onClick={simulate}
        disabled={loading}
        className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <Zap className="w-5 h-5" />
        {loading ? 'Calculando...' : 'Simular Automação Fiscal'}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Resultado da Automação</h2>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'ICMS', value: totalIcms, color: 'text-slate-700' },
              { label: 'PIS + COFINS', value: totalPis + totalCofins, color: 'text-slate-700' },
              { label: 'IBS', value: totalIbs, color: 'text-teal-700' },
              { label: 'CBS', value: totalCbs, color: 'text-teal-700' },
              { label: 'Total c/ Impostos', value: totalGeral, color: 'text-slate-900' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                <p className={`text-base font-bold ${c.color}`}>{fmt(c.value)}</p>
              </div>
            ))}
          </div>

          {/* Per-item detail */}
          {results.map((r, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedIdx === idx ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRightIcon className="w-4 h-4 text-slate-400" />}
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">Item {idx + 1}</span>
                      <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">CFOP {r.cfopCode}</span>
                      {(r.cstIcms || r.csosn) && (
                        <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {r.cstIcms ? `CST ${r.cstIcms}` : `CSOSN ${r.csosn}`}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${fonteColors[r.fonte]}`}>
                        {fonteLabels[r.fonte]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{r.naturezaOperacao}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">Bruto → Total c/ Impostos</p>
                  <p className="font-semibold text-slate-900">{fmt(r.valorBruto)} → {fmt(r.valorTotal)}</p>
                </div>
              </button>

              {expandedIdx === idx && (
                <div className="border-t border-slate-200 p-4 space-y-4">
                  {/* Avisos */}
                  {r.avisos.length > 0 && (
                    <div className="space-y-1">
                      {r.avisos.map((av, i) => (
                        <div key={i} className="flex gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {av}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tax table */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* ICMS */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">ICMS</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-500">CST/CSOSN</dt><dd className="font-mono font-medium">{r.cstIcms ?? r.csosn ?? '-'}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Alíquota</dt><dd className="font-medium">{fmtPct(r.aliqIcms)}</dd></div>
                        {r.reducaoBcIcms > 0 && <div className="flex justify-between"><dt className="text-slate-500">Redução BC</dt><dd>{fmtPct(r.reducaoBcIcms)}</dd></div>}
                        <div className="flex justify-between border-t border-slate-200 pt-1"><dt className="text-slate-500">Valor</dt><dd className="font-semibold text-slate-800">{fmt(r.valorIcms)}</dd></div>
                        {r.temSt && <div className="mt-1 text-xs text-red-600 font-medium">⚠ Sujeito a ST</div>}
                      </dl>
                    </div>

                    {/* IPI */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">IPI</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-500">CST IPI</dt><dd className="font-mono font-medium">{r.cstIpi}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Alíquota</dt><dd className="font-medium">{fmtPct(r.aliqIpi)}</dd></div>
                        <div className="flex justify-between border-t border-slate-200 pt-1"><dt className="text-slate-500">Valor</dt><dd className="font-semibold text-slate-800">{fmt(r.valorIpi)}</dd></div>
                      </dl>
                    </div>

                    {/* PIS / COFINS */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">PIS / COFINS</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-500">CST</dt><dd className="font-mono font-medium">{r.cstPis}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">PIS</dt><dd className="font-medium">{fmtPct(r.aliqPis)}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">COFINS</dt><dd className="font-medium">{fmtPct(r.aliqCofins)}</dd></div>
                        <div className="flex justify-between border-t border-slate-200 pt-1"><dt className="text-slate-500">Valor</dt><dd className="font-semibold text-slate-800">{fmt(r.valorPis + r.valorCofins)}</dd></div>
                      </dl>
                    </div>

                    {/* Reforma Tributária */}
                    <div className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Reforma (EC 132)</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between"><dt className="text-teal-600">IBS</dt><dd className="font-medium">{fmtPct(r.aliqIbs)} = {fmt(r.valorIbs)}</dd></div>
                        <div className="flex justify-between"><dt className="text-teal-600">CBS</dt><dd className="font-medium">{fmtPct(r.aliqCbs)} = {fmt(r.valorCbs)}</dd></div>
                        {r.temIs && <div className="flex justify-between"><dt className="text-orange-600">IS</dt><dd className="font-medium">{fmtPct(r.aliqIs)} = {fmt(r.valorIs)}</dd></div>}
                        {!r.temIs && r.aliqIbs === 0 && (
                          <p className="text-xs text-teal-500 italic mt-1">Não vigente para {new Date().getFullYear()}</p>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="flex items-center justify-end gap-4 pt-2 border-t border-slate-200">
                    <span className="text-sm text-slate-500">Valor bruto: <strong>{fmt(r.valorBruto)}</strong></span>
                    <span className="text-sm text-slate-500">+Impostos destacados: <strong>{fmt(r.valorTotal - r.valorBruto)}</strong></span>
                    <span className="text-base font-bold text-slate-900">Total: {fmt(r.valorTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
