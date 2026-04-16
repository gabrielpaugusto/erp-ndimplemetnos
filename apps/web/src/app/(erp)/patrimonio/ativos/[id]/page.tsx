'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { fmtCurrency as formatCurrency, fmtPercent, fmtNumber, fmtFileSize } from '@/lib/format';
import { ArrowLeft, AlertTriangle, X, Wrench, Paperclip, Download, Trash2, Plus, Upload, Printer, ShieldCheck } from 'lucide-react';

interface FixedAsset {
  id: string;
  plaqueta: string;
  descricao: string;
  type: string;
  marca: string | null;
  modelo: string | null;
  numeroserie: string | null;
  localizacao: string | null;
  costCenterCode: string;
  dataAquisicao: string;
  fornecedor: string | null;
  notaFiscal: string | null;
  valorAquisicao: number;
  vidaUtilMeses: number;
  taxaDepreciacaoMensal: number;
  valorDepreciacaoAcumulada: number;
  valorResidual: number;
  mesInicioDepreciacao: string;
  ultimaDepreciacaoEm: string | null;
  status: string;
  dataBaixa: string | null;
  motivoBaixa: string | null;
  observacoes: string | null;
  createdAt: string;
  depreciacoes: Depreciation[];
  // CIAP — A10
  ciapAtivo: boolean;
  icmsNaEntrada: number | null;
  parcelasIcmsCiap: number;
  parcelasApropriadas: number;
  nfeEntradaChave: string | null;
  nfeEntradaNumero: string | null;
}

interface CiapMovimentoFront {
  ano: number;
  mes: number;
  parcelaNumero: number;
  valorCredito: number;
  aproveitado: boolean;
  processadoEm: string | null;
}

interface CiapSaldo {
  ciapAtivo: boolean;
  icmsNaEntrada: number;
  parcelasTotal: number;
  parcelasAproveitadas: number;
  parcelasRestantes: number;
  valorParcela: number;
  totalAproveitado: number;
  creditoRestante: number;
  movimentos: CiapMovimentoFront[];
}

interface Depreciation {
  id: string;
  ano: number;
  mes: number;
  valorDepreciacao: number;
  valorAcumulado: number;
  valorResidual: number;
  processadoEm: string;
}

interface Maintenance {
  id: string;
  numero: string;
  type: string;
  status: string;
  local: string;
  dataAbertura: string;
  dataEnvio: string | null;
  dataRetornoPrevista: string | null;
  dataRetornoReal: string | null;
  dataConclusao: string | null;
  fornecedorNome: string | null;
  notaFiscalRemessa: string | null;
  notaFiscalRetorno: string | null;
  notaFiscalServico: string | null;
  valorServico: number | null;
  valorPecas: number | null;
  descricaoProblema: string | null;
  descricaoServico: string | null;
  observacoes: string | null;
  anexos: MaintenanceAttachment[];
  _count?: { anexos: number };
}

interface MaintenanceAttachment {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  MAQUINA_EQUIPAMENTO: 'Máquina/Equipamento',
  VEICULO: 'Veículo',
  MOVEL_UTENSILIO: 'Móvel/Utensílio',
  IMOVEL: 'Imóvel',
  INFORMATICA: 'Informática',
  FERRAMENTA: 'Ferramenta',
  OUTRO: 'Outro',
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  ATIVO: { label: 'Ativo', class: 'bg-green-100 text-green-800' },
  BAIXADO: { label: 'Baixado', class: 'bg-gray-100 text-gray-600' },
  EM_MANUTENCAO: { label: 'Em Manutenção', class: 'bg-yellow-100 text-yellow-800' },
};

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva',
  PREDITIVA: 'Preditiva',
  LUBRIFICACAO: 'Lubrificação',
  CALIBRACAO: 'Calibração',
  INSPECAO: 'Inspeção',
  OUTRO: 'Outro',
};

const MAINTENANCE_STATUS_BADGES: Record<string, string> = {
  ABERTA: 'bg-blue-100 text-blue-800',
  EM_EXECUCAO: 'bg-yellow-100 text-yellow-800',
  AGUARDANDO_RETORNO: 'bg-orange-100 text-orange-800',
  CONCLUIDA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-gray-100 text-gray-500',
};

const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_RETORNO: 'Ag. Retorno',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const CC_LABELS: Record<string, string> = {
  CC_IND: 'Industrial',
  CC_COM: 'Comercial',
  CC_OFI: 'Oficina',
  CC_ADM: 'Administrativo',
  CC_FI: 'F&I',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatFileSize(bytes: number): string {
  return fmtFileSize(bytes);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || '—'}</dd>
    </div>
  );
}

