'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Landmark, DollarSign, CreditCard, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

type FinancingType = 'FINAME' | 'CDC' | 'LEASING' | 'CONSORCIO' | 'DIRETO';

interface FinancingForm {
  clientId: string;
  pedidoVendaId: string;
  type: FinancingType;
  financeiraId: string;
  valorBem: string;
  entrada: string;
  valorFinanciado: string;
  taxaJuros: string;
  parcelas: string;
  valorParcela: string;
  codigoFiname: string;
  linhaCredito: string;
  carencia: string;
  comissaoPercentual: string;
  comissaoValor: string;
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

// Static list of major Brazilian financial institutions for financing
const FINANCEIRAS_STATIC = [
  { id: 'bndes-bb', name: 'BNDES / Banco do Brasil' },
  { id: 'bndes-bradesco', name: 'BNDES / Bradesco' },
  { id: 'bndes-itau', name: 'BNDES / Itaú' },
  { id: 'safra', name: 'Banco Safra' },
  { id: 'itaubba', name: 'Itaú BBA' },
  { id: 'santander', name: 'Santander' },
  { id: 'direto', name: 'Direto Fabricante' },
];

const formatCurrency = (value: number) => fmtCurrency(value);

export default function NovoFinanciamentoPage() {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Person[]>([]);
  const [pedidos, setPedidos] = useState<SaleOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState<FinancingForm>({
    clientId: '',
    pedidoVendaId: '',
    type: 'FINAME',
    financeiraId: '',
    valorBem: '',
    entrada: '',
    valorFinanciado: '',
    taxaJuros: '',
    parcelas: '',
    valorParcela: '',
    codigoFiname: '',
    linhaCredito: '',
    carencia: '',
    comissaoPercentual: '2',
    comissaoValor: '',
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

  const updateForm = (field: keyof FinancingForm, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate valorFinanciado
      if (field === 'valorBem' || field === 'entrada') {
        const bem = parseFloat(field === 'valorBem' ? value : prev.valorBem) || 0;
        const ent = parseFloat(field === 'entrada' ? value : prev.entrada) || 0;
        updated.valorFinanciado = (bem - ent).toFixed(2);
      }

      // Auto-calculate comissaoValor
      if (field === 'comissaoPercentual' || field === 'valorFinanciado' || field === 'valorBem' || field === 'entrada') {
        const financiado = parseFloat(updated.valorFinanciado) || 0;
        const pct = parseFloat(updated.comissaoPercentual) || 0;
        updated.comissaoValor = ((financiado * pct) / 100).toFixed(2);
      }

      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.clientId) {
      toast.error('Selecione o cliente');
      return;
    }
    if (!form.valorBem) {
      toast.error('Informe o valor do bem');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        personId: form.clientId,
        type: form.type,
        valorBem: parseFloat(form.valorBem) || 0,
        valorEntrada: parseFloat(form.entrada) || 0,
        valorFinanciado: parseFloat(form.valorFinanciado) || 0,
      };

      if (form.pedidoVendaId) body.saleOrderId = form.pedidoVendaId;
      if (form.financeiraId) body.financeiraId = form.financeiraId;
      if (form.taxaJuros) body.taxaJuros = parseFloat(form.taxaJuros);
      if (form.parcelas) body.parcelas = parseInt(form.parcelas, 10);
      if (form.valorParcela) body.valorParcela = parseFloat(form.valorParcela);
      if (form.codigoFiname) body.codigoFiname = form.codigoFiname;
      if (form.linhaCredito) body.linhaCredito = form.linhaCredito;
      if (form.carencia) body.carencia = parseInt(form.carencia, 10);
      if (form.comissaoPercentual) body.comissaoPercent = parseFloat(form.comissaoPercentual);
      if (form.observacoes) body.observacoes = form.observacoes;

      const res = await apiFetch('/api/fi/financing', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || 'Erro ao salvar financiamento');
      }

      router.push('/fi/financiamento');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar financiamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fi/financiamento"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Financiamento</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Cadastre uma nova operação de financiamento
          </p>
        </div>
      </div>

      {/* Dados do Financiamento */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Financiamento</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
            <select
              value={form.clientId}
              onChange={(e) => updateForm('clientId', e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Pedido de Venda (opcional)</label>
            <select
              value={form.pedidoVendaId}
              onChange={(e) => updateForm('pedidoVendaId', e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50"
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
        </div>

        {/* Tipo - Radio Cards */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Financiamento *</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { key: 'FINAME' as const, label: 'FINAME', desc: 'BNDES - Bens de capital' },
              { key: 'CDC' as const, label: 'CDC', desc: 'Crédito Direto ao Consumidor' },
              { key: 'LEASING' as const, label: 'Leasing', desc: 'Arrendamento mercantil' },
              { key: 'CONSORCIO' as const, label: 'Consórcio', desc: 'Carta de crédito' },
              { key: 'DIRETO' as const, label: 'Direto', desc: 'Financiamento direto' },
            ]).map((type) => (
              <label
                key={type.key}
                className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors text-center ${
                  form.type === type.key
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={type.key}
                  checked={form.type === type.key}
                  onChange={() => updateForm('type', type.key)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-slate-900">{type.label}</span>
                <span className="text-xs text-slate-500 mt-0.5">{type.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Financeira *</label>
          <select
            value={form.financeiraId}
            onChange={(e) => updateForm('financeiraId', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Selecione a financeira</option>
            {FINANCEIRAS_STATIC.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Valores */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Valores</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor do Bem (R$) *</label>
            <input
              type="number"
              value={form.valorBem}
              onChange={(e) => updateForm('valorBem', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Entrada (R$)</label>
            <input
              type="number"
              value={form.entrada}
              onChange={(e) => updateForm('entrada', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Financiado (R$)</label>
            <input
              type="number"
              value={form.valorFinanciado}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Taxa de Juros (% a.m.) *</label>
            <input
              type="number"
              value={form.taxaJuros}
              onChange={(e) => updateForm('taxaJuros', e.target.value)}
              step="0.01"
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas *</label>
            <input
              type="number"
              value={form.parcelas}
              onChange={(e) => updateForm('parcelas', e.target.value)}
              placeholder="Ex: 48"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Parcela (R$)</label>
            <input
              type="number"
              value={form.valorParcela}
              onChange={(e) => updateForm('valorParcela', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* FINAME Section (conditional) */}
      {form.type === 'FINAME' && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-green-700" />
            <h2 className="text-lg font-semibold text-green-900">FINAME</h2>
          </div>
          <p className="text-xs text-green-700 mb-4">
            Campos específicos para financiamento via BNDES/FINAME
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-green-800 mb-1">Código FINAME</label>
              <input
                type="text"
                value={form.codigoFiname}
                onChange={(e) => updateForm('codigoFiname', e.target.value)}
                placeholder="Ex: 1234567"
                className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-800 mb-1">Linha de Crédito</label>
              <select
                value={form.linhaCredito}
                onChange={(e) => updateForm('linhaCredito', e.target.value)}
                className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                <option value="">Selecione a linha</option>
                <option value="FINAME_BK">FINAME BK</option>
                <option value="FINAME_AGRICOLA">FINAME Agrícola</option>
                <option value="FINAME_LEASING">FINAME Leasing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-green-800 mb-1">Carência (meses)</label>
              <input
                type="number"
                value={form.carencia}
                onChange={(e) => updateForm('carencia', e.target.value)}
                placeholder="Ex: 3"
                className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Comissão */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Comissão</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Percentual (%)</label>
            <input
              type="number"
              value={form.comissaoPercentual}
              onChange={(e) => updateForm('comissaoPercentual', e.target.value)}
              step="0.5"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Comissão (R$)</label>
            <input
              type="text"
              value={form.comissaoValor ? formatCurrency(parseFloat(form.comissaoValor)) : 'R$ 0,00'}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-emerald-700 font-semibold"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => updateForm('observacoes', e.target.value)}
            rows={3}
            placeholder="Informações adicionais sobre o financiamento..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/fi/financiamento"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Salvar Financiamento
        </button>
      </div>
    </div>
  );
}
