'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Save,
  CheckCircle,
  AlertCircle,
  MapPin,
  Phone,
  Settings,
  Plus,
  Trash2,
  Star,
  StarOff,
  Pencil,
  X,
  Check,
  ExternalLink,
} from 'lucide-react';
import AddressBlock from '@/components/address/address-block';
import type { AddressValue } from '@/lib/address';
import { maskCnpj, maskPhone } from '@/lib/masks';
import { apiFetch } from '@/lib/api';
import { fmtNumber, fmtCurrency } from '@/lib/format';
import { useToast } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyCnae {
  id: string;
  cnae: string;
  descricao: string | null;
  principal: boolean;
}

interface Company {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  codigoMunicipioIbge: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  taxRegime: string;
  issRetidoMunicipio: boolean;
  mvaPadrao: number;
  cnaePrincipal: string | null;
  ambienteSefaz: number;
  ambienteNfe: number;
  ambienteNfse: number;
  ambienteSped: number;
  ambienteEsocial: number;
  ambienteReinf: number;
  ambienteDctfweb: number;
  ambienteDFe: number;
  serieNfe: number;
  proximoNumeroNfe: number;
  serieCte: string;
  proximoNumeroCte: number;
  serieMdfe: string;
  proximoNumeroMdfe: number;
  serieNfse: string;
  proximoNumeroNfse: number;
  certDigitalValidade: string | null;
  certDigitalCn: string | null;
  cnaes: CompanyCnae[];
}

// ---------------------------------------------------------------------------
// CnaeRow
// ---------------------------------------------------------------------------

