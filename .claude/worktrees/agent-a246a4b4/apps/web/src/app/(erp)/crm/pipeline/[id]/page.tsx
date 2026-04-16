'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft,
  DollarSign,
  User,
  Clock,
  Phone,
  Mail,
  Calendar,
  Building2,
  ArrowRight,
  Plus,
  FileText,
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'LIGACAO' | 'EMAIL' | 'REUNIAO' | 'TAREFA';
  title: string;
  description: string;
  scheduledAt: string;
  completed: boolean;
}

interface LinkedQuotation {
  id: string;
  number: string;
  date: string;
  total: number;
  status: string;
}

const activityTypeLabels: Record<string, string> = {
  LIGACAO: 'Ligação',
  EMAIL: 'E-mail',
  REUNIAO: 'Reunião',
  TAREFA: 'Tarefa',
};

const activityTypeIcons: Record<string, typeof Phone> = {
  LIGACAO: Phone,
  EMAIL: Mail,
  REUNIAO: Calendar,
  TAREFA: FileText,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const stageLabels: Record<string, string> = {
  NOVO: 'Novo',
  QUALIFICADO: 'Qualificado',
  PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

const stageColors: Record<string, string> = {
  NOVO: 'bg-blue-100 text-blue-700',
  QUALIFICADO: 'bg-yellow-100 text-yellow-700',
  PROPOSTA: 'bg-purple-100 text-purple-700',
  NEGOCIACAO: 'bg-orange-100 text-orange-700',
  GANHO: 'bg-emerald-100 text-emerald-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

interface LeadDetail {
  id: string;
  title: string;
  stage: string;
  estimatedValue: number;
  probability: number;
  source: string;
  salesperson: string;
  expectedCloseDate: string;
  createdAt: string;
  description: string;
  person: {
    id: string;
    name: string;
    tradeName: string;
    contactName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
  } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLead(raw: any): LeadDetail {
  return {
    id: raw.id,
    title: raw.title,
    stage: raw.status,
    estimatedValue: raw.valorEstimado ?? 0,
    probability: raw.probabilidade ?? 0,
    source: raw.source || '',
    salesperson: raw.vendedor?.name || '',
    expectedCloseDate: raw.dataPrevisaoFechamento || '',
    createdAt: raw.createdAt,
    description: raw.description || '',
    person: raw.person
      ? {
          id: raw.person.id,
          name: raw.person.razaoSocial || raw.person.nomeFantasia || '',
          tradeName: raw.person.nomeFantasia || '',
          contactName: raw.contactName || '',
          email: raw.contactEmail || raw.person.email || '',
          phone: raw.contactPhone || raw.person.phone || '',
          city: raw.person.cidade || '',
          state: raw.person.estado || '',
        }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(raw: any): Activity {
  return {
    id: raw.id,
    type: raw.type as Activity['type'],
    title: raw.title,
    description: raw.description || '',
    scheduledAt: raw.scheduledAt || raw.createdAt,
    completed: !!raw.completedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapQuotation(raw: any): LinkedQuotation {
  return {
    id: raw.id,
    number: raw.numero,
    date: raw.createdAt,
    total: raw.total ?? 0,
    status: raw.status || '',
  };
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [quotations, setQuotations] = useState<LinkedQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);

  const [newActivity, setNewActivity] = useState({
    type: 'LIGACAO',
    title: '',
    description: '',
    scheduledAt: '',
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/crm/leads/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error('Erro ao carregar lead');
        const json = await res.json();
        setLead(mapLead(json));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setActivities((json.activities || []).map((a: any) => mapActivity(a)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setQuotations((json.quotations || []).map((q: any) => mapQuotation(q)));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddActivity = async () => {
    if (!newActivity.title.trim()) {
      alert('Titulo da atividade e obrigatorio');
      return;
    }
    setSavingActivity(true);
    try {
      const res = await apiFetch(`/api/crm/leads/${id}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          type: newActivity.type,
          title: newActivity.title,
          description: newActivity.description,
          scheduledAt: newActivity.scheduledAt || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao adicionar atividade');
      }
      const json = await res.json();
      setActivities((prev) => [mapActivity(json), ...prev]);
      setNewActivity({ type: 'LIGACAO', title: '', description: '', scheduledAt: '' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar atividade');
    } finally {
      setSavingActivity(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="space-y-4">
        <Link href="/crm/pipeline" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">Lead nao encontrado.</p>
          <button
            onClick={() => router.push('/crm/pipeline')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Ver pipeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm/pipeline"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{lead.title}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stageColors[lead.stage] || 'bg-slate-100 text-slate-600'}`}>
              {stageLabels[lead.stage] || lead.stage}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">
            Lead criado em {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors">
            <ArrowRight className="w-4 h-4" />
            Avançar
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors">
            Marcar como Perdido
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Lead Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead details card */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Informações do Lead</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Estimado</label>
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  <span className="text-xl font-bold text-slate-900">{formatCurrency(lead.estimatedValue)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Vendedor</label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-900">{lead.salesperson || '—'}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fonte</label>
                <p className="text-sm text-slate-900 mt-1">{lead.source || '—'}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Previsão de Fechamento</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-900">
                    {lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString('pt-BR') : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Probability bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Probabilidade</label>
                <span className="text-sm font-bold text-slate-900">{lead.probability}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${lead.probability}%` }}
                />
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Descrição</label>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">{lead.description || '—'}</p>
            </div>
          </div>

          {/* Person info card */}
          {lead.person && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Pessoa / Empresa</h2>

              <div className="flex items-start gap-4">
                <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-slate-500" />
                </div>
                <div className="flex-1">
                  <Link
                    href={`/crm/pessoas/${lead.person.id}`}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {lead.person.name}
                  </Link>
                  <p className="text-xs text-slate-500">{lead.person.tradeName}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    {lead.person.contactName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{lead.person.contactName}</span>
                      </div>
                    )}
                    {lead.person.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{lead.person.phone}</span>
                      </div>
                    )}
                    {lead.person.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{lead.person.email}</span>
                      </div>
                    )}
                    {(lead.person.city || lead.person.state) && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {[lead.person.city, lead.person.state].filter(Boolean).join('/')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Linked Quotations */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Orçamentos Vinculados</h2>
              <Link
                href="/comercial/orcamentos/novo"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Novo Orçamento
              </Link>
            </div>

            {quotations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Número</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Data</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Total</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((q) => (
                      <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <Link href={`/comercial/orcamentos/${q.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                            {q.number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {new Date(q.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-900 text-right font-medium">
                          {formatCurrency(q.total)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            {q.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">Nenhum orçamento vinculado.</p>
            )}
          </div>
        </div>

        {/* Right column - Activities */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Atividades</h2>

            {/* Activities Timeline */}
            <div className="space-y-4 mb-6">
              {activities.map((activity) => {
                const Icon = activityTypeIcons[activity.type] || FileText;
                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${activity.completed ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      <Icon className={`w-3.5 h-3.5 ${activity.completed ? 'text-emerald-600' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-slate-900 truncate">{activity.title}</h4>
                        {activity.completed && (
                          <span className="text-xs text-emerald-600 font-medium">Concluído</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{activity.description}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">
                          {new Date(activity.scheduledAt).toLocaleDateString('pt-BR')} -{' '}
                          {new Date(activity.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {activities.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma atividade registrada.</p>
              )}
            </div>

            {/* New activity form */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Nova Atividade</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select
                    value={newActivity.type}
                    onChange={(e) => setNewActivity((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(activityTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
                  <input
                    type="text"
                    value={newActivity.title}
                    onChange={(e) => setNewActivity((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Título da atividade"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                  <textarea
                    value={newActivity.description}
                    onChange={(e) => setNewActivity((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Detalhes da atividade"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data/Hora</label>
                  <input
                    type="datetime-local"
                    value={newActivity.scheduledAt}
                    onChange={(e) => setNewActivity((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleAddActivity}
                  disabled={savingActivity}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {savingActivity ? 'Salvando...' : 'Adicionar Atividade'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Resumo</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Atividades</span>
                <span className="text-sm font-medium text-slate-900">{activities.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Concluídas</span>
                <span className="text-sm font-medium text-emerald-600">{activities.filter((a) => a.completed).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Orçamentos</span>
                <span className="text-sm font-medium text-slate-900">{quotations.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Dias aberto</span>
                <span className="text-sm font-medium text-slate-900">
                  {Math.floor((new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