// ---- Nova Manutenção Modal ----
function NovaManutencaoModal({
  assetId,
  onClose,
  onCreated,
}: {
  assetId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    assetId,
    type: 'CORRETIVA',
    local: 'INTERNA',
    dataEnvio: '',
    dataRetornoPrevista: '',
    fornecedorNome: '',
    notaFiscalRemessa: '',
    descricaoProblema: '',
    observacoes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await apiFetch('/api/patrimonio/manutencoes', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Nova Manutenção</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Local <span className="text-red-500">*</span>
            </label>
            <select
              value={form.local}
              onChange={e => setForm(prev => ({ ...prev, local: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="INTERNA">Interna</option>
              <option value="EXTERNA">Externa</option>
            </select>
          </div>
        </div>

        {form.local === 'EXTERNA' && (
          <div className="space-y-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs font-semibold text-orange-700 uppercase">Dados da Manutenção Externa</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data de Envio</label>
                <input
                  type="date"
                  value={form.dataEnvio}
                  onChange={e => setForm(prev => ({ ...prev, dataEnvio: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Retorno Previsto</label>
                <input
                  type="date"
                  value={form.dataRetornoPrevista}
                  onChange={e => setForm(prev => ({ ...prev, dataRetornoPrevista: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fornecedor</label>
              <input
                type="text"
                value={form.fornecedorNome}
                onChange={e => setForm(prev => ({ ...prev, fornecedorNome: e.target.value }))}
                placeholder="Nome do fornecedor..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">NF de Remessa</label>
              <input
                type="text"
                value={form.notaFiscalRemessa}
                onChange={e => setForm(prev => ({ ...prev, notaFiscalRemessa: e.target.value }))}
                placeholder="Número da NF de saída..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Problema</label>
          <textarea
            rows={3}
            value={form.descricaoProblema}
            onChange={e => setForm(prev => ({ ...prev, descricaoProblema: e.target.value }))}
            placeholder="Descreva o problema ou motivo da manutenção..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea
            rows={2}
            value={form.observacoes}
            onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
            placeholder="Observações adicionais..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? 'Criando...' : 'Criar Manutenção'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Impressão da Ficha de Manutenção ----
function printMaintenanceFicha(detail: Maintenance, assetPlaqueta: string, assetDescricao: string) {
  const fmt = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
  const cur = (v: number | null) => v != null ? formatCurrency(v) : '—';

  const TYPE_L: Record<string, string> = {
    PREVENTIVA: 'Preventiva', CORRETIVA: 'Corretiva', PREDITIVA: 'Preditiva',
    LUBRIFICACAO: 'Lubrificação', CALIBRACAO: 'Calibração', INSPECAO: 'Inspeção', OUTRO: 'Outro',
  };
  const STATUS_L: Record<string, string> = {
    ABERTA: 'Aberta', EM_EXECUCAO: 'Em Execução', AGUARDANDO_RETORNO: 'Aguardando Retorno',
    CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
  };

  const valorTotal =
    (detail.valorServico != null ? Number(detail.valorServico) : 0) +
    (detail.valorPecas != null ? Number(detail.valorPecas) : 0);

  const row = (label: string, value: string) =>
    `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>`;

  const section = (title: string, content: string) =>
    `<div class="section"><div class="section-title">${title}</div>${content}</div>`;

  const textarea = (title: string, text: string | null) =>
    text ? `<div class="section"><div class="section-title">${title}</div><div class="textarea">${text}</div></div>` : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Ficha de Manutenção – ${detail.numero}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 28px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left h1 { font-size: 18px; font-weight: 700; color: #1d4ed8; letter-spacing: 0.5px; }
    .header-left p { font-size: 11px; color: #555; margin-top: 2px; }
    .header-right { text-align: right; font-size: 11px; color: #555; }
    .header-right strong { font-size: 20px; color: #111; display: block; }
    .asset-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; }
    .asset-box .asset-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #3b82f6; font-weight: 700; }
    .asset-box .asset-name { font-size: 15px; font-weight: 700; color: #111; margin-top: 2px; }
    .asset-box .asset-plaqueta { font-size: 11px; color: #555; margin-top: 1px; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; color: #3b82f6; border-bottom: 1px solid #dbeafe; padding-bottom: 4px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 6px; vertical-align: top; }
    td.lbl { width: 160px; font-size: 11px; color: #555; font-weight: 600; white-space: nowrap; }
    td.val { font-size: 12px; color: #111; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
    .textarea { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; font-size: 12px; color: #111; white-space: pre-wrap; line-height: 1.5; min-height: 36px; }
    .nf-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 12px; }
    .nf-box table td.lbl { color: #777; font-weight: 500; }
    .valores-box { display: flex; gap: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 10px 14px; }
    .valor-item { text-align: center; }
    .valor-item .v-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    .valor-item .v-value { font-size: 15px; font-weight: 700; color: #15803d; }
    .valor-item.total .v-value { color: #166534; font-size: 17px; }
    .anexos-list { list-style: none; }
    .anexos-list li { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px; color: #333; display: flex; align-items: center; gap: 6px; }
    .anexos-list li:last-child { border-bottom: none; }
    .clip { display: inline-block; width: 12px; height: 12px; }
    .footer { border-top: 1px solid #ddd; margin-top: 20px; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;
      background: ${detail.status === 'CONCLUIDA' ? '#dcfce7' : detail.status === 'CANCELADA' ? '#f3f4f6' : detail.status === 'ABERTA' ? '#dbeafe' : '#fef9c3'};
      color: ${detail.status === 'CONCLUIDA' ? '#166534' : detail.status === 'CANCELADA' ? '#6b7280' : detail.status === 'ABERTA' ? '#1d4ed8' : '#92400e'};
    }
    @media print {
      body { padding: 10px 14px; }
      @page { margin: 10mm 12mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>FICHA DE MANUTENÇÃO</h1>
      <p>Módulo Patrimônio — Registro de Manutenção</p>
    </div>
    <div class="header-right">
      <strong>${detail.numero}</strong>
      <span class="status-badge">${STATUS_L[detail.status] || detail.status}</span>
    </div>
  </div>

  <div class="asset-box">
    <div class="asset-label">Ativo Patrimonial</div>
    <div class="asset-name">${assetDescricao}</div>
    <div class="asset-plaqueta">Plaqueta: <strong>${assetPlaqueta}</strong></div>
  </div>

  ${section('Identificação', `<table>
    ${row('Número', detail.numero)}
    ${row('Tipo', TYPE_L[detail.type] || detail.type)}
    ${row('Local', detail.local === 'EXTERNA' ? 'Externa (Terceiro)' : 'Interna')}
    ${row('Status', STATUS_L[detail.status] || detail.status)}
    ${detail.fornecedorNome ? row('Fornecedor', detail.fornecedorNome) : ''}
  </table>`)}

  ${section('Datas', `<div class="two-col"><table>
    ${row('Data de Abertura', fmt(detail.dataAbertura))}
    ${detail.dataEnvio ? row('Data de Envio', fmt(detail.dataEnvio)) : ''}
    ${detail.dataRetornoPrevista ? row('Retorno Previsto', fmt(detail.dataRetornoPrevista)) : ''}
    ${detail.dataRetornoReal ? row('Retorno Real', fmt(detail.dataRetornoReal)) : ''}
    ${detail.dataConclusao ? row('Data de Conclusão', fmt(detail.dataConclusao)) : ''}
  </table></div>`)}

  ${(detail.notaFiscalRemessa || detail.notaFiscalRetorno || detail.notaFiscalServico) ? section('Documentos Fiscais', `<div class="nf-box"><table>
    ${detail.notaFiscalRemessa ? row('NF de Remessa', detail.notaFiscalRemessa) : ''}
    ${detail.notaFiscalRetorno ? row('NF de Retorno', detail.notaFiscalRetorno) : ''}
    ${detail.notaFiscalServico ? row('NF do Serviço', detail.notaFiscalServico) : ''}
  </table></div>`) : ''}

  ${(detail.valorServico != null || detail.valorPecas != null) ? section('Valores', `<div class="valores-box">
    ${detail.valorServico != null ? `<div class="valor-item"><div class="v-label">Mão de Obra / Serviço</div><div class="v-value">${cur(Number(detail.valorServico))}</div></div>` : ''}
    ${detail.valorPecas != null ? `<div class="valor-item"><div class="v-label">Peças / Materiais</div><div class="v-value">${cur(Number(detail.valorPecas))}</div></div>` : ''}
    ${detail.valorServico != null && detail.valorPecas != null ? `<div class="valor-item total"><div class="v-label">Total Geral</div><div class="v-value">${cur(valorTotal)}</div></div>` : ''}
  </div>`) : ''}

  ${textarea('Problema Relatado / Solicitação', detail.descricaoProblema)}
  ${textarea('Serviço Realizado / Laudo', detail.descricaoServico)}
  ${textarea('Observações', detail.observacoes)}

  ${detail.anexos && detail.anexos.length > 0 ? section('Anexos', `<ul class="anexos-list">
    ${detail.anexos.map(a => `<li>📎 ${a.originalName} <span style="color:#999">(${fmtFileSize(a.fileSize)})</span></li>`).join('')}
  </ul>`) : ''}

  <div class="footer">
    <span>Impresso em: ${new Date().toLocaleString('pt-BR')}</span>
    <span>ERP — Ficha de Manutenção nº ${detail.numero}</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ---- Detalhe da Manutenção (painel lateral) ----
function MaintenanceDetailPanel({
  maintenance,
  onClose,
  onUpdated,
  assetPlaqueta,
  assetDescricao,
}: {
  maintenance: Maintenance;
  onClose: () => void;
  onUpdated: () => void;
  assetPlaqueta: string;
  assetDescricao: string;
}) {
  const [detail, setDetail] = useState<Maintenance>(maintenance);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showConcluirForm, setShowConcluirForm] = useState(false);
  const [concluirData, setConcluirData] = useState({
    descricaoServico: '',
    valorServico: '',
    valorPecas: '',
    notaFiscalServico: '',
    notaFiscalRetorno: '',
    dataRetornoReal: '',
  });
  const [submittingConcluir, setSubmittingConcluir] = useState(false);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const res = await apiFetch(`/api/patrimonio/manutencoes/${maintenance.id}`);
      const data = await (res as any).json() as Maintenance;
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }, [maintenance.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleConcluir = async () => {
    if (!concluirData.descricaoServico) return;
    setSubmittingConcluir(true);
    try {
      await apiFetch(`/api/patrimonio/manutencoes/${maintenance.id}/concluir`, {
        method: 'POST',
        body: JSON.stringify({
          ...concluirData,
          valorServico: concluirData.valorServico ? parseFloat(concluirData.valorServico) : undefined,
          valorPecas: concluirData.valorPecas ? parseFloat(concluirData.valorPecas) : undefined,
        }),
      });
      setShowConcluirForm(false);
      await loadDetail();
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingConcluir(false);
    }
  };

  const handleUploadAnexo = async (file: File) => {
    setUploadingAnexo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiFetch(`/api/patrimonio/manutencoes/${maintenance.id}/anexos`, {
        method: 'POST',
        body: formData,
      });
      await loadDetail();
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAnexo(false);
    }
  };

  const handleDeleteAnexo = async (attachmentId: string) => {
    try {
      await apiFetch(`/api/patrimonio/manutencoes/anexos/${attachmentId}`, { method: 'DELETE' });
      await loadDetail();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (attachmentId: string, originalName: string) => {
    try {
      const resDownload = await apiFetch(`/api/patrimonio/manutencoes/anexos/${attachmentId}/download`);
      const { url } = await (resDownload as any).json();
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      a.target = '_blank';
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const isAtrasada = detail.dataRetornoPrevista
    ? new Date(detail.dataRetornoPrevista) < new Date() && detail.status !== 'CONCLUIDA' && detail.status !== 'CANCELADA'
    : false;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="bg-white w-full max-w-xl shadow-2xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{detail.numero}</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MAINTENANCE_STATUS_BADGES[detail.status] || 'bg-gray-100'}`}>
                {MAINTENANCE_STATUS_LABELS[detail.status] || detail.status}
              </span>
              {isAtrasada && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  <AlertTriangle className="w-3 h-3" />
                  Atrasada
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {MAINTENANCE_TYPE_LABELS[detail.type] || detail.type} — {detail.local === 'EXTERNA' ? 'Externa' : 'Interna'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printMaintenanceFicha(detail, assetPlaqueta, assetDescricao)}
              title="Imprimir / Salvar PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Dados principais */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Abertura</p>
              <p className="text-gray-900">{formatDate(detail.dataAbertura)}</p>
            </div>
            {detail.dataEnvio && (
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Data Envio</p>
                <p className="text-gray-900">{formatDate(detail.dataEnvio)}</p>
              </div>
            )}
            {detail.dataRetornoPrevista && (
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Retorno Previsto</p>
                <p className={isAtrasada ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                  {formatDate(detail.dataRetornoPrevista)}
                </p>
              </div>
            )}
            {detail.dataRetornoReal && (
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Retorno Real</p>
                <p className="text-gray-900">{formatDate(detail.dataRetornoReal)}</p>
              </div>
            )}
            {detail.dataConclusao && (
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Conclusão</p>
                <p className="text-gray-900">{formatDate(detail.dataConclusao)}</p>
              </div>
            )}
            {detail.fornecedorNome && (
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Fornecedor</p>
                <p className="text-gray-900">{detail.fornecedorNome}</p>
              </div>
            )}
          </div>

          {/* Notas Fiscais */}
          {(detail.notaFiscalRemessa || detail.notaFiscalRetorno || detail.notaFiscalServico) && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
              {detail.notaFiscalRemessa && <p><span className="text-gray-500">NF Remessa:</span> {detail.notaFiscalRemessa}</p>}
              {detail.notaFiscalRetorno && <p><span className="text-gray-500">NF Retorno:</span> {detail.notaFiscalRetorno}</p>}
              {detail.notaFiscalServico && <p><span className="text-gray-500">NF Serviço:</span> {detail.notaFiscalServico}</p>}
            </div>
          )}

          {/* Valores */}
          {(detail.valorServico || detail.valorPecas) && (
            <div className="flex gap-4 p-3 bg-green-50 rounded-lg text-sm">
              {detail.valorServico != null && (
                <div>
                  <p className="text-xs text-gray-500">Serviço</p>
                  <p className="font-semibold text-green-700">{formatCurrency(Number(detail.valorServico))}</p>
                </div>
              )}
              {detail.valorPecas != null && (
                <div>
                  <p className="text-xs text-gray-500">Peças</p>
                  <p className="font-semibold text-green-700">{formatCurrency(Number(detail.valorPecas))}</p>
                </div>
              )}
              {detail.valorServico != null && detail.valorPecas != null && (
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="font-bold text-green-700">{formatCurrency(Number(detail.valorServico) + Number(detail.valorPecas))}</p>
                </div>
              )}
            </div>
          )}

          {/* Descrições */}
          {detail.descricaoProblema && (
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Problema Relatado</p>
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg">{detail.descricaoProblema}</p>
            </div>
          )}
          {detail.descricaoServico && (
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Serviço Realizado</p>
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg">{detail.descricaoServico}</p>
            </div>
          )}
          {detail.observacoes && (
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Observações</p>
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg">{detail.observacoes}</p>
            </div>
          )}

          {/* Anexos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Paperclip className="w-4 h-4" />
                Anexos ({detail.anexos?.length || 0})
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAnexo}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                {uploadingAnexo ? 'Enviando...' : 'Anexar'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAnexo(file);
                  e.target.value = '';
                }}
              />
            </div>
            {detail.anexos && detail.anexos.length > 0 ? (
              <div className="space-y-2">
                {detail.anexos.map(att => (
                  <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{att.originalName}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(att.fileSize)} · {formatDate(att.uploadedAt)}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => handleDownload(att.id, att.originalName)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnexo(att.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-3">Nenhum anexo</p>
            )}
          </div>

          {/* Concluir Manutenção */}
          {detail.status !== 'CONCLUIDA' && detail.status !== 'CANCELADA' && (
            <div className="border-t pt-4">
              {!showConcluirForm ? (
                <button
                  onClick={() => setShowConcluirForm(true)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Concluir Manutenção
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Concluir Manutenção</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Descrição do Serviço <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={concluirData.descricaoServico}
                      onChange={e => setConcluirData(prev => ({ ...prev, descricaoServico: e.target.value }))}
                      placeholder="Descreva o que foi feito..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valor do Serviço</label>
                      <input
                        type="number"
                        step="0.01"
                        value={concluirData.valorServico}
                        onChange={e => setConcluirData(prev => ({ ...prev, valorServico: e.target.value }))}
                        placeholder="0,00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valor das Peças</label>
                      <input
                        type="number"
                        step="0.01"
                        value={concluirData.valorPecas}
                        onChange={e => setConcluirData(prev => ({ ...prev, valorPecas: e.target.value }))}
                        placeholder="0,00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">NF do Serviço</label>
                      <input
                        type="text"
                        value={concluirData.notaFiscalServico}
                        onChange={e => setConcluirData(prev => ({ ...prev, notaFiscalServico: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    {detail.local === 'EXTERNA' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">NF de Retorno</label>
                        <input
                          type="text"
                          value={concluirData.notaFiscalRetorno}
                          onChange={e => setConcluirData(prev => ({ ...prev, notaFiscalRetorno: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    )}
                  </div>
                  {detail.local === 'EXTERNA' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Data de Retorno Real</label>
                      <input
                        type="date"
                        value={concluirData.dataRetornoReal}
                        onChange={e => setConcluirData(prev => ({ ...prev, dataRetornoReal: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConcluirForm(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConcluir}
                      disabled={submittingConcluir || !concluirData.descricaoServico}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      {submittingConcluir ? 'Concluindo...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Aba de Manutenções ----
function MaintenancesTab({ assetId, assetPlaqueta, assetDescricao }: { assetId: string; assetPlaqueta: string; assetDescricao: string }) {
  const [manutencoes, setManutencoes] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState<Maintenance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resMaint = await apiFetch(`/api/patrimonio/manutencoes?assetId=${assetId}&limit=100`);
      const data = await (resMaint as any).json();
      setManutencoes(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const agora = new Date();

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div>
          <h2 className="font-semibold text-gray-800">Manutenções</h2>
          <p className="text-xs text-gray-500 mt-0.5">{manutencoes.length} registro(s)</p>
        </div>
        <button
          onClick={() => setShowNovaModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nova Manutenção
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
      ) : manutencoes.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">
          <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nenhuma manutenção registrada para este ativo.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Número</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Local</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Abertura</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Retorno Previsto</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {manutencoes.map(m => {
                const isAtrasada = m.dataRetornoPrevista
                  ? new Date(m.dataRetornoPrevista) < agora && m.status !== 'CONCLUIDA' && m.status !== 'CANCELADA'
                  : false;
                const valorTotal =
                  (m.valorServico != null ? Number(m.valorServico) : 0) +
                  (m.valorPecas != null ? Number(m.valorPecas) : 0);

                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedMaintenance(m)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${isAtrasada ? 'bg-red-50 hover:bg-red-100' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-blue-600">{m.numero}</td>
                    <td className="px-4 py-2.5">{MAINTENANCE_TYPE_LABELS[m.type] || m.type}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${m.local === 'EXTERNA' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.local === 'EXTERNA' ? 'Externa' : 'Interna'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MAINTENANCE_STATUS_BADGES[m.status] || 'bg-gray-100'}`}>
                        {MAINTENANCE_STATUS_LABELS[m.status] || m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{formatDate(m.dataAbertura)}</td>
                    <td className="px-4 py-2.5">
                      {m.dataRetornoPrevista ? (
                        <span className={isAtrasada ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {isAtrasada && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {formatDate(m.dataRetornoPrevista)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {valorTotal > 0 ? formatCurrency(valorTotal) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNovaModal && (
        <NovaManutencaoModal
          assetId={assetId}
          onClose={() => setShowNovaModal(false)}
          onCreated={load}
        />
      )}

      {selectedMaintenance && (
        <MaintenanceDetailPanel
          maintenance={selectedMaintenance}
          onClose={() => setSelectedMaintenance(null)}
          onUpdated={load}
          assetPlaqueta={assetPlaqueta}
          assetDescricao={assetDescricao}
        />
      )}
    </div>
  );
}

// ---- Página Principal ----
export default function AtivoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalhes' | 'depreciacoes' | 'manutencoes' | 'ciap'>('detalhes');
  const [ciapSaldo, setCiapSaldo] = useState<CiapSaldo | null>(null);
  const [ciapLoading, setCiapLoading] = useState(false);
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [baixaData, setBaixaData] = useState({ dataBaixa: '', motivoBaixa: '' });
  const [submittingBaixa, setSubmittingBaixa] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resAsset = await apiFetch(`/api/patrimonio/${id}`);
      const data = await (resAsset as any).json() as FixedAsset;
      setAsset(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === 'ciap' && asset?.ciapAtivo && !ciapSaldo) {
      setCiapLoading(true);
      apiFetch(`/api/patrimonio/${asset.id}/ciap`)
        .then(r => (r as any).json())
        .then((data: CiapSaldo) => setCiapSaldo(data))
        .catch(console.error)
        .finally(() => setCiapLoading(false));
    }
  }, [activeTab, asset?.ciapAtivo, asset?.id, ciapSaldo]);

  const handleBaixar = async () => {
    if (!baixaData.dataBaixa || !baixaData.motivoBaixa) return;
    setSubmittingBaixa(true);
    try {
      await apiFetch(`/api/patrimonio/${id}/baixar`, {
        method: 'POST',
        body: JSON.stringify(baixaData),
      });
      setShowBaixaModal(false);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingBaixa(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-100 rounded w-64 animate-pulse" />
        <div className="h-48 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6 text-center text-gray-400">Ativo não encontrado.</div>
    );
  }

  const valorAquisicao = Number(asset.valorAquisicao);
  const valorDeprecAcum = Number(asset.valorDepreciacaoAcumulada);
  const valorResidual = Number(asset.valorResidual);
  const pct = valorAquisicao > 0 ? (valorDeprecAcum / valorAquisicao) * 100 : 0;
  const statusInfo = STATUS_LABELS[asset.status] || { label: asset.status, class: 'bg-gray-100' };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/patrimonio/ativos" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{asset.plaqueta}</h1>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.class}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{asset.descricao}</p>
          </div>
        </div>
        {asset.status !== 'BAIXADO' && (
          <button
            onClick={() => setShowBaixaModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition-colors"
          >
            Dar Baixa
          </button>
        )}
      </div>

      {/* Depreciation progress bar */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progresso de Depreciação</span>
          <span className={`text-sm font-bold ${pct > 80 ? 'text-red-600' : pct > 50 ? 'text-orange-500' : 'text-green-600'}`}>
            {fmtPercent(pct, 1)} depreciado
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-orange-400' : 'bg-green-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Aquisição: {formatCurrency(valorAquisicao)}</span>
          <span>Depreciado: {formatCurrency(valorDeprecAcum)}</span>
          <span>Residual: {formatCurrency(valorResidual)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {[
            { key: 'detalhes', label: 'Dados do Ativo' },
            { key: 'depreciacoes', label: `Depreciações (${asset.depreciacoes.length})` },
            { key: 'manutencoes', label: 'Manutenções' },
            ...(asset.ciapAtivo ? [{ key: 'ciap', label: 'CIAP' }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'detalhes' && (
        <div className="bg-white rounded-lg border p-5 space-y-5">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow label="Plaqueta" value={asset.plaqueta} />
            <InfoRow label="Tipo" value={TYPE_LABELS[asset.type] || asset.type} />
            <InfoRow label="Centro de Custo" value={CC_LABELS[asset.costCenterCode] || asset.costCenterCode} />
            <InfoRow label="Marca" value={asset.marca} />
            <InfoRow label="Modelo" value={asset.modelo} />
            <InfoRow label="Número de Série" value={asset.numeroserie} />
            <InfoRow label="Localização" value={asset.localizacao} />
            <InfoRow label="Fornecedor" value={asset.fornecedor} />
            <InfoRow label="Nota Fiscal" value={asset.notaFiscal} />
            <InfoRow label="Data de Aquisição" value={formatDate(asset.dataAquisicao)} />
            <InfoRow label="Valor de Aquisição" value={formatCurrency(valorAquisicao)} />
            <InfoRow label="Vida Útil" value={`${asset.vidaUtilMeses} meses (${fmtNumber(asset.vidaUtilMeses / 12, 1)} anos)`} />
            <InfoRow label="Taxa Mensal" value={fmtPercent(Number(asset.taxaDepreciacaoMensal) * 100, 4)} />
            <InfoRow label="Início Depreciação" value={formatDate(asset.mesInicioDepreciacao)} />
            <InfoRow label="Última Depreciação" value={formatDate(asset.ultimaDepreciacaoEm)} />
            {asset.dataBaixa && <InfoRow label="Data da Baixa" value={formatDate(asset.dataBaixa)} />}
            {asset.motivoBaixa && <InfoRow label="Motivo da Baixa" value={asset.motivoBaixa} />}
            {asset.observacoes && (
              <div className="col-span-2 md:col-span-3">
                <InfoRow label="Observações" value={asset.observacoes} />
              </div>
            )}
          </dl>
        </div>
      )}

      {activeTab === 'depreciacoes' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          {asset.depreciacoes.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              Nenhuma depreciação registrada ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Mês/Ano</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Deprec. Mensal</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Acumulado</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Valor Residual</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">% Deprec.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asset.depreciacoes.map(dep => {
                    const pctDep = valorAquisicao > 0 ? (Number(dep.valorAcumulado) / valorAquisicao) * 100 : 0;
                    return (
                      <tr key={dep.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">
                          {String(dep.mes).padStart(2, '0')}/{dep.ano}
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(Number(dep.valorDepreciacao))}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(Number(dep.valorAcumulado))}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(Number(dep.valorResidual))}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${pctDep > 80 ? 'bg-red-500' : pctDep > 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(pctDep, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{fmtPercent(pctDep, 1)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'manutencoes' && (
        <MaintenancesTab assetId={id} assetPlaqueta={asset.plaqueta} assetDescricao={asset.descricao} />
      )}

      {/* CIAP Tab — A10 */}
      {activeTab === 'ciap' && (
        <div className="space-y-5">
          {/* CIAP Info banner */}
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-900">CIAP — Controle de Crédito de ICMS do Ativo Permanente</p>
              <p className="text-xs text-violet-700 mt-0.5">Art. 20 LC 87/96 — Crédito do ICMS pago na aquisição em {asset.parcelasIcmsCiap || 48} parcelas mensais iguais. Escriturado no Bloco G do SPED Fiscal.</p>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">ICMS na Entrada</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(Number(asset.icmsNaEntrada ?? 0))}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">Parcelas Total</p>
              <p className="text-xl font-bold text-gray-900">{asset.parcelasIcmsCiap || 48}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">Aproveitadas</p>
              <p className="text-xl font-bold text-emerald-700">{asset.parcelasApropriadas}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">Restantes</p>
              <p className="text-xl font-bold text-violet-700">{Math.max(0, (asset.parcelasIcmsCiap || 48) - asset.parcelasApropriadas)}</p>
            </div>
          </div>

          {/* Progress bar */}
          {(() => {
            const total = asset.parcelasIcmsCiap || 48;
            const done = asset.parcelasApropriadas;
            const pctCiap = total > 0 ? (done / total) * 100 : 0;
            const valorParcela = Number(asset.icmsNaEntrada ?? 0) / total;
            const totalAproveitado = done * valorParcela;
            const restante = Math.max(0, Number(asset.icmsNaEntrada ?? 0) - totalAproveitado);
            return (
              <div className="bg-white rounded-lg border p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progresso CIAP</span>
                  <span className="text-sm font-bold text-violet-700">{fmtPercent(pctCiap, 1)} aproveitado</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(pctCiap, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Aproveitado: {formatCurrency(Math.round(totalAproveitado * 100) / 100)}</span>
                  <span>Parcela mensal: {formatCurrency(Math.round(valorParcela * 100) / 100)}</span>
                  <span>Saldo a apropriar: {formatCurrency(Math.round(restante * 100) / 100)}</span>
                </div>
                {asset.nfeEntradaNumero && (
                  <p className="text-xs text-gray-400 mt-2">NF-e aquisição: {asset.nfeEntradaNumero}{asset.nfeEntradaChave ? ` — Chave: ${asset.nfeEntradaChave.substring(0, 22)}...` : ''}</p>
                )}
              </div>
            );
          })()}

          {/* Movimentos */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Histórico de Apropriações</h3>
              <span className="text-xs text-gray-400">Gerado por Processar CIAP Mensal</span>
            </div>
            {ciapLoading ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">Carregando...</div>
            ) : ciapSaldo && ciapSaldo.movimentos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Mês/Ano</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">Parcela</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Valor Crédito</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ciapSaldo.movimentos.map(mov => (
                      <tr key={`${mov.ano}-${mov.mes}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{String(mov.mes).padStart(2, '0')}/{mov.ano}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{mov.parcelaNumero}/{asset.parcelasIcmsCiap || 48}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-violet-700">{formatCurrency(mov.valorCredito)}</td>
                        <td className="px-4 py-2.5 text-center">
                          {mov.aproveitado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Aproveitado</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pendente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Nenhuma apropriação registrada. Use <strong>Processar CIAP Mensal</strong> em Patrimônio → Relatórios.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Baixa Modal */}
      {showBaixaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Dar Baixa no Ativo</h3>
              <button onClick={() => setShowBaixaModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Esta ação é irreversível. O ativo <strong>{asset.plaqueta}</strong> será marcado como baixado
                e não poderá mais ser editado ou depreciado.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data da Baixa <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={baixaData.dataBaixa}
                  onChange={e => setBaixaData(prev => ({ ...prev, dataBaixa: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da Baixa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={baixaData.motivoBaixa}
                  onChange={e => setBaixaData(prev => ({ ...prev, motivoBaixa: e.target.value }))}
                  placeholder="Ex: Venda, descarte, sinistro..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowBaixaModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleBaixar}
                disabled={submittingBaixa || !baixaData.dataBaixa || !baixaData.motivoBaixa}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {submittingBaixa ? 'Processando...' : 'Confirmar Baixa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