function CnaeRow({
  cnae,
  onSetPrincipal,
  onDelete,
  onSaveDesc,
}: {
  cnae: CompanyCnae;
  onSetPrincipal: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveDesc: (id: string, desc: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(cnae.descricao ?? '');

  return (
    <tr className={cnae.principal ? 'bg-blue-50' : 'hover:bg-slate-50'}>
      {/* Principal badge */}
      <td className="px-4 py-3 text-center w-10">
        <button
          onClick={() => !cnae.principal && onSetPrincipal(cnae.id)}
          title={cnae.principal ? 'CNAE Principal' : 'Definir como Principal'}
          className={`p-1 rounded transition-colors ${
            cnae.principal
              ? 'text-amber-500 cursor-default'
              : 'text-slate-300 hover:text-amber-400'
          }`}
        >
          {cnae.principal ? (
            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
          ) : (
            <StarOff className="w-4 h-4" />
          )}
        </button>
      </td>

      {/* CÃ³digo */}
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-semibold text-slate-800">{cnae.cnae}</span>
        {cnae.principal && (
          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded uppercase">
            Principal
          </span>
        )}
      </td>

      {/* DescriÃ§Ã£o */}
      <td className="px-4 py-3 w-full">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="input text-xs flex-1"
              placeholder="Descricao da atividade economica"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onSaveDesc(cnae.id, desc); setEditing(false); }
                if (e.key === 'Escape') { setDesc(cnae.descricao ?? ''); setEditing(false); }
              }}
            />
            <button onClick={() => { onSaveDesc(cnae.id, desc); setEditing(false); }} className="text-emerald-600 hover:text-emerald-700">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setDesc(cnae.descricao ?? ''); setEditing(false); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-sm text-slate-600">
            {cnae.descricao || <span className="italic text-slate-400">sem descricao</span>}
          </span>
        )}
      </td>

      {/* AÃ§Ãµes */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Editar descricao"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {!cnae.principal && (
            <button
              onClick={() => onDelete(cnae.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Remover CNAE"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// CertificadoPanel moved to @/components/fiscal/certificado-panel.tsx

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EmpresaConfigPage() {
  const toast = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'geral' | 'endereco' | 'cnaes' | 'rh'>('geral');
  const router = useRouter();

  // CNAE form
  const [newCnae, setNewCnae] = useState('');
  const [newCnaeDesc, setNewCnaeDesc] = useState('');
  const [newCnaePrincipal, setNewCnaePrincipal] = useState(false);
  const [cnaeError, setCnaeError] = useState('');
  const [cnaeAdding, setCnaeAdding] = useState(false);
  const [showAddCnae, setShowAddCnae] = useState(false);

  // Payroll / RH config
  const [payrollConfig, setPayrollConfig] = useState({ fgtsRate: 8, inssPatronalRate: 20, inssTeto: 7786.02 });
  const [payrollConfigSaving, setPayrollConfigSaving] = useState(false);
  const [payrollConfigStatus, setPayrollConfigStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rhAno, setRhAno] = useState(new Date().getFullYear());
  const [inssFaixas, setInssFaixas] = useState<Array<{ ordem: number; limiteMax: number; aliquota: number }>>([]);
  const [irrfFaixas, setIrrfFaixas] = useState<Array<{ ordem: number; limiteMax: number; aliquota: number; deducao: number }>>([]);
  const [rhFaixasSaving, setRhFaixasSaving] = useState(false);
  const [rhFaixasStatus, setRhFaixasStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rhLoading, setRhLoading] = useState(false);
  // Tracks which cell is focused (to show raw number while editing)
  const [inssFocus, setInssFocus] = useState<{ idx: number; field: string } | null>(null);
  const [irrfFocus, setIrrfFocus] = useState<{ idx: number; field: string } | null>(null);
  const [payFocus, setPayFocus] = useState<string | null>(null);

  /** Parses a pt-BR formatted string or plain number string to float */
  const parseBR = useCallback((v: string): number => {
    const clean = v.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }, []);

  useEffect(() => {
    apiFetch('/api/company')
      .then((r) => r.json())
      .then((data) => {
        setCompany(data);
        setForm(data);
      })
      .catch(() => setErrorMsg('Erro ao carregar dados da empresa'))
      .finally(() => setLoading(false));
  }, []);

  // Load payroll config
  useEffect(() => {
    apiFetch('/api/hr/payroll-config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.config) {
          setPayrollConfig({
            fgtsRate: +(data.config.fgtsRate * 100).toFixed(4),
            inssPatronalRate: +(data.config.inssPatronalRate * 100).toFixed(4),
            inssTeto: data.config.inssTeto ?? 7786.02,
          });
        }
      })
      .catch(() => { /* mantÃ©m padrÃµes */ });
  }, []);

  const loadRhFaixas = async (ano: number) => {
    setRhLoading(true);
    try {
      const res = await apiFetch(`/api/hr/payroll-config/faixas/${ano}`);
      const data = await res.json();
      setInssFaixas(data.inssFaixas ?? []);
      setIrrfFaixas(data.irrfFaixas ?? []);
    } catch {
      setInssFaixas([]);
      setIrrfFaixas([]);
    } finally {
      setRhLoading(false);
    }
  };

  useEffect(() => {
    loadRhFaixas(rhAno);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rhAno]);

  const handleSavePayrollConfig = async () => {
    setPayrollConfigSaving(true);
    setPayrollConfigStatus('idle');
    try {
      const res = await apiFetch('/api/hr/payroll-config', {
        method: 'PATCH',
        body: JSON.stringify({
          fgtsRate: payrollConfig.fgtsRate / 100,
          inssPatronalRate: payrollConfig.inssPatronalRate / 100,
          inssTeto: payrollConfig.inssTeto,
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar configuracoes de RH');
      setPayrollConfigStatus('success');
    } catch {
      setPayrollConfigStatus('error');
    } finally {
      setPayrollConfigSaving(false);
    }
  };

  const handleSaveRhFaixas = async () => {
    setRhFaixasSaving(true);
    setRhFaixasStatus('idle');
    try {
      const [resInss, resIrrf] = await Promise.all([
        apiFetch('/api/hr/payroll-config/inss-faixas', {
          method: 'POST',
          body: JSON.stringify({ ano: rhAno, faixas: inssFaixas }),
        }),
        apiFetch('/api/hr/payroll-config/irrf-faixas', {
          method: 'POST',
          body: JSON.stringify({ ano: rhAno, faixas: irrfFaixas }),
        }),
      ]);
      if (!resInss.ok || !resIrrf.ok) throw new Error('Falha ao salvar faixas');
      setRhFaixasStatus('success');
    } catch {
      setRhFaixasStatus('error');
    } finally {
      setRhFaixasSaving(false);
    }
  };

  const handleImportDefaults2025 = async () => {
    setRhLoading(true);
    try {
      const res = await apiFetch('/api/hr/payroll-config/import-defaults-2025', { method: 'POST' });
      const data = await res.json();
      setInssFaixas(data.inssFaixas ?? []);
      setIrrfFaixas(data.irrfFaixas ?? []);
      setRhAno(2025);
    } catch {
      // silently ignore
    } finally {
      setRhLoading(false);
    }
  };

  const handleChange = (field: keyof Company, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus('idle');
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('idle');
    try {
      const res = await apiFetch('/api/company', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      const updated = await res.json();
      setCompany(updated);
      setForm(updated);
      setStatus('success');
      window.dispatchEvent(new CustomEvent('company-saved'));
    } catch {
      setStatus('error');
      setErrorMsg('Erro ao salvar as configuracoes');
    } finally {
      setSaving(false);
    }
  };

  // ---- CNAE handlers ----

  const refreshCnaes = async () => {
    const res = await apiFetch('/api/company/cnaes');
    const data: CompanyCnae[] = await res.json();
    setCompany((prev) => prev ? { ...prev, cnaes: data } : prev);
  };

  const handleAddCnae = async () => {
    setCnaeError('');
    if (!newCnae.trim()) { setCnaeError('Informe o codigo CNAE'); return; }
    if (!newCnaeDesc.trim()) { setCnaeError('Informe a descricao da atividade'); return; }
    setCnaeAdding(true);
    try {
      const res = await apiFetch('/api/company/cnaes', {
        method: 'POST',
        body: JSON.stringify({ cnae: newCnae.trim(), descricao: newCnaeDesc.trim(), principal: newCnaePrincipal }),
      });
      if (!res.ok) {
        let msg = 'Erro ao adicionar CNAE';
        try { const err = await res.json(); msg = err.message || msg; } catch {}
        throw new Error(msg);
      }
      setNewCnae(''); setNewCnaeDesc(''); setNewCnaePrincipal(false); setShowAddCnae(false);
      await refreshCnaes();
    } catch (e: unknown) {
      setCnaeError(e instanceof Error ? e.message : 'Erro ao adicionar CNAE');
    } finally {
      setCnaeAdding(false);
    }
  };

  const handleSetPrincipal = async (id: string) => {
    await apiFetch(`/api/company/cnaes/${id}/principal`, { method: 'PATCH' });
    await refreshCnaes();
  };

  const handleDeleteCnae = async (id: string) => {
    if (!confirm('Remover este CNAE?')) return;
    const res = await apiFetch(`/api/company/cnaes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.message || 'Erro ao remover CNAE');
      return;
    }
    await refreshCnaes();
  };

  const handleSaveDesc = async (id: string, descricao: string) => {
    await apiFetch(`/api/company/cnaes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ descricao }),
    });
    await refreshCnaes();
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs = [
    { id: 'geral',    label: 'Dados Gerais',       icon: Building2 },
    { id: 'endereco', label: 'Endereco',            icon: MapPin    },
    { id: 'cnaes',    label: 'CNAEs',               icon: Settings  },
    { id: 'rh',       label: 'Tabelas Fiscais RH', icon: Phone     },
  ] as const;

  const cnaes = company?.cnaes ?? [];
  const principal = cnaes.find((c) => c.principal);
  const secundarios = cnaes.filter((c) => !c.principal);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuracoes da Empresa</h1>
          <p className="text-slate-500 mt-1">
            Dados cadastrais, CNAEs, regime tributario e parametros para transmissoes governamentais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/configuracoes/empresas')}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Empresa
          </button>
        {activeTab !== 'cnaes' && activeTab !== 'rh' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Salvando...' : 'Salvar Alteracoes'}
          </button>
        )}
        </div>
      </div>

      {/* Status */}
      {status === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Dados salvos com sucesso!
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Aviso */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-800">Dados obrigatorios para emissao fiscal e SPED</p>
          <p className="text-amber-700 mt-0.5">
            CNPJ, Razao Social, Inscricao Estadual, Endereco fiscal com codigo IBGE, CNAE Principal e
            Regime Tributario sao exigidos em todas as transmissoes ao governo.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'cnaes' && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-600 rounded-full">
                    {cnaes.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ================================================================
          ABA: DADOS GERAIS
      ================================================================ */}
      {activeTab === 'geral' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Identificacao da Empresa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CNPJ *" hint="14 digitos â€” deve coincidir com a Receita Federal">
              <input
                type="text"
                value={maskCnpj(form.cnpj ?? '')}
                onChange={(e) => handleChange('cnpj', e.target.value.replace(/\D/g, '').slice(0, 14))}
                className="input"
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field label="Razao Social *" hint="Conforme registrado no CNPJ (Receita Federal)">
              <input
                type="text"
                value={form.razaoSocial ?? ''}
                onChange={(e) => handleChange('razaoSocial', e.target.value)}
                className="input"
                placeholder="Nome empresarial completo"
              />
            </Field>
            <Field label="Nome Fantasia">
              <input
                type="text"
                value={form.nomeFantasia ?? ''}
                onChange={(e) => handleChange('nomeFantasia', e.target.value)}
                className="input"
                placeholder="Nome comercial"
              />
            </Field>
            <Field label="Inscricao Estadual *" hint="IE do estado de origem â€” consta no cadastro SEFAZ estadual">
              <input
                type="text"
                value={form.inscricaoEstadual ?? ''}
                onChange={(e) => handleChange('inscricaoEstadual', e.target.value)}
                className="input"
                placeholder="Ex: 123.456.789.000"
              />
            </Field>
            <Field label="Inscricao Municipal" hint="Obrigatorio para emissao de NFS-e (servicos)">
              <input
                type="text"
                value={form.inscricaoMunicipal ?? ''}
                onChange={(e) => handleChange('inscricaoMunicipal', e.target.value)}
                className="input"
                placeholder="Ex: 123456"
              />
            </Field>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
              <Phone className="w-4 h-4 text-slate-500" /> Contato
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Telefone">
                <input type="text" value={maskPhone(form.telefone ?? '')} onChange={(e) => handleChange('telefone', e.target.value.replace(/\D/g, ''))} className="input" placeholder="(00) 0000-0000 OU (00) 00000-0000" />
              </Field>
              <Field label="E-mail Corporativo" hint="Usado para envio de NF-e ao destinatario">
                <input type="email" value={form.email ?? ''} onChange={(e) => handleChange('email', e.target.value)} className="input" placeholder="fiscal@empresa.com.br" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn saving={saving} onSave={handleSave} />
          </div>
        </div>
      )}

      {/* ================================================================
          ABA: ENDERECO
      ================================================================ */}
      {activeTab === 'endereco' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" /> Endereco Fiscal
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Deve coincidir com o endereco registrado no CNPJ. Usado em NF-e, SPED e eSocial.
            </p>
          </div>
          <AddressBlock
            value={{
              cep: form.cep ?? '',
              uf: form.uf ?? '',
              municipio: form.municipio ?? '',
              codigoIbge: form.codigoMunicipioIbge ?? '',
              logradouro: form.logradouro ?? '',
              numero: form.numero ?? '',
              complemento: form.complemento ?? '',
              bairro: form.bairro ?? '',
            }}
            onChange={(addr: AddressValue) => {
              setForm((prev) => ({
                ...prev,
                cep: addr.cep,
                uf: addr.uf,
                municipio: addr.municipio,
                codigoMunicipioIbge: addr.codigoIbge,
                logradouro: addr.logradouro,
                numero: addr.numero,
                complemento: addr.complemento,
                bairro: addr.bairro,
              }));
              setStatus('idle');
            }}
          />
          {!form.uf && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <span>UF (Estado) e obrigatoria para emissao de documentos fiscais. Preencha o CEP ou selecione a UF manualmente.</span>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <SaveBtn saving={saving} onSave={handleSave} />
          </div>
        </div>
      )}

      {/* Redirect notice: configuracoes fiscais unificadas em Fiscal â†’ Configuracao Fiscal */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <ExternalLink className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-900">Configuracoes Fiscais</p>
          <p className="text-blue-700 mt-0.5">
            Regime tributario, ambientes SEFAZ, numeracao de documentos, aliquotas, CFOP/CST, certificado digital
            e configuracoes de retencao foram unificados em{' '}
            <Link href="/fiscal/configuracao" className="font-semibold underline hover:text-blue-900">
              Fiscal â†’ Configuracao Fiscal
            </Link>
            .
          </p>
        </div>
      </div>

      {/* ================================================================
          ABA: CNAEs
      ================================================================ */}
      {activeTab === 'cnaes' && (
        <div className="space-y-4">

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">CNAEs â€” Classificacao Nacional de Atividades Economicas</p>
            <p>
              Cadastre exatamente os CNAEs registrados na Receita Federal (cartao CNPJ). O <strong>CNAE Principal</strong> (marcado com â˜…)
              aparece no campo <code className="px-1 bg-blue-100 rounded font-mono text-xs">CNAE</code> do emitente na NF-e e no
              registro <code className="px-1 bg-blue-100 rounded font-mono text-xs">0000</code> do SPED Fiscal.
              Os <strong>CNAEs Secundarios</strong> sao exigidos no eSocial (evento S-1000) e no cadastro do SPED.
            </p>
          </div>

          {/* Tabela */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {cnaes.length === 0
                    ? 'Nenhum CNAE cadastrado'
                    : `${cnaes.length} CNAE${cnaes.length > 1 ? 's' : ''} cadastrado${cnaes.length > 1 ? 's' : ''}`}
                </h2>
                {principal && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Principal: <span className="font-mono font-semibold text-slate-700">{principal.cnae}</span>
                    {principal.descricao && <span className="text-slate-400"> â€” {principal.descricao}</span>}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setShowAddCnae(true); setCnaeError(''); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar CNAE
              </button>
            </div>

            {/* Formulario de adiÃ§Ã£o */}
            {showAddCnae && (
              <div className="px-4 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Novo CNAE</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Codigo CNAE *" hint="Ex: 2920-4/01">
                    <input
                      type="text"
                      value={newCnae}
                      onChange={(e) => setNewCnae(e.target.value)}
                      className="input font-mono"
                      placeholder="0000-0/00"
                    />
                  </Field>
                  <Field label="Descricao da Atividade *" className="md:col-span-2" hint="Conforme tabela IBGE de CNAEs">
                    <input
                      type="text"
                      value={newCnaeDesc}
                      onChange={(e) => setNewCnaeDesc(e.target.value)}
                      className="input"
                      placeholder="Ex: Fabricacao de implementos e equipamentos rodoviarios"
                    />
                  </Field>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newCnaePrincipal}
                      onChange={(e) => setNewCnaePrincipal(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    Definir como CNAE Principal
                    {!principal && <span className="text-xs text-slate-400">(nenhum principal cadastrado ainda)</span>}
                  </label>
                </div>
                {cnaeError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {cnaeError}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleAddCnae}
                    disabled={cnaeAdding}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    {cnaeAdding ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Plus className="w-4 h-4" />}
                    {cnaeAdding ? 'Salvando...' : 'Confirmar'}
                  </button>
                  <button
                    onClick={() => { setShowAddCnae(false); setNewCnae(''); setNewCnaeDesc(''); setNewCnaePrincipal(false); setCnaeError(''); }}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de CNAEs */}
            {cnaes.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-400">
                <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhum CNAE cadastrado</p>
                <p className="text-xs mt-1">Clique em "Adicionar CNAE" para comecar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="px-4 py-2.5 text-center w-10 text-xs font-semibold text-slate-500">â˜…</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">Codigo CNAE</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Descricao da Atividade Economica</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Principal primeiro */}
                    {principal && (
                      <CnaeRow
                        key={principal.id}
                        cnae={principal}
                        onSetPrincipal={handleSetPrincipal}
                        onDelete={handleDeleteCnae}
                        onSaveDesc={handleSaveDesc}
                      />
                    )}
                    {/* SecundÃ¡rios */}
                    {secundarios.map((c) => (
                      <CnaeRow
                        key={c.id}
                        cnae={c}
                        onSetPrincipal={handleSetPrincipal}
                        onDelete={handleDeleteCnae}
                        onSaveDesc={handleSaveDesc}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legenda */}
            {cnaes.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  CNAE Principal â€” campo obrigatorio no XML da NF-e e no SPED registro 0000
                </span>
                <span className="flex items-center gap-1.5">
                  <StarOff className="w-3.5 h-3.5" />
                  CNAE Secundario â€” exigido no eSocial S-1000 e declaracoes de MEI/Simples
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          ABA: TABELAS FISCAIS DE RH
      ================================================================ */}
      {activeTab === 'rh' && (
        <div className="space-y-6">

          {/* --- Aliquotas Patronais --- */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                Aliquotas Patronais e FGTS
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Configuracao de aliquotas do empregador. Atualizadas conforme legislacao vigente.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="FGTS (%)" hint="Fundo de Garantia por Tempo de Servico - padrao 8%">
                <input
                  type="text"
                  inputMode="decimal"
                  value={payFocus === 'fgtsRate' ? payrollConfig.fgtsRate : fmtNumber(payrollConfig.fgtsRate, 2)}
                  onFocus={() => setPayFocus('fgtsRate')}
                  onBlur={() => setPayFocus(null)}
                  onChange={(e) => setPayrollConfig((p) => ({ ...p, fgtsRate: parseBR(e.target.value) }))}
                  className="input"
                />
              </Field>
              <Field label="INSS Patronal (%)" hint="Contribuicao previdenciaria do empregador - padrao 20%">
                <input
                  type="text"
                  inputMode="decimal"
                  value={payFocus === 'inssPatronalRate' ? payrollConfig.inssPatronalRate : fmtNumber(payrollConfig.inssPatronalRate, 2)}
                  onFocus={() => setPayFocus('inssPatronalRate')}
                  onBlur={() => setPayFocus(null)}
                  onChange={(e) => setPayrollConfig((p) => ({ ...p, inssPatronalRate: parseBR(e.target.value) }))}
                  className="input"
                />
              </Field>
              <Field label="Teto INSS (R$)" hint="Salario maximo de contribuicao ao INSS (2025: R$ 7.786,02)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={payFocus === 'inssTeto' ? payrollConfig.inssTeto : fmtCurrency(payrollConfig.inssTeto)}
                  onFocus={() => setPayFocus('inssTeto')}
                  onBlur={() => setPayFocus(null)}
                  onChange={(e) => setPayrollConfig((p) => ({ ...p, inssTeto: parseBR(e.target.value) }))}
                  className="input"
                />
              </Field>
            </div>
            {payrollConfigStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Configuracoes de RH salvas com sucesso!
              </div>
            )}
            {payrollConfigStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Erro ao salvar configuracoes de RH. Tente novamente.
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSavePayrollConfig}
                disabled={payrollConfigSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {payrollConfigSaving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
                {payrollConfigSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          {/* --- Faixas INSS / IRRF por ano --- */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Faixas de INSS e IRRF por Ano</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  As faixas sao atualizadas anualmente por lei federal. Defina as faixas vigentes para cada ano de competencia.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm font-medium text-slate-700">Ano:</label>
                <input
                  type="number"
                  value={rhAno}
                  min={2020}
                  max={2099}
                  onChange={(e) => setRhAno(parseInt(e.target.value) || new Date().getFullYear())}
                  className="input w-24"
                />
                <button
                  onClick={handleImportDefaults2025}
                  disabled={rhLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {rhLoading ? <div className="animate-spin w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full" /> : <Plus className="w-4 h-4" />}
                  Importar tabela 2025
                </button>
              </div>
            </div>

            {rhLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                Carregando faixas...
              </div>
            )}

            {!rhLoading && (
              <>
                {/* INSS */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-800">Faixas INSS â€” {rhAno}</h3>
                    <button
                      onClick={() => setInssFaixas((prev) => [...prev, { ordem: prev.length + 1, limiteMax: 0, aliquota: 0 }])}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar faixa
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ordem</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Limite Max (R$)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Aliquota (%)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Acoes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inssFaixas.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400 italic">
                              Nenhuma faixa cadastrada para {rhAno}. Importe a tabela 2025 ou adicione manualmente.
                            </td>
                          </tr>
                        )}
                        {inssFaixas.map((f, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                min={1}
                                value={f.ordem}
                                onChange={(e) => setInssFaixas((prev) => prev.map((x, i) => i === idx ? { ...x, ordem: parseInt(e.target.value) || 1 } : x))}
                                className="input w-16 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={inssFocus?.idx === idx && inssFocus.field === 'limiteMax' ? f.limiteMax : fmtNumber(f.limiteMax, 2)}
                                onFocus={() => setInssFocus({ idx, field: 'limiteMax' })}
                                onBlur={() => setInssFocus(null)}
                                onChange={(e) => setInssFaixas((prev) => prev.map((x, i) => i === idx ? { ...x, limiteMax: parseBR(e.target.value) } : x))}
                                className="input w-32 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={inssFocus?.idx === idx && inssFocus.field === 'aliquota' ? +(f.aliquota * 100).toFixed(4) : fmtNumber(f.aliquota * 100, 2)}
                                onFocus={() => setInssFocus({ idx, field: 'aliquota' })}
                                onBlur={() => setInssFocus(null)}
                                onChange={(e) => setInssFaixas((prev) => prev.map((x, i) => i === idx ? { ...x, aliquota: parseBR(e.target.value) / 100 } : x))}
                                className="input w-24 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => setInssFaixas((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* IRRF */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-800">Faixas IRRF â€” {rhAno}</h3>
                    <button
                      onClick={() => setIrrfFaixas((prev) => [...prev, { ordem: prev.length + 1, limiteMax: 0, aliquota: 0, deducao: 0 }])}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar faixa
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ordem</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Limite Max (R$)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Aliquota (%)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Deducao (R$)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Acoes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {irrfFaixas.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400 italic">
                              Nenhuma faixa cadastrada para {rhAno}. Importe a tabela 2025 ou adicione manualmente.
                            </td>
                          </tr>
                        )}
                        {irrfFaixas.map((f, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                min={1}
                                value={f.ordem}
                                onChange={(e) => setIrrfFaixas((prev) => prev.map((x, i) => i === idx ? { ...x, ordem: parseInt(e.target.value) || 1 } : x))}
                                className="input w-16 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={irrfFocus?.idx === idx && irrfFocus.field === 'limiteMax'
                                  ? (f.limiteMax >= 99999999 ? 99999999 : f.limiteMax)
                                  : (f.limiteMax >= 99999999 ? 'Sem limite' : fmtNumber(f.limiteMax, 2))}
                                onFocus={() => setIrrfFocus({ idx, field: 'limiteMax' })}
                                onBlur={() => setIrrfFocus(null)}
                                onChange={(e) => setIrrfFaixas((prev) => prev.map((x, i) => i === idx ? { ...x, limiteMax: parseBR(e.target.value) } : x))}
                                className="input w-32 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={irrfFocus?.idx === idx && irrfFocus.field === 'aliquota' ? +(f.aliquota * 100).toFixed(4) : fmtNumber(f.aliquota * 100, 2)}
                                onFocus={() => setIrrfFocus({ idx, field: 'aliquota' })}
                                onBlur={() => setIrrfFocus(null)}
                                onChange={(e) => setIrrfFaixas((prev) => prev.map((x, i) => i === idx ? { ...x, aliquota: parseBR(e.target.value) / 100 } : x))}
                                className="input w-24 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={irrfFocus?.idx === idx && irrfFocus.field === 'deducao' ? f.deducao : fmtNumber(f.deducao, 2)}
                                onFocus={() => setIrrfFocus({ idx, field: 'deducao' })}
                                onBlur={() => setIrrfFocus(null)}
                                onChange={(e) => setIrrfFaixas((prev) => prev.map((x, i) => i === idx ? { ...x, deducao: parseBR(e.target.value) } : x))}
                                className="input w-28 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => setIrrfFaixas((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {rhFaixasStatus === 'success' && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Faixas salvas com sucesso para {rhAno}!
                  </div>
                )}
                {rhFaixasStatus === 'error' && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Erro ao salvar faixas. Verifique e tente novamente.
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveRhFaixas}
                    disabled={rhFaixasSaving || inssFaixas.length === 0 || irrfFaixas.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    {rhFaixasSaving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
                    {rhFaixasSaving ? 'Salvando...' : `Salvar Faixas ${rhAno}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

function SaveBtn({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
    >
      {saving ? (
        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      {saving ? 'Salvando...' : 'Salvar Alteracoes'}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
