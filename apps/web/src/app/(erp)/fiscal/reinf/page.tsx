'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Lock,
  FileText,
  TrendingDown,
  Building2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReinfResumo {
  periodo: string;
  retencoesPJ: number;
  totalInssRetido: number;
  pagamentosPjComIr: number;
  totalIrRetido: number;
  statusPeriodo: string;
  transmissoesRealizadas: number;
}

interface PreviewR2010Item {
  cnpjPrestador: string;
  nomeFantasia?: string;
  valorBruto: number;
  valorInssRetido: number;
  dataCompetencia: string;
}

interface PreviewR4020Item {
  cnpjBeneficiario: string;
  nomeFantasia?: string;
  valorRendimento: number;
  valorIrRetido: number;
  naturezaRendimento: string;
}

interface Transmissao {
  id: string;
  type: string;
  success: boolean;
  errorMessage?: string;
  protocolNumber?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function periodoAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_PERIODO: Record<string, { label: string; color: string }> = {
  ABERTO:   { label: 'Aberto',   color: 'bg-blue-100 text-blue-700'        },
  FECHADO:  { label: 'Fechado',  color: 'bg-emerald-100 text-emerald-700'  },
  ENVIADO:  { label: 'Enviado',  color: 'bg-violet-100 text-violet-700'    },
  SEM_DADOS:{ label: 'Sem Dados',color: 'bg-amber-100 text-amber-700'      },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReinfPage() {
  const toast = useToast();

  const [periodo, setPeriodo]               = useState(periodoAtual());
  const [resumo, setResumo]                 = useState<ReinfResumo | null>(null);
  const [historico, setHistorico]           = useState<Transmissao[]>([]);
  const [loading, setLoading]               = useState(false);
  const [sending, setSending]               = useState(false);
  const [closing, setClosing]               = useState(false);
  const [previewingR2010, setPreviewingR2010] = useState(false);
  const [previewingR4020, setPreviewingR4020] = useState(false);
  const [previewR2010, setPreviewR2010]     = useState<PreviewR2010Item[] | null>(null);
  const [previewR4020, setPreviewR4020]     = useState<PreviewR4020Item[] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resumoRes, histRes] = await Promise.all([
        apiFetch(`/api/reinf/dashboard?periodo=${periodo}`),
        apiFetch('/api/reinf/historico?limit=10'),
      ]);
      if (resumoRes.ok) setResumo(await resumoRes.json());
      if (histRes.ok)   setHistorico(await histRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEnviar = async () => {
    setSending(true);
    try {
      const res = await apiFetch(`/api/reinf/enviar?periodo=${periodo}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`REINF enviado com sucesso — ${data.totalEventos ?? 0} evento(s)`);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao enviar REINF');
      }
    } catch {
      toast.error('Erro ao enviar REINF');
    } finally {
      setSending(false);
    }
  };

  const handleFechar = async () => {
    setClosing(true);
    try {
      const res = await apiFetch(`/api/reinf/fechar?periodo=${periodo}`, { method: 'POST' });
      if (res.ok) {
        toast.success('Período fechado com sucesso');
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao fechar período');
      }
    } catch {
      toast.error('Erro ao fechar período');
    } finally {
      setClosing(false);
    }
  };

  const handlePreviewR2010 = async () => {
    setPreviewingR2010(true);
    try {
      const res = await apiFetch(`/api/reinf/preview/r2010?periodo=${periodo}`);
      if (res.ok) setPreviewR2010(await res.json());
    } catch {
      /* ignore */
    } finally {
      setPreviewingR2010(false);
    }
  };

  const handlePreviewR4020 = async () => {
    setPreviewingR4020(true);
    try {
      const res = await apiFetch(`/api/reinf/preview/r4020?periodo=${periodo}`);
      if (res.ok) setPreviewR4020(await res.json());
    } catch {
      /* ignore */
    } finally {
      setPreviewingR4020(false);
    }
  };

  const statusPeriodo =
    resumo ? (STATUS_PERIODO[resumo.statusPeriodo] ?? STATUS_PERIODO.SEM_DADOS) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">REINF</h1>
          <p className="text-sm text-slate-500 mt-1">
            Escrituração Fiscal Digital de Retenções e Outras Informações Fiscais (R-2010, R-4020, R-9000)
          </p>
        </div>
        {statusPeriodo && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusPeriodo.color}`}>
            Período: {statusPeriodo.label}
          </span>
        )}
      </div>

      {/* Period selector + actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Competência</label>
            <input
              type="month"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-end gap-2 mt-4 flex-wrap">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>

            <button
              onClick={handlePreviewR2010}
              disabled={previewingR2010}
              className="px-3 py-2 text-sm border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {previewingR2010 ? 'Carregando...' : 'Preview R-2010'}
            </button>

            <button
              onClick={handlePreviewR4020}
              disabled={previewingR4020}
              className="px-3 py-2 text-sm border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {previewingR4020 ? 'Carregando...' : 'Preview R-4020'}
            </button>

            <button
              onClick={handleFechar}
              disabled={closing}
              className="px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {closing ? 'Fechando...' : 'Fechar Período'}
            </button>

            <button
              onClick={handleEnviar}
              disabled={sending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {sending
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {sending ? 'Enviando...' : 'Enviar REINF'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Retenções PJ (R-2010) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-rose-600" />
              <p className="text-xs text-slate-500">Retenções PJ (R-2010)</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{resumo.retencoesPJ}</p>
            <p className="text-xs text-slate-400 mt-1">notas com retenção INSS</p>
          </div>

          {/* Total INSS Retido */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <p className="text-xs text-slate-500">Total INSS Retido</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {fmtCurrency(resumo.totalInssRetido)}
            </p>
          </div>

          {/* Pagamentos PJ c/ IR (R-4020) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-slate-500">Pagamentos PJ c/ IR (R-4020)</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{resumo.pagamentosPjComIr}</p>
            <p className="text-xs text-slate-400 mt-1">pagamentos no período</p>
          </div>

          {/* Total IR Retido */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              <p className="text-xs text-slate-500">Total IR Retido</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {fmtCurrency(resumo.totalIrRetido)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {resumo.transmissoesRealizadas} transmissão(ões)
            </p>
          </div>
        </div>
      )}

      {/* Preview R-2010 */}
      {previewR2010 && previewR2010.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Preview R-2010 — {previewR2010.length} registro(s)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 px-3">CNPJ Prestador</th>
                  <th className="text-left py-2 px-3">Nome / Fantasia</th>
                  <th className="text-right py-2 px-3">Valor Bruto</th>
                  <th className="text-right py-2 px-3">INSS Retido</th>
                  <th className="text-left py-2 px-3">Competência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewR2010.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-xs">{item.cnpjPrestador}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{item.nomeFantasia ?? '—'}</td>
                    <td className="py-2 px-3 text-right font-medium">
                      {fmtCurrency(item.valorBruto)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {fmtCurrency(item.valorInssRetido)}
                    </td>
                    <td className="py-2 px-3 text-xs">{item.dataCompetencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview R-4020 */}
      {previewR4020 && previewR4020.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Preview R-4020 — {previewR4020.length} registro(s)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 px-3">CNPJ Beneficiário</th>
                  <th className="text-left py-2 px-3">Nome / Fantasia</th>
                  <th className="text-right py-2 px-3">Valor Rendimento</th>
                  <th className="text-right py-2 px-3">IR Retido</th>
                  <th className="text-left py-2 px-3">Natureza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewR4020.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-xs">{item.cnpjBeneficiario}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{item.nomeFantasia ?? '—'}</td>
                    <td className="py-2 px-3 text-right font-medium">
                      {fmtCurrency(item.valorRendimento)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {fmtCurrency(item.valorIrRetido)}
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-500">{item.naturezaRendimento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transmission history */}
      {historico.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Histórico de Transmissões</h3>
          <div className="space-y-2">
            {historico.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {t.success
                    ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                    : <AlertCircle className="w-4 h-4 text-red-500" />}
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t.type}</p>
                    {t.protocolNumber && (
                      <p className="text-xs text-slate-400">Protocolo: {t.protocolNumber}</p>
                    )}
                    {t.errorMessage && (
                      <p className="text-xs text-red-500">{t.errorMessage}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {new Date(t.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !resumo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Nenhum dado REINF encontrado para a competência selecionada.
          </p>
        </div>
      )}
    </div>
  );
}
