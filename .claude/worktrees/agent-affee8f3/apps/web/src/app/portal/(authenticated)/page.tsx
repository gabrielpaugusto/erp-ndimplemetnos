'use client';

import Link from 'next/link';
import {
  FileText,
  Headphones,
  Clock,
  Plus,
  FolderOpen,
  ArrowRight,
  Download,
  MessageSquare,
} from 'lucide-react';

const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');

const recentDocuments = [
  { id: '1', title: 'NF-e 001234 - Carroceria Bau Refrigerado', category: 'NF-e', date: '2026-03-14' },
  { id: '2', title: 'Boleto #5678 - Parcela 3/12', category: 'Boleto', date: '2026-03-12' },
  { id: '3', title: 'Orcamento ORC-2026-045', category: 'Orcamento', date: '2026-03-10' },
];

const recentTickets = [
  { id: '42', subject: 'Duvida sobre garantia da carroceria', status: 'RESPONDIDO', statusColor: 'bg-emerald-100 text-emerald-700', date: '2026-03-14' },
  { id: '39', subject: 'Solicitar 2a via de boleto', status: 'FECHADO', statusColor: 'bg-slate-100 text-slate-600', date: '2026-03-08' },
  { id: '35', subject: 'Agendamento de manutencao preventiva', status: 'EM_ANDAMENTO', statusColor: 'bg-amber-100 text-amber-700', date: '2026-03-05' },
];

const statusLabels: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em Andamento',
  RESPONDIDO: 'Respondido',
  FECHADO: 'Fechado',
};

export default function PortalHomePage() {
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <h1 className="text-xl font-bold">Bem-vindo, Logistica Express S/A</h1>
        <p className="text-blue-100 mt-1 text-sm">
          Acesse seus documentos, acompanhe chamados e gerencie sua conta.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">24</p>
              <p className="text-xs text-slate-500">Documentos disponiveis</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Headphones className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">2</p>
              <p className="text-xs text-slate-500">Chamados abertos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">15/03/2026 08:32</p>
              <p className="text-xs text-slate-500">Ultimo acesso</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/portal/chamados/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Abrir Chamado
        </Link>
        <Link
          href="/portal/documentos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          Ver Documentos
        </Link>
      </div>

      {/* Recent Documents */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Documentos Recentes</h2>
          </div>
          <Link href="/portal/documentos" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {recentDocuments.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-50 rounded-lg transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-400">{doc.category} — {formatDate(doc.date)}</p>
                </div>
              </div>
              <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0">
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Chamados Recentes</h2>
          </div>
          <Link href="/portal/chamados" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {recentTickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/portal/chamados/${ticket.id}`}
              className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">#{ticket.id} — {ticket.subject}</p>
                <p className="text-xs text-slate-400">{formatDate(ticket.date)}</p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ticket.statusColor} shrink-0 ml-3`}>
                {statusLabels[ticket.status] || ticket.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
