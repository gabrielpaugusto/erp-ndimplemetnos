'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  DollarSign,
  Shield,
  FileText,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EsocialResumo {
  periodo: string;
  empregadosAtivos: number;
  demitidosNoPeriodo: number;
  totalFolhaBruta: number;
  totalFolhaLiquida: number;
  totalFGTS: number;
  totalINSSPatronal: number;
  transmissoesRealizadas: number;
  statusFolha: string;
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

const STATUS_FOLHA: Record<string, { label: string; color: string }> = {
  RASCUNHO:  { label: 'Rascunho',  color: 'bg-slate-100 text-slate-600'   },
  CALCULADA: { label: 'Calculada', color: 'bg-blue-100 text-blue-700'     },
  APROVADA:  { label: 'Aprovada',  color: 'bg-green-100 text-green-700'   },
  PAGA:      { label: 'Paga',      color: 'bg-emerald-100 text-emerald-700' },
  SEM_FOLHA: { label: 'Sem Folha', color: 'bg-amber-100 text-amber-700'   },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EsocialPage() {
  const toast = useToast();

  const [periodo, setPeriodo]         = useState(periodoAtual());
  const [resumo, setResumo]           = useState<EsocialResumo | null>(null);
  const [historico, setHistorico]     = useState<Transmissao[]>([]);
  const [loading, setLoading]         = useState(false);
  const [sending, setSending]         = useState(false);
  const [previewing, setPreviewing]   = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resumoRes, histRes] = await Promise.all([
        apiFetch(`/api/esocial/dashboard?periodo=${periodo}`),
        apiFetch('/api/esocial/historico?limit=10'),
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
      const res = await apiFetch(`/api/esocial/enviar?periodo=${periodo}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`eSocial enviado com sucesso — ${data.totalEventos} evento(s)`);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao enviar eSocial');
      }
    } catch {
      toast.error('Erro ao enviar eSocial');
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await apiFetch(`/api/esocial/preview/s1200?periodo=${periodo}`);
      if (res.ok) setPreviewData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setPreviewing(false);
    }
  };

  const statusFolha =
    resumo ? (STATUS_FOLHA[resumo.statusFolha] ?? STATUS_FOLHA.SEM_FOLHA) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">eSocial</h1>
          <p className="text-sm text-slate-500 mt-1">
            Transmissão de eventos periódicos ao eSocial (S-1200, S-1210, S-1299)
          </p>
        </div>
        {statusFolha && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusFolha.color}`}>
            Folha: {statusFolha.label}
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
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-end gap-2 mt-4">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>

            <button
              onClick={handlePreview}
              disabled={previewing}
              className="px-3 py-2 text-sm border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {previewing ? 'Carregando...' : 'Preview S-1200'}
            </button>

            <button
              onClick={handleEnviar}
              disabled={sending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {sending
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {sending ? 'Enviando...' : 'Enviar eSocial'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Empregados Ativos */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <p className="text-xs text-slate-500">Empregados Ativos</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{resumo.empregadosAtivos}</p>
            {resumo.demitidosNoPeriodo > 0 && (
              <p className="text-xs text-red-500 mt-1">
                {resumo.demitidosNoPeriodo} desligamento(s) no período
              </p>
            )}
          </div>

          {/* Folha Bruta */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-slate-500">Total Folha Bruta</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmtCurrency(resumo.totalFolhaBruta)}</p>
            <p className="text-xs text-slate-400 mt-1">
              Líquido: {fmtCurrency(resumo.totalFolhaLiquida)}
            </p>
          </div>

          {/* FGTS */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-slate-500">FGTS do Período</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmtCurrency(resumo.totalFGTS)}</p>
          </div>

          {/* INSS Patronal */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-violet-600" />
              <p className="text-xs text-slate-500">INSS Patronal</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {fmtCurrency(resumo.totalINSSPatronal)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {resumo.transmissoesRealizadas} transmissão(ões)
            </p>
          </div>
        </div>
      )}

      {/* Preview S-1200 table */}
      {previewData && previewData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Preview S-1200 — {previewData.length} trabalhador(es)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 px-3">CPF</th>
                  <th className="text-left py-2 px-3">Matrícula</th>
                  <th className="text-right py-2 px-3">Salário Base</th>
                  <th className="text-right py-2 px-3">Total Bruto</th>
                  <th className="text-right py-2 px-3">INSS</th>
                  <th className="text-right py-2 px-3">IRRF</th>
                  <th className="text-right py-2 px-3">Líquido</th>
                  <th className="text-right py-2 px-3">FGTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-xs">{e.dados.cpfTrab}</td>
                    <td className="py-2 px-3 text-xs">{e.dados.matricula}</td>
                    <td className="py-2 px-3 text-right">
                      {fmtCurrency(parseFloat(e.dados.vrSalFx || '0'))}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {fmtCurrency(parseFloat(e.dados.totalBruto || '0'))}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {fmtCurrency(parseFloat(e.dados.vrInss || '0'))}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {fmtCurrency(parseFloat(e.dados.vrIrrf || '0'))}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                      {fmtCurrency(parseFloat(e.dados.totalLiquido || '0'))}
                    </td>
                    <td className="py-2 px-3 text-right text-blue-700">
                      {fmtCurrency(parseFloat(e.dados.vrFgts || '0'))}
                    </td>
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
            Nenhuma folha de pagamento encontrada para a competência selecionada.
          </p>
        </div>
      )}
    </div>
  );
}
