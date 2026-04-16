'use client';

import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtFileSize } from '@/lib/format';

interface CertStatus {
  instalado: boolean;
  cn?: string;
  validade?: string;
  diasRestantes?: number;
  vencido?: boolean;
  alertaVencimento?: boolean;
}

interface Props {
  companyId: string;
  onUpdated?: (data: { certDigitalValidade: string | null; certDigitalCn: string | null }) => void;
}

export function CertificadoPanel({ companyId: _companyId, onUpdated }: Props) {
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
      const res = await apiFetch('/api/company/certificado', {
        method: 'POST',
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
      onUpdated?.({ certDigitalValidade: typed.validade, certDigitalCn: typed.cn });
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
      onUpdated?.({ certDigitalValidade: null, certDigitalCn: null });
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
              Sem o certificado A1, não é possível transmitir NF-e, NFS-e ou obrigações acessórias à SEFAZ.
            </p>
          </div>
        </div>
      )}

      {/* Upload form */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">
          {status?.instalado ? 'Substituir certificado' : 'Instalar certificado'}
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
                {file.name} ({fmtFileSize(file.size)})
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
