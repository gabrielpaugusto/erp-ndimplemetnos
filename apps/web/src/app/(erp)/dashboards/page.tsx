'use client';

import Link from 'next/link';
import {
  Factory,
  ShoppingCart,
  TrendingUp,
  Package,
  BarChart3,
} from 'lucide-react';

const DASHBOARDS = [
  {
    href:    '/dashboards/chao-fabrica',
    icon:    Factory,
    title:   'Chão de Fábrica',
    desc:    'OPs ativas, progresso, atrasos e centros de trabalho',
    color:   'from-blue-500 to-blue-700',
  },
  {
    href:    '/dashboards/comercial',
    icon:    ShoppingCart,
    title:   'Comercial',
    desc:    'Funil de vendas, ticket médio, top clientes e orçamentos a vencer',
    color:   'from-green-500 to-green-700',
  },
  {
    href:    '/dashboards/financeiro',
    icon:    TrendingUp,
    title:   'Financeiro Executivo',
    desc:    'Fluxo de caixa, inadimplência e DRE simplificado do mês',
    color:   'from-purple-500 to-purple-700',
  },
  {
    href:    '/dashboards/compras-estoque',
    icon:    Package,
    title:   'Compras / Estoque',
    desc:    'Itens críticos, giro de estoque e OCs abertas por fornecedor',
    color:   'from-orange-500 to-orange-700',
  },
];

export default function DashboardsHubPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Dashboards Operacionais</h1>
          <p className="text-muted-foreground text-sm">Visão 360° do ERP em tempo real</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {DASHBOARDS.map((d) => {
          const Icon = d.icon;
          return (
            <Link
              key={d.href}
              href={d.href}
              className="group rounded-xl border bg-card hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className={`bg-gradient-to-br ${d.color} p-5 flex items-center justify-center`}>
                <Icon className="h-10 w-10 text-white" />
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-base group-hover:text-primary transition-colors">
                  {d.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{d.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
