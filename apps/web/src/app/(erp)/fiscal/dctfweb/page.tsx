'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileOutput,
  Search,
  Send,
  Info,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DctfWebResumo {
  periodo: string;
  fgts: number;
  inssEmpregado: number;
  inssPatronal: number;
  irrf: number;
  inssRetidoNfe: number;
  irRetidoPj: number;
  totalDebitos: number;
  status: string;
  numeroDeclaracao?: string;
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

const STATUS_DCTF: Record<string, { label: string; color: string }> = {
  NAO_GERADA:   { label: 'Não Gerada',   color: 'bg-slate-100 text-slate-600'    },
  GERADA:       { label: 'Gerada',       color: 'bg-blue-100 text-blue-700'      },
  TRANSMITIDA:  { label: 'Transmitida',  color: 'bg-violet-100 text-violet-700'  },
  ATIVA:        { label: 'Ativa',        color: 'bg-emerald-100 text-emerald-700'},
  RETIFICADA:   { label: 'Retificada',   color: 'bg-amber-100 text-amber-700'    },
};

interface TributoCardProps {
  label: string;
  value: number;
  accent: string;
}

function TributoCard({ label, value, accent }: TributoCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`w-1 h-8 rounded-full ${accent} mb-3`} />
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900">{fmtCurrency(value)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DctfWebPage() {
  const toast = useToast();

  const [periodo, setPeriodo]       = useState(periodoAtual());
  const [resumo, setResumo]         = useState<DctfWebResumo | null>(null);
  const [historico, setHistorico]   = useState<Transmissao[]>([]);
  const [loading, setLoading]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const [transmitting, setTransmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resumoRes, histRes] = await Promise.all([
        apiFetch(`/api/dctfweb/dashboard?periodo=${periodo}`),
        apiFetch('/api/dctfweb/historico?limit=10'),
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

  const handleGerar = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch(`/api/dctfweb/gerar?periodo=${periodo}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Declaração gerada — nº ${data.numeroDeclaracao ?? 'N/A'}`);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao gerar declaração');
      }
    } catch {
      toast.error('Erro ao gerar declaração');
    } finally {
      setGenerating(false);
    }
  };

  const handleConsultar = async () => {
    setConsulting(true);
    try {
      const res = await apiFetch(`/api/dctfweb/consultar?periodo=${periodo}`);
      if (res.ok) {
        const data = await res.json();
        setResumo(data);
        toast.info('Dados atualizados com sucesso');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao consultar declaração');
      }
    } catch {
      toast.error('Erro ao consultar declaração');
    } finally {
      setConsulting(false);
    }
  };

  const handleTransmitir = async () => {
    setTransmitting(true);
    try {
      const res = await apiFetch(`/api/dctfweb/transmitir?periodo=${periodo}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`DCTF-Web transmitida ao RFB — protocolo ${data.protocolNumber ?? 'N/A'}`);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao transmitir ao RFB');
      }
    } catch {
      toast.error('Erro ao transmitir ao RFB');
    } finally {
      setTransmitting(false);
    }
  };

  const statusDctf =
    resumo ? (STATUS_DCTF[resumo.status] ?? STATUS_DCTF.NAO_GERADA) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">DCTF-Web</h1>
          <p className="text-sm text-slate-500 mt-1">
            Declaração de Débitos e Créditos Tributários Federais Previdenciários e de Outras Entidades e Fundos
          </p>
        </div>
        {statusDctf && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusDctf.color}`}>
            {statusDctf.label}
          </span>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          A DCTF-Web é gerada automaticamente pelo RFB a partir dos dados transmitidos pelo eSocial e REINF.
          Certifique-se de que os eventos do período estão corretamente transmitidos antes de gerar ou transmitir a declaração.
        </p>
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
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {resumo?.numeroDeclaracao && (
            <div className="mt-4">
              <p className="text-xs text-slate-400">Nº Declaração</p>
              <p className="text-sm font-mono font-medium text-slate-700">{resumo.numeroDeclaracao}</p>
            </div>
          )}

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
              onClick={handleConsultar}
              disabled={consulting}
              className="px-3 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 flex items-center gap-2 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {consulting ? 'Consultando...' : 'Consultar'}
            </button>

            <button
              onClick={handleGerar}
              disabled={generating}
              className="px-3 py-2 text-sm border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 flex items-center gap-2 disabled:opacity-50"
            >
              <FileOutput className="w-4 h-4" />
              {generating ? 'Gerando...' : 'Gerar Declaração'}
            </button>

            <button
              onClick={handleTransmitir}
              disabled={transmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {transmitting
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {transmitting ? 'Transmitindo...' : 'Transmitir ao RFB'}
            </button>
          </div>
        </div>
      </div>

      {/* Tributo cards */}
      {resumo && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <TributoCard label="FGTS"                accent="bg-amber-400"  value={resumo.fgts} />
            <TributoCard label="INSS Empregado"      accent="bg-blue-400"   value={resumo.inssEmpregado} />
            <TributoCard label="INSS Patronal"       accent="bg-violet-400" value={resumo.inssPatronal} />
            <TributoCard label="IRRF"                accent="bg-rose-400"   value={resumo.irrf} />
            <TributoCard label="INSS Retido NF-e"    accent="bg-cyan-400"   value={resumo.inssRetidoNfe} />
            <TributoCard label="IR Retido PJ"        accent="bg-orange-400" value={resumo.irRetidoPj} />
          </div>

          {/* Total Débitos highlight card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 mb-1">Total Débitos do Período</p>
                <p className="text-4xl font-bold text-amber-900">
                  {fmtCurrency(resumo.totalDebitos)}
                </p>
              </div>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <FileOutput className="w-7 h-7 text-amber-600" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transmission history */}
      {historico.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Últimas Transmissões</h3>
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
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <p className="text-sm text-slate-500">
            Nenhuma declaração encontrada para a competência selecionada. Use "Gerar Declaração" para criar uma nova.
          </p>
        </div>
      )}
    </div>
  );
}
