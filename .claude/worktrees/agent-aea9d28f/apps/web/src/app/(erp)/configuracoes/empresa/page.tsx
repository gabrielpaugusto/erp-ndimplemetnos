'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Save,
  CheckCircle,
  AlertCircle,
  FileText,
  MapPin,
  Phone,
  Settings,
  ShieldCheck,
  Plus,
  Trash2,
  Star,
  StarOff,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import AddressBlock from '@/components/address/address-block';
import type { AddressValue } from '@/lib/address';
import { maskCnpj, maskPhone } from '@/lib/masks';
import { apiFetch } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAX_REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI - Microempreendedor Individual',
};

function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

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
  cnaePrincipal: string | null;
  ambienteSefaz: number;
  ambienteNfe: number;
  ambienteNfce: number;
  ambienteNfse: number;
  ambienteSped: number;
  ambienteEsocial: number;
  ambienteReinf: number;
  ambienteDctfweb: number;
  serieNfe: number;
  serieNfce: number;
  proximoNumeroNfe: number;
  proximoNumeroNfce: number;
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

      {/* Código */}
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-semibold text-slate-800">{cnae.cnae}</span>
        {cnae.principal && (
          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded uppercase">
            Principal
          </span>
        )}
      </td>

      {/* Descrição */}
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

      {/* Ações */}
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

// ---------------------------------------------------------------------------
// CertificadoPanel
// ---------------------------------------------------------------------------

interface CertStatus {
  instalado: boolean;
  cn?: string;
  validade?: string;
  diasRestantes?: number;
  vencido?: boolean;
  alertaVencimento?: boolean;
}

