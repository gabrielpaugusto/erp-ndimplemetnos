'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Plus, Pencil, Trash2, Sprout, Search, RefreshCw, X, CheckCircle, AlertCircle,
} from 'lucide-react';

// ─── Listas de referência ────────────────────────────────────────────────────

const DESTINACOES_ENTRADA = [
  { value: 'MATERIA_PRIMA',        label: 'Matéria-Prima' },
  { value: 'COMPONENTE',           label: 'Componente' },
  { value: 'PRODUTO_REVENDA',      label: 'Produto p/ Revenda' },
  { value: 'INSUMO_PRODUCAO',      label: 'Insumo de Produção' },
  { value: 'EMBALAGEM',            label: 'Embalagem' },
  { value: 'MATERIAL_USO_CONSUMO', label: 'Uso e Consumo' },
  { value: 'GGF',                  label: 'GGF (Custo Indireto)' },
  { value: 'IMOBILIZADO',          label: 'Ativo Imobilizado' },
  { value: 'SERVICO',              label: 'Serviço (Entrada)' },
  { value: 'FRETE',                label: 'Frete (CT-e)' },
  { value: 'SERVICO_TOMADO',       label: 'Serviço Tomado (NFS-e)' },
];

const DESTINACOES_SAIDA = [
  { value: 'PRODUTO_INDUSTRIALIZADO', label: 'Produto Industrializado (fabricado)' },
  { value: 'PRODUTO_REVENDA',         label: 'Produto p/ Revenda' },
  { value: 'IMOBILIZADO',             label: 'Ativo Imobilizado' },
  { value: 'SERVICO_EMITIDO',         label: 'Serviço Emitido (NFS-e)' },
  { value: 'DEVOLUCAO_COMPRA',        label: 'Devolução de Compra' },
  { value: 'MATERIA_PRIMA',           label: 'Remessa / MP' },
];

const TODAS_DESTINACOES = [...DESTINACOES_ENTRADA, ...DESTINACOES_SAIDA];

const TIPOS_FORN = [
  { value: 'INDUSTRIA',             label: 'Indústria' },
  { value: 'ATACADISTA_EQUIPARADO', label: 'Atacadista Equiparado' },
  { value: 'COMERCIO',              label: 'Comércio' },
  { value: 'PRESTADOR_SERVICO',     label: 'Prestador de Serviço' },
  { value: 'IMPORTADOR',            label: 'Importador' },
  { value: 'PESSOA_FISICA',         label: 'Pessoa Física' },
  { value: 'SIMPLES_NACIONAL',      label: 'Simples Nacional (regime)' },
];

const TIPOS_CLI = [
  { value: 'CONTRIBUINTE',          label: 'Contribuinte ICMS (CRT 3)' },
  { value: 'CONTRIBUINTE_SIMPLES',  label: 'Contribuinte Simples Nacional (CRT 1/2)' },
  { value: 'NAO_CONTRIBUINTE',      label: 'Não Contribuinte / Pessoa Física' },
];

const REGIMES = [
  { value: 'LUCRO_REAL',      label: 'Lucro Real' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'SIMPLES_NACIONAL',label: 'Simples Nacional' },
];

const FINALIDADES = [
  { value: 'VENDA',            label: 'Venda' },
  { value: 'REMESSA',          label: 'Remessa (p/ industrialização)' },
  { value: 'DEVOLUCAO',        label: 'Devolução' },
  { value: 'INDUSTRIALIZACAO', label: 'Industrialização' },
  { value: 'TRANSFERENCIA',    label: 'Transferência' },
];

// ─── Interface ────────────────────────────────────────────────────────────────

interface OperacaoFiscal {
  id: string;
  codigo: string;
  descricao: string;
  tipo: 'ENTRADA' | 'SAIDA';
  destinacao?: string;
  tipoFornecedor?: string;
  tipoCliente?: string;
  regimeTributario?: string;
  intraestadual?: boolean;
  temST?: boolean;
  stRetida?: boolean;
  finalidade?: string;
  freteContaDestinatario?: boolean;
  prioridade: number;
  cfop: string;
  cstIcms: string;
  cstIpi: string;
  cstPis: string;
  cstCofins: string;
  creditaIcms: boolean;
  creditaIpi: boolean;
  creditaPisCofins: boolean;
  icmsSimplesPCredSN: boolean;
  ciap: boolean;
  pisCofins24x: boolean;
  retencaoIss: boolean;
  retencaoFederal: boolean;
  retencaoInss: boolean;
  contaDebitoCode?: string;
  ativo: boolean;
  isDefault: boolean;
}

