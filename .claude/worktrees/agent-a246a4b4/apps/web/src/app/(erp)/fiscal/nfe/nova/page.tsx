'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft,
  Save,
  X,
  FileText,
  User,
  Package,
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronUp,
  Link2,
  MessageSquare,
  ArrowRightLeft,
} from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface NFeItem {
  id: string;
  descricao: string;
  ncm: string;
  cfop: string;
  quantidade: string;
  precoUnitario: string;
  desconto: string;
  showTaxes: boolean;
  icms: { cst: string; base: number; aliquota: number; valor: number };
  ipi: { cst: string; aliquota: number; valor: number };
  pis: { cst: string; aliquota: number; valor: number };
  cofins: { cst: string; aliquota: number; valor: number };
  ibs: { aliquota: number; valor: number };
  cbs: { aliquota: number; valor: number };
  is: { aliquota: number; valor: number };
}

interface NFeForm {
  tipo: 'ENTRADA' | 'SAIDA';
  finalidade: string;
  operacao: string;
  pessoaId: string;
  naturezaOperacao: string;
  vinculoTipo: string;
  vinculoId: string;
  informacoesComplementares: string;
  frete: string;
  seguro: string;
  desconto: string;
}

interface Pessoa {
  id: string;
  razaoSocial: string;
  cpfCnpj: string | null;
}

const operacaoOptions = [
  { value: 'VENDA',           label: 'Venda',                      desc: 'Venda de mercadorias fabricadas pelo estabelecimento' },
  { value: 'COMPRA',          label: 'Compra',                     desc: 'Aquisição de materiais ou mercadorias' },
  { value: 'TRANSFERENCIA',   label: 'Transferência',              desc: 'Transferência entre estabelecimentos' },
  { value: 'REMESSA',         label: 'Remessa para Industrialização', desc: 'Envio de mercadoria para industrialização por terceiros' },
  { value: 'RETORNO',         label: 'Retorno de Industrialização',   desc: 'Retorno de mercadoria industrializada por terceiros' },
  { value: 'DEVOLUCAO_COMPRA', label: 'Devolução de Compra',       desc: 'Devolução de mercadorias adquiridas' },
  { value: 'DEVOLUCAO_VENDA', label: 'Devolução de Venda',         desc: 'Devolução de mercadorias vendidas' },
  { value: 'INDUSTRIALIZACAO', label: 'Industrialização',           desc: 'Industrialização por encomenda' },
  { value: 'BONIFICACAO',     label: 'Bonificação',                desc: 'Envio de mercadorias a título de bonificação' },
  { value: 'CONSIGNACAO',     label: 'Consignação',                desc: 'Remessa ou retorno de consignação mercantil' },
];

const finalidadeOptions = [
  { value: 'NORMAL',        label: 'NF-e normal' },
  { value: 'COMPLEMENTAR',  label: 'NF-e complementar' },
  { value: 'AJUSTE',        label: 'NF-e de ajuste' },
  { value: 'DEVOLUCAO',     label: 'Devolução de mercadoria' },
];

function createEmptyItem(): NFeItem {
  return {
    id: String(Date.now()),
    descricao: '',
    ncm: '',
    cfop: '',
    quantidade: '1',
    precoUnitario: '0',
    desconto: '0',
    showTaxes: false,
    icms: { cst: '00', base: 0, aliquota: 18, valor: 0 },
    ipi: { cst: '50', aliquota: 5, valor: 0 },
    pis: { cst: '01', aliquota: 1.65, valor: 0 },
    cofins: { cst: '01', aliquota: 7.6, valor: 0 },
    ibs: { aliquota: 2.5, valor: 0 },
    cbs: { aliquota: 0.9, valor: 0 },
    is: { aliquota: 0, valor: 0 },
  };
}

