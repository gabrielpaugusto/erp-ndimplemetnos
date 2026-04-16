'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ChevronLeft, Save, X } from 'lucide-react';
import { maskPhone } from '@/lib/masks';

interface LeadForm {
  title: string;
  personId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  source: string;
  estimatedValue: string;
  probability: number;
  salesperson: string;
  expectedCloseDate: string;
  description: string;
}

interface DropdownItem {
  id: string;
  name: string;
}

const sources = [
  'Indicação',
  'Site / Internet',
  'Feira / Evento',
  'Visita Comercial',
  'Telefone',
  'WhatsApp',
  'Redes Sociais',
  'Outros',
];

export default function NovoLeadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [persons, setPersons] = useState<DropdownItem[]>([]);
  const [salespersons, setSalespersons] = useState<DropdownItem[]>([]);

  const [form, setForm] = useState<LeadForm>({
    title: '',
    personId: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    source: '',
    estimatedValue: '',
    probability: 50,
    salesperson: '',
    expectedCloseDate: '',
    description: '',
  });

  useEffect(() => {
    apiFetch('/api/persons?limit=200')
      .then((res) => res.ok ? res.json() : { data: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((json) => setPersons((json.data || []).map((p: any) => ({ id: p.id, name: p.razaoSocial || p.nomeFantasia || p.name || '' }))))
      .catch(() => {});

    apiFetch('/api/hr/employees?limit=100')
      .then((res) => res.ok ? res.json() : { data: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((json) => setSalespersons((json.data || []).map((e: any) => ({ id: e.id, name: e.name || e.nome || '' }))))
      .catch(() => {});
  }, []);

  const updateForm = (field: keyof LeadForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert('Titulo e obrigatorio');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        source: form.source || undefined,
        valorEstimado: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
        probabilidade: form.probability,
        dataPrevisaoFechamento: form.expectedCloseDate || undefined,
      };
      if (form.personId) body.personId = form.personId;
      if (form.salesperson) body.vendedorId = form.salesperson;
      if (!form.personId) {
        body.contactName = form.contactName;
        body.contactEmail = form.contactEmail;
        body.contactPhone = form.contactPhone;
      }

      const res = await apiFetch('/api/crm/leads', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao salvar lead');
      }
      router.push('/crm/pipeline');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar lead');
    } finally {
      setSaving(false);
    }
  };

  const showContactFields = !form.personId;

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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Lead</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Cadastre uma nova oportunidade de venda
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="Ex: Carroceria Baú Refrigerado 8m"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Person select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pessoa (Cliente)
            </label>
            <select
              value={form.personId}
              onChange={(e) => updateForm('personId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione ou deixe em branco para informar contato manual</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Selecione uma pessoa cadastrada ou preencha os dados de contato abaixo.
            </p>
          </div>

          {/* Contact fields (shown when no person selected) */}
          {showContactFields && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Dados do Contato</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome do Contato
                  </label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => updateForm('contactName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => updateForm('contactEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={maskPhone(form.contactPhone)}
                    onChange={(e) => updateForm('contactPhone', e.target.value.replace(/\D/g, ''))}
                    placeholder="(00) 0000-0000 OU (00) 00000-0000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fonte
              </label>
              <select
                value={form.source}
                onChange={(e) => updateForm('source', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione a fonte</option>
                {sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Estimated value */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor Estimado (R$)
              </label>
              <input
                type="number"
                value={form.estimatedValue}
                onChange={(e) => updateForm('estimatedValue', e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Probability slider */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Probabilidade de Fechamento: <span className="font-bold text-blue-600">{form.probability}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.probability}
              onChange={(e) => updateForm('probability', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-400">0%</span>
              <span className="text-xs text-slate-400">50%</span>
              <span className="text-xs text-slate-400">100%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Salesperson */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Vendedor
              </label>
              <select
                value={form.salesperson}
                onChange={(e) => updateForm('salesperson', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione o vendedor</option>
                {salespersons.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Expected close date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Previsão de Fechamento
              </label>
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) => updateForm('expectedCloseDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              rows={4}
              placeholder="Descreva os detalhes da oportunidade, requisitos do cliente, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/crm/pipeline"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