type FormData = Omit<OperacaoFiscal, 'id' | 'isDefault'>;

const EMPTY_FORM_ENTRADA: FormData = {
  codigo: '', descricao: '', tipo: 'ENTRADA', prioridade: 50,
  cfop: '', cstIcms: '000', cstIpi: '49', cstPis: '70', cstCofins: '70',
  creditaIcms: false, creditaIpi: false, creditaPisCofins: false,
  icmsSimplesPCredSN: false, ciap: false, pisCofins24x: false,
  retencaoIss: false, retencaoFederal: false, retencaoInss: false, ativo: true,
};

const EMPTY_FORM_SAIDA: FormData = {
  codigo: '', descricao: '', tipo: 'SAIDA', prioridade: 100,
  cfop: '', cstIcms: '000', cstIpi: '99', cstPis: '01', cstCofins: '01',
  creditaIcms: false, creditaIpi: false, creditaPisCofins: false,
  icmsSimplesPCredSN: false, ciap: false, pisCofins24x: false,
  retencaoIss: false, retencaoFederal: false, retencaoInss: false, ativo: true,
};

function labelOf(list: { value: string; label: string }[], val?: string) {
  return list.find((x) => x.value === val)?.label ?? val ?? '—';
}

// ─── Referência rápida de CSTs ────────────────────────────────────────────────

const CST_ICMS_REGIME = [
  { cst: '000', desc: 'Tributada integralmente' },
  { cst: '010', desc: 'Tributada + ST' },
  { cst: '020', desc: 'Com redução de BC' },
  { cst: '040', desc: 'Isenta' },
  { cst: '041', desc: 'Não tributada' },
  { cst: '050', desc: 'Suspensão' },
  { cst: '051', desc: 'Diferimento' },
  { cst: '060', desc: 'ICMS cobrado anteriormente por ST' },
  { cst: '070', desc: 'Redução BC + ST' },
  { cst: '090', desc: 'Outras' },
];
const CSOSN = [
  { cst: '101', desc: 'SN c/ permissão de crédito (pCredSN)' },
  { cst: '102', desc: 'SN s/ permissão de crédito' },
  { cst: '201', desc: 'SN c/ crédito + ST' },
  { cst: '202', desc: 'SN s/ crédito + ST' },
  { cst: '400', desc: 'SN — Não tributada' },
  { cst: '500', desc: 'SN — ST cobrada anteriormente' },
  { cst: '900', desc: 'SN — Outros' },
];
const CST_IPI_ENT = [
  { cst: '00', desc: 'Entrada c/ crédito' }, { cst: '01', desc: 'Alíq. zero' },
  { cst: '02', desc: 'Isenta' }, { cst: '03', desc: 'NT' }, { cst: '04', desc: 'Imune' },
  { cst: '05', desc: 'Suspensão' }, { cst: '49', desc: 'Outras (não tributado)' },
];
const CST_IPI_SAI = [
  { cst: '50', desc: 'Saída tributada' }, { cst: '51', desc: 'Alíq. zero' },
  { cst: '52', desc: 'Isenta' }, { cst: '53', desc: 'NT' }, { cst: '54', desc: 'Imune' },
  { cst: '55', desc: 'Suspensão' }, { cst: '99', desc: 'Outras (não tributado)' },
];
const CST_PIS_ENT = [
  { cst: '50', desc: 'Crédito — receitas tributadas' }, { cst: '51', desc: 'Crédito — receitas NT' },
  { cst: '52', desc: 'Crédito — exportação' }, { cst: '70', desc: 'Sem direito a crédito' },
  { cst: '71', desc: 'Aquisição isenta' }, { cst: '72', desc: 'Suspensão' },
  { cst: '73', desc: 'Alíquota zero' }, { cst: '74', desc: 'Sem incidência' },
  { cst: '75', desc: 'Por ST' }, { cst: '99', desc: 'Outras' },
];
const CST_PIS_SAI = [
  { cst: '01', desc: 'Tributável — alíquota básica' }, { cst: '02', desc: 'Alíquota diferenciada' },
  { cst: '03', desc: 'Alíquota por unidade' }, { cst: '04', desc: 'Monofásico — rev. alíq. zero' },
  { cst: '05', desc: 'Por ST' }, { cst: '06', desc: 'Alíquota zero' },
  { cst: '07', desc: 'Isento (SN)' }, { cst: '08', desc: 'Sem incidência (exportação)' },
  { cst: '09', desc: 'Suspensão (remessa)' }, { cst: '49', desc: 'Outras saídas' },
];

