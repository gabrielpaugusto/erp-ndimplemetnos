'use client';

import Link from 'next/link';
import {
  Tag,
  ArrowLeftRight,
  ShieldCheck,
  ShieldAlert,
  Layers,
  LayoutList,
  ListTree,
  Map,
  Landmark,
  Globe,
} from 'lucide-react';

const INDICES = [
  { label: 'NCM', description: 'Nomenclatura Comum do Mercosul', path: '/fiscal/indices/ncm', icon: Tag, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { label: 'CFOP', description: 'Código Fiscal de Operações e Prestações', path: '/fiscal/indices/cfop', icon: ArrowLeftRight, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { label: 'CST ICMS', description: 'Código de Situação Tributária do ICMS', path: '/fiscal/indices/cst-icms', icon: ShieldCheck, color: 'bg-green-50 text-green-600 border-green-200' },
  { label: 'CSOSN', description: 'Código de Situação de Operação no Simples Nacional', path: '/fiscal/indices/csosn', icon: ShieldAlert, color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  { label: 'CST IPI', description: 'Código de Situação Tributária do IPI', path: '/fiscal/indices/cst-ipi', icon: Layers, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { label: 'CST PIS/COFINS', description: 'Código de Situação Tributária do PIS e COFINS', path: '/fiscal/indices/cst-pis-cofins', icon: LayoutList, color: 'bg-rose-50 text-rose-600 border-rose-200' },
  { label: 'CEST', description: 'Código Especificador da Substituição Tributária', path: '/fiscal/indices/cest', icon: ListTree, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { label: 'ICMS Interestadual', description: 'Alíquotas de ICMS por origem e destino de UF', path: '/fiscal/indices/icms-interestadual', icon: Map, color: 'bg-teal-50 text-teal-600 border-teal-200' },
  { label: 'Bancos', description: 'Cadastro de instituições financeiras', path: '/fiscal/indices/bancos', icon: Landmark, color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  { label: 'Países', description: 'Tabela de países conforme BACEN', path: '/fiscal/indices/paises', icon: Globe, color: 'bg-slate-50 text-slate-600 border-slate-200' },
];

export default function FiscalIndicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Índices Fiscais</h1>
        <p className="text-slate-500 text-sm mt-0.5">Tabelas de referência utilizadas nas operações fiscais</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INDICES.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-lg border ${item.color} shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{item.label}</h2>
                  <p className="text-sm text-slate-500 mt-0.5 leading-tight">{item.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
