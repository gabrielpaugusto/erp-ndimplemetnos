'use client';

import { useState, useEffect } from 'react';
import {
  Scale,
  Save,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Lock,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
  CalendarClock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { usePermission } from '@/hooks/use-permission';
import { useToast } from '@/components/ui/toast';
import { CertificadoPanel } from '@/components/fiscal/certificado-panel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAX_REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI - Microempreendedor Individual',
};

function Field({
  label,
  hint,
  locked,
  children,
}: {
  label: string;
  hint?: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
        {label}
        {locked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
      </label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FiscalConfig {
  taxRegime: string;
  issRetidoMunicipio: boolean;
  mvaPadrao: number;
  // Ambientes
  ambienteNfe: number;
  ambienteNfse: number;
  ambienteSped: number;
  ambienteEsocial: number;
  ambienteReinf: number;
  ambienteDctfweb: number;
  ambienteDFe: number;
  // Séries / Numeração
  serieNfe: number;
  proximoNumeroNfe: number;
  serieCte: string;
  proximoNumeroCte: number;
  serieMdfe: string;
  proximoNumeroMdfe: number;
  serieNfse: string;
  proximoNumeroNfse: number;
  // CFOP/CST defaults
  cfopPadraoNfeSaida: string;
  cfopPadraoNfeSaidaInter: string;
  cfopPadraoCteEntrada: string;
  cstIcmsPadrao: string;
  csosnPadrao: string;
}

interface TaxRates {
  regime: string;
  aliquotaPis: number;
  aliquotaCofins: number;
  aliquotaIss: number;
  aliquotaCsll: number;
  aliquotaIr: number;
  aliquotaInss: number;
  aliquotaCbs: number;
  aliquotaIbs: number;
}

const DEFAULT_CONFIG: FiscalConfig = {
  taxRegime: 'SIMPLES_NACIONAL',
  issRetidoMunicipio: false,
  mvaPadrao: 0,
  ambienteNfe: 2,
  ambienteNfse: 2,
  ambienteSped: 2,
  ambienteEsocial: 2,
  ambienteReinf: 2,
  ambienteDctfweb: 2,
  ambienteDFe: 2,
  serieNfe: 1,
  proximoNumeroNfe: 1,
  serieCte: '1',
  proximoNumeroCte: 1,
  serieMdfe: '1',
  proximoNumeroMdfe: 1,
  serieNfse: '1',
  proximoNumeroNfse: 1,
  cfopPadraoNfeSaida: '5102',
  cfopPadraoNfeSaidaInter: '6102',
  cfopPadraoCteEntrada: '2352',
  cstIcmsPadrao: '00',
  csosnPadrao: '102',
};

const DEFAULT_RATES: TaxRates = {
  regime: 'SIMPLES_NACIONAL',
  aliquotaPis: 0,
  aliquotaCofins: 0,
  aliquotaIss: 0,
  aliquotaCsll: 0,
  aliquotaIr: 0,
  aliquotaInss: 0,
  aliquotaCbs: 0,
  aliquotaIbs: 0,
};

interface TaxRetentionConfig {
  minimoRetencaoPisCofinsCsll: number;
  minimoRetencaoIrrf: number;
  minimoRetencaoInss: number;
  minimoRetencaoIss: number;
  usarSistemaNovo: boolean;
  periodoReforma: string;
  aliquotaCbs: number;
  aliquotaIbs: number;
}

const DEFAULT_RETENTION: TaxRetentionConfig = {
  minimoRetencaoPisCofinsCsll: 215.05,
  minimoRetencaoIrrf: 10.00,
  minimoRetencaoInss: 0.00,
  minimoRetencaoIss: 0.00,
  usarSistemaNovo: false,
  periodoReforma: 'TESTE_2026',
  aliquotaCbs: 0.9,
  aliquotaIbs: 0.1,
};

interface AuditEntry {
  id: string;
  createdAt: string;
  entityType: string;
  action: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  user: { name: string | null; email: string | null } | null;
}

const FIELD_LABELS: Record<string, string> = {
  taxRegime: 'Regime Tributário',
  issRetidoMunicipio: 'ISS retido na fonte',
  mvaPadrao: 'MVA Padrão (%)',
  ambienteNfe: 'Ambiente NF-e',
  ambienteNfse: 'Ambiente NFS-e',
  ambienteSped: 'Ambiente SPED',
  ambienteEsocial: 'Ambiente e-Social',
  ambienteReinf: 'Ambiente REINF',
  ambienteDctfweb: 'Ambiente DCTFWeb',
  ambienteDFe: 'Ambiente DF-e',
  serieNfe: 'Série NF-e',
  proximoNumeroNfe: 'Próximo Nº NF-e',
  serieCte: 'Série CT-e',
  proximoNumeroCte: 'Próximo Nº CT-e',
  serieMdfe: 'Série MDF-e',
  proximoNumeroMdfe: 'Próximo Nº MDF-e',
  serieNfse: 'Série NFS-e',
  proximoNumeroNfse: 'Próximo Nº NFS-e',
  cfopPadraoNfeSaida: 'CFOP Saída Intraestadual',
  cfopPadraoNfeSaidaInter: 'CFOP Saída Interestadual',
  cfopPadraoCteEntrada: 'CFOP Entrada CT-e',
  cstIcmsPadrao: 'CST ICMS Padrão',
  csosnPadrao: 'CSOSN Padrão',
  // alíquotas
  regime: 'Regime p/ Alíquotas',
  aliquotaPis: 'PIS (%)',
  aliquotaCofins: 'COFINS (%)',
  aliquotaIss: 'ISS (%)',
  aliquotaCsll: 'CSLL (%)',
  aliquotaIr: 'IR (%)',
  aliquotaInss: 'INSS (%)',
  aliquotaCbs: 'CBS (%)',
  aliquotaIbs: 'IBS (%)',
};

const ENTITY_LABELS: Record<string, string> = {
  company_fiscal_config: 'Parâmetros Fiscais',
  company_tax_rates: 'Alíquotas de Impostos',
};

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'number' && (String(val) === '1' || String(val) === '2')) {
    return val === 1 ? 'Produção' : 'Homologação';
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConfiguracaoFiscalPage() {
  const { canConfigurar, isSuperAdmin } = usePermission();
  const fiscalReadOnly = !canConfigurar('FISCAL') && !isSuperAdmin;
  const toast = useToast();

  const [config, setConfig] = useState<FiscalConfig>(DEFAULT_CONFIG);
  const [taxRates, setTaxRates] = useState<TaxRates>(DEFAULT_RATES);
  const [retention, setRetention] = useState<TaxRetentionConfig>(DEFAULT_RETENTION);
  const [companyId, setCompanyId] = useState('');
  const [dataInicioOperacao, setDataInicioOperacao] = useState<string>('');
  const [savingGlobalInicio, setSavingGlobalInicio] = useState(false);
  const [globalInicioStatus, setGlobalInicioStatus] = useState<'idle' | 'success' | 'error'>('idle');
  // Per-module start dates: moduleName -> 'YYYY-MM-DD' | ''
  const [moduleDates, setModuleDates] = useState<Record<string, string>>({});
  const [savingModules, setSavingModules] = useState<Record<string, boolean>>({});
  const [moduleStatus, setModuleStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ratesStatus, setRatesStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [retentionStatus, setRetentionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const [companyRes, ratesRes, auditRes, retentionRes, moduleStartRes] = await Promise.all([
          apiFetch('/api/company'),
          apiFetch('/api/company/tax-rates').catch(() => null),
          apiFetch('/api/company/fiscal-audit-log').catch(() => null),
          apiFetch('/api/company/tax-retention-config').catch(() => null),
          apiFetch('/api/company/module-start-dates').catch(() => null),
        ]);
        const company = await companyRes.json();
        setCompanyId(company.id ?? '');
        // Data global de início de operação
        if (company.dataInicioOperacao) {
          setDataInicioOperacao(new Date(company.dataInicioOperacao).toISOString().slice(0, 10));
        }
        // Datas por módulo
        const moduleArr = moduleStartRes?.ok ? await moduleStartRes.json() : [];
        const moduleMap: Record<string, string> = {};
        for (const row of (Array.isArray(moduleArr) ? moduleArr : []) as Array<{ module: string; startDate: string }>) {
          moduleMap[row.module] = new Date(row.startDate).toISOString().slice(0, 10);
        }
        setModuleDates(moduleMap);
        setConfig({
          taxRegime: company.taxRegime ?? 'SIMPLES_NACIONAL',
          issRetidoMunicipio: company.issRetidoMunicipio ?? false,
          mvaPadrao: company.mvaPadrao ?? 0,
          ambienteNfe: company.ambienteNfe ?? 2,
          ambienteNfse: company.ambienteNfse ?? 2,
          ambienteSped: company.ambienteSped ?? 2,
          ambienteEsocial: company.ambienteEsocial ?? 2,
          ambienteReinf: company.ambienteReinf ?? 2,
          ambienteDctfweb: company.ambienteDctfweb ?? 2,
          ambienteDFe: company.ambienteDFe ?? 2,
          serieNfe: company.serieNfe ?? 1,
          proximoNumeroNfe: company.proximoNumeroNfe ?? 1,
          serieCte: company.serieCte ?? '1',
          proximoNumeroCte: company.proximoNumeroCte ?? 1,
          serieMdfe: company.serieMdfe ?? '1',
          proximoNumeroMdfe: company.proximoNumeroMdfe ?? 1,
          serieNfse: company.serieNfse ?? '1',
          proximoNumeroNfse: company.proximoNumeroNfse ?? 1,
          cfopPadraoNfeSaida: company.cfopPadraoNfeSaida ?? '5102',
          cfopPadraoNfeSaidaInter: company.cfopPadraoNfeSaidaInter ?? '6102',
          cfopPadraoCteEntrada: company.cfopPadraoCteEntrada ?? '2352',
          cstIcmsPadrao: company.cstIcmsPadrao ?? '00',
          csosnPadrao: company.csosnPadrao ?? '102',
        });
        if (ratesRes?.ok) {
          const ratesData = await ratesRes.json();
          setTaxRates({
            regime: ratesData.regime ?? 'SIMPLES_NACIONAL',
            aliquotaPis: ratesData.aliquotaPis ?? 0,
            aliquotaCofins: ratesData.aliquotaCofins ?? 0,
            aliquotaIss: ratesData.aliquotaIss ?? 0,
            aliquotaCsll: ratesData.aliquotaCsll ?? 0,
            aliquotaIr: ratesData.aliquotaIr ?? 0,
            aliquotaInss: ratesData.aliquotaInss ?? 0,
            aliquotaCbs: ratesData.aliquotaCbs ?? 0,
            aliquotaIbs: ratesData.aliquotaIbs ?? 0,
          });
        }
        if (auditRes?.ok) {
          const audit = await auditRes.json();
          if (Array.isArray(audit)) setAuditLog(audit);
        }
        if (retentionRes?.ok) {
          const retData = await retentionRes.json();
          setRetention({
            minimoRetencaoPisCofinsCsll: retData.minimoRetencaoPisCofinsCsll ?? 215.05,
            minimoRetencaoIrrf: retData.minimoRetencaoIrrf ?? 10.00,
            minimoRetencaoInss: retData.minimoRetencaoInss ?? 0.00,
            minimoRetencaoIss: retData.minimoRetencaoIss ?? 0.00,
            usarSistemaNovo: retData.usarSistemaNovo ?? false,
            periodoReforma: retData.periodoReforma ?? 'TESTE_2026',
            aliquotaCbs: retData.aliquotaCbs ?? 0.9,
            aliquotaIbs: retData.aliquotaIbs ?? 0.1,
          });
        }
      } catch {
        toast.error('Erro ao carregar configurações fiscais.');
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Save handlers
  // -------------------------------------------------------------------------
  async function handleSaveGlobalInicio() {
    if (fiscalReadOnly) return;
    setSavingGlobalInicio(true);
    setGlobalInicioStatus('idle');
    try {
      const res = await apiFetch('/api/company', {
        method: 'PATCH',
        body: JSON.stringify({ dataInicioOperacao: dataInicioOperacao || null }),
      });
      if (!res.ok) throw new Error();
      setGlobalInicioStatus('success');
      setTimeout(() => setGlobalInicioStatus('idle'), 3000);
    } catch {
      setGlobalInicioStatus('error');
    } finally {
      setSavingGlobalInicio(false);
    }
  }

  async function handleSaveModule(module: string) {
    if (fiscalReadOnly) return;
    setSavingModules((p) => ({ ...p, [module]: true }));
    setModuleStatus((p) => ({ ...p, [module]: 'idle' }));
    try {
      const res = await apiFetch('/api/company/module-start-dates', {
        method: 'POST',
        body: JSON.stringify({ module, startDate: moduleDates[module] || null }),
      });
      if (!res.ok) throw new Error();
      setModuleStatus((p) => ({ ...p, [module]: 'success' }));
      setTimeout(() => setModuleStatus((p) => ({ ...p, [module]: 'idle' })), 3000);
    } catch {
      setModuleStatus((p) => ({ ...p, [module]: 'error' }));
    } finally {
      setSavingModules((p) => ({ ...p, [module]: false }));
    }
  }

  async function handleSaveConfig() {
    if (fiscalReadOnly) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await apiFetch('/api/company', { method: 'PATCH', body: JSON.stringify(config) });
      if (!res.ok) throw new Error();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
      apiFetch('/api/company/fiscal-audit-log')
        .then((r) => r.ok ? r.json() : [])
        .then((a) => { if (Array.isArray(a)) setAuditLog(a); })
        .catch(() => {});
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRates() {
    if (fiscalReadOnly) return;
    setSavingRates(true);
    setRatesStatus('idle');
    try {
      const res = await apiFetch('/api/company/tax-rates', { method: 'POST', body: JSON.stringify(taxRates) });
      if (!res.ok) throw new Error();
      setRatesStatus('success');
      setTimeout(() => setRatesStatus('idle'), 3000);
      apiFetch('/api/company/fiscal-audit-log')
        .then((r) => r.ok ? r.json() : [])
        .then((a) => { if (Array.isArray(a)) setAuditLog(a); })
        .catch(() => {});
    } catch {
      setRatesStatus('error');
    } finally {
      setSavingRates(false);
    }
  }

  async function handleSaveRetention() {
    if (fiscalReadOnly) return;
    setSavingRetention(true);
    setRetentionStatus('idle');
    try {
      const res = await apiFetch('/api/company/tax-retention-config', { method: 'POST', body: JSON.stringify(retention) });
      if (!res.ok) throw new Error();
      setRetentionStatus('success');
      setTimeout(() => setRetentionStatus('idle'), 3000);
    } catch {
      setRetentionStatus('error');
    } finally {
      setSavingRetention(false);
    }
  }

  function setC<K extends keyof FiscalConfig>(key: K, val: FiscalConfig[K]) {
    setConfig((p) => ({ ...p, [key]: val }));
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
        Carregando...
      </div>
    );
  }

  const anyProd = [
    config.ambienteNfe, config.ambienteNfse, config.ambienteSped,
    config.ambienteEsocial, config.ambienteReinf, config.ambienteDctfweb, config.ambienteDFe,
  ].some((v) => v === 1);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-xl">
          <Scale className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Configuração Fiscal</h1>
          <p className="text-sm text-slate-500">
            Parâmetros fiscais centralizados: ambientes SEFAZ, numeração, alíquotas e defaults tributários.
          </p>
        </div>
      </div>

      {/* Acesso restrito banner */}
      {fiscalReadOnly && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Acesso somente leitura</p>
            <p className="text-amber-700 mt-0.5">
              Você pode visualizar os parâmetros fiscais, mas não pode alterá-los.
              Solicite ao administrador a permissão <strong>Fiscal › Configurar</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Data de Início de Operação                                          */}
      {/* ------------------------------------------------------------------ */}
      {/* Datas de Início por Módulo Fiscal                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-600" /> Datas de Início por Módulo Fiscal
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Cada módulo pode ter sua própria data de entrada em produção. O calendário fiscal e os syncs de
            documentos respeitam a data de cada módulo individualmente, com fallback para a data global abaixo.
          </p>
        </div>

        {/* Data global (fallback) */}
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Data Global (fallback para módulos sem data específica)
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              type="date"
              value={dataInicioOperacao}
              onChange={(e) => setDataInicioOperacao(e.target.value)}
              disabled={fiscalReadOnly}
              className={`input text-sm max-w-[200px] ${fiscalReadOnly ? 'bg-slate-100 cursor-default text-slate-500' : ''}`}
            />
            <div className="flex items-center gap-2">
              {globalInicioStatus === 'success' && <span className="text-xs text-emerald-600 font-medium">Salvo!</span>}
              {globalInicioStatus === 'error' && <span className="text-xs text-red-600 font-medium">Erro</span>}
              <button
                onClick={handleSaveGlobalInicio}
                disabled={fiscalReadOnly || savingGlobalInicio}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-xs font-medium transition-colors"
              >
                {savingGlobalInicio ? <><div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
            <p className="text-xs text-slate-400">Deixe em branco para não filtrar por data.</p>
          </div>
        </div>

        {/* Tabela de módulos */}
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/2">Módulo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data de Início</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {([
                { key: 'NFE_ENTRADA',       label: 'NF-e Entrada',              desc: 'Sync de notas fiscais recebidas (SEFAZ DistDFe)' },
                { key: 'CTE_ENTRADA',       label: 'CT-e Entrada',              desc: 'Sync de conhecimentos de transporte recebidos' },
                { key: 'MDFE_ENTRADA',      label: 'MDF-e Entrada',             desc: 'Sync de manifestos de documentos fiscais recebidos' },
                { key: 'NFSE_ENTRADA',      label: 'NFS-e Entrada',             desc: 'Sync de notas de serviço recebidas (prefeituras)' },
                { key: 'NFE_SAIDA',         label: 'NF-e Saída',                desc: 'Emissão de NF-e / autorização SEFAZ' },
                { key: 'NFSE_SAIDA',        label: 'NFS-e Saída',               desc: 'Emissão de notas de serviço' },
                { key: 'EFD_ICMS',          label: 'EFD-ICMS/IPI (SPED Fiscal)',desc: 'Escrituração Fiscal Digital — ICMS e IPI' },
                { key: 'EFD_CONTRIBUICOES', label: 'EFD-Contribuições',         desc: 'Escrituração de PIS/COFINS' },
                { key: 'SPED_ECD',          label: 'SPED ECD',                  desc: 'Escrituração Contábil Digital' },
                { key: 'SPED_ECF',          label: 'SPED ECF',                  desc: 'Escrituração Contábil Fiscal (IRPJ/CSLL)' },
                { key: 'ESOCIAL',           label: 'e-Social',                  desc: 'Folha de pagamento, FGTS, GPS, RAIS' },
                { key: 'REINF',             label: 'EFD-REINF',                 desc: 'Retenções e informações de serviços tomados — DIRF' },
                { key: 'DCTFWEB',           label: 'DCTFWeb',                   desc: 'DCTF, DARF IRPJ/CSLL, DARF PIS/COFINS' },
              ] as const).map(({ key, label, desc }) => {
                const date = moduleDates[key] ?? '';
                const saving = savingModules[key] ?? false;
                const status = moduleStatus[key] ?? 'idle';
                const effectiveDate = date || dataInicioOperacao;
                return (
                  <tr key={key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 text-sm">{label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setModuleDates((p) => ({ ...p, [key]: e.target.value }))}
                          disabled={fiscalReadOnly}
                          className={`input text-sm max-w-[180px] ${fiscalReadOnly ? 'bg-slate-50 cursor-default text-slate-500' : ''}`}
                        />
                        {!date && effectiveDate && (
                          <span className="text-[11px] text-slate-400">
                            Usando global: {new Date(effectiveDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {!date && !effectiveDate && (
                          <span className="text-[11px] text-slate-400">Sem filtro de data</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {status === 'success' && <span className="text-xs text-emerald-600 font-medium">✓</span>}
                        {status === 'error' && <span className="text-xs text-red-600 font-medium">✗</span>}
                        <button
                          onClick={() => handleSaveModule(key)}
                          disabled={fiscalReadOnly || saving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs font-medium transition-colors"
                        >
                          {saving ? <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : 'Salvar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-400">
          Prioridade: data específica do módulo → data global → sem filtro. Módulos sem data específica usam o fallback global.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Regime Tributário                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Regime Tributário
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field
            label="Regime Tributário da Empresa"
            hint="Define as obrigações acessórias e retenções aplicáveis."
            locked={fiscalReadOnly}
          >
            <select
              value={config.taxRegime}
              onChange={(e) => setC('taxRegime', e.target.value)}
              disabled={fiscalReadOnly}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default text-slate-500' : ''}`}
            >
              {Object.entries(TAX_REGIME_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Field>

          <Field
            label="ISS retido na fonte pelo município"
            hint="Ativo = ISS retido em todas as NFS-e emitidas."
            locked={fiscalReadOnly}
          >
            <label className={`flex items-center gap-3 mt-1 ${fiscalReadOnly ? 'cursor-default opacity-75' : 'cursor-pointer'}`}>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={config.issRetidoMunicipio}
                  disabled={fiscalReadOnly}
                  onChange={(e) => setC('issRetidoMunicipio', e.target.checked)}
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${config.issRetidoMunicipio ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.issRetidoMunicipio ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-gray-700">
                {config.issRetidoMunicipio ? 'ISS retido na fonte (ativo)' : 'ISS não retido na fonte'}
              </span>
            </label>
          </Field>

          <Field
            label="MVA Padrão (%)"
            hint="Margem de Valor Agregado para Substituição Tributária quando não há tabela específica por UF."
            locked={fiscalReadOnly}
          >
            <input
              type="number"
              step="0.01"
              min="0"
              value={config.mvaPadrao}
              readOnly={fiscalReadOnly}
              onChange={(e) => setC('mvaPadrao', parseFloat(e.target.value) || 0)}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
            />
          </Field>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Ambientes por Módulo                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Ambientes por Módulo Fiscal
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Cada módulo pode operar de forma independente em Produção ou Homologação.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <strong className="text-emerald-700">1 — Produção:</strong>
            <span className="text-slate-500">transmissões reais com validade jurídica</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" />
            <strong className="text-red-700">2 — Homologação:</strong>
            <span className="text-slate-500">servidores de teste, sem validade</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {([
            { field: 'ambienteNfe',     label: 'NF-e',     hint: 'Nota Fiscal Eletrônica (modelo 55)' },
            { field: 'ambienteNfse',    label: 'NFS-e',    hint: 'Nota Fiscal de Serviço Eletrônica (prefeitura)' },
            { field: 'ambienteSped',    label: 'SPED',     hint: 'EFD-ICMS/IPI, EFD-Contribuições, ECD, ECF' },
            { field: 'ambienteEsocial', label: 'e-Social', hint: 'Folha de pagamento e obrigações trabalhistas' },
            { field: 'ambienteReinf',   label: 'REINF',    hint: 'EFD-Reinf — retenções e informações da NF' },
            { field: 'ambienteDctfweb', label: 'DCTFWeb',  hint: 'Declaração de Débitos e Créditos Tributários Federais' },
            { field: 'ambienteDFe',     label: 'DF-e',     hint: 'Distribuição de DF-e (NF-e, CT-e, MDF-e, Eventos)' },
          ] as { field: keyof FiscalConfig; label: string; hint: string }[]).map(({ field, label, hint }) => {
            const val = (config[field] as number) ?? 2;
            const isProd = val === 1;
            return (
              <div key={field} className={`border rounded-lg p-3 ${isProd ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">{label}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isProd ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {isProd ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">{hint}</p>
                <select
                  value={val}
                  disabled={fiscalReadOnly}
                  onChange={(e) => setC(field, Number(e.target.value) as FiscalConfig[typeof field])}
                  className={`input text-sm ${fiscalReadOnly ? 'bg-slate-50 cursor-default opacity-75' : ''}`}
                >
                  <option value={2}>2 — Homologação (Teste)</option>
                  <option value={1}>1 — Produção (Oficial)</option>
                </select>
              </div>
            );
          })}
        </div>

        {anyProd && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              <strong>Atenção:</strong> Um ou mais módulos estão configurados para Produção.
              Certifique-se de que o certificado digital A1 está instalado antes de transmitir documentos oficiais.
            </span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Numeração e Séries                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Numeração e Séries de Documentos Fiscais
        </h2>

        {/* NF-e */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">NF-e (modelo 55)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Série NF-e" hint="Normalmente 1. Alterar somente se houver autorização da SEFAZ." locked={fiscalReadOnly}>
            <input type="number" min={1} max={999} value={config.serieNfe} readOnly={fiscalReadOnly}
              onChange={(e) => setC('serieNfe', Number(e.target.value))}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
          <Field label="Próximo Número NF-e" hint="Sequencial do próximo documento a ser emitido." locked={fiscalReadOnly}>
            <input type="number" min={1} value={config.proximoNumeroNfe} readOnly={fiscalReadOnly}
              onChange={(e) => setC('proximoNumeroNfe', Number(e.target.value))}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
        </div>

        {/* CT-e */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-t border-slate-100 pt-3">CT-e</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Série CT-e" locked={fiscalReadOnly}>
            <input type="text" maxLength={3} value={config.serieCte} readOnly={fiscalReadOnly}
              onChange={(e) => setC('serieCte', e.target.value)}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
          <Field label="Próximo Número CT-e" locked={fiscalReadOnly}>
            <input type="number" min={1} value={config.proximoNumeroCte} readOnly={fiscalReadOnly}
              onChange={(e) => setC('proximoNumeroCte', Number(e.target.value))}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
        </div>

        {/* MDF-e */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-t border-slate-100 pt-3">MDF-e</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Série MDF-e" locked={fiscalReadOnly}>
            <input type="text" maxLength={3} value={config.serieMdfe} readOnly={fiscalReadOnly}
              onChange={(e) => setC('serieMdfe', e.target.value)}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
          <Field label="Próximo Número MDF-e" locked={fiscalReadOnly}>
            <input type="number" min={1} value={config.proximoNumeroMdfe} readOnly={fiscalReadOnly}
              onChange={(e) => setC('proximoNumeroMdfe', Number(e.target.value))}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
        </div>

        {/* NFS-e */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-t border-slate-100 pt-3">NFS-e</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Série NFS-e" locked={fiscalReadOnly}>
            <input type="text" maxLength={3} value={config.serieNfse} readOnly={fiscalReadOnly}
              onChange={(e) => setC('serieNfse', e.target.value)}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
          <Field label="Próximo Número NFS-e" locked={fiscalReadOnly}>
            <input type="number" min={1} value={config.proximoNumeroNfse} readOnly={fiscalReadOnly}
              onChange={(e) => setC('proximoNumeroNfse', Number(e.target.value))}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
          </Field>
        </div>

        {/* Save button */}
        {!fiscalReadOnly && (
          <>
            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" /> Configurações salvas com sucesso!
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> Erro ao salvar. Tente novamente.
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar Ambientes, Regime e Numeração'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Alíquotas de Impostos                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Alíquotas de Impostos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Utilizadas na emissão de NFS-e e cálculos fiscais. Podem ser sobrescritas por documento individual.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Regime p/ Alíquotas" hint="Regime ao qual estas alíquotas se aplicam" locked={fiscalReadOnly}>
            <select
              value={taxRates.regime}
              disabled={fiscalReadOnly}
              onChange={(e) => setTaxRates((p) => ({ ...p, regime: e.target.value }))}
              className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default text-slate-500' : ''}`}
            >
              {Object.entries(TAX_REGIME_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Field>

          {([
            { key: 'aliquotaPis',    label: 'PIS (%)',             hint: 'Programa de Integração Social' },
            { key: 'aliquotaCofins', label: 'COFINS (%)',          hint: 'Contribuição p/ Financiamento da Seguridade Social' },
            { key: 'aliquotaIss',    label: 'ISS (%)',             hint: 'Imposto Sobre Serviços — padrão municipal' },
            { key: 'aliquotaCsll',   label: 'CSLL (%)',            hint: 'Contribuição Social sobre o Lucro Líquido' },
            { key: 'aliquotaIr',     label: 'IR sobre Serviços (%)', hint: 'Imposto de Renda Retido na Fonte' },
            { key: 'aliquotaInss',   label: 'INSS Retido (%)',     hint: 'Retenção previdenciária sobre serviços' },
          ] as { key: keyof TaxRates; label: string; hint: string }[]).map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint} locked={fiscalReadOnly}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxRates[key] as number}
                readOnly={fiscalReadOnly}
                onChange={(e) => setTaxRates((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
              />
            </Field>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Reforma Tributária (IBS / CBS)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CBS (%)" hint="Contribuição sobre Bens e Serviços (fase teste 2026)" locked={fiscalReadOnly}>
              <input
                type="number" step="0.01" min="0" value={taxRates.aliquotaCbs}
                readOnly={fiscalReadOnly}
                onChange={(e) => setTaxRates((p) => ({ ...p, aliquotaCbs: parseFloat(e.target.value) || 0 }))}
                className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
              />
            </Field>
            <Field label="IBS (%)" hint="Imposto sobre Bens e Serviços (fase teste 2026)" locked={fiscalReadOnly}>
              <input
                type="number" step="0.01" min="0" value={taxRates.aliquotaIbs}
                readOnly={fiscalReadOnly}
                onChange={(e) => setTaxRates((p) => ({ ...p, aliquotaIbs: parseFloat(e.target.value) || 0 }))}
                className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
              />
            </Field>
          </div>
        </div>

        {!fiscalReadOnly && (
          <>
            {ratesStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" /> Alíquotas salvas com sucesso!
              </div>
            )}
            {ratesStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> Erro ao salvar alíquotas.
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSaveRates}
                disabled={savingRates}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {savingRates ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
                {savingRates ? 'Salvando...' : 'Salvar Alíquotas'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CFOP e CST/CSOSN Padrão                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> CFOP e CST/CSOSN Padrão
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Valores usados pelo Motor Fiscal quando nenhuma regra tributária ou NCM define o CFOP/CST do item.
            Não altere sem orientação contábil.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="CFOP Saída Intraestadual" hint="NF-e saída — emitente e destinatário na mesma UF. Padrão: 5102" locked={fiscalReadOnly}>
            <input
              type="text" maxLength={5} value={config.cfopPadraoNfeSaida} readOnly={fiscalReadOnly}
              onChange={(e) => setC('cfopPadraoNfeSaida', e.target.value)}
              className={`input font-mono ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
              placeholder="5102"
            />
          </Field>
          <Field label="CFOP Saída Interestadual" hint="NF-e saída — destinatário em outra UF. Padrão: 6102" locked={fiscalReadOnly}>
            <input
              type="text" maxLength={5} value={config.cfopPadraoNfeSaidaInter} readOnly={fiscalReadOnly}
              onChange={(e) => setC('cfopPadraoNfeSaidaInter', e.target.value)}
              className={`input font-mono ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
              placeholder="6102"
            />
          </Field>
          <Field label="CFOP Entrada CT-e" hint="Fallback quando o CT-e recebido não traz CFOP no XML. Padrão: 2352" locked={fiscalReadOnly}>
            <input
              type="text" maxLength={5} value={config.cfopPadraoCteEntrada} readOnly={fiscalReadOnly}
              onChange={(e) => setC('cfopPadraoCteEntrada', e.target.value)}
              className={`input font-mono ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
              placeholder="2352"
            />
          </Field>

          <Field label="CST ICMS Saída (Regime Normal)" hint="Código de Situação Tributária para ICMS em operações de saída." locked={fiscalReadOnly}>
            <select
              value={config.cstIcmsPadrao}
              disabled={fiscalReadOnly}
              onChange={(e) => setC('cstIcmsPadrao', e.target.value)}
              className={`input font-mono ${fiscalReadOnly ? 'bg-slate-50 cursor-default text-slate-500' : ''}`}
            >
              <option value="00">00 — Tributada integralmente</option>
              <option value="10">10 — Tributada c/ ST</option>
              <option value="20">20 — Redução de BC</option>
              <option value="30">30 — Isenta c/ ST</option>
              <option value="40">40 — Isenta</option>
              <option value="41">41 — Não tributada</option>
              <option value="50">50 — Suspensão</option>
              <option value="51">51 — Diferimento</option>
              <option value="60">60 — ICMS cobrado ant. ST</option>
              <option value="70">70 — Redução BC c/ ST</option>
              <option value="90">90 — Outras</option>
            </select>
          </Field>

          <Field label="CSOSN Saída (Simples Nacional)" hint="Código de Situação da Operação no Simples Nacional." locked={fiscalReadOnly}>
            <select
              value={config.csosnPadrao}
              disabled={fiscalReadOnly}
              onChange={(e) => setC('csosnPadrao', e.target.value)}
              className={`input font-mono ${fiscalReadOnly ? 'bg-slate-50 cursor-default text-slate-500' : ''}`}
            >
              <option value="101">101 — Tributada com crédito</option>
              <option value="102">102 — Tributada sem crédito</option>
              <option value="103">103 — Isenta (receita bruta)</option>
              <option value="201">201 — Tributada c/ ST e crédito</option>
              <option value="202">202 — Tributada c/ ST sem crédito</option>
              <option value="300">300 — Imune</option>
              <option value="400">400 — Não tributada SN</option>
              <option value="500">500 — ICMS cobrado ant. ST</option>
              <option value="900">900 — Outras</option>
            </select>
          </Field>
        </div>

        {!fiscalReadOnly && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar CFOP/CST'}
            </button>
          </div>
        )}

        {fiscalReadOnly && (
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm">
            <Lock className="w-4 h-4 shrink-0" />
            Campos bloqueados. Solicite permissão <strong className="text-slate-700">Fiscal › Configurar</strong> para editar.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Certificado Digital A1                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Certificado Digital A1
        </h2>
        <p className="text-sm text-slate-500 -mt-2">
          Necessário para assinar e transmitir NF-e, NFS-e e obrigações acessórias à SEFAZ.
        </p>
        <CertificadoPanel companyId={companyId} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Retenções na Fonte                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Retenções na Fonte — Valores Mínimos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Conforme IN RFB 2.145/2023. O imposto só é retido quando o valor do serviço atingir o mínimo configurado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { key: 'minimoRetencaoPisCofinsCsll', label: 'Mínimo PIS/COFINS/CSLL (R$)', hint: 'Padrão: R$ 215,05' },
            { key: 'minimoRetencaoIrrf',           label: 'Mínimo IRRF (R$)',             hint: 'Padrão: R$ 10,00' },
            { key: 'minimoRetencaoInss',           label: 'Mínimo INSS (R$)',             hint: 'Padrão: R$ 0,00 (sem mínimo)' },
            { key: 'minimoRetencaoIss',            label: 'Mínimo ISSQN (R$)',            hint: 'Conforme legislação municipal' },
          ] as { key: keyof TaxRetentionConfig; label: string; hint: string }[]).map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint} locked={fiscalReadOnly}>
              <input
                type="number" step="0.01" min="0"
                value={retention[key] as number}
                readOnly={fiscalReadOnly}
                onChange={(e) => setRetention((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`}
              />
            </Field>
          ))}
        </div>

        {/* Reforma Tributária */}
        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Reforma Tributária (EC 132/2023)</h3>
              <p className="text-sm text-slate-500">Ativar cálculo com CBS e IBS conforme LC 214/2025</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${retention.usarSistemaNovo ? 'text-blue-700 bg-blue-50' : 'text-amber-600 bg-amber-50'}`}>
                {retention.usarSistemaNovo ? 'NOVO SISTEMA ATIVO' : 'SISTEMA ATUAL'}
              </span>
              {!fiscalReadOnly && (
                <button
                  onClick={() => setRetention((p) => ({ ...p, usarSistemaNovo: !p.usarSistemaNovo }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${retention.usarSistemaNovo ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform absolute top-0.5 ${retention.usarSistemaNovo ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              )}
            </div>
          </div>

          {retention.usarSistemaNovo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Período da Reforma" locked={fiscalReadOnly}>
                <select
                  value={retention.periodoReforma}
                  disabled={fiscalReadOnly}
                  onChange={(e) => setRetention((p) => ({ ...p, periodoReforma: e.target.value }))}
                  className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default text-slate-500' : ''}`}
                >
                  <option value="TESTE_2026">2026 — Período de Teste (0,9% CBS + 0,1% IBS)</option>
                  <option value="CBS_2027">2027 — CBS plena (PIS/COFINS extintos)</option>
                  <option value="TRANSICAO">2029–2032 — Transição IBS/ISS</option>
                  <option value="PLENA_2033">2033+ — Sistema pleno (IBS substitui ISS)</option>
                </select>
              </Field>
              <Field label="Alíquota CBS (%)" hint="2026: 0,9% | 2027+: ~9,25%" locked={fiscalReadOnly}>
                <input type="number" step="0.01" min="0" value={retention.aliquotaCbs}
                  readOnly={fiscalReadOnly}
                  onChange={(e) => setRetention((p) => ({ ...p, aliquotaCbs: parseFloat(e.target.value) || 0 }))}
                  className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
              </Field>
              <Field label="Alíquota IBS (%)" hint="2026: 0,1% | 2033: alíquota plena" locked={fiscalReadOnly}>
                <input type="number" step="0.01" min="0" value={retention.aliquotaIbs}
                  readOnly={fiscalReadOnly}
                  onChange={(e) => setRetention((p) => ({ ...p, aliquotaIbs: parseFloat(e.target.value) || 0 }))}
                  className={`input ${fiscalReadOnly ? 'bg-slate-50 cursor-default' : ''}`} />
              </Field>
            </div>
          )}

          <div className="mt-3 text-xs text-slate-500 bg-blue-50 p-3 rounded">
            <strong>Nota:</strong> CSLL e IRRF <strong>não são afetados</strong> pela reforma tributária e permanecem com as mesmas regras de retenção.
            INSS também permanece inalterado.
          </div>
        </div>

        {!fiscalReadOnly && (
          <>
            {retentionStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" /> Configurações de retenção salvas com sucesso!
              </div>
            )}
            {retentionStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> Erro ao salvar configurações de retenção.
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSaveRetention}
                disabled={savingRetention}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {savingRetention ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
                {savingRetention ? 'Salvando...' : 'Salvar Retenções'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Histórico de Alterações                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setAuditOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span className="text-base font-semibold text-slate-900">Histórico de Alterações</span>
            {auditLog.length > 0 && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {auditLog.length} {auditLog.length === 1 ? 'registro' : 'registros'}
              </span>
            )}
          </div>
          {auditOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {auditOpen && (
          <div className="border-t border-slate-100">
            {auditLog.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">
                Nenhuma alteração registrada ainda. As mudanças salvas aparecerão aqui.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLog.map((entry) => {
                  const isOpen = expandedEntry === entry.id;
                  const changedFields = Object.keys(entry.newData ?? {});
                  const date = new Date(entry.createdAt);
                  return (
                    <div key={entry.id}>
                      <button
                        onClick={() => setExpandedEntry(isOpen ? null : entry.id)}
                        className="w-full flex items-start gap-4 px-6 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="shrink-0 mt-0.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                            <History className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">
                              {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                            </span>
                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                              {changedFields.length} campo{changedFields.length !== 1 ? 's' : ''} alterado{changedFields.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {entry.user?.name ?? entry.user?.email ?? 'Usuário desconhecido'}
                            {' · '}
                            {date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
                      </button>

                      {isOpen && (
                        <div className="px-6 pb-4 pl-16">
                          <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="text-left px-3 py-2 font-semibold text-slate-600 w-1/3">Campo</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600 w-1/3">Antes</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600 w-1/3">Depois</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {changedFields.map((field) => (
                                <tr key={field}>
                                  <td className="px-3 py-2 text-slate-600 font-medium">
                                    {FIELD_LABELS[field] ?? field}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500 font-mono">
                                    {formatVal(entry.oldData?.[field])}
                                  </td>
                                  <td className="px-3 py-2 text-emerald-700 font-mono font-semibold">
                                    {formatVal(entry.newData?.[field])}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
