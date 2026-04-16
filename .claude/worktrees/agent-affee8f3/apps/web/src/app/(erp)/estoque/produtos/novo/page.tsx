'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Save, X, Check, Package, DollarSign, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ProductForm {
  code: string;
  barcode: string;
  description: string;
  shortDescription: string;
  type: string;
  origin: string;
  unit: string;
  ncm: string;
  cest: string;
  costPrice: string;
  salePrice: string;
  margin: string;
  minStock: string;
  maxStock: string;
  location: string;
  netWeight: string;
  grossWeight: string;
  length: string;
  width: string;
  height: string;
  costCenter: string;
  notes: string;
  active: boolean;
}

const productTypes = [
  { value: 'PRODUTO_ACABADO', label: 'Produto Acabado' },
  { value: 'MATERIA_PRIMA', label: 'Matéria Prima' },
  { value: 'COMPONENTE', label: 'Componente / Peça Fabricada' },
  { value: 'PECA_REPOSICAO', label: 'Peça de Reposição' },
  { value: 'CONSUMIVEL', label: 'Consumível (Solda, Tinta, Parafusos)' },
  { value: 'SERVICO', label: 'Serviço / Mão de Obra' },
];

const originOptions = [
  { value: 'NACIONAL_0', label: '0 - Nacional' },
  { value: 'IMPORTADA_1', label: '1 - Estrangeira (importação direta)' },
  { value: 'IMPORTADA_2', label: '2 - Estrangeira (adquirida mercado interno)' },
  { value: 'NACIONAL_3', label: '3 - Nacional com conteúdo importação > 40%' },
  { value: 'NACIONAL_4', label: '4 - Nacional - processos básicos (PPB)' },
  { value: 'NACIONAL_5', label: '5 - Nacional com conteúdo importação <= 40%' },
  { value: 'IMPORTADA_6', label: '6 - Estrangeira (import. direta, sem similar)' },
  { value: 'IMPORTADA_7', label: '7 - Estrangeira (merc. interno, sem similar)' },
  { value: 'IMPORTADA_8', label: '8 - Nacional com conteúdo importação > 70%' },
];

const unitOptions = [
  { value: 'UN', label: 'UN - Unidade' },
  { value: 'KG', label: 'KG - Quilograma' },
  { value: 'M', label: 'M - Metro' },
  { value: 'M2', label: 'M2 - Metro Quadrado' },
  { value: 'M3', label: 'M3 - Metro Cúbico' },
  { value: 'L', label: 'L - Litro' },
  { value: 'HR', label: 'HR - Hora' },
  { value: 'CJ', label: 'CJ - Conjunto' },
  { value: 'PC', label: 'PC - Peça' },
  { value: 'PR', label: 'PR - Par' },
  { value: 'TON', label: 'TON - Tonelada' },
];

const STEPS = [
  { number: 1, label: 'Identificação', description: 'Dados básicos do produto', icon: Package },
  { number: 2, label: 'Preços e Estoque', description: 'Valores e controle de estoque', icon: DollarSign },
  { number: 3, label: 'Fiscal e Dimensões', description: 'NCM, CEST e medidas', icon: FileText },
];

type FormErrors = Partial<Record<keyof ProductForm, string>>;

function validateField(field: keyof ProductForm, value: unknown): string {
  if (field === 'code') return !String(value).trim() ? 'Código é obrigatório.' : '';
  if (field === 'description') return !String(value).trim() ? 'Descrição é obrigatória.' : '';
  return '';
}

const EMPTY_FORM: ProductForm = {
  code: '', barcode: '', description: '', shortDescription: '',
  type: 'PRODUTO_ACABADO', origin: 'NACIONAL_0', unit: 'UN',
  ncm: '', cest: '', costPrice: '', salePrice: '', margin: '',
  minStock: '', maxStock: '', location: '', netWeight: '',
  grossWeight: '', length: '', width: '', height: '',
  costCenter: '', notes: '', active: true,
};