function CertificadoPanel({
  companyId,
  onUpdated,
}: {
  companyId: string;
  certValidade: string | null;
  certCn: string | null;
  onUpdated: (data: { certDigitalValidade: string | null; certDigitalCn: string | null }) => void;
}) {
  const [status, setStatus] = useState<CertStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await apiFetch('/api/company/certificado/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ instalado: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async () => {
    setUploadError('');
    setUploadSuccess('');
    if (!file) { setUploadError('Selecione o arquivo .pfx do certificado'); return; }
    if (!senha) { setUploadError('Informe a senha do certificado'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('senha', senha);
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const res = await fetch('/api/company/certificado', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { message?: string }).message || 'Erro ao instalar certificado');
      const typed = data as { cn: string; validade: string; diasRestantes: number };
      setUploadSuccess(
        `Certificado instalado! CN: ${typed.cn} — Validade: ${new Date(typed.validade).toLocaleDateString('pt-BR')} (${typed.diasRestantes} dias restantes)`,
      );
      setFile(null);
      setSenha('');
      if (fileRef.current) fileRef.current.value = '';
      await fetchStatus();
      onUpdated({ certDigitalValidade: typed.validade, certDigitalCn: typed.cn });
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Erro ao instalar certificado');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remover o certificado digital? As transmissões fiscais ficarão indisponíveis.')) return;
    setRemoving(true);
    try {
      await apiFetch('/api/company/certificado', { method: 'DELETE' });
      await fetchStatus();
      onUpdated({ certDigitalValidade: null, certDigitalCn: null });
    } finally {
      setRemoving(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
        Verificando certificado...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status atual */}
      {status?.instalado ? (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg border ${
            status.vencido
              ? 'bg-red-50 border-red-200'
              : status.alertaVencimento
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              status.vencido ? 'bg-red-100' : status.alertaVencimento ? 'bg-amber-100' : 'bg-emerald-100'
            }`}
          >
            {status.vencido ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : status.alertaVencimento ? (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`font-semibold text-sm ${
                status.vencido
                  ? 'text-red-800'
                  : status.alertaVencimento
                  ? 'text-amber-800'
                  : 'text-emerald-800'
              }`}
            >
              {status.vencido
                ? 'Certificado VENCIDO'
                : status.alertaVencimento
                ? 'Certificado próximo do vencimento'
                : 'Certificado instalado e válido'}
            </p>
            {status.cn && (
              <p className="text-xs mt-0.5 text-slate-600 font-mono">{status.cn}</p>
            )}
            {status.validade && (
              <p
                className={`text-xs mt-0.5 ${
                  status.vencido
                    ? 'text-red-700'
                    : status.alertaVencimento
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                Validade: {new Date(status.validade).toLocaleDateString('pt-BR')}
                {status.diasRestantes !== undefined && status.diasRestantes >= 0 && (
                  <span className="ml-1">
                    ({status.diasRestantes} dia{status.diasRestantes !== 1 ? 's' : ''} restante
                    {status.diasRestantes !== 1 ? 's' : ''})
                  </span>
                )}
                {status.vencido && <span className="ml-1 font-semibold">— VENCIDO</span>}
              </p>
            )}
          </div>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-red-600 hover:text-red-700 border border-red-300 hover:bg-red-50 px-2 py-1 rounded transition-colors shrink-0"
          >
            {removing ? 'Removendo...' : 'Remover'}
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-700">Nenhum certificado instalado</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Sem o certificado A1, não é possível transmitir NF-e, NFC-e ou obrigações acessórias à SEFAZ.
            </p>
          </div>
        </div>
      )}

      {/* Upload form */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">
          {status?.instalado ? 'Substituir certificado' : 'Instalar certificado A1'}
        </h3>
        <p className="text-xs text-slate-500">
          Faça upload do arquivo{' '}
          <code className="px-1 bg-slate-100 rounded font-mono">.pfx</code> ou{' '}
          <code className="px-1 bg-slate-100 rounded font-mono">.p12</code> emitido pela autoridade
          certificadora (ex: Serpro, Certisign, Valid, Soluti).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Arquivo do certificado (.pfx / .p12) *
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setUploadError('');
                setUploadSuccess('');
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-300 rounded-lg cursor-pointer"
            />
            {file && (
              <p className="text-[11px] text-slate-500 mt-1">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Senha do certificado *
            </label>
            <div className="relative">
              <input
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setUploadError('');
                  setUploadSuccess('');
                }}
                placeholder="Senha definida na emissão do certificado"
                className="input pr-20 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {uploadSuccess}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {uploading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Validando e instalando...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              {status?.instalado ? 'Substituir certificado' : 'Instalar certificado'}
            </>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Como obter o arquivo .pfx do seu certificado A1:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>Acesse o site da sua AC (Serpro, Certisign, Valid, Soluti, etc.)</li>
          <li>Faça login com seu certificado e localize a opção de exportar / fazer backup</li>
          <li>Exporte o certificado no formato PKCS#12 (.pfx) com senha de proteção</li>
          <li>Faça upload do arquivo .pfx e informe a senha acima</li>
        </ol>
        <p className="mt-1 text-blue-600">
          O arquivo é armazenado de forma criptografada no servidor. A senha nunca é salva em texto puro.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EmpresaConfigPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'geral' | 'endereco' | 'fiscal' | 'cnaes' | 'nfe'>('geral');

  // CNAE form
  const [newCnae, setNewCnae] = useState('');
  const [newCnaeDesc, setNewCnaeDesc] = useState('');
  const [newCnaePrincipal, setNewCnaePrincipal] = useState(false);
  const [cnaeError, setCnaeError] = useState('');
  const [cnaeAdding, setCnaeAdding] = useState(false);
  const [showAddCnae, setShowAddCnae] = useState(false);

  useEffect(() => {
    apiFetch('/api/company')
      .then((r) => r.json())
      .then((data) => { setCompany(data); setForm(data); })
      .catch(() => setErrorMsg('Erro ao carregar dados da empresa'))
      .finally(() => setLoading(false));
  }, []);

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
      alert(err.message || 'Erro ao remover CNAE');
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
    { id: 'geral',    label: 'Dados Gerais',        icon: Building2   },
    { id: 'endereco', label: 'Endereco',             icon: MapPin      },
    { id: 'fiscal',   label: 'Regime Tributario',   icon: FileText    },
    { id: 'cnaes',    label: 'CNAEs',                icon: Settings    },
    { id: 'nfe',      label: 'NF-e / SEFAZ',        icon: ShieldCheck },
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
        {activeTab !== 'cnaes' && (
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
            <Field label="CNPJ *" hint="14 digitos — deve coincidir com a Receita Federal">
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
            <Field label="Inscricao Estadual *" hint="IE do estado de origem — consta no cadastro SEFAZ estadual">
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
          <div className="flex justify-end pt-2">
            <SaveBtn saving={saving} onSave={handleSave} />
          </div>
        </div>
      )}

      {/* ================================================================
          ABA: REGIME TRIBUTARIO
      ================================================================ */}
      {activeTab === 'fiscal' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Regime Tributario
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Regime Tributario *" hint="Define a apuracao de PIS, COFINS, CSLL, IRPJ e o tipo de SPED gerado">
              <select value={form.taxRegime ?? ''} onChange={(e) => handleChange('taxRegime', e.target.value)} className="input">
                {Object.entries(TAX_REGIME_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 space-y-2">
            <p className="font-medium text-slate-700">Como o Regime Tributario e usado pelo sistema:</p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li><strong>Simples Nacional:</strong> gera DAS, apura SPED simplificado e bloqueia escrituracao de IRPJ separado</li>
              <li><strong>Lucro Presumido:</strong> apura IRPJ/CSLL por percentual de presuncao sobre receita bruta; gera SPED Contribuicoes + ECD/ECF</li>
              <li><strong>Lucro Real:</strong> apura IRPJ/CSLL sobre o lucro contabil ajustado; exige escrituracao contabil completa (ECD) e ECF anual</li>
              <li><strong>MEI:</strong> modalidade simplificada com DASN-SIMEI anual</li>
            </ul>
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn saving={saving} onSave={handleSave} />
          </div>
        </div>
      )}

      {/* ================================================================
          ABA: CNAEs
      ================================================================ */}
      {activeTab === 'cnaes' && (
        <div className="space-y-4">

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">CNAEs — Classificacao Nacional de Atividades Economicas</p>
            <p>
              Cadastre exatamente os CNAEs registrados na Receita Federal (cartao CNPJ). O <strong>CNAE Principal</strong> (marcado com ★)
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
                    {principal.descricao && <span className="text-slate-400"> — {principal.descricao}</span>}
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

            {/* Formulario de adição */}
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
                      <th className="px-4 py-2.5 text-center w-10 text-xs font-semibold text-slate-500">★</th>
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
                    {/* Secundários */}
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
                  CNAE Principal — campo obrigatorio no XML da NF-e e no SPED registro 0000
                </span>
                <span className="flex items-center gap-1.5">
                  <StarOff className="w-3.5 h-3.5" />
                  CNAE Secundario — exigido no eSocial S-1000 e declaracoes de MEI/Simples
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          ABA: NF-e / SEFAZ
      ================================================================ */}
      {activeTab === 'nfe' && (
        <div className="space-y-5">

          {/* ---- Ambientes por Módulo ---- */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" /> Ambientes por Modulo Fiscal
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Cada modulo pode operar de forma independente em Producao ou Homologacao.
                Ex.: NF-e em Producao enquanto SPED ainda esta em Homologacao.
              </p>
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <strong className="text-emerald-700">1 — Producao:</strong>
                <span className="text-slate-500">transmissoes reais com validade juridica</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500 inline-block" />
                <strong className="text-red-700">2 — Homologacao:</strong>
                <span className="text-slate-500">servidores de teste, sem validade</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                { field: 'ambienteNfe',     label: 'NF-e',     hint: 'Nota Fiscal Eletronica (modelo 55)' },
                { field: 'ambienteNfce',    label: 'NFC-e',    hint: 'Nota Fiscal de Consumidor Eletronico (modelo 65)' },
                { field: 'ambienteNfse',    label: 'NFS-e',    hint: 'Nota Fiscal de Servico Eletronica (prefeitura)' },
                { field: 'ambienteSped',    label: 'SPED',     hint: 'EFD-ICMS/IPI, EFD-Contribuicoes, ECD, ECF' },
                { field: 'ambienteEsocial', label: 'e-Social', hint: 'Folha de pagamento e obrigacoes trabalhistas' },
                { field: 'ambienteReinf',   label: 'REINF',    hint: 'EFD-Reinf — retencoes e informacoes da NF' },
                { field: 'ambienteDctfweb', label: 'DCTFWeb',  hint: 'Declaracao de Debitos e Creditos Tributarios Federais' },
              ] as { field: keyof Company; label: string; hint: string }[]).map(({ field, label, hint }) => {
                const val = (form[field] as number) ?? 2;
                const isProd = val === 1;
                return (
                  <div key={field} className={`border rounded-lg p-3 ${isProd ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-800">{label}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isProd ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                        {isProd ? 'PRODUCAO' : 'HOMOLOGACAO'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">{hint}</p>
                    <select
                      value={val}
                      onChange={(e) => handleChange(field, Number(e.target.value))}
                      className="input text-sm"
                    >
                      <option value={2}>2 — Homologacao (Teste)</option>
                      <option value={1}>1 — Producao (Oficial)</option>
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Aviso producao */}
            {Object.entries({
              ambienteNfe: form.ambienteNfe, ambienteNfce: form.ambienteNfce,
              ambienteNfse: form.ambienteNfse, ambienteSped: form.ambienteSped,
              ambienteEsocial: form.ambienteEsocial, ambienteReinf: form.ambienteReinf,
              ambienteDctfweb: form.ambienteDctfweb,
            }).some(([, v]) => v === 1) && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Atencao:</strong> Um ou mais modulos estao configurados para Producao.
                  Certifique-se de que o certificado digital A1 esta instalado antes de transmitir documentos oficiais.
                </span>
              </div>
            )}
          </div>

          {/* ---- Parametros NF-e ---- */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" /> Numeracao e Series NF-e / NFC-e
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Serie NF-e" hint="Normalmente 1. Alterar somente se houver autorizacao da SEFAZ para serie diferente.">
                <input type="number" min={1} max={999} value={form.serieNfe ?? 1} onChange={(e) => handleChange('serieNfe', Number(e.target.value))} className="input" />
              </Field>
              <Field label="Serie NFC-e" hint="Normalmente 1.">
                <input type="number" min={1} max={999} value={form.serieNfce ?? 1} onChange={(e) => handleChange('serieNfce', Number(e.target.value))} className="input" />
              </Field>
              <Field label="Proximo Numero NF-e" hint="Sequencial do proximo documento a ser emitido.">
                <input type="number" min={1} value={form.proximoNumeroNfe ?? 1} onChange={(e) => handleChange('proximoNumeroNfe', Number(e.target.value))} className="input" />
              </Field>
              <Field label="Proximo Numero NFC-e">
                <input type="number" min={1} value={form.proximoNumeroNfce ?? 1} onChange={(e) => handleChange('proximoNumeroNfce', Number(e.target.value))} className="input" />
              </Field>
            </div>
          </div>

          {/* ---- Certificado Digital ---- */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" /> Certificado Digital A1
            </h2>
            <CertificadoPanel
              companyId={company?.id ?? ''}
              certValidade={company?.certDigitalValidade ?? null}
              certCn={company?.certDigitalCn ?? null}
              onUpdated={(data) =>
                setCompany((prev) =>
                  prev ? { ...prev, ...data } : prev,
                )
              }
            />
          </div>

          <div className="flex justify-end pt-2">
            <SaveBtn saving={saving} onSave={handleSave} />
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
