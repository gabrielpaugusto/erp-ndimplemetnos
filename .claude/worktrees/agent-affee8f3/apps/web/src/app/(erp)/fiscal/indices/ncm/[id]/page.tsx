'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Save, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const tabs = [
  { key: 'identificacao', label: 'Identificação' },
  { key: 'ipi', label: 'IPI' },
  { key: 'icms', label: 'ICMS / CSOSN' },
  { key: 'pis_cofins', label: 'PIS / COFINS' },
  { key: 'importacao', label: 'Importação' },
  { key: 'reforma', label: 'Reforma Tributária' },
];

const CST_ICMS_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: '00', label: '00 — Tributada integralmente' },
  { value: '10', label: '10 — Tributada + ST' },
  { value: '20', label: '20 — Com redução de BC' },
  { value: '30', label: '30 — Isenta/Não trib. + ST' },
  { value: '40', label: '40 — Isenta' },
  { value: '41', label: '41 — Não tributada' },
  { value: '50', label: '50 — Suspensão' },
  { value: '51', label: '51 — Diferimento' },
  { value: '60', label: '60 — ICMS cobrado ant. por ST' },
  { value: '70', label: '70 — Redução de BC + ST' },
  { value: '90', label: '90 — Outros' },
];

const CSOSN_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: '101', label: '101 — Tributada SN com crédito' },
  { value: '102', label: '102 — Tributada SN sem crédito' },
  { value: '103', label: '103 — Isenta SN (faixa de receita)' },
  { value: '201', label: '201 — Tributada SN com crédito + ST' },
  { value: '202', label: '202 — Tributada SN sem crédito + ST' },
  { value: '203', label: '203 — Isenta SN + ST' },
  { value: '300', label: '300 — Imune' },
  { value: '400', label: '400 — Não tributada SN' },
  { value: '500', label: '500 — ICMS cobrado ant. por ST' },
  { value: '900', label: '900 — Outros' },
];

const CST_IPI_ENTRADA = [
  { value: '', label: 'Selecione...' },
  { value: '00', label: '00 — Entrada c/ recuperação de crédito' },
  { value: '01', label: '01 — Entrada tributada alíquota zero' },
  { value: '02', label: '02 — Entrada isenta' },
  { value: '03', label: '03 — Entrada não tributada' },
  { value: '04', label: '04 — Entrada imune' },
  { value: '05', label: '05 — Entrada com suspensão' },
  { value: '49', label: '49 — Outras entradas' },
];

const CST_IPI_SAIDA = [
  { value: '', label: 'Selecione...' },
  { value: '50', label: '50 — Saída tributada' },
  { value: '51', label: '51 — Saída tributável alíquota zero' },
  { value: '52', label: '52 — Saída isenta' },
  { value: '53', label: '53 — Saída não tributada' },
  { value: '54', label: '54 — Saída imune' },
  { value: '55', label: '55 — Saída com suspensão' },
  { value: '99', label: '99 — Outras saídas' },
];

const CST_PIS_COFINS_SAIDA = [
  { value: '', label: 'Selecione...' },
  { value: '01', label: '01 — Tributável (alíq. normal)' },
  { value: '02', label: '02 — Tributável (alíq. diferenciada)' },
  { value: '03', label: '03 — Tributável (por qtd × alíq. unit.)' },
  { value: '04', label: '04 — Monofásica (alíq. zero)' },
  { value: '05', label: '05 — Por substituição tributária' },
  { value: '06', label: '06 — Alíquota zero' },
  { value: '07', label: '07 — Isenta' },
  { value: '08', label: '08 — Sem incidência' },
  { value: '09', label: '09 — Com suspensão' },
  { value: '49', label: '49 — Outras saídas' },
];

const CST_PIS_COFINS_ENTRADA = [
  { value: '', label: 'Selecione...' },
  { value: '50', label: '50 — Direito a crédito (rec. tributadas)' },
  { value: '70', label: '70 — Sem direito a crédito' },
  { value: '71', label: '71 — Aquisição com isenção' },
  { value: '72', label: '72 — Aquisição com suspensão' },
  { value: '73', label: '73 — Aquisição alíquota zero' },
  { value: '74', label: '74 — Aquisição sem incidência' },
  { value: '75', label: '75 — Aquisição por ST' },
  { value: '98', label: '98 — Outras entradas' },
  { value: '99', label: '99 — Outras operações' },
];

