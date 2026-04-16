'use client';

import { useEffect, useState } from 'react';
import { Brain, CheckCircle2, AlertTriangle, Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Decisao {
  id: string;
  documentType: string;
  documentId: string;
  cfop: string | null;
  cstIcms: string | null;
  cstPis: string | null;
  cstCofins: string | null;
  aliquotaIcms: number | null;
  confianca: number;
  autoAplicado: boolean;
  revisadoPor: string | null;
  correcao: Record<string, unknown> | null;
  revisadoEm: string | null;
  fundamentoLegal: string[];
  raciocinio: string;
  alertas: string[];
  createdAt: string;
}

export default function PainelDecisoesPage() {
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [erro, setErro]         = useState('');

  async function load() {
    setLoading(true);
    setErro('');
    try {
      const res = await apiFetch('/api/fiscal-brain/decisoes?limit=100');
      if (!res.ok) { setErro('Erro ao carregar decisões'); return; }
      setDecisoes(await res.json());
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => setExpanded((p) => (p === id ? null : id));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Painel de Decisões — IA Fiscal</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4" /> {erro}
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Auto-aplicado</span>
        <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> Enviado para exceção</span>
        <span className="flex items-center gap-1 text-blue-600"><Clock className="w-3.5 h-3.5" /> Revisado por humano</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando decisões...</div>
      ) : decisoes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma decisão registrada ainda.</p>
          <p className="text-sm mt-1">Use POST /api/fiscal-brain/classificar para classificar um documento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {decisoes.map((d) => (
            <div
              key={d.id}
              className={`border rounded-xl overflow-hidden transition-all ${
                d.correcao ? 'border-blue-200 bg-blue-50/30' :
                d.autoAplicado ? 'border-green-200 bg-green-50/30' :
                'border-amber-200 bg-amber-50/30'
              }`}
            >
              {/* Linha principal */}
              <button
                onClick={() => toggle(d.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
              >
                {d.correcao ? (
                  <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                ) : d.autoAplicado ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                )}

                <span className="font-mono text-xs text-gray-500 w-20 shrink-0">{d.documentType}</span>
                <span className="font-semibold text-sm text-gray-800 w-24 shrink-0">
                  CFOP {d.cfop ?? '—'}
                </span>
                <span className="text-xs text-gray-500 w-16 shrink-0">CST {d.cstIcms ?? '—'}</span>
                <span className="text-xs text-gray-500 w-28 shrink-0">
                  ICMS {d.aliquotaIcms ?? 0}%
                </span>

                {/* Barra de confiança */}
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        d.confianca >= 92 ? 'bg-green-500' :
                        d.confianca >= 75 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${d.confianca}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-10 shrink-0">{d.confianca}%</span>
                </div>

                <span className="text-xs text-gray-400 w-36 shrink-0 text-right">
                  {new Date(d.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                {expanded === d.id
                  ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {/* Detalhe expandido */}
              {expanded === d.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-inherit">
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {/* Classificação */}
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-gray-700 mb-1">Classificação</p>
                      <Row label="CFOP"          value={d.cfop ?? '—'} />
                      <Row label="CST ICMS"      value={d.cstIcms ?? '—'} />
                      <Row label="CST PIS"       value={d.cstPis ?? '—'} />
                      <Row label="CST COFINS"    value={d.cstCofins ?? '—'} />
                      <Row label="Alíq. ICMS"    value={`${d.aliquotaIcms ?? 0}%`} />
                    </div>
                    {/* Metadados */}
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-gray-700 mb-1">Metadados</p>
                      <Row label="Confiança"     value={`${d.confianca}%`} />
                      <Row label="Modo"          value={d.autoAplicado ? 'Automático' : 'Fila exceção'} />
                      {d.revisadoPor && <Row label="Revisado por"  value={d.revisadoPor} />}
                      {d.correcao && <Row label="Corrigido"      value="Sim — ver abaixo" />}
                    </div>
                  </div>

                  {/* Raciocínio */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Raciocínio da IA</p>
                    <p className="text-sm text-gray-700 leading-relaxed bg-white/60 rounded-lg p-3 border border-inherit">
                      {d.raciocinio}
                    </p>
                  </div>

                  {/* Fundamentos legais */}
                  {d.fundamentoLegal?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Fundamentos legais</p>
                      <div className="flex flex-wrap gap-1.5">
                        {d.fundamentoLegal.map((f, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alertas */}
                  {d.alertas?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-600 mb-1">Alertas</p>
                      {d.alertas.map((a, i) => (
                        <p key={i} className="text-xs text-amber-700 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{a}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Correção humana */}
                  {d.correcao && (
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <p className="text-xs font-medium text-blue-700 mb-1">Correção aplicada pelo usuário</p>
                      <pre className="text-xs text-blue-900 font-mono whitespace-pre-wrap">
                        {JSON.stringify(d.correcao, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
