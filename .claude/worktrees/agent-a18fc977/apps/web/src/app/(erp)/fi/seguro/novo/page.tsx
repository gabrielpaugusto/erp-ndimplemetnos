'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Shield, Truck, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type InsuranceType = 'RCFV' | 'CASCO' | 'TOTAL' | 'TRANSPORTE' | 'GARANTIA_ESTENDIDA';

interface InsuranceForm {
  clientId: string;
  seguradoraId: string;
  type: InsuranceType;
  status: string;
  descricaoBem: string;
  anoFabricacao: string;
  chassi: string;
  placa: string;
  valorBem: string;
  premio: string;
  franquia: string;
  importanciaSegurada: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  dataRenovacao: string;
  pedidoVendaId: string;
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

// Static list of major Brazilian insurance companies
const SEGURADORAS_STATIC = [
  { id: 'porto-seguro', name: 'Porto Seguro' },
  { id: 'bradesco-seguros', name: 'Bradesco Seguros' },
  { id: 'allianz', name: 'Allianz Seguros' },
  { id: 'tokio-marine', name: 'Tokio Marine' },
  { id: 'hdi', name: 'HDI Seguros' },
  { id: 'sulamerica', name: 'SulAmérica' },
  { id: 'mapfre', name: 'Mapfre Seguros' },
  { id: 'zurich', name: 'Zurich Seguros' },
];

export default function NovoSeguroPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Person[]>([]);
  const [pedidos, setPedidos] = useState<SaleOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState<InsuranceForm>({
    clientId: '',
    seguradoraId: '',
    type: 'RCFV',
    status: 'EM_ANALISE',
    descricaoBem: '',
    anoFabricacao: '',
    chassi: '',
    placa: '',
    valorBem: '',
    premio: '',
    franquia: '',
    importanciaSegurada: '',
    vigenciaInicio: '',
    vigenciaFim: '',
    dataRenovacao: '',
    pedidoVendaId: '',
    comissaoPercentual: '15',
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

  const updateForm = (field: keyof InsuranceForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.clientId) {
      alert('Selecione o cliente');
      return;
    }
    if (!form.descricaoBem) {
      alert('Informe a descrição do bem');
      return;
    }
    if (!form.valorBem) {
      alert('Informe o valor do bem');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        personId: form.clientId,
        type: form.type,
        descricaoBem: form.descricaoBem,
        valorBem: parseFloat(form.valorBem) || 0,
      };

      if (form.seguradoraId) body.seguradoraId = form.seguradoraId;
      if (form.anoFabricacao) body.anoFabricacao = parseInt(form.anoFabricacao, 10);
      if (form.chassi) body.chassi = form.chassi;
      if (form.placa) body.placa = form.placa;
      if (form.premio) body.premio = parseFloat(form.premio);
      if (form.franquia) body.franquia = parseFloat(form.franquia);
      if (form.importanciaSegurada) body.importanciaSegurada = parseFloat(form.importanciaSegurada);
      if (form.vigenciaInicio) body.dataInicio = form.vigenciaInicio;
      if (form.vigenciaFim) body.dataFim = form.vigenciaFim;
      if (form.pedidoVendaId) body.saleOrderId = form.pedidoVendaId;
      if (form.comissaoPercentual) body.comissaoPercent = parseFloat(form.comissaoPercentual);
      if (form.observacoes) body.observacoes = form.observacoes;

      const res = await apiFetch('/api/fi/insurance', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || 'Erro ao salvar apólice');
      }

      router.push('/fi/seguro');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar apólice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fi/seguro"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Apólice de Seguro</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Cadastre uma nova apólice de seguro
          </p>
        </div>
      </div>

      {/* Dados do Seguro */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Seguro</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
            <select
              value={form.clientId}
              onChange={(e) => updateForm('clientId', e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-50"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Seguradora *</label>
            <select
              value={form.seguradoraId}
              onChange={(e) => updateForm('seguradoraId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Selecione a seguradora</option>
              {SEGURADORAS_STATIC.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Seguro *</label>
            <select
              value={form.type}
              onChange={(e) => updateForm('type', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="RCFV">RCFV - Responsabilidade Civil Facultativa</option>
              <option value="CASCO">Casco</option>
              <option value="TOTAL">Total (Casco + RCFV)</option>
              <option value="TRANSPORTE">Transporte de Carga</option>
              <option value="GARANTIA_ESTENDIDA">Garantia Estendida</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => updateForm('status', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="EM_ANALISE">Em Análise</option>
              <option value="VIGENTE">Vigente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bem Segurado */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Bem Segurado</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Bem *</label>
            <input
              type="text"
              value={form.descricaoBem}
              onChange={(e) => updateForm('descricaoBem', e.target.value)}
              placeholder="Ex: Carroceria Baú Refrigerado 8m"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ano de Fabricação</label>
            <input
              type="number"
              value={form.anoFabricacao}
              onChange={(e) => updateForm('anoFabricacao', e.target.value)}
              placeholder="Ex: 2026"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chassi</label>
            <input
              type="text"
              value={form.chassi}
              onChange={(e) => updateForm('chassi', e.target.value)}
              placeholder="Ex: 9BW2B05U1RP012345"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
            <input
              type="text"
              value={form.placa}
              onChange={(e) => updateForm('placa', e.target.value)}
              placeholder="Ex: ABC-1D23"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono uppercase"
            />
          </div>
        </div>
      </div>

      {/* Valores */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Valores</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor do Bem (R$) *</label>
            <input
              type="number"
              value={form.valorBem}
              onChange={(e) => updateForm('valorBem', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prêmio (R$) *</label>
            <input
              type="number"
              value={form.premio}
              onChange={(e) => updateForm('premio', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Franquia (R$)</label>
            <input
              type="number"
              value={form.franquia}
              onChange={(e) => updateForm('franquia', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Importância Segurada (R$)</label>
            <input
              type="number"
              value={form.importanciaSegurada}
              onChange={(e) => updateForm('importanciaSegurada', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Vigência */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Vigência</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Início *</label>
            <input
              type="date"
              value={form.vigenciaInicio}
              onChange={(e) => updateForm('vigenciaInicio', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim *</label>
            <input
              type="date"
              value={form.vigenciaFim}
              onChange={(e) => updateForm('vigenciaFim', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Renovação</label>
            <input
              type="date"
              value={form.dataRenovacao}
              onChange={(e) => updateForm('dataRenovacao', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Comissão */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Comissão</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pedido de Venda (opcional)</label>
            <select
              value={form.pedidoVendaId}
              onChange={(e) => updateForm('pedidoVendaId', e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-50"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Comissão (%)</label>
            <input
              type="number"
              value={form.comissaoPercentual}
              onChange={(e) => updateForm('comissaoPercentual', e.target.value)}
              step="0.5"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => updateForm('observacoes', e.target.value)}
            rows={3}
            placeholder="Informações adicionais sobre a apólice de seguro..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/fi/seguro"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Salvar Apólice
        </button>
      </div>
    </div>
  );
}