function CstSelector({ label, value, onChange, options }: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { cst: string; desc: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {options.map((o) => (
          <option key={o.cst} value={o.cst}>{o.cst} — {o.desc}</option>
        ))}
        <option value={value}>{value || '—'}</option>
      </select>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function FormModal({ initial, isEdit, onClose, onSaved }: {
  initial: Partial<FormData> & { id?: string };
  isEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const emptyForm = (initial.tipo ?? 'ENTRADA') === 'SAIDA' ? EMPTY_FORM_SAIDA : EMPTY_FORM_ENTRADA;
  const [form, setForm] = useState<Partial<FormData>>(isEdit ? initial : emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isSaida = form.tipo === 'SAIDA';

  function set<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  // Ao mudar o tipo, resetar CSTs padrão
  function handleTipoChange(tipo: 'ENTRADA' | 'SAIDA') {
    if (!isEdit) {
      const defaults = tipo === 'SAIDA' ? EMPTY_FORM_SAIDA : EMPTY_FORM_ENTRADA;
      setForm((prev) => ({ ...prev, tipo, cstIpi: defaults.cstIpi, cstPis: defaults.cstPis, cstCofins: defaults.cstCofins }));
    } else {
      set('tipo', tipo);
    }
  }

  async function handleSave() {
    if (!isEdit && !form.codigo) { setErr('Código obrigatório'); return; }
    if (!form.descricao) { setErr('Descrição obrigatória'); return; }
    if (!form.cfop) { setErr('CFOP obrigatório'); return; }
    setSaving(true); setErr('');
    try {
      const url = isEdit ? `/fiscal/operacoes-fiscais/${(initial as any).id}` : '/fiscal/operacoes-fiscais';
      await api(url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(form) });
      onSaved(); onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const ipiOptions  = isSaida ? CST_IPI_SAI  : CST_IPI_ENT;
  const pisOptions  = isSaida ? CST_PIS_SAI  : CST_PIS_ENT;
  const icmsOptions = (form.regimeTributario === 'SIMPLES_NACIONAL' || form.regimeTributario === 'MEI') ? CSOSN : CST_ICMS_REGIME;
  const destOptions = isSaida ? DESTINACOES_SAIDA : DESTINACOES_ENTRADA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Editar Operação Fiscal' : 'Nova Operação Fiscal (TES)'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSaida ? 'Regra de saída — débito de impostos, CFOP e CSTs de saída' : 'Regra de entrada — crédito de impostos, CFOP e CSTs de entrada'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}

          {/* Identificação */}
          <div className="grid grid-cols-2 gap-4">
            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Código *</label>
                <input value={form.codigo ?? ''} onChange={(e) => set('codigo', e.target.value)} maxLength={30}
                  placeholder="ex: SAI-IND-CONT-INTRA"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            )}
            <div className={isEdit ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Descrição *</label>
              <input value={form.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} maxLength={200}
                placeholder="Descrição da operação fiscal"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Tipo + Prioridade + Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => handleTipoChange(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Prioridade</label>
              <input type="number" value={form.prioridade ?? 50} onChange={(e) => set('prioridade', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Status</label>
              <select value={form.ativo ? 'true' : 'false'} onChange={(e) => set('ativo', e.target.value === 'true')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>

          {/* Regime Tributário da Empresa (filtro) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Regime Tributário da Empresa
              </label>
              <select value={form.regimeTributario ?? ''} onChange={(e) => set('regimeTributario', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Qualquer regime</option>
                {REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Regra só aplica quando empresa está neste regime. Vazio = qualquer regime.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Destinação</label>
              <select value={form.destinacao ?? ''} onChange={(e) => set('destinacao', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Qualquer destinação</option>
                {destOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          {/* Contraparte — condicional ENTRADA vs SAÍDA */}
          <div className="grid grid-cols-2 gap-4">
            {!isSaida ? (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tipo de Fornecedor</label>
                <select value={form.tipoFornecedor ?? ''} onChange={(e) => set('tipoFornecedor', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Qualquer tipo</option>
                  {TIPOS_FORN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tipo de Cliente (Destinatário)</label>
                <select value={form.tipoCliente ?? ''} onChange={(e) => set('tipoCliente', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Qualquer tipo</option>
                  {TIPOS_CLI.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}

            {/* Finalidade — só em saídas */}
            {isSaida && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Finalidade</label>
                <select value={form.finalidade ?? ''} onChange={(e) => set('finalidade', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Qualquer finalidade</option>
                  {FINALIDADES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Condicionais — checkboxes */}
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input type="checkbox" checked={form.intraestadual === true}
                onChange={(e) => set('intraestadual', e.target.checked ? true : undefined)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              Intraestadual
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input type="checkbox" checked={form.temST === true}
                onChange={(e) => set('temST', e.target.checked ? true : undefined)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              Com ST (emitente recolhe)
            </label>
            {isSaida && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input type="checkbox" checked={form.stRetida === true}
                  onChange={(e) => set('stRetida', e.target.checked ? true : undefined)}
                  className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                <span className="text-orange-700">ST já retida anteriormente (CST 060/500)</span>
              </label>
            )}
          </div>

          {/* Frete FOB/CIF — só em entradas de FRETE */}
          {!isSaida && form.destinacao === 'FRETE' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Modalidade de Frete</p>
              <select value={form.freteContaDestinatario === true ? 'true' : form.freteContaDestinatario === false ? 'false' : ''}
                onChange={(e) => set('freteContaDestinatario', e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Qualquer (FOB ou CIF)</option>
                <option value="true">FOB — Destinatário paga (crédita ICMS + PIS/COFINS)</option>
                <option value="false">CIF — Emitente paga (sem crédito de ICMS/PIS/COFINS)</option>
              </select>
            </div>
          )}

          {/* Retenções — só em SERVICO_TOMADO */}
          {!isSaida && form.destinacao === 'SERVICO_TOMADO' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Retenções na Fonte (Serviço Tomado)</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'retencaoIss',     label: 'Reter ISS (município)' },
                  { key: 'retencaoFederal', label: 'Reter Federal 4,65% (IN 1234)' },
                  { key: 'retencaoInss',    label: 'Reter INSS 11%' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" checked={!!(form as any)[key]}
                      onChange={(e) => set(key as any, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Códigos Fiscais */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Códigos Fiscais
              {isSaida && <span className="ml-2 text-orange-600 font-normal">(CSTs de saída)</span>}
            </p>
            <div className="grid grid-cols-5 gap-3">
              {/* CFOP */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">CFOP *</label>
                <input value={form.cfop ?? ''} onChange={(e) => set('cfop', e.target.value)} maxLength={4}
                  placeholder={isSaida ? '5101' : '1101'}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <p className="text-[10px] text-slate-400 mt-0.5">{isSaida ? '5xxx/6xxx' : '1xxx/2xxx'}</p>
              </div>

              {/* CST ICMS */}
              <CstSelector label="CST ICMS" value={form.cstIcms ?? '000'}
                onChange={(v) => set('cstIcms', v)} options={icmsOptions} />

              {/* CST IPI */}
              <CstSelector label="CST IPI" value={form.cstIpi ?? (isSaida ? '99' : '49')}
                onChange={(v) => set('cstIpi', v)} options={ipiOptions} />

              {/* CST PIS */}
              <CstSelector label="CST PIS" value={form.cstPis ?? (isSaida ? '01' : '70')}
                onChange={(v) => set('cstPis', v)} options={pisOptions} />

              {/* CST COFINS */}
              <CstSelector label="CST COFINS" value={form.cstCofins ?? (isSaida ? '01' : '70')}
                onChange={(v) => set('cstCofins', v)} options={pisOptions} />
            </div>
          </div>

          {/* Créditos / Débitos */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {isSaida ? 'Flags de Débito / Comportamento' : 'Aproveitamento de Créditos'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {!isSaida && [
                { key: 'creditaIcms',        label: 'Credita ICMS' },
                { key: 'creditaIpi',         label: 'Credita IPI' },
                { key: 'creditaPisCofins',   label: 'Credita PIS/COFINS' },
                { key: 'icmsSimplesPCredSN', label: 'ICMS Simples (pCredSN)' },
                { key: 'ciap',               label: 'CIAP (Ativo Imob.)' },
                { key: 'pisCofins24x',       label: 'PIS/COFINS 2,4x (MP)' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input type="checkbox" checked={!!(form as any)[key]}
                    onChange={(e) => set(key as any, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  {label}
                </label>
              ))}
              {isSaida && (
                <p className="col-span-3 text-xs text-slate-500">
                  Para saídas, os débitos de ICMS / IPI / PIS/COFINS são derivados automaticamente dos CSTs informados acima.
                  CST ICMS 000/010/020 → debita ICMS · CST IPI 50 → debita IPI · CST PIS 01/02/03 → debita PIS/COFINS.
                </p>
              )}
            </div>
          </div>

          {/* Conta Contábil */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              {isSaida ? 'Conta Receita / Custo (Código)' : 'Conta Débito / Estoque (Código)'}
            </label>
            <input value={form.contaDebitoCode ?? ''} onChange={(e) => set('contaDebitoCode', e.target.value || undefined)}
              maxLength={20} placeholder="ex: 3.1.1.01"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium">
            {saving ? 'Salvando...' : 'Salvar Operação'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function OperacoesFiscaisPage() {
  const [data, setData] = useState<OperacaoFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OperacaoFiscal | undefined>();
  const [seeding, setSeeding] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<OperacaoFiscal[]>('/fiscal/operacoes-fiscais');
      setData(Array.isArray(res) ? res : []);
    } catch {
      setError('Erro ao carregar operações fiscais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(op: OperacaoFiscal) {
    if (op.isDefault) { setError('Operações padrão não podem ser removidas'); return; }
    if (!confirm(`Remover "${op.codigo} — ${op.descricao}"?`)) return;
    try {
      await api(`/fiscal/operacoes-fiscais/${op.id}`, { method: 'DELETE' });
      setSuccess('Operação removida'); load();
    } catch (e: any) { setError(e?.message ?? 'Erro ao remover'); }
  }

  async function handleSeedPadrao() {
    setSeeding(true); setError(''); setSuccess('');
    try {
      await api('/fiscal/operacoes-fiscais/seed-padrao', { method: 'POST' });
      setSuccess('Regras padrão inseridas com sucesso'); load();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao semear regras');
    } finally { setSeeding(false); }
  }

  const filtered = data.filter((op) => {
    const q = search.toLowerCase();
    const matchSearch = !q || op.codigo.toLowerCase().includes(q) || op.descricao.toLowerCase().includes(q) || op.cfop.includes(q);
    const matchTipo   = filterTipo === 'ALL' || op.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const sorted = [...filtered].sort((a, b) =>
    a.tipo.localeCompare(b.tipo) || b.prioridade - a.prioridade || a.codigo.localeCompare(b.codigo)
  );

  const entradas = sorted.filter(o => o.tipo === 'ENTRADA');
  const saidas   = sorted.filter(o => o.tipo === 'SAIDA');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operações Fiscais (TES)</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Motor de regras fiscais — determina CFOP, CST e créditos/débitos automaticamente para entradas e saídas,
            considerando destinação, contraparte, regime tributário e UF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeedPadrao} disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium disabled:opacity-50">
            <Sprout className="w-4 h-4" />
            {seeding ? 'Inserindo...' : 'Seed Regras Padrão'}
          </button>
          <button onClick={load} disabled={loading}
            className="p-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50" title="Recarregar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setEditing(undefined); setDialogOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nova Operação
          </button>
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar código, descrição, CFOP..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="ALL">Entradas + Saídas</option>
          <option value="ENTRADA">Somente Entradas</option>
          <option value="SAIDA">Somente Saídas</option>
        </select>
        <span className="text-xs text-slate-400">{entradas.length} entrada(s) / {saidas.length} saída(s)</span>
      </div>

      {/* Tabela Entradas */}
      {(filterTipo === 'ALL' || filterTipo === 'ENTRADA') && (
        <TabelaOperacoes
          titulo="Entradas — Créditos Fiscais"
          badge="bg-blue-100 text-blue-700"
          rows={entradas}
          tipo="ENTRADA"
          onEdit={(op) => { setEditing(op); setDialogOpen(true); }}
          onDelete={handleDelete}
          loading={loading}
          onSeedPadrao={handleSeedPadrao}
        />
      )}

      {/* Tabela Saídas */}
      {(filterTipo === 'ALL' || filterTipo === 'SAIDA') && (
        <TabelaOperacoes
          titulo="Saídas — Débitos Fiscais"
          badge="bg-orange-100 text-orange-700"
          rows={saidas}
          tipo="SAIDA"
          onEdit={(op) => { setEditing(op); setDialogOpen(true); }}
          onDelete={handleDelete}
          loading={loading}
          onSeedPadrao={handleSeedPadrao}
        />
      )}

      <p className="text-xs text-slate-400">
        Motor aplica a regra de <strong>maior prioridade</strong> que satisfaz todas as condições.
        Regime tributário da empresa é lido de <em>Configurações → Dados da Empresa → Regime Tributário</em>.
        Para saídas interestaduais a Não Contribuinte, o CFOP 6108 aciona DIFAL automaticamente (EC 87/2015).
      </p>

      {dialogOpen && (
        <FormModal
          initial={editing ?? {}}
          isEdit={!!editing}
          onClose={() => { setDialogOpen(false); setEditing(undefined); }}
          onSaved={() => { load(); setSuccess(editing ? 'Operação atualizada' : 'Operação criada'); }}
        />
      )}
    </div>
  );
}

// ─── Tabela reutilizável ──────────────────────────────────────────────────────

function TabelaOperacoes({ titulo, badge, rows, tipo, onEdit, onDelete, loading, onSeedPadrao }: {
  titulo: string; badge: string; rows: OperacaoFiscal[];
  tipo: 'ENTRADA' | 'SAIDA';
  onEdit: (op: OperacaoFiscal) => void;
  onDelete: (op: OperacaoFiscal) => void;
  loading: boolean;
  onSeedPadrao: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className={`px-4 py-2.5 border-b border-slate-200 flex items-center gap-2 ${tipo === 'SAIDA' ? 'bg-orange-50' : 'bg-blue-50'}`}>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>{tipo}</span>
        <span className="text-sm font-medium text-slate-700">{titulo}</span>
        <span className="ml-auto text-xs text-slate-400">{rows.length} regra(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
              <th className="px-2 py-2.5 text-left w-10">Prio</th>
              <th className="px-2 py-2.5 text-left">Código</th>
              <th className="px-2 py-2.5 text-left">Descrição</th>
              <th className="px-2 py-2.5 text-left">Destinação</th>
              <th className="px-2 py-2.5 text-left">{tipo === 'SAIDA' ? 'Cliente' : 'Fornecedor'}</th>
              <th className="px-2 py-2.5 text-left">Regime</th>
              <th className="px-2 py-2.5 text-center">Intra</th>
              <th className="px-2 py-2.5 text-center">ST</th>
              <th className="px-2 py-2.5 text-center font-mono">CFOP</th>
              <th className="px-2 py-2.5 text-center font-mono">ICMS</th>
              <th className="px-2 py-2.5 text-center font-mono">IPI</th>
              <th className="px-2 py-2.5 text-center font-mono">PIS</th>
              <th className="px-2 py-2.5 text-center font-mono">COF</th>
              <th className="px-2 py-2.5 text-center">Status</th>
              <th className="px-2 py-2.5 text-right w-16">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={15} className="text-center py-8 text-slate-400">Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="text-center py-8 text-slate-400">
                  Nenhuma regra de {tipo === 'SAIDA' ? 'saída' : 'entrada'}.{' '}
                  <button onClick={onSeedPadrao} className="text-emerald-600 underline hover:text-emerald-800">
                    Inserir regras padrão
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((op) => (
                <tr key={op.id} className={`hover:bg-slate-50 ${!op.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-2 py-2 text-slate-400 text-xs">{op.prioridade}</td>
                  <td className="px-2 py-2">
                    <span className="font-mono font-semibold text-slate-800 text-xs">{op.codigo}</span>
                    {op.isDefault && <span className="ml-1 text-[10px] px-1 py-0.5 rounded border border-slate-300 text-slate-400">padrão</span>}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600 max-w-[160px] truncate" title={op.descricao}>{op.descricao}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">{labelOf(TODAS_DESTINACOES, op.destinacao)}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {tipo === 'SAIDA'
                      ? labelOf(TIPOS_CLI, op.tipoCliente)
                      : labelOf(TIPOS_FORN, op.tipoFornecedor)}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {op.regimeTributario ? labelOf(REGIMES, op.regimeTributario) : '—'}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-slate-500">
                    {op.intraestadual === true ? '✓' : op.intraestadual === false ? '✗' : '—'}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-slate-500">
                    {op.temST === true ? '✓' : op.stRetida ? <span className="text-orange-500">Ret</span> : '—'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-blue-700 text-sm">{op.cfop}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-slate-600">{op.cstIcms}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-slate-600">{op.cstIpi}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-slate-600">{op.cstPis}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-slate-600">{op.cstCofins}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${op.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {op.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onEdit(op)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!op.isDefault && (
                        <button onClick={() => onDelete(op)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Remover">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
