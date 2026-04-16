'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ConsortiumForm {
  clientId: string;
  administradoraId: string;
  grupo: string;
  cota: string;
  valorCredito: string;
  parcelasMensais: string;
  valorParcela: string;
  pedidoVendaId: string;
  dataAdesao: string;
  comissaoPercentual: string;
  observacoes: string;
}

interface Person {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cpfCnpj?: string;
}

interface SaleOrder {
  id: string;
  numero: string;
  status: string;
  person?: { razaoSocial?: string; nomeFantasia?: string };
}

// Static list of major Brazilian consortium administrators
const ADMINISTRADORAS_STATIC = [
  { id: 'randon', name: 'Randon Consórcios' },
  { id: 'embracon', name: 'Embracon' },
  { id: 'rodobens', name: 'Rodobens Consórcios' },
  { id: 'vw-consorcios', name: 'Volkswagen Consórcios' },
  { id: 'porto-seguro', name: 'Porto Seguro Consórcios' },
  { id: 'caixa', name: 'Caixa Consórcios' },
  { id: 'bb', name: 'BB Consórcios' },
];

export default function NovoConsorcioPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Person[]>([]);
  const [pedidos, setPedidos] = useState<SaleOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState<ConsortiumForm>({
    clientId: '',
    administradoraId: '',
    grupo: '',
    cota: '',
    valorCredito: '',
    parcelasMensais: '',
    valorParcela: '',
    pedidoVendaId: '',
    dataAdesao: '',
    comissaoPercentual: '3',
    observacoes: '',
  });

  useEffect(() => {
    async function loadFormData() {
      try {
        const [clientsRes, pedidosRes] = await Promise.all([
          apiFetch('/api/persons?limit=200'),
          apiFetch('/api/sales/orders?status=APROVADO&limit=100'),
        ]);

        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients(data.data ?? data ?? []);
        }

        if (pedidosRes.ok) {
          const data = await pedidosRes.json();
          setPedidos(data.data ?? data ?? []);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadFormData();
  }, []);

  const updateForm = (field: keyof ConsortiumForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.clientId) {
      alert('Selecione o cliente');
      return;
    }
    if (!form.grupo || !form.cota) {
      alert('Informe o grupo e a cota');
      return;
    }
    if (!form.valorCredito) {
      alert('Informe o valor do crédito');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        personId: form.clientId,
        grupo: form.grupo,
        cota: form.cota,
        valorCredito: parseFloat(form.valorCredito) || 0,
      };

      if (form.administradoraId) body.administradoraId = form.administradoraId;
      if (form.parcelasMensais) body.parcelasMensais = parseInt(form.parcelasMensais, 10);
      if (form.valorParcela) body.valorParcelaMensal = parseFloat(form.valorParcela);
      if (form.pedidoVendaId) body.saleOrderId = form.pedidoVendaId;
      if (form.comissaoPercentual) body.comissaoPercent = parseFloat(form.comissaoPercentual);
      if (form.dataAdesao) body.dataAdesao = form.dataAdesao;
      if (form.observacoes) body.observacoes = form.observacoes;

      const res = await apiFetch('/api/fi/consortium', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || 'Erro ao salvar consórcio');
      }

      router.push('/fi/consorcio');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar consórcio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fi/consorcio"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Cota de Consórcio</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Cadastre uma nova cota de consórcio
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Consórcio</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
            <select
              value={form.clientId}
              onChange={(e) => updateForm('clientId', e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-slate-50"
            >
              <option value="">{loadingData ? 'Carregando...' : 'Selecione o cliente'}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial || c.nomeFantasia}
                  {c.cpfCnpj ? ` — ${c.cpfCnpj}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Administradora *</label>
            <select
              value={form.administradoraId}
              onChange={(e) => updateForm('administradoraId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="">Selecione a administradora</option>
              {ADMINISTRADORAS_STATIC.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grupo *</label>
            <input
              type="text"
              value={form.grupo}
              onChange={(e) => updateForm('grupo', e.target.value)}
              placeholder="Ex: G-1250"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cota *</label>
            <input
              type="text"
              value={form.cota}
              onChange={(e) => updateForm('cota', e.target.value)}
              placeholder="Ex: C-0032"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor do Crédito (R$) *</label>
            <input
              type="number"
              value={form.valorCredito}
              onChange={(e) => updateForm('valorCredito', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas Mensais *</label>
            <input
              type="number"
              value={form.parcelasMensais}
              onChange={(e) => updateForm('parcelasMensais', e.target.value)}
              placeholder="Ex: 72"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Parcela (R$) *</label>
            <input
              type="number"
              value={form.valorParcela}
              onChange={(e) => updateForm('valorParcela', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pedido de Venda (opcional)</label>
            <select
              value={form.pedidoVendaId}
              onChange={(e) => updateForm('pedidoVendaId', e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-slate-50"
            >
              <option value="">Nenhum pedido vinculado</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero}
                  {p.person ? ` — ${p.person.razaoSocial ?? p.person.nomeFantasia ?? ''}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data de Adesão *</label>
            <input
              type="date"
              value={form.dataAdesao}
              onChange={(e) => updateForm('dataAdesao', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Comissão (%)</label>
            <input
              type="number"
              value={form.comissaoPercentual}
              onChange={(e) => updateForm('comissaoPercentual', e.target.value)}
              step="0.5"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => updateForm('observacoes', e.target.value)}
            rows={3}
            placeholder="Informações adicionais sobre a cota de consórcio..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/fi/consorcio"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Salvar Consórcio
        </button>
      </div>
    </div>
  );
}
