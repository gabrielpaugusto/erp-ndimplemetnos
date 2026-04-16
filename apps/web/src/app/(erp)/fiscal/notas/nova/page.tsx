'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

interface NFeItem {
  id: string;
  descricao: string;
  ncm: string;
  cfop: string;
  quantidade: string;
  precoUnitario: string;
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
  name: string;
  cpfCnpj: string;
}

interface PedidoVenda {
  id: string;
  number: string;
}

interface OrdemServico {
  id: string;
  number: string;
}

const operacaoOptions = [
  { value: 'venda_producao', label: 'Venda de Produção', desc: 'Venda de mercadorias fabricadas pelo estabelecimento' },
  { value: 'compra_materia', label: 'Compra de Matéria-Prima', desc: 'Aquisição de insumos para produção' },
  { value: 'compra_componentes', label: 'Compra de Componentes', desc: 'Aquisição de componentes e peças' },
  { value: 'remessa_industrializacao', label: 'Remessa para Industrialização', desc: 'Envio de mercadoria para industrialização por terceiros' },
  { value: 'retorno_industrializacao', label: 'Retorno de Industrialização', desc: 'Retorno de mercadoria industrializada por terceiros' },
  { value: 'devolucao_compra', label: 'Devolução de Compra', desc: 'Devolução de mercadorias adquiridas' },
  { value: 'devolucao_venda', label: 'Devolução de Venda', desc: 'Devolução de mercadorias vendidas' },
];

const finalidadeOptions = [
  { value: '1', label: 'NF-e normal' },
  { value: '2', label: 'NF-e complementar' },
  { value: '3', label: 'NF-e de ajuste' },
  { value: '4', label: 'Devolução de mercadoria' },
];