export default function NovoProdutoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ProductForm, boolean>>>({});
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const updateForm = (field: keyof ProductForm, value: unknown) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'costPrice' || field === 'salePrice') {
        const cost = parseFloat(field === 'costPrice' ? String(value) : prev.costPrice);
        const sale = parseFloat(field === 'salePrice' ? String(value) : prev.salePrice);
        if (cost > 0 && sale > 0) updated.margin = (((sale - cost) / cost) * 100).toFixed(2);
      }
      return updated;
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

  const touchField = (field: keyof ProductForm) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }));
  };

  const fieldClass = (field: keyof ProductForm) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
      touched[field] && errors[field]
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-slate-300 focus:ring-blue-500'
    }`;

  // Validate step 1 before advancing
  const advanceStep = () => {
    if (step === 1) {
      const step1Fields: (keyof ProductForm)[] = ['code', 'description'];
      const newTouched: Partial<Record<keyof ProductForm, boolean>> = {};
      const newErrors: FormErrors = {};
      step1Fields.forEach((f) => { newTouched[f] = true; newErrors[f] = validateField(f, form[f]); });
      setTouched((prev) => ({ ...prev, ...newTouched }));
      setErrors((prev) => ({ ...prev, ...newErrors }));
      if (step1Fields.some((f) => newErrors[f])) return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleSave = async (andNew = false) => {
    setSaveError('');
    setSaving(true);
    try {
      const userObj = JSON.parse(localStorage.getItem('user') ?? '{}');
      const companyId = userObj?.company?.id ?? userObj?.companyId ?? '';
      if (!companyId) throw new Error('Empresa não identificada. Faça login novamente.');

      const body: Record<string, unknown> = {
        code: form.code.trim(),
        description: form.description.trim(),
        descriptionShort: form.shortDescription.trim() || undefined,
        type: form.type || undefined,
        origin: form.origin || undefined,
        unit: form.unit || undefined,
        cestCode: form.cest.trim() || undefined,
        precoCusto: form.costPrice ? parseFloat(form.costPrice) : undefined,
        precoVenda: form.salePrice ? parseFloat(form.salePrice) : undefined,
        margemLucro: form.margin ? parseFloat(form.margin) : undefined,
        estoqueMinimo: form.minStock ? parseFloat(form.minStock) : undefined,
        estoqueMaximo: form.maxStock ? parseFloat(form.maxStock) : undefined,
        pesoLiquido: form.netWeight ? parseFloat(form.netWeight) : undefined,
        pesoBruto: form.grossWeight ? parseFloat(form.grossWeight) : undefined,
        costCenterCode: form.costCenter || undefined,
        barcode: form.barcode.trim() || undefined,
        observacoes: form.notes.trim() || undefined,
      };

      const res = await apiFetch(`/api/products?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(Array.isArray(err.message) ? err.message.join(' | ') : (err.message || `Erro ${res.status}`));
      }

      if (andNew) {
        setForm(EMPTY_FORM);
        setErrors({});
        setTouched({});
        setStep(1);
      } else {
        router.push('/estoque/produtos');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao salvar produto. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/estoque/produtos"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Produto</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Preencha os dados para cadastrar um novo produto</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isDone = step > s.number;
            const isActive = step === s.number;
            return (
              <div key={s.number} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isDone ? 'bg-emerald-500' : isActive ? 'bg-blue-600' : 'bg-slate-100'
                  }`}>
                    {isDone
                      ? <Check className="w-5 h-5 text-white" />
                      : <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    }
                  </div>
                  <div className="hidden sm:block min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-blue-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{s.description}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${step > s.number ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">

        {/* ── Etapa 1: Identificação ── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Identificação do Produto
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateForm('code', e.target.value)}
                  onBlur={() => touchField('code')}
                  placeholder="Ex: PA-001"
                  className={fieldClass('code')}
                />
                {touched.code && errors.code && (
                  <p className="text-xs text-red-500 mt-1">{errors.code}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código de Barras</label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => updateForm('barcode', e.target.value)}
                  placeholder="EAN-13 ou EAN-14"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => updateForm('type', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {productTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descrição <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                onBlur={() => touchField('description')}
                placeholder="Descrição completa do produto"
                className={fieldClass('description')}
              />
              {touched.description && errors.description && (
                <p className="text-xs text-red-500 mt-1">{errors.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição Curta (NF-e)</label>
              <input
                type="text"
                value={form.shortDescription}
                onChange={(e) => updateForm('shortDescription', e.target.value)}
                placeholder="Descrição para uso em NF-e (máx 120 caracteres)"
                maxLength={120}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 mt-1">{form.shortDescription.length}/120 caracteres</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unidade de Medida</label>
                <select
                  value={form.unit}
                  onChange={(e) => updateForm('unit', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {unitOptions.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
                <select
                  value={form.origin}
                  onChange={(e) => updateForm('origin', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {originOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateForm('active', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Produto ativo</span>
            </label>
          </div>
        )}

        {/* ── Etapa 2: Preços e Estoque ── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Preços e Controle de Estoque
            </h2>

            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Precificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number" step="0.01" value={form.costPrice}
                    onChange={(e) => updateForm('costPrice', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number" step="0.01" value={form.salePrice}
                    onChange={(e) => updateForm('salePrice', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Margem (%)</label>
                  <input
                    type="text" value={form.margin} readOnly placeholder="Calculada automaticamente"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                  />
                  <p className="text-xs text-slate-400 mt-1">Calculada com base nos preços informados</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Custo</label>
              <select
                value={form.costCenter}
                onChange={(e) => updateForm('costCenter', e.target.value)}
                className="w-full md:w-1/2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Nenhum</option>
                <option value="CC_IND">Industrial / Produção</option>
                <option value="CC_COM">Comercial</option>
                <option value="CC_ADM">Administrativo</option>
                <option value="CC_OFI">Oficina / Calderaria</option>
                <option value="CC_FI">F&I (Financiamento / Seguro)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" /> Estoque
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mínimo</label>
                  <input
                    type="number" value={form.minStock}
                    onChange={(e) => updateForm('minStock', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Máximo</label>
                  <input
                    type="number" value={form.maxStock}
                    onChange={(e) => updateForm('maxStock', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Localização</label>
                  <input
                    type="text" value={form.location}
                    onChange={(e) => updateForm('location', e.target.value)}
                    placeholder="Ex: Prateleira A-03"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Etapa 3: Fiscal e Dimensões ── */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Classificação Fiscal e Dimensões
            </h2>

            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Classificação Fiscal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NCM</label>
                  <input
                    type="text" value={form.ncm}
                    onChange={(e) => updateForm('ncm', e.target.value)}
                    placeholder="0000.00.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">Nomenclatura Comum do Mercosul</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CEST</label>
                  <input
                    type="text" value={form.cest}
                    onChange={(e) => updateForm('cest', e.target.value)}
                    placeholder="00.000.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">Código Especificador da Substituição Tributária</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-600 mb-4">Dimensões e Peso</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Peso Líquido (kg)</label>
                  <input
                    type="number" step="0.001" value={form.netWeight}
                    onChange={(e) => updateForm('netWeight', e.target.value)}
                    placeholder="0,000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Peso Bruto (kg)</label>
                  <input
                    type="number" step="0.001" value={form.grossWeight}
                    onChange={(e) => updateForm('grossWeight', e.target.value)}
                    placeholder="0,000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comprimento (m)</label>
                  <input
                    type="number" step="0.01" value={form.length}
                    onChange={(e) => updateForm('length', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Largura (m)</label>
                  <input
                    type="number" step="0.01" value={form.width}
                    onChange={(e) => updateForm('width', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Altura (m)</label>
                  <input
                    type="number" step="0.01" value={form.height}
                    onChange={(e) => updateForm('height', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Resumo dos dados das etapas anteriores */}
            <div className="pt-2 border-t border-slate-100 bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Resumo do produto</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                <span><span className="text-slate-400">Código:</span> {form.code || '—'}</span>
                <span><span className="text-slate-400">Tipo:</span> {productTypes.find(t => t.value === form.type)?.label || '—'}</span>
                <span className="col-span-2"><span className="text-slate-400">Descrição:</span> {form.description || '—'}</span>
                {form.salePrice && <span><span className="text-slate-400">Preço Venda:</span> R$ {parseFloat(form.salePrice).toFixed(2)}</span>}
                {form.margin && <span><span className="text-slate-400">Margem:</span> {form.margin}%</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Erro de salvamento */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <span className="font-semibold shrink-0">Erro:</span>
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError('')} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: cancel or back */}
        {step === 1 ? (
          <Link
            href="/estoque/produtos"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" /> Cancelar
          </Link>
        ) : (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Etapa anterior
          </button>
        )}

        {/* Right: next or save */}
        {step < 3 ? (
          <button
            onClick={advanceStep}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Próxima etapa <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> Salvar e adicionar outro
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
