'use client';
import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const TABS = [
  { key: 'cst-icms', label: 'CST ICMS (LR/LP)', endpoint: '/api/ref-tables/cst-icms' },
  { key: 'csosn', label: 'CSOSN (SN)', endpoint: '/api/ref-tables/csosn' },
  { key: 'cst-ipi', label: 'CST IPI', endpoint: '/api/ref-tables/cst-ipi' },
  { key: 'cst-pis-cofins', label: 'CST PIS/COFINS', endpoint: '/api/ref-tables/cst-pis-cofins' },
];

const CATEGORIA_COLORS: Record<string, string> = {
  TRIBUTADO: 'bg-red-100 text-red-700',
  TRIBUTADO_ST: 'bg-orange-100 text-orange-700',
  TRIBUTADO_REDUCAO: 'bg-yellow-100 text-yellow-700',
  ISENTO_ST: 'bg-blue-100 text-blue-700',
  ISENTO: 'bg-green-100 text-green-700',
  NAO_TRIBUTADO: 'bg-emerald-100 text-emerald-700',
  SUSPENSAO: 'bg-purple-100 text-purple-700',
  DIFERIMENTO: 'bg-indigo-100 text-indigo-700',
  ST_RECOLHIDO: 'bg-slate-100 text-slate-700',
  REDUCAO_ST: 'bg-amber-100 text-amber-700',
  OUTROS: 'bg-gray-100 text-gray-700',
};

export default function CstReferenciaPage() {
  const [activeTab, setActiveTab] = useState('cst-icms');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    if (!tab) return;
    setLoading(true);
    apiFetch(`${tab.endpoint}?limit=100`).then(r => r.json()).then(json => {
      setData(json.data ?? json);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg"><Shield className="w-5 h-5 text-slate-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tabela CST / CSOSN</h1>
          <p className="text-slate-500 text-sm mt-0.5">Códigos de Situação Tributária oficiais — RFB / SEFAZ</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600 w-24">Código</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Descrição</th>
                {activeTab === 'cst-icms' && <th className="px-4 py-3 text-left font-medium text-slate-600 w-40">Categoria</th>}
                {(activeTab === 'cst-ipi' || activeTab === 'cst-pis-cofins') && <th className="px-4 py-3 text-left font-medium text-slate-600 w-28">Tipo</th>}
                {activeTab === 'cst-pis-cofins' && <th className="px-4 py-3 text-left font-medium text-slate-600 w-36">Regime</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? [...Array(6)].map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse w-2/3" /></td></tr>
              )) : data.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-sm">Nenhum registro encontrado</td></tr>
              ) : data.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-blue-700">{item.code}</td>
                  <td className="px-4 py-3 text-slate-700">{item.description}</td>
                  {activeTab === 'cst-icms' && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORIA_COLORS[item.categoria] ?? 'bg-gray-100 text-gray-700'}`}>{item.categoria}</span>
                    </td>
                  )}
                  {(activeTab === 'cst-ipi' || activeTab === 'cst-pis-cofins') && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.tipo === 'ENTRADA' ? 'bg-green-100 text-green-700' : item.tipo === 'SAIDA' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{item.tipo}</span>
                    </td>
                  )}
                  {activeTab === 'cst-pis-cofins' && (
                    <td className="px-4 py-3 text-xs text-slate-500">{item.regime}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
