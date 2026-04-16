'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Save, X } from 'lucide-react';
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

const sections = [
  { key: 'identificacao', label: 'Identificação' },
  { key: 'fiscal', label: 'Classificação Fiscal' },
  { key: 'precos', label: 'Preços' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'dimensoes', label: 'Dimensões' },
];


export default function EditarProdutoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [activeSection, setActiveSection] = useState('identificacao');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState<ProductForm>({
    code: '',
    barcode: '',
    description: '',
    shortDescription: '',
    type: 'PRODUTO_ACABADO',
    origin: 'NACIONAL_0',
    unit: 'UN',
    ncm: '',
    cest: '',
    costPrice: '',
    salePrice: '',
    margin: '',
    minStock: '',
    maxStock: '',
    location: '',
    netWeight: '',
    grossWeight: '',
    length: '',
    width: '',
    height: '',
    costCenter: '',
    notes: '',
    active: true,
  });

  useEffect(() => {
    apiFetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(p => {
        setForm({
          code: p.code ?? '',
          barcode: p.barcode ?? '',
          description: p.description ?? '',
          shortDescription: p.descriptionShort ?? '',
          type: p.type ?? 'PRODUTO_ACABADO',
          origin: p.origin ?? '0',
          unit: p.unit ?? 'UN',
          ncm: p.ncm?.code ?? '',
          cest: p.cestCode ?? '',
          costPrice: p.precoCusto != null ? String(p.precoCusto) : '',
          salePrice: p.precoVenda != null ? String(p.precoVenda) : '',
          margin: p.margemLucro != null ? String(p.margemLucro) : '',
          minStock: p.estoqueMinimo != null ? String(p.estoqueMinimo) : '',
          maxStock: p.estoqueMaximo != null ? String(p.estoqueMaximo) : '',
          location: p.localizacao ?? '',
          netWeight: p.pesoLiquido != null ? String(p.pesoLiquido) : '',
          grossWeight: p.pesoBruto != null ? String(p.pesoBruto) : '',
          length: p.comprimento != null ? String(p.comprimento) : '',
          width: p.largura != null ? String(p.largura) : '',
          height: p.altura != null ? String(p.altura) : '',
          costCenter: p.costCenterCode ?? '',
          notes: p.observacoes ?? '',
          active: p.active ?? true,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const updateForm = (field: keyof ProductForm, value: unknown) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'costPrice' || field === 'salePrice') {
        const cost = parseFloat(field === 'costPrice' ? String(value) : prev.costPrice);
        const sale = parseFloat(field === 'salePrice' ? String(value) : prev.salePrice);
        if (cost > 0 && sale > 0) {
          const margin = ((sale - cost) / cost) * 100;
          updated.margin = margin.toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaveError('');

    if (!form.code.trim()) {
      setSaveError('O campo Código é obrigatório.');
      setActiveSection('identificacao');
      return;
    }
    if (!form.description.trim()) {
      setSaveError('O campo Descrição é obrigatório.');
      setActiveSection('identificacao');
      return;
    }

    setSaving(true);
    try {
      const body = {
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
        active: form.active,
      };
      const res = await apiFetch(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message)
          ? err.message.join(' | ')
          : (err.message || `Erro ${res.status}`);
        throw new Error(msg);
      }
      router.push('/estoque/produtos');
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao atualizar produto. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/estoque/produtos"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar Produto</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {form.code ? `${form.code} — ${form.description}` : 'Carregando...'}
          </p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px overflow-x-auto">
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === section.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Identificação */}
          {activeSection === 'identificacao' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => updateForm('code', e.target.value)}
                    placeholder="Ex: PA-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                    {productTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Descrição completa do produto"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
                  <select
                    value={form.origin}
                    onChange={(e) => updateForm('origin', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {originOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                  <select
                    value={form.unit}
                    onChange={(e) => updateForm('unit', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {unitOptions.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
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

              <div>
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
            </div>
          )}

          {/* Classificação Fiscal */}
          {activeSection === 'fiscal' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NCM</label>
                  <input
                    type="text"
                    value={form.ncm}
                    onChange={(e) => updateForm('ncm', e.target.value)}
                    placeholder="0000.00.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">Nomenclatura Comum do Mercosul</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CEST</label>
                  <input
                    type="text"
                    value={form.cest}
                    onChange={(e) => updateForm('cest', e.target.value)}
                    placeholder="00.000.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">Código Especificador da Substituição Tributária</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
                  <select
                    value={form.origin}
                    onChange={(e) => updateForm('origin', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {originOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Preços */}
          {activeSection === 'precos' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) => updateForm('costPrice', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.salePrice}
                    onChange={(e) => updateForm('salePrice', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Margem (%)</label>
                  <input
                    type="text"
                    value={form.margin}
                    readOnly
                    placeholder="Calculada automaticamente"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                  />
                  <p className="text-xs text-slate-400 mt-1">Calculada com base nos preços de custo e venda</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Custo</label>
                <select
                  value={form.costCenter}
                  onChange={(e) => updateForm('costCenter', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent md:w-1/2"
                >
                  <option value="">Nenhum</option>
                  <option value="CC_IND">Industrial / Produção</option>
                  <option value="CC_COM">Comercial</option>
                  <option value="CC_ADM">Administrativo</option>
                  <option value="CC_OFI">Oficina / Calderaria</option>
                  <option value="CC_FI">F&I (Financiamento / Seguro)</option>
                </select>
              </div>
            </div>
          )}

          {/* Estoque */}
          {activeSection === 'estoque' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    value={form.minStock}
                    onChange={(e) => updateForm('minStock', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Máximo</label>
                  <input
                    type="number"
                    value={form.maxStock}
                    onChange={(e) => updateForm('maxStock', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Localização no Estoque</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => updateForm('location', e.target.value)}
                    placeholder="Ex: Prateleira A-03"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dimensões */}
          {activeSection === 'dimensoes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Peso Líquido (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.netWeight}
                    onChange={(e) => updateForm('netWeight', e.target.value)}
                    placeholder="0,000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Peso Bruto (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.grossWeight}
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
                    type="number"
                    step="0.01"
                    value={form.length}
                    onChange={(e) => updateForm('length', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Largura (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.width}
                    onChange={(e) => updateForm('width', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Altura (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.height}
                    onChange={(e) => updateForm('height', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Erro de salvamento */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <span className="font-semibold shrink-0">Erro:</span>
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError('')} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/estoque/produtos"
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