function createEmptyItem(): NFeItem {
  return {
    id: String(Date.now()),
    descricao: '',
    ncm: '',
    cfop: '',
    quantidade: '1',
    precoUnitario: '0',
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
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [taxesCalculated, setTaxesCalculated] = useState(false);

  const [form, setForm] = useState<NFeForm>({
    tipo: 'SAIDA',
    finalidade: '1',
    operacao: 'venda_producao',
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

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [pedidosVenda, setPedidosVenda] = useState<PedidoVenda[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [pesRes, pvRes, osRes] = await Promise.all([
          apiFetch('/api/persons?limit=200'),
          apiFetch('/api/sales/orders?status=APROVADO&limit=100'),
          apiFetch('/api/service-orders?limit=100'),
        ]);

        if (pesRes.ok) {
          const d = await pesRes.json();
          const list = d.data ?? d;
          setPessoas(
            list.map((p: any) => ({
              id: p.id,
              name: p.razaoSocial ?? p.nomeFantasia ?? p.name,
              cpfCnpj: p.cpfCnpj ?? '',
            }))
          );
        }

        if (pvRes.ok) {
          const d = await pvRes.json();
          const list = d.data ?? d;
          setPedidosVenda(
            list.map((o: any) => ({
              id: o.id,
              number: `${o.numero} — ${o.pessoa?.razaoSocial ?? o.cliente ?? ''}`,
            }))
          );
        }

        if (osRes.ok) {
          const d = await osRes.json();
          const list = d.data ?? d;
          setOrdensServico(
            list.map((o: any) => ({
              id: o.id,
              number: `${o.numero} — ${o.pessoa?.razaoSocial ?? o.cliente ?? ''}`,
            }))
          );
        }
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

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

  const updateItemReformaTax = (
    id: string,
    tributo: 'ibs' | 'cbs' | 'is',
    field: 'aliquota',
    value: string,
  ) => {
    const numVal = parseFloat(value) || 0;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const total = getItemTotal(item);
        return {
          ...item,
          [tributo]: {
            ...item[tributo],
            aliquota: numVal,
            valor: total * (numVal / 100),
          },
        };
      })
    );
  };

  const getItemTotal = (item: NFeItem) => {
    return (parseFloat(item.quantidade) || 0) * (parseFloat(item.precoUnitario) || 0);
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
    if (!form.pessoaId) { toast.error('Selecione o destinatário/remetente.'); return; }
    if (!form.naturezaOperacao) { toast.error('Informe a natureza da operação.'); return; }

    setSaving(true);
    try {
      const body: Record<string, any> = {
        type: form.tipo,
        finality: form.finalidade === '1' ? 'NORMAL'
          : form.finalidade === '2' ? 'COMPLEMENTAR'
          : form.finalidade === '3' ? 'AJUSTE'
          : 'DEVOLUCAO',
        operation: form.operacao.toUpperCase(),
        personId: form.pessoaId,
        naturezaOperacao: form.naturezaOperacao,
        dataEmissao: new Date().toISOString(),
        informacoesComplementares: form.informacoesComplementares || undefined,
        items: items.map((item) => ({
          description: item.descricao,
          ncmCode: item.ncm,
          cfopCode: item.cfop,
          quantity: parseFloat(item.quantidade) || 1,
          unitPrice: parseFloat(item.precoUnitario) || 0,
          unit: 'UN',
          // Reforma Tributária — alíquotas override para o motor fiscal
          aliqIbsOverride: item.ibs.aliquota > 0 ? item.ibs.aliquota : undefined,
          aliqCbsOverride: item.cbs.aliquota > 0 ? item.cbs.aliquota : undefined,
          aliqIsOverride: item.is.aliquota > 0 ? item.is.aliquota : undefined,
        })),
      };

      if (form.vinculoTipo === 'pedido_venda' && form.vinculoId) {
        body.saleOrderId = form.vinculoId;
      }
      if (form.vinculoTipo === 'ordem_servico' && form.vinculoId) {
        body.serviceOrderId = form.vinculoId;
      }

      const res = await apiFetch('/api/fiscal/nfe', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erro ao criar NF-e');
        return;
      }

      router.push('/fiscal/notas');
    } catch {
      toast.error('Erro ao criar NF-e');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fiscal/notas"
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

      {/* Dados da Nota */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados da Nota</h2>
        </div>

        {/* Type Radio */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo da Nota *</label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {(['ENTRADA', 'SAIDA'] as const).map((tipo) => (
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
            disabled={loadingData}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-60"
          >
            <option value="">{loadingData ? 'Carregando...' : `Selecione o ${form.tipo === 'SAIDA' ? 'destinatário' : 'remetente'}`}</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.cpfCnpj}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Natureza da Operação */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Natureza da Operação *</label>
        <input
          type="text"
          value={form.naturezaOperacao}
          onChange={(e) => updateForm('naturezaOperacao', e.target.value)}
          placeholder="Ex: Venda de produção do estabelecimento"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
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
                {form.vinculoTipo === 'pedido_venda' ? 'Pedido de Venda' : 'Ordem de Serviço'}
              </label>
              <select
                value={form.vinculoId}
                onChange={(e) => updateForm('vinculoId', e.target.value)}
                disabled={loadingData}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-60"
              >
                <option value="">Selecione</option>
                {(form.vinculoTipo === 'pedido_venda' ? pedidosVenda : ordensServico).map((v) => (
                  <option key={v.id} value={v.id}>{v.number}</option>
                ))}
              </select>
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
                    placeholder="Descrição do item"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
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
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Tributos Atuais</p>
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
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-teal-700">Reforma Tributária — IBS / CBS / IS</p>
                      <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">LC 214/2025 · vigência 2026</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {/* IBS */}
                      <div className="bg-white rounded border border-teal-200 p-2">
                        <p className="text-xs font-bold text-teal-700 mb-1">IBS</p>
                        <p className="text-[10px] text-slate-500 mb-1">Imp. Bens e Serviços</p>
                        <div className="flex items-center gap-1 mb-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.ibs.aliquota}
                            onChange={(e) => updateItemReformaTax(item.id, 'ibs', 'aliquota', e.target.value)}
                            className="w-16 px-1 py-0.5 border border-teal-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                          <span className="text-[10px] text-slate-500">%</span>
                        </div>
                        <p className="text-xs font-bold text-teal-900">{formatCurrency(item.ibs.valor)}</p>
                      </div>
                      {/* CBS */}
                      <div className="bg-white rounded border border-teal-200 p-2">
                        <p className="text-xs font-bold text-teal-700 mb-1">CBS</p>
                        <p className="text-[10px] text-slate-500 mb-1">Contrib. Bens e Serviços</p>
                        <div className="flex items-center gap-1 mb-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.cbs.aliquota}
                            onChange={(e) => updateItemReformaTax(item.id, 'cbs', 'aliquota', e.target.value)}
                            className="w-16 px-1 py-0.5 border border-teal-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                          <span className="text-[10px] text-slate-500">%</span>
                        </div>
                        <p className="text-xs font-bold text-teal-900">{formatCurrency(item.cbs.valor)}</p>
                      </div>
                      {/* IS */}
                      <div className="bg-white rounded border border-teal-200 p-2">
                        <p className="text-xs font-bold text-teal-700 mb-1">IS</p>
                        <p className="text-[10px] text-slate-500 mb-1">Imposto Seletivo</p>
                        <div className="flex items-center gap-1 mb-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.is.aliquota}
                            onChange={(e) => updateItemReformaTax(item.id, 'is', 'aliquota', e.target.value)}
                            className="w-16 px-1 py-0.5 border border-teal-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                          <span className="text-[10px] text-slate-500">%</span>
                        </div>
                        <p className="text-xs font-bold text-teal-900">{formatCurrency(item.is.valor)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">Alíquotas de referência: IBS 26,5% (2033) · CBS 8,8% (2033) · IS varia por NCM. No período de teste (2026) as alíquotas são reduzidas.</p>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">Desconto</label>
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

        {/* Reforma Tributária — sempre visível pois alíquotas são editáveis */}
        {(totalIBS > 0 || totalCBS > 0 || totalIS > 0) && (
          <div className="mb-4 p-3 bg-teal-50 rounded-lg border border-teal-200">
            <p className="text-xs font-semibold text-teal-700 mb-2">Reforma Tributária (LC 214/2025)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-teal-600">IBS:</span>
                <span className="font-semibold text-teal-900">{formatCurrency(totalIBS)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-teal-600">CBS:</span>
                <span className="font-semibold text-teal-900">{formatCurrency(totalCBS)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-teal-600">IS:</span>
                <span className="font-semibold text-teal-900">{formatCurrency(totalIS)}</span>
              </div>
            </div>
            <p className="text-[10px] text-teal-500 mt-1">Informados na NF-e dentro do grupo &lt;totIBSCBS&gt; — não compõem o vNF durante o período de transição.</p>
          </div>
        )}

        {taxesCalculated && (
          <div className="border-t border-slate-200 pt-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Impostos Calculados</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/fiscal/notas"
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