const CATEGORIA_IS = [
  { value: '', label: 'Não sujeito' },
  { value: 'TABACO', label: 'Tabaco e derivados' },
  { value: 'ALCOOL', label: 'Bebidas alcoólicas' },
  { value: 'VEICULO_POLUENTE', label: 'Veículos poluentes' },
  { value: 'APOSTAS', label: 'Jogos e apostas' },
  { value: 'ARMAS', label: 'Armas e munições' },
  { value: 'MINERIO', label: 'Extração mineral' },
  { value: 'OUTROS', label: 'Outros' },
];

interface NcmForm {
  code: string; description: string; exTipi: string;
  aliquotaIpi: string; cstIpiEntrada: string; cstIpiSaida: string;
  cstIcms: string; reducaoBcIcms: string; csosn: string;
  temSt: boolean; cestCode: string; cestDescricao: string;
  cstPisCofinsSaida: string; cstPisCofinsEntrada: string;
  aliquotaPis: string; aliquotaCofins: string; monofasico: boolean;
  aliquotaImportacao: string;
  aliquotaCbs: string; cstCbs: string;
  aliquotaIbs: string; cstIbs: string;
  temIs: boolean; aliquotaIs: string; categoriaIs: string;
  categoriaReforma: string; regimeEspecialReforma: string; observacoes: string;
  active: boolean;
}

const toStr = (v: unknown): string => (v == null ? '' : String(v));

