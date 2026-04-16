'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  X,
  BookOpen,
  ArrowRightLeft,
  Info,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const operacaoOptions = [
  { value: '', label: 'Qualquer operação (wildcard)' },
  { value: 'SAIDA_VENDA_PRODUCAO', label: 'Venda de Produção Própria' },
  { value: 'SAIDA_VENDA_MERCADORIA', label: 'Venda de Mercadoria (Revenda)' },
  { value: 'SAIDA_VENDA_PECA', label: 'Venda de Peça de Reposição' },
  { value: 'SAIDA_SERVICO', label: 'Prestação de Serviço' },
  { value: 'SAIDA_DEVOLUCAO_COMPRA', label: 'Devolução a Fornecedor' },
  { value: 'SAIDA_REMESSA_INDUSTRIA', label: 'Remessa para Industrialização' },
  { value: 'SAIDA_REMESSA_CONSERTO', label: 'Remessa para Conserto' },
  { value: 'SAIDA_TRANSFERENCIA', label: 'Transferência para Filial' },
  { value: 'ENTRADA_COMPRA_INDUSTRIA', label: 'Compra para Industrialização' },
  { value: 'ENTRADA_COMPRA_COMERCIO', label: 'Compra para Comercialização' },
  { value: 'ENTRADA_DEVOLUCAO_VENDA', label: 'Devolução de Venda Recebida' },
  { value: 'ENTRADA_RETORNO_INDUSTRIA', label: 'Retorno de Industrialização' },
  { value: 'ENTRADA_RETORNO_CONSERTO', label: 'Retorno de Conserto' },
  { value: 'ENTRADA_TRANSFERENCIA', label: 'Recebimento de Transferência' },
];

const cstIcmsOptions = [
  { value: '00', label: '00 — Tributada integralmente' },
  { value: '10', label: '10 — Tributada com cobrança do ICMS por ST' },
  { value: '20', label: '20 — Com redução de base de cálculo' },
  { value: '30', label: '30 — Isenta/não tributada com cobrança de ICMS por ST' },
  { value: '40', label: '40 — Isenta' },
  { value: '41', label: '41 — Não tributada' },
  { value: '50', label: '50 — Suspensão' },
  { value: '51', label: '51 — Diferimento' },
  { value: '60', label: '60 — ICMS cobrado anteriormente por ST' },
  { value: '70', label: '70 — Redução de BC com cobrança de ICMS por ST' },
  { value: '90', label: '90 — Outros' },
];

const cstPisCofinsOptions = [
  { value: '01', label: '01 — Operação tributável (alíquota básica)' },
  { value: '02', label: '02 — Operação tributável (alíquota diferenciada)' },
  { value: '04', label: '04 — Operação tributável monofásica (revenda a alíquota zero)' },
  { value: '06', label: '06 — Operação tributável (alíquota zero)' },
  { value: '07', label: '07 — Operação isenta da contribuição' },
  { value: '08', label: '08 — Operação sem incidência da contribuição' },
  { value: '09', label: '09 — Operação com suspensão da contribuição' },
  { value: '49', label: '49 — Outras operações de saída' },
  { value: '50', label: '50 — Operação com direito a crédito (alíquota básica)' },
  { value: '99', label: '99 — Outras operações' },
];

const ncmSuggestions = [
  { ncm: '8707.90.90', desc: 'Carrocerias para veículos automóveis' },
  { ncm: '8418.69.99', desc: 'Outros equipamentos de refrigeração' },
  { ncm: '8512.20.29', desc: 'Outros aparelhos de iluminação para veículos' },
  { ncm: '7208.51.00', desc: 'Chapas de aço laminadas a quente (espessura >= 10mm)' },
  { ncm: '7216.31.00', desc: 'Perfis de aço em U, laminados a quente' },
  { ncm: '7308.90.90', desc: 'Outras construções e partes de ferro ou aço' },
  { ncm: '7318.15.00', desc: 'Parafusos e porcas de ferro ou aço' },
  { ncm: '8481.80.99', desc: 'Outros artigos de torneiras e válvulas' },
];

interface RuleForm {
  name: string;
  ncmCode: string;
  cfopCode: string;
  operation: string;
  priority: string;
  cstIcms: string;
  aliqIcms: string;
  reducaoBcIcms: string;
  cstIpi: string;
  aliqIpi: string;
  cstPis: string;
  aliqPis: string;
  cstCofins: string;
  aliqCofins: string;
  aliqIbs: string;
  aliqCbs: string;
  aliqIs: string;
}