export default function NovaNFeFormPage() {
  const router = useRouter();
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState('');
  const [taxesCalculated, setTaxesCalculated] = useState(false);
  const [pessoas, setPessoas]             = useState<Pessoa[]>([]);
  const [loadingPessoas, setLoadingPessoas] = useState(true);

  // Fetch real people list
  useEffect(() => {
    const companyId = (() => {
      try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.company?.id ?? ''; } catch { return ''; }
    })();
    apiFetch(`/api/persons?companyId=${companyId}&limit=200`)
      .then((r) => r.json())
      .then((json) => setPessoas(json.data ?? json ?? []))
      .catch(() => {/* ignore */})
      .finally(() => setLoadingPessoas(false));
  }, []);

  const [form, setForm] = useState<NFeForm>({
    tipo: 'SAIDA',
    finalidade: 'NORMAL',
    operacao: 'VENDA',
    pessoaId: '',
    naturezaOperacao: 'Venda de produção do estabelecimento',
    vinculoTipo: '',
    vinculoId: '',
    informacoesComplementares: '',
    frete: '0',
    seguro: '0',
    desconto: '0',
  });

  const [items, setItems] = useState<NFeItem[]>([createEmptyItem()]);

  const updateForm = (field: keyof NFeForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const updateItem = (id: string, field: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const toggleItemTaxes = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, showTaxes: !item.showTaxes } : item))
    );
  };

  const getItemTotal = (item: NFeItem) => {
    const subtotal = (parseFloat(item.quantidade) || 0) * (parseFloat(item.precoUnitario) || 0);
    const desc = parseFloat(item.desconto) || 0;
    return subtotal - desc;
  };

  const calcularImpostos = () => {
    setItems((prev) =>
      prev.map((item) => {
        const total = getItemTotal(item);
        const icmsBase = total;
        const icmsValor = icmsBase * (item.icms.aliquota / 100);
        const ipiValor = total * (item.ipi.aliquota / 100);
        const pisValor = total * (item.pis.aliquota / 100);
        const cofinsValor = total * (item.cofins.aliquota / 100);
        const ibsValor = total * (item.ibs.aliquota / 100);
        const cbsValor = total * (item.cbs.aliquota / 100);
        const isValor = total * (item.is.aliquota / 100);

        return {
          ...item,
          icms: { ...item.icms, base: icmsBase, valor: icmsValor },
          ipi: { ...item.ipi, valor: ipiValor },
          pis: { ...item.pis, valor: pisValor },
          cofins: { ...item.cofins, valor: cofinsValor },
          ibs: { ...item.ibs, valor: ibsValor },
          cbs: { ...item.cbs, valor: cbsValor },
          is: { ...item.is, valor: isValor },
        };
      })
    );
    setTaxesCalculated(true);
  };

  const totalProdutos = items.reduce((sum, i) => sum + getItemTotal(i), 0);
  const totalFrete = parseFloat(form.frete) || 0;
  const totalSeguro = parseFloat(form.seguro) || 0;
  const totalDesconto = parseFloat(form.desconto) || 0;

  const totalICMS = items.reduce((sum, i) => sum + i.icms.valor, 0);
  const totalIPI = items.reduce((sum, i) => sum + i.ipi.valor, 0);
  const totalPIS = items.reduce((sum, i) => sum + i.pis.valor, 0);
  const totalCOFINS = items.reduce((sum, i) => sum + i.cofins.valor, 0);
  const totalIBS = items.reduce((sum, i) => sum + i.ibs.valor, 0);
  const totalCBS = items.reduce((sum, i) => sum + i.cbs.valor, 0);
  const totalIS = items.reduce((sum, i) => sum + i.is.valor, 0);

  const totalNFe = totalProdutos + totalFrete + totalSeguro - totalDesconto + totalIPI;

  const handleSave = async () => {
    setSaveError('');
    if (!form.pessoaId) { setSaveError('Selecione o destinatário/remetente.'); return; }
    if (items.length === 0 || items.every((i) => !i.descricao)) {
      setSaveError('Adicione pelo menos um item com descrição.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: form.tipo,
        finality: form.finalidade,
        operation: form.operacao,
        personId: form.pessoaId,
        naturezaOperacao: form.naturezaOperacao,
        dataEmissao: new Date().toISOString(),
        informacoesComplementares: form.informacoesComplementares || undefined,
        items: items
          .filter((i) => i.descricao.trim())
          .map((i) => ({
            description: i.descricao,
            ncmCode:     i.ncm     || '00000000',
            cfopCode:    i.cfop    || '5101',
            quantity:    parseFloat(i.quantidade) || 1,
            unitPrice:   parseFloat(i.precoUnitario) || 0,
            unit:        'UN',
          })),
      };

      const res  = await apiFetch('/api/fiscal/nfe', {
        method: 'POST',
        body:   JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const msgs = Array.isArray(data.message)
          ? data.message.join('; ')
          : data.message || 'Erro ao criar NF-e';
        setSaveError(msgs);
        return;
      }

      router.push(`/fiscal/nfe/${data.id}`);
    } catch {
      setSaveError('Erro de conexão ao salvar NF-e. Verifique se o servidor está rodando.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fiscal/nfe"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Nota Fiscal Eletrônica</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Emita uma nova NF-e com cálculo automático de tributos (regime atual + Reforma Tributária)
          </p>
        </div>
      </div>

      {/* Reforma Tributária Indicator */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Reforma Tributária — Transição 2026</span>
        </div>
        <p className="text-xs text-emerald-700">
          2026: 90% sistema atual (ICMS, IPI, PIS, COFINS) / 10% reforma (IBS, CBS, IS).
          O motor tributário calcula automaticamente ambos os regimes em cada item.
        </p>
      </div>

      {/* Dados da Nota */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados Gerais</h2>
        </div>

        {/* Type Radio */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo da Nota *</label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {(['SAIDA', 'ENTRADA'] as const).map((tipo) => (
              <label
                key={tipo}
                className={`flex items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${
                  form.tipo === tipo
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={tipo}
                  checked={form.tipo === tipo}
                  onChange={() => updateForm('tipo', tipo)}
                  className="sr-only"
                />
                <span className="text-sm font-bold text-slate-900">
                  {tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Finalidade *</label>
            <select
              value={form.finalidade}
              onChange={(e) => updateForm('finalidade', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {finalidadeOptions.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Operação *</label>
            <select
              value={form.operacao}
              onChange={(e) => updateForm('operacao', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {operacaoOptions.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {form.operacao && (
              <p className="text-xs text-slate-500 mt-1">
                {operacaoOptions.find((o) => o.value === form.operacao)?.desc}
              </p>
            )}
          </div>
        </div>

        {/* Natureza da Operação */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Natureza da Operação *</label>
          <input
            type="text"
            value={form.naturezaOperacao}
            onChange={(e) => updateForm('naturezaOperacao', e.target.value)}
            placeholder="Ex: Venda de produção do estabelecimento"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Destinatário/Remetente */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">
            {form.tipo === 'SAIDA' ? 'Destinatário' : 'Remetente'}
          </h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pessoa *</label>
          <select
            value={form.pessoaId}
            onChange={(e) => updateForm('pessoaId', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">{loadingPessoas ? 'Carregando...' : `Selecione o ${form.tipo === 'SAIDA' ? 'destinatário' : 'remetente'}`}</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.razaoSocial}{p.cpfCnpj ? ` — ${p.cpfCnpj}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Vínculo */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Vínculo (opcional)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Vínculo</label>
            <select
              value={form.vinculoTipo}
              onChange={(e) => { updateForm('vinculoTipo', e.target.value); updateForm('vinculoId', ''); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Nenhum</option>
              <option value="pedido_venda">Pedido de Venda</option>
              <option value="ordem_servico">Ordem de Serviço</option>
            </select>
          </div>

          {form.vinculoTipo && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ID do {form.vinculoTipo === 'pedido_venda' ? 'Pedido de Venda' : 'Ordem de Serviço'}
              </label>
              <input
                type="text"
                value={form.vinculoId}
                onChange={(e) => updateForm('vinculoId', e.target.value)}
                placeholder="ID do documento (opcional)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      {/* Itens da Nota */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Itens da Nota</h2>
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Item Row */}
              <div className="grid grid-cols-12 gap-2 p-3 items-end">
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                  <input
                    type="text"
                    value={item.descricao}
                    onChange={(e) => updateItem(item.id, 'descricao', e.target.value)}
                    placeholder="Carroceria Baú Refrigerado 8m"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">NCM</label>
                  <input
                    type="text"
                    value={item.ncm}
                    onChange={(e) => updateItem(item.id, 'ncm', e.target.value)}
                    placeholder="8707.90.90"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">CFOP</label>
                  <input
                    type="text"
                    value={item.cfop}
                    onChange={(e) => updateItem(item.id, 'cfop', e.target.value)}
                    placeholder="5101"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Qtd</label>
                  <input
                    type="number"
                    value={item.quantidade}
                    onChange={(e) => updateItem(item.id, 'quantidade', e.target.value)}
                    min="1"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Preço Unit.</label>
                  <input
                    type="number"
                    value={item.precoUnitario}
                    onChange={(e) => updateItem(item.id, 'precoUnitario', e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Desconto</label>
                  <input
                    type="number"
                    value={item.desconto}
                    onChange={(e) => updateItem(item.id, 'desconto', e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Total</label>
                  <div className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-right font-semibold text-slate-900">
                    {formatCurrency(getItemTotal(item))}
                  </div>
                </div>
                <div className="col-span-1 flex items-end gap-1 justify-end">
                  <button
                    onClick={() => toggleItemTaxes(item.id)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                    title="Ver impostos"
                  >
                    {item.showTaxes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tax Details (Expandable) */}
              {item.showTaxes && (
                <div className="bg-slate-50 border-t border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Detalhes Tributários — Item {idx + 1}</p>

                  {/* Current Taxes */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Tributos Atuais (90%)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded border border-slate-200 p-2">
                        <p className="text-xs font-bold text-slate-700">ICMS</p>
                        <p className="text-[10px] text-slate-500">CST: {item.icms.cst} | Alíq: {item.icms.aliquota}%</p>
                        <p className="text-[10px] text-slate-500">Base: {formatCurrency(item.icms.base)}</p>
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(item.icms.valor)}</p>
                      </div>
                      <div className="bg-white rounded border border-slate-200 p-2">
                        <p className="text-xs font-bold text-slate-700">IPI</p>
                        <p className="text-[10px] text-slate-500">CST: {item.ipi.cst} | Alíq: {item.ipi.aliquota}%</p>
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(item.ipi.valor)}</p>
                      </div>
                      <div className="bg-white rounded border border-slate-200 p-2">
                        <p className="text-xs font-bold text-slate-700">PIS</p>
                        <p className="text-[10px] text-slate-500">CST: {item.pis.cst} | Alíq: {item.pis.aliquota}%</p>
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(item.pis.valor)}</p>
                      </div>
                      <div className="bg-white rounded border border-slate-200 p-2">
                        <p className="text-xs font-bold text-slate-700">COFINS</p>
                        <p className="text-[10px] text-slate-500">CST: {item.cofins.cst} | Alíq: {item.cofins.aliquota}%</p>
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(item.cofins.valor)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reforma Tributária Taxes */}
                  <div>
                    <p className="text-xs font-semibold text-teal-700 mb-2">Reforma Tributária (10%) — IBS + CBS + IS</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded border border-teal-200 p-2">
                        <p className="text-xs font-bold text-teal-700">IBS</p>
                        <p className="text-[10px] text-slate-500">Alíq: {item.ibs.aliquota}%</p>
                        <p className="text-xs font-bold text-teal-900">{formatCurrency(item.ibs.valor)}</p>
                      </div>
                      <div className="bg-white rounded border border-teal-200 p-2">
                        <p className="text-xs font-bold text-teal-700">CBS</p>
                        <p className="text-[10px] text-slate-500">Alíq: {item.cbs.aliquota}%</p>
                        <p className="text-xs font-bold text-teal-900">{formatCurrency(item.cbs.valor)}</p>
                      </div>
                      <div className="bg-white rounded border border-teal-200 p-2">
                        <p className="text-xs font-bold text-teal-700">IS</p>
                        <p className="text-[10px] text-slate-500">Alíq: {item.is.aliquota}%</p>
                        <p className="text-xs font-bold text-teal-900">{formatCurrency(item.is.valor)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Totais */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Totais da Nota</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Frete</label>
            <input
              type="number"
              value={form.frete}
              onChange={(e) => updateForm('frete', e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Seguro</label>
            <input
              type="number"
              value={form.seguro}
              onChange={(e) => updateForm('seguro', e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Desconto Global</label>
            <input
              type="number"
              value={form.desconto}
              onChange={(e) => updateForm('desconto', e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Total Produtos</label>
            <div className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-right font-semibold">
              {formatCurrency(totalProdutos)}
            </div>
          </div>
        </div>

        {taxesCalculated && (
          <div className="border-t border-slate-200 pt-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Impostos Calculados</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">ICMS:</span>
                <span className="font-medium">{formatCurrency(totalICMS)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">IPI:</span>
                <span className="font-medium">{formatCurrency(totalIPI)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">PIS:</span>
                <span className="font-medium">{formatCurrency(totalPIS)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">COFINS:</span>
                <span className="font-medium">{formatCurrency(totalCOFINS)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
              <div className="flex justify-between text-sm">
                <span className="text-teal-700">IBS:</span>
                <span className="font-medium text-teal-900">{formatCurrency(totalIBS)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-teal-700">CBS:</span>
                <span className="font-medium text-teal-900">{formatCurrency(totalCBS)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-teal-700">IS:</span>
                <span className="font-medium text-teal-900">{formatCurrency(totalIS)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            onClick={calcularImpostos}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Calcular Impostos
          </button>
          <div className="text-right">
            <p className="text-sm text-slate-500">Total da NF-e</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalNFe)}</p>
          </div>
        </div>
      </div>

      {/* Informações Complementares */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Informações Complementares</h2>
        </div>
        <textarea
          value={form.informacoesComplementares}
          onChange={(e) => updateForm('informacoesComplementares', e.target.value)}
          rows={4}
          placeholder="Informações adicionais para impressão no DANFE..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Error message */}
      {saveError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-red-500 text-sm font-semibold">Erro:</span>
          <span className="text-sm text-red-700">{saveError}</span>
          <button onClick={() => setSaveError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/fiscal/nfe"
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
          Salvar NF-e
        </button>
      </div>
    </div>
  );
}