function mapDataToForm(data: any): NcmForm {
  return {
    code: toStr(data.code),
    description: toStr(data.description),
    exTipi: toStr(data.exTipi),
    aliquotaIpi: data.aliquotaIpi != null ? String(Number(data.aliquotaIpi)) : '',
    cstIpiEntrada: toStr(data.cstIpiEntrada),
    cstIpiSaida: toStr(data.cstIpiSaida),
    cstIcms: toStr(data.cstIcms),
    reducaoBcIcms: data.reducaoBcIcms != null ? String(Number(data.reducaoBcIcms)) : '',
    csosn: toStr(data.csosn),
    temSt: Boolean(data.temSt),
    cestCode: toStr(data.cestCode),
    cestDescricao: toStr(data.cestDescricao),
    cstPisCofinsSaida: toStr(data.cstPisCofinsSaida),
    cstPisCofinsEntrada: toStr(data.cstPisCofinsEntrada),
    aliquotaPis: data.aliquotaPis != null ? String(Number(data.aliquotaPis)) : '',
    aliquotaCofins: data.aliquotaCofins != null ? String(Number(data.aliquotaCofins)) : '',
    monofasico: Boolean(data.monofasico),
    aliquotaImportacao: data.aliquotaImportacao != null ? String(Number(data.aliquotaImportacao)) : '',
    aliquotaCbs: data.aliquotaCbs != null ? String(Number(data.aliquotaCbs)) : '',
    cstCbs: toStr(data.cstCbs),
    aliquotaIbs: data.aliquotaIbs != null ? String(Number(data.aliquotaIbs)) : '',
    cstIbs: toStr(data.cstIbs),
    temIs: Boolean(data.temIs),
    aliquotaIs: data.aliquotaIs != null ? String(Number(data.aliquotaIs)) : '',
    categoriaIs: toStr(data.categoriaIs),
    categoriaReforma: toStr(data.categoriaReforma) || 'BEM',
    regimeEspecialReforma: toStr(data.regimeEspecialReforma),
    observacoes: toStr(data.observacoes),
    active: data.active !== false,
  };
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
const selectCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export default function EditNcmPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [activeTab, setActiveTab] = useState('identificacao');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NcmForm | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/fiscal/ncm/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => setForm(mapDataToForm(data)))
      .catch(err => setLoadError(err.message || 'Erro ao carregar NCM.'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: keyof NcmForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!form) return;
    setForm(prev => prev ? ({ ...prev, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }) : prev);
  };

  const handleSave = async () => {
    if (!form) return;
    setSaveError('');
    if (!form.code.trim()) { setSaveError('Código NCM é obrigatório.'); setActiveTab('identificacao'); return; }
    if (!form.description.trim()) { setSaveError('Descrição é obrigatória.'); setActiveTab('identificacao'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim(),
        description: form.description.trim(),
        exTipi: form.exTipi || undefined,
        aliquotaIpi: form.aliquotaIpi ? parseFloat(form.aliquotaIpi) : undefined,
        cstIpiEntrada: form.cstIpiEntrada || undefined,
        cstIpiSaida: form.cstIpiSaida || undefined,
        cstIcms: form.cstIcms || undefined,
        reducaoBcIcms: form.reducaoBcIcms ? parseFloat(form.reducaoBcIcms) : undefined,
        csosn: form.csosn || undefined,
        temSt: form.temSt,
        cestCode: form.temSt ? (form.cestCode || undefined) : undefined,
        cestDescricao: form.temSt ? (form.cestDescricao || undefined) : undefined,
        cstPisCofinsSaida: form.cstPisCofinsSaida || undefined,
        cstPisCofinsEntrada: form.cstPisCofinsEntrada || undefined,
        aliquotaPis: form.aliquotaPis ? parseFloat(form.aliquotaPis) : undefined,
        aliquotaCofins: form.aliquotaCofins ? parseFloat(form.aliquotaCofins) : undefined,
        monofasico: form.monofasico,
        aliquotaImportacao: form.aliquotaImportacao ? parseFloat(form.aliquotaImportacao) : undefined,
        aliquotaCbs: form.aliquotaCbs ? parseFloat(form.aliquotaCbs) : undefined,
        cstCbs: form.cstCbs || undefined,
        aliquotaIbs: form.aliquotaIbs ? parseFloat(form.aliquotaIbs) : undefined,
        cstIbs: form.cstIbs || undefined,
        temIs: form.temIs,
        aliquotaIs: form.temIs && form.aliquotaIs ? parseFloat(form.aliquotaIs) : undefined,
        categoriaIs: form.temIs ? (form.categoriaIs || undefined) : undefined,
        categoriaReforma: form.categoriaReforma || undefined,
        regimeEspecialReforma: form.regimeEspecialReforma || undefined,
        observacoes: form.observacoes || undefined,
        active: form.active,
      };

      const res = await apiFetch(`/api/fiscal/ncm/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message) ? err.message.join(' | ') : (err.message || `Erro ${res.status}`);
        throw new Error(msg);
      }
      router.push('/fiscal/indices/ncm');
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao salvar NCM.');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="h-64 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-6 rounded-lg text-center">
        <p className="font-semibold">Erro ao carregar NCM</p>
        <p className="text-sm mt-1">{loadError}</p>
        <Link href="/fiscal/indices/ncm" className="mt-4 inline-block text-sm text-blue-600 hover:underline">Voltar à lista</Link>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/fiscal/indices/ncm" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar NCM — {form.code}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Edição de Nomenclatura Comum do Mercosul</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* IDENTIFICAÇÃO */}
          {activeTab === 'identificacao' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className={labelCls}>Código NCM <span className="text-red-500">*</span></label>
                  <input type="text" value={form.code} onChange={set('code')} placeholder="0000.00.00" maxLength={10} className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">8 dígitos — ex: 8716.39.00</p>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Descrição <span className="text-red-500">*</span></label>
                  <input type="text" value={form.description} onChange={set('description')} placeholder="Descrição completa conforme TIPI" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className={labelCls}>Ex TIPI</label>
                  <input type="text" value={form.exTipi} onChange={set('exTipi')} placeholder="Ex: 01" maxLength={5} className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">Exceção TIPI (quando aplicável)</p>
                </div>
                <div>
                  <label className={labelCls}>Categoria (Reforma)</label>
                  <select value={form.categoriaReforma} onChange={set('categoriaReforma')} className={selectCls}>
                    <option value="BEM">Bem / Produto</option>
                    <option value="SERVICO">Serviço</option>
                    <option value="BEM_IMATERIAL">Bem Imaterial</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={set('active')} className="w-4 h-4 text-blue-600 border-slate-300 rounded" />
                  <span className="text-sm font-medium text-slate-700">NCM ativo</span>
                </label>
              </div>
            </div>
          )}

          {/* IPI */}
          {activeTab === 'ipi' && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <strong>IPI — Imposto sobre Produtos Industrializados</strong><br/>
                Defina a alíquota e os CSTs padrão para operações com este NCM.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className={labelCls}>Alíquota IPI (%)</label>
                  <input type="number" step="0.01" min="0" max="300" value={form.aliquotaIpi} onChange={set('aliquotaIpi')} placeholder="0,00" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>CST IPI — Entradas</label>
                  <select value={form.cstIpiEntrada} onChange={set('cstIpiEntrada')} className={selectCls}>
                    {CST_IPI_ENTRADA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>CST IPI — Saídas</label>
                  <select value={form.cstIpiSaida} onChange={set('cstIpiSaida')} className={selectCls}>
                    {CST_IPI_SAIDA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ICMS / CSOSN */}
          {activeTab === 'icms' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 border border-slate-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-slate-800">Regime Normal (Lucro Real / Lucro Presumido)</h3>
                  <div>
                    <label className={labelCls}>CST ICMS padrão</label>
                    <select value={form.cstIcms} onChange={set('cstIcms')} className={selectCls}>
                      {CST_ICMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Redução BC ICMS (%)</label>
                    <input type="number" step="0.01" min="0" max="100" value={form.reducaoBcIcms} onChange={set('reducaoBcIcms')} placeholder="0,00" className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Preencher apenas se CST 20 ou 70</p>
                  </div>
                </div>
                <div className="p-5 border border-slate-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-slate-800">Simples Nacional</h3>
                  <div>
                    <label className={labelCls}>CSOSN padrão</label>
                    <select value={form.csosn} onChange={set('csosn')} className={selectCls}>
                      {CSOSN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-5 border border-orange-200 bg-orange-50 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="temSt" checked={form.temSt} onChange={set('temSt')} className="w-4 h-4 text-orange-600" />
                  <label htmlFor="temSt" className="font-semibold text-orange-800 cursor-pointer">Sujeito à Substituição Tributária (ST)</label>
                </div>
                {form.temSt && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Código CEST</label>
                      <input type="text" value={form.cestCode} onChange={set('cestCode')} placeholder="0000000 (sem pontos)" maxLength={7} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Descrição CEST / Segmento</label>
                      <input type="text" value={form.cestDescricao} onChange={set('cestDescricao')} placeholder="Ex: Autopeças" className={inputCls} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PIS / COFINS */}
          {activeTab === 'pis_cofins' && (
            <div className="space-y-5">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <strong>PIS / COFINS</strong> — defina os CSTs e alíquotas padrão para este NCM no regime não-cumulativo.
              </div>
              <div className="flex items-center gap-2 p-4 border border-slate-200 rounded-lg">
                <input type="checkbox" id="monofasico" checked={form.monofasico} onChange={set('monofasico')} className="w-4 h-4 text-blue-600" />
                <label htmlFor="monofasico" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Tributação monofásica (combustíveis, farmacêuticos, etc.) — CST 04 automático
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-700">Saídas (Vendas)</h3>
                  <div>
                    <label className={labelCls}>CST PIS/COFINS — Saída</label>
                    <select value={form.cstPisCofinsSaida} onChange={set('cstPisCofinsSaida')} className={selectCls}>
                      {CST_PIS_COFINS_SAIDA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Alíquota PIS (%)</label>
                      <input type="number" step="0.0001" min="0" value={form.aliquotaPis} onChange={set('aliquotaPis')} placeholder="1.65" className={inputCls} disabled={form.monofasico} />
                    </div>
                    <div>
                      <label className={labelCls}>Alíquota COFINS (%)</label>
                      <input type="number" step="0.0001" min="0" value={form.aliquotaCofins} onChange={set('aliquotaCofins')} placeholder="7.60" className={inputCls} disabled={form.monofasico} />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-700">Entradas (Compras)</h3>
                  <div>
                    <label className={labelCls}>CST PIS/COFINS — Entrada</label>
                    <select value={form.cstPisCofinsEntrada} onChange={set('cstPisCofinsEntrada')} className={selectCls}>
                      {CST_PIS_COFINS_ENTRADA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IMPORTAÇÃO */}
          {activeTab === 'importacao' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                <strong>II — Imposto de Importação</strong> — alíquota aplicável para importações deste NCM.
              </div>
              <div className="max-w-xs">
                <label className={labelCls}>Alíquota II (%)</label>
                <input type="number" step="0.01" min="0" value={form.aliquotaImportacao} onChange={set('aliquotaImportacao')} placeholder="0,00" className={inputCls} />
              </div>
            </div>
          )}

          {/* REFORMA TRIBUTÁRIA */}
          {activeTab === 'reforma' && (
            <div className="space-y-5">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
                <strong>Reforma Tributária — EC 132/2023</strong><br/>
                Vigência gradual 2026–2033. CBS substitui PIS+COFINS+IPI (federal). IBS substitui ICMS+ISS (estados+municípios). IS incide sobre bens e serviços prejudiciais à saúde/meio ambiente.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 border border-purple-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-purple-800">CBS — Contribuição sobre Bens e Serviços</h3>
                  <div>
                    <label className={labelCls}>Alíquota CBS (%)</label>
                    <input type="number" step="0.0001" min="0" value={form.aliquotaCbs} onChange={set('aliquotaCbs')} placeholder="8.80 (referência)" className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Alíquota de referência CBS federal (~8.8%)</p>
                  </div>
                  <div>
                    <label className={labelCls}>CST CBS</label>
                    <input type="text" value={form.cstCbs} onChange={set('cstCbs')} placeholder="01" maxLength={2} className={inputCls} />
                  </div>
                </div>

                <div className="p-5 border border-blue-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-blue-800">IBS — Imposto sobre Bens e Serviços</h3>
                  <div>
                    <label className={labelCls}>Alíquota IBS (%)</label>
                    <input type="number" step="0.0001" min="0" value={form.aliquotaIbs} onChange={set('aliquotaIbs')} placeholder="17.70 (referência)" className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Alíquota de referência IBS estados+municípios (~17.7%)</p>
                  </div>
                  <div>
                    <label className={labelCls}>CST IBS</label>
                    <input type="text" value={form.cstIbs} onChange={set('cstIbs')} placeholder="01" maxLength={2} className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="p-5 border border-red-200 bg-red-50 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="temIs" checked={form.temIs} onChange={set('temIs')} className="w-4 h-4 text-red-600" />
                  <label htmlFor="temIs" className="font-semibold text-red-800 cursor-pointer">
                    IS — Imposto Seletivo (produto prejudicial à saúde ou ao meio ambiente)
                  </label>
                </div>
                {form.temIs && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Categoria IS</label>
                      <select value={form.categoriaIs} onChange={set('categoriaIs')} className={selectCls}>
                        {CATEGORIA_IS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Alíquota IS (%)</label>
                      <input type="number" step="0.01" min="0" value={form.aliquotaIs} onChange={set('aliquotaIs')} placeholder="Ex: 15 (tabaco)" className={inputCls} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Regime especial / Observações sobre a Reforma</label>
                <textarea value={form.regimeEspecialReforma} onChange={set('regimeEspecialReforma')} rows={3}
                  placeholder="Descreva qualquer tratamento diferenciado na reforma tributária para este NCM..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div>
                <label className={labelCls}>Observações gerais</label>
                <textarea value={form.observacoes} onChange={set('observacoes')} rows={3}
                  placeholder="Notas internas, referências legais, etc."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <span className="font-semibold shrink-0">Erro:</span>
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError('')} className="text-red-400 hover:text-red-600">&#x2715;</button>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/fiscal/indices/ncm" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
