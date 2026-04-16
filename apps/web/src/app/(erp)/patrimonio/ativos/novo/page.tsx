'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';
import { ArrowLeft, AlertTriangle, Info } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'MAQUINA_EQUIPAMENTO', label: 'Máquina / Equipamento' },
  { value: 'VEICULO', label: 'Veículo' },
  { value: 'MOVEL_UTENSILIO', label: 'Móvel / Utensílio' },
  { value: 'IMOVEL', label: 'Imóvel' },
  { value: 'INFORMATICA', label: 'Informática' },
  { value: 'FERRAMENTA', label: 'Ferramenta' },
  { value: 'OUTRO', label: 'Outro' },
];

const CC_OPTIONS = [
  { value: 'CC_IND', label: 'Industrial (CC_IND)' },
  { value: 'CC_COM', label: 'Comercial (CC_COM)' },
  { value: 'CC_OFI', label: 'Oficina (CC_OFI)' },
  { value: 'CC_ADM', label: 'Administrativo (CC_ADM)' },
  { value: 'CC_FI', label: 'F&I (CC_FI)' },
];

export default function NovoAtivoPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    plaqueta: '',
    descricao: '',
    type: 'MAQUINA_EQUIPAMENTO',
    marca: '',
    modelo: '',
    numeroserie: '',
    localizacao: '',
    costCenterCode: 'CC_IND',
    dataAquisicao: '',
    fornecedor: '',
    notaFiscal: '',
    valorAquisicao: '',
    vidaUtilMeses: '',
    mesInicioDepreciacao: '',
    observacoes: '',
  });

  const vidaUtilNum = parseInt(form.vidaUtilMeses) || 0;
  const vidaUtilAnos = vidaUtilNum > 0 ? fmtNumber(vidaUtilNum / 12, 1) : '';
  const taxaMensal = vidaUtilNum > 0 ? fmtPercent((1 / vidaUtilNum) * 100, 4) : '';
  const valorAquisicaoNum = parseFloat(form.valorAquisicao) || 0;

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: field === 'descricao' ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.plaqueta || !form.descricao || !form.dataAquisicao || !form.valorAquisicao || !form.vidaUtilMeses) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/patrimonio', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          valorAquisicao: parseFloat(form.valorAquisicao),
          vidaUtilMeses: parseInt(form.vidaUtilMeses),
          mesInicioDepreciacao: form.mesInicioDepreciacao || form.dataAquisicao,
        }),
      });
      router.push('/patrimonio/ativos');
    } catch (err: any) {
      setError(err?.message || 'Erro ao cadastrar ativo. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/patrimonio/ativos" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Ativo Patrimonial</h1>
          <p className="text-sm text-gray-500">Cadastro de ativo fixo imobilizado</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação */}
        <div className="bg-white rounded-lg border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Identificação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plaqueta Patrimonial <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.plaqueta}
                onChange={e => handleChange('plaqueta', e.target.value)}
                placeholder="Ex: PAT-0001"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                value={form.type}
                onChange={e => handleChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.descricao}
                onChange={e => handleChange('descricao', e.target.value)}
                placeholder="TORNO CNC ROMI GALAXY"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input
                type="text"
                value={form.marca}
                onChange={e => handleChange('marca', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input
                type="text"
                value={form.modelo}
                onChange={e => handleChange('modelo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Série</label>
              <input
                type="text"
                value={form.numeroserie}
                onChange={e => handleChange('numeroserie', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
              <input
                type="text"
                value={form.localizacao}
                onChange={e => handleChange('localizacao', e.target.value)}
                placeholder="Ex: Setor Calderaria"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Custo <span className="text-red-500">*</span>
              </label>
              <select
                value={form.costCenterCode}
                onChange={e => handleChange('costCenterCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Aquisição */}
        <div className="bg-white rounded-lg border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Aquisição</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Aquisição <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.dataAquisicao}
                onChange={e => handleChange('dataAquisicao', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor de Aquisição (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valorAquisicao}
                onChange={e => handleChange('valorAquisicao', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {valorAquisicaoNum > 0 && valorAquisicaoNum < 1200 && (
                <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Valor abaixo de R$ 1.200,00 — considere usar o módulo de Estoque.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
              <input
                type="text"
                value={form.fornecedor}
                onChange={e => handleChange('fornecedor', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota Fiscal</label>
              <input
                type="text"
                value={form.notaFiscal}
                onChange={e => handleChange('notaFiscal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Depreciação */}
        <div className="bg-white rounded-lg border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Depreciação</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Método linear: depreciação mensal = Valor de Aquisição / Vida Útil em meses.
              O valor mensal é alocado como custo GGF no centro de custo do ativo.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vida Útil (meses) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.vidaUtilMeses}
                onChange={e => handleChange('vidaUtilMeses', e.target.value)}
                placeholder="Ex: 60"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {vidaUtilAnos && (
                <p className="text-xs text-gray-500 mt-1">{form.vidaUtilMeses} meses = {vidaUtilAnos} anos</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taxa de Depreciação Mensal
              </label>
              <div className="flex items-center px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">
                  {taxaMensal ? `${taxaMensal} ao mês` : '— calculado automaticamente'}
                </span>
              </div>
              {taxaMensal && valorAquisicaoNum > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Parcela mensal: {fmtCurrency((valorAquisicaoNum / vidaUtilNum) || 0)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Início da Depreciação
              </label>
              <input
                type="date"
                value={form.mesInicioDepreciacao}
                onChange={e => handleChange('mesInicioDepreciacao', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Padrão: data de aquisição</p>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-lg border p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Observações</h2>
          <textarea
            value={form.observacoes}
            onChange={e => handleChange('observacoes', e.target.value)}
            rows={3}
            placeholder="Informações adicionais sobre o ativo..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/patrimonio/ativos"
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
          >
            {submitting ? 'Cadastrando...' : 'Cadastrar Ativo'}
          </button>
        </div>
      </form>
    </div>
  );
}