function getCompanyId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    return u?.company?.id ?? u?.companyId ?? '';
  } catch { return ''; }
}

export default function NovaRegraPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showNcmSuggestions, setShowNcmSuggestions] = useState(false);

  const [form, setForm] = useState<RuleForm>({
    name: '',
    ncmCode: '',
    cfopCode: '',
    operation: '',
    priority: '50',
    cstIcms: '00',
    aliqIcms: '12',
    reducaoBcIcms: '0',
    cstIpi: '50',
    aliqIpi: '0',
    cstPis: '01',
    aliqPis: '1.65',
    cstCofins: '01',
    aliqCofins: '7.6',
    aliqIbs: '0',
    aliqCbs: '0',
    aliqIs: '0',
  });

  const updateForm = (field: keyof RuleForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectNcm = (ncm: string) => {
    updateForm('ncmCode', ncm.replace(/\./g, ''));
    setShowNcmSuggestions(false);
  };

  const filteredNcmSuggestions = ncmSuggestions.filter(
    (s) => s.ncm.includes(form.ncmCode) || s.desc.toLowerCase().includes(form.ncmCode.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.name.trim()) { setSaveError('Informe um nome para a regra.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const res = await apiFetch('/api/fiscal/tax-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          ncmCode: form.ncmCode || undefined,
          cfopCode: form.cfopCode || undefined,
          operation: form.operation || undefined,
          priority: Number(form.priority) || 50,
          cstIcms: form.cstIcms || undefined,
          aliqIcms: form.aliqIcms ? Number(form.aliqIcms) : undefined,
          reducaoBcIcms: Number(form.reducaoBcIcms) || 0,
          cstIpi: form.cstIpi || undefined,
          aliqIpi: form.aliqIpi ? Number(form.aliqIpi) : undefined,
          cstPis: form.cstPis || undefined,
          aliqPis: form.aliqPis ? Number(form.aliqPis) : undefined,
          cstCofins: form.cstCofins || undefined,
          aliqCofins: form.aliqCofins ? Number(form.aliqCofins) : undefined,
          aliqIbs: form.aliqIbs ? Number(form.aliqIbs) : undefined,
          aliqCbs: form.aliqCbs ? Number(form.aliqCbs) : undefined,
          aliqIs: form.aliqIs ? Number(form.aliqIs) : undefined,
          active: true,
        }),
      });
      if (res.ok) {
        router.push('/fiscal/regras');
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(Array.isArray(err.message) ? err.message.join(' | ') : (err.message ?? 'Erro ao salvar regra'));
      }
    } catch {
      setSaveError('Erro de conexão com o servidor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fiscal/regras"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Regra Tributária</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Configure a tributação para uma combinação de NCM, CFOP e operação
          </p>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {saveError}
        </div>
      )}

      {/* NCM + CFOP + Operação */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Identificação</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Regra *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Ex: Venda de carroceria RS→SP"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prioridade <span className="text-slate-400 font-normal">(0–100, maior = mais específica)</span>
            </label>
            <input
              type="number" min="0" max="100"
              value={form.priority}
              onChange={(e) => updateForm('priority', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              NCM <span className="text-slate-400 font-normal">(vazio = qualquer)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.ncmCode}
                onChange={(e) => {
                  updateForm('ncmCode', e.target.value.replace(/\D/g, '').slice(0, 8));
                  setShowNcmSuggestions(true);
                }}
                onFocus={() => setShowNcmSuggestions(true)}
                placeholder="Ex: 87079090"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            {showNcmSuggestions && form.ncmCode && filteredNcmSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredNcmSuggestions.map((s) => (
                  <button
                    key={s.ncm}
                    onClick={() => selectNcm(s.ncm)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm border-b border-slate-100 last:border-0"
                  >
                    <span className="font-mono font-medium text-slate-900">{s.ncm}</span>
                    <span className="text-slate-500 ml-2">— {s.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CFOP <span className="text-slate-400 font-normal">(vazio = qualquer)</span>
            </label>
            <input
              type="text"
              value={form.cfopCode}
              onChange={(e) => updateForm('cfopCode', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ex: 5101"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Operação</label>
            <select
              value={form.operation}
              onChange={(e) => updateForm('operation', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {operacaoOptions.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Current System */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Sistema Atual</h2>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">2026: 90%</span>
        </div>

        {/* ICMS */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">ICMS</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">CST ICMS</label>
              <select
                value={form.cstIcms}
                onChange={(e) => updateForm('cstIcms', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {cstIcmsOptions.map((cst) => (
                  <option key={cst.value} value={cst.value}>{cst.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Alíquota ICMS (%)</label>
              <input type="number" value={form.aliqIcms} onChange={(e) => updateForm('aliqIcms', e.target.value)}
                min="0" max="100" step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Redução BC ICMS (%)</label>
              <input type="number" value={form.reducaoBcIcms} onChange={(e) => updateForm('reducaoBcIcms', e.target.value)}
                min="0" max="100" step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Alíquota IPI (%)</label>
              <input type="number" value={form.aliqIpi} onChange={(e) => updateForm('aliqIpi', e.target.value)}
                min="0" max="100" step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        </div>

        {/* PIS / COFINS */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">PIS / COFINS</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">CST PIS/COFINS</label>
              <select value={form.cstPis} onChange={(e) => { updateForm('cstPis', e.target.value); updateForm('cstCofins', e.target.value); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {cstPisCofinsOptions.map((cst) => (
                  <option key={cst.value} value={cst.value}>{cst.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Alíquota PIS (%)</label>
              <input type="number" value={form.aliqPis} onChange={(e) => updateForm('aliqPis', e.target.value)}
                min="0" max="100" step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Alíquota COFINS (%)</label>
              <input type="number" value={form.aliqCofins} onChange={(e) => updateForm('aliqCofins', e.target.value)}
                min="0" max="100" step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Reforma Tributária */}
      <div className="bg-white rounded-lg shadow-sm border border-teal-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Reforma Tributária (EC 132/2023)</h2>
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">2026: 10% vigência</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-teal-600 mb-1">Alíquota IBS (%)</label>
            <input type="number" value={form.aliqIbs} onChange={(e) => updateForm('aliqIbs', e.target.value)}
              min="0" max="100" step="0.01"
              className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <p className="text-[10px] text-teal-600 mt-1">Imposto sobre Bens e Serviços (estadual/municipal)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-teal-600 mb-1">Alíquota CBS (%)</label>
            <input type="number" value={form.aliqCbs} onChange={(e) => updateForm('aliqCbs', e.target.value)}
              min="0" max="100" step="0.01"
              className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <p className="text-[10px] text-teal-600 mt-1">Contribuição sobre Bens e Serviços (federal)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-teal-600 mb-1">Alíquota IS (%)</label>
            <input type="number" value={form.aliqIs} onChange={(e) => updateForm('aliqIs', e.target.value)}
              min="0" max="100" step="0.01"
              className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <p className="text-[10px] text-teal-600 mt-1">Imposto Seletivo (itens prejudiciais à saúde/ambiente)</p>
          </div>
        </div>
      </div>

      {/* Transition Information Box */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-emerald-800 mb-2">Cronograma da Reforma Tributária</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-emerald-700">
              <div className="bg-white rounded p-2 border border-emerald-200">
                <p className="font-bold">2026</p>
                <p>90% atual / 10% IBS+CBS</p>
              </div>
              <div className="bg-white rounded p-2 border border-emerald-200">
                <p className="font-bold">2027</p>
                <p>80% atual / 20% IBS+CBS</p>
              </div>
              <div className="bg-white rounded p-2 border border-emerald-200">
                <p className="font-bold">2028</p>
                <p>70% atual / 30% IBS+CBS</p>
              </div>
              <div className="bg-white rounded p-2 border border-emerald-200">
                <p className="font-bold">2029-2032</p>
                <p>Redução gradual</p>
              </div>
            </div>
            <p className="text-xs text-emerald-600 mt-3">
              A partir de 2033, os tributos atuais (ICMS, IPI, PIS, COFINS) serão extintos e substituídos integralmente por IBS, CBS e IS.
              O motor tributário calcula automaticamente as proporções de acordo com o ano fiscal vigente.
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/fiscal/regras"
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
          Salvar Regra
        </button>
      </div>
    </div>
  );
}
