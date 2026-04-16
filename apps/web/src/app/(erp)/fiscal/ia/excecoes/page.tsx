'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  ChevronDown, ChevronUp, Edit3, ThumbsUp,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Excecao {
  id: string;
  documentType: string;
  documentId: string;
  motivo: string;
  status: 'PENDENTE' | 'RESOLVIDA' | 'IGNORADA';
  resolvidoEm: string | null;
  createdAt: string;
  decision: {
    cfop: string | null;
    cstIcms: string | null;
    cstPis: string | null;
    cstCofins: string | null;
    aliquotaIcms: number | null;
    aliquotaPis: number | null;
    aliquotaCofins: number | null;
    confianca: number;
    raciocinio: string;
    fundamentoLegal: string[];
    alternativas: { cfop: string; raciocinio: string; descartadoPor: string }[];
    alertas: string[];
    createdAt: string;
  } | null;
}

type StatusFilter = 'PENDENTE' | 'RESOLVIDA' | 'IGNORADA' | 'TODAS';

export default function ExcecoesFiscaisPage() {
  const [excecoes, setExcecoes]       = useState<Excecao[]>([]);
  const [filtro, setFiltro]           = useState<StatusFilter>('PENDENTE');
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [salvando, setSalvando]       = useState<string | null>(null);
  const [erro, setErro]               = useState('');
  // Estado do formulário de correção
  const [editando, setEditando]       = useState<string | null>(null);
  const [correcao, setCorrecao]       = useState({ cfop: '', cstIcms: '', cstPis: '', cstCofins: '', aliquotaIcms: '' });

  async function load() {
    setLoading(true);
    setErro('');
    try {
      const q = filtro === 'TODAS' ? '' : `?status=${filtro}`;
      const res = await apiFetch(`/api/fiscal-brain/excecoes${q}`);
      if (!res.ok) { setErro('Erro ao carregar exceções'); return; }
      setExcecoes(await res.json());
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filtro]);

  const toggle = (id: string) => setExpanded((p) => (p === id ? null : id));

  async function aceitar(id: string) {
    setSalvando(id);
    try {
      const res = await apiFetch(`/api/fiscal-brain/excecoes/${id}/resolver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aceitar: true }),
      });
      if (res.ok) { setExcecoes((prev) => prev.filter((e) => e.id !== id)); }
      else setErro('Erro ao resolver exceção');
    } finally {
      setSalvando(null);
    }
  }

  async function corrigir(id: string) {
    setSalvando(id);
    try {
      const res = await apiFetch(`/api/fiscal-brain/excecoes/${id}/resolver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aceitar: false,
          resolucao: {
            cfop:         correcao.cfop || undefined,
            cstIcms:      correcao.cstIcms || undefined,
            cstPis:       correcao.cstPis || undefined,
            cstCofins:    correcao.cstCofins || undefined,
            aliquotaIcms: correcao.aliquotaIcms ? Number(correcao.aliquotaIcms) : undefined,
          },
        }),
      });
      if (res.ok) {
        setExcecoes((prev) => prev.filter((e) => e.id !== id));
        setEditando(null);
      } else setErro('Erro ao corrigir exceção');
    } finally {
      setSalvando(null);
    }
  }

  async function ignorar(id: string) {
    setSalvando(id);
    try {
      const res = await apiFetch(`/api/fiscal-brain/excecoes/${id}/ignorar`, { method: 'PATCH' });
      if (res.ok) { setExcecoes((prev) => prev.filter((e) => e.id !== id)); }
      else setErro('Erro ao ignorar exceção');
    } finally {
      setSalvando(null);
    }
  }

  const statusColors: Record<StatusFilter, string> = {
    PENDENTE:  'bg-amber-100 text-amber-800 border-amber-300',
    RESOLVIDA: 'bg-green-100 text-green-800 border-green-300',
    IGNORADA:  'bg-gray-100 text-gray-600 border-gray-300',
    TODAS:     'bg-gray-100 text-gray-700 border-gray-300',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900">Fila de Exceções Fiscais</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Documentos classificados com confiança abaixo de <strong>92%</strong> ou com erros de validação.
        Revise, corrija se necessário e alimente o aprendizado da IA.
      </p>

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4" /> {erro}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['PENDENTE', 'RESOLVIDA', 'IGNORADA', 'TODAS'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filtro === s ? statusColors[s] : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'TODAS' ? 'Todas' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando exceções...</div>
      ) : excecoes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma exceção {filtro !== 'TODAS' ? filtro.toLowerCase() : ''}</p>
          <p className="text-sm mt-1">A IA está classificando os documentos com alta confiança.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {excecoes.map((ex) => (
            <div
              key={ex.id}
              className={`border rounded-xl overflow-hidden ${
                ex.status === 'PENDENTE' ? 'border-amber-200 bg-amber-50/30' :
                ex.status === 'RESOLVIDA' ? 'border-green-200 bg-green-50/20' :
                'border-gray-200 bg-gray-50/20'
              }`}
            >
              {/* Header */}
              <div className="flex items-start gap-3 px-4 py-3">
                <button onClick={() => toggle(ex.id)} className="flex items-center gap-3 flex-1 text-left">
                  {ex.status === 'PENDENTE'
                    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    : ex.status === 'RESOLVIDA'
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-medium text-gray-600">{ex.documentType}</span>
                      <span className="text-xs text-gray-400">#{ex.documentId.slice(0, 8)}…</span>
                      {ex.decision && (
                        <span className="font-semibold text-sm text-gray-800">CFOP {ex.decision.cfop ?? '—'}</span>
                      )}
                      {ex.decision && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          ex.decision.confianca >= 80 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {ex.decision.confianca}% confiança
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ex.motivo}</p>
                  </div>
                  {expanded === ex.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {/* Ações rápidas (só para PENDENTE) */}
                {ex.status === 'PENDENTE' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => aceitar(ex.id)}
                      disabled={salvando === ex.id}
                      title="Aceitar sugestão da IA"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-60"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Aceitar
                    </button>
                    <button
                      onClick={() => { setEditando(ex.id); setExpanded(ex.id); setCorrecao({ cfop: ex.decision?.cfop ?? '', cstIcms: ex.decision?.cstIcms ?? '', cstPis: ex.decision?.cstPis ?? '', cstCofins: ex.decision?.cstCofins ?? '', aliquotaIcms: String(ex.decision?.aliquotaIcms ?? '') }); }}
                      title="Corrigir e aplicar"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Corrigir
                    </button>
                    <button
                      onClick={() => ignorar(ex.id)}
                      disabled={salvando === ex.id}
                      title="Ignorar"
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Detalhe expandido */}
              {expanded === ex.id && ex.decision && (
                <div className="px-4 pb-4 space-y-4 border-t border-inherit">
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-600 mb-1">Sugestão da IA</p>
                      <Row label="CFOP"       value={ex.decision.cfop ?? '—'} />
                      <Row label="CST ICMS"   value={ex.decision.cstIcms ?? '—'} />
                      <Row label="CST PIS"    value={ex.decision.cstPis ?? '—'} />
                      <Row label="CST COFINS" value={ex.decision.cstCofins ?? '—'} />
                      <Row label="Alíq. ICMS" value={`${ex.decision.aliquotaIcms ?? 0}%`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-600 mb-1">Alternativas avaliadas</p>
                      {ex.decision.alternativas?.length > 0 ? (
                        ex.decision.alternativas.map((alt, i) => (
                          <div key={i} className="text-xs mb-1">
                            <span className="font-mono font-medium">{alt.cfop}</span>
                            <span className="text-gray-400"> — {alt.descartadoPor}</span>
                          </div>
                        ))
                      ) : <p className="text-xs text-gray-400">Nenhuma alternativa avaliada</p>}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Raciocínio</p>
                    <p className="text-sm text-gray-700 bg-white/60 rounded-lg p-3 border border-inherit leading-relaxed">
                      {ex.decision.raciocinio}
                    </p>
                  </div>

                  {ex.decision.fundamentoLegal?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ex.decision.fundamentoLegal.map((f, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{f}</span>
                      ))}
                    </div>
                  )}

                  {ex.decision.alertas?.length > 0 && (
                    <div className="space-y-1">
                      {ex.decision.alertas.map((a, i) => (
                        <p key={i} className="text-xs text-amber-700 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{a}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Formulário de correção */}
                  {editando === ex.id && ex.status === 'PENDENTE' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                      <p className="text-sm font-semibold text-blue-800">Corrigir Classificação</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'CFOP', key: 'cfop', placeholder: 'ex: 6.101' },
                          { label: 'CST ICMS', key: 'cstIcms', placeholder: 'ex: 400' },
                          { label: 'CST PIS', key: 'cstPis', placeholder: 'ex: 01' },
                          { label: 'CST COFINS', key: 'cstCofins', placeholder: 'ex: 01' },
                          { label: 'Alíq. ICMS (%)', key: 'aliquotaIcms', placeholder: 'ex: 12' },
                        ].map(({ label, key, placeholder }) => (
                          <div key={key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                            <input
                              value={(correcao as any)[key]}
                              onChange={(e) => setCorrecao((p) => ({ ...p, [key]: e.target.value }))}
                              placeholder={placeholder}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => corrigir(ex.id)}
                          disabled={salvando === ex.id}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
                        >
                          {salvando === ex.id ? 'Salvando...' : 'Salvar e Aplicar'}
                        </button>
                        <button
                          onClick={() => setEditando(null)}
                          className="px-4 py-2 bg-white text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
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
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
