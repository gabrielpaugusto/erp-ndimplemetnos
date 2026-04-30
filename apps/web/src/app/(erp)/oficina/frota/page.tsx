'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Car, Truck, Plus, Search, X, RefreshCw, CheckCircle2,
  AlertTriangle, Calendar, Shield, ShieldOff, ExternalLink,
  ChevronDown, ChevronUp, Wrench, FileText, ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

// ── Tipos OS ────────────────────────────────────────────────────────────────

interface OsResumo {
  id: string;
  numero: string;
  status: string;
  type: string;
  defeitoRelatado: string;
  dataEntrada: string;
  dataEntrega?: string | null;
  valorTotal?: string | number | null;
}

const OS_STATUS_BADGE: Record<string, string> = {
  ORCAMENTO:        'bg-slate-100 text-slate-600',
  AGUARD_APROVACAO: 'bg-sky-100 text-sky-700',
  APROVADA:         'bg-violet-100 text-violet-700',
  EM_EXECUCAO:      'bg-rose-100 text-rose-700',
  AGUARD_PECAS:     'bg-amber-100 text-amber-700',
  CONCLUIDA:        'bg-emerald-100 text-emerald-700',
  FATURADA:         'bg-blue-100 text-blue-700',
  CANCELADA:        'bg-red-100 text-red-600',
  VENDA_PERDIDA:    'bg-gray-100 text-gray-500',
};

const OS_STATUS_LABELS: Record<string, string> = {
  ORCAMENTO:        'Orçamento',
  AGUARD_APROVACAO: 'Ag. Aprovação',
  APROVADA:         'Aprovada',
  EM_EXECUCAO:      'Em Execução',
  AGUARD_PECAS:     'Ag. Peças',
  CONCLUIDA:        'Concluída',
  FATURADA:         'Faturada',
  CANCELADA:        'Cancelada',
  VENDA_PERDIDA:    'Venda Perdida',
};

const OS_TYPE_ICON: Record<string, string> = {
  MECANICA: '🔧', CALDERARIA: '⚙️', PINTURA: '🎨',
  MISTA: '🔀', GARANTIA: '🛡️', INSTALACAO: '🏗️', INTERNA: '🏭',
};

// ── Tipos ────────────────────────────────────────────────────────────────────

type TipoEquipamento = 'CAMINHAO' | 'SEMIRREBOQUE' | 'REBOQUE' | 'CARROCERIA';

interface Equipamento {
  id: string;
  tipo: TipoEquipamento;
  marca: string | null;
  modelo: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string | null;
  chassi: string | null;
  placa: string | null;
  serialNumber: string | null;
  renavam: string | null;
  seguro: boolean;
  seguradoraNome: string | null;
  vigenciaSeguro: string | null;
  dataProximaRevisao: string | null;
  kmAtual: number | null;
  ativo: boolean;
  proprietario?: { razaoSocial: string; id: string } | null;
  _count?: { ordensServico: number };
}

interface FrotaForm {
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: string;
  anoModelo: string;
  cor: string;
  chassi: string;
  placa: string;
  serialNumber: string;
  renavam: string;
  seguro: boolean;
  seguradoraNome: string;
  vigenciaSeguro: string;
  dataProximaRevisao: string;
  kmAtual: string;
  observations: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoEquipamento, string> = {
  CAMINHAO:     'Caminhão',
  SEMIRREBOQUE: 'Semirreboque',
  REBOQUE:      'Reboque',
  CARROCERIA:   'Carroceria',
};

const TIPO_COLORS: Record<TipoEquipamento, string> = {
  CAMINHAO:     'bg-blue-100 text-blue-700',
  SEMIRREBOQUE: 'bg-violet-100 text-violet-700',
  REBOQUE:      'bg-amber-100 text-amber-700',
  CARROCERIA:   'bg-emerald-100 text-emerald-700',
};

function isSeguroVencendo(vigencia: string | null): boolean {
  if (!vigencia) return false;
  const diff = new Date(vigencia).getTime() - Date.now();
  return diff > 0 && diff < 30 * 86400000; // vence em < 30 dias
}

function isSeguroVencido(vigencia: string | null): boolean {
  if (!vigencia) return false;
  return new Date(vigencia).getTime() < Date.now();
}

function isRevisaoProxima(data: string | null): boolean {
  if (!data) return false;
  const diff = new Date(data).getTime() - Date.now();
  return diff > 0 && diff < 15 * 86400000; // revisão em < 15 dias
}

function isRevisaoAtrasada(data: string | null): boolean {
  if (!data) return false;
  return new Date(data).getTime() < Date.now();
}

function fmtDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('pt-BR');
}

function defaultForm(): FrotaForm {
  return {
    tipo: 'CAMINHAO', marca: '', modelo: '', anoFabricacao: '', anoModelo: '',
    cor: '', chassi: '', placa: '', serialNumber: '', renavam: '',
    seguro: false, seguradoraNome: '', vigenciaSeguro: '', dataProximaRevisao: '',
    kmAtual: '', observations: '',
  };
}

function getCompanyId(): string {
  try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.company?.id ?? ''; } catch { return ''; }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function FrotaPage() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [tipoFilter, setTipoFilter]     = useState<TipoEquipamento | ''>('');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState<FrotaForm>(defaultForm());
  const [submitting, setSubmitting]     = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  // Histórico de OS por equipamento
  const [osHistory, setOsHistory]       = useState<Record<string, OsResumo[]>>({});
  const [loadingOs, setLoadingOs]       = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const companyId = getCompanyId();
    try {
      const res = await apiFetch(
        `/api/equipamentos?companyId=${companyId}&limit=200&include=proprietario,_count`,
      );
      if (res.ok) {
        const data = await res.json();
        setEquipamentos(Array.isArray(data) ? data : (data.data ?? []));
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = equipamentos.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || [e.placa, e.chassi, e.marca, e.modelo, e.renavam, e.serialNumber]
      .some(v => v?.toLowerCase().includes(q));
    const matchTipo = !tipoFilter || e.tipo === tipoFilter;
    return matchSearch && matchTipo;
  });

  // Alertas de seguro/revisão
  const alertas = equipamentos.filter(e =>
    isSeguroVencido(e.vigenciaSeguro) || isSeguroVencendo(e.vigenciaSeguro) ||
    isRevisaoAtrasada(e.dataProximaRevisao) || isRevisaoProxima(e.dataProximaRevisao),
  );

  const openCreate = () => { setEditId(null); setForm(defaultForm()); setShowForm(true); };

  const openEdit = (e: Equipamento) => {
    setEditId(e.id);
    setForm({
      tipo: e.tipo,
      marca: e.marca ?? '', modelo: e.modelo ?? '',
      anoFabricacao: e.anoFabricacao?.toString() ?? '',
      anoModelo: e.anoModelo?.toString() ?? '',
      cor: e.cor ?? '', chassi: e.chassi ?? '', placa: e.placa ?? '',
      serialNumber: e.serialNumber ?? '', renavam: e.renavam ?? '',
      seguro: e.seguro, seguradoraNome: e.seguradoraNome ?? '',
      vigenciaSeguro: e.vigenciaSeguro ? e.vigenciaSeguro.slice(0, 10) : '',
      dataProximaRevisao: e.dataProximaRevisao ? e.dataProximaRevisao.slice(0, 10) : '',
      kmAtual: e.kmAtual?.toString() ?? '', observations: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tipo) return;
    setSubmitting(true);
    const companyId = getCompanyId();
    const payload = {
      companyId,
      tipo: form.tipo,
      marca: form.marca || null,
      modelo: form.modelo || null,
      anoFabricacao: form.anoFabricacao ? Number(form.anoFabricacao) : null,
      anoModelo: form.anoModelo ? Number(form.anoModelo) : null,
      cor: form.cor || null,
      chassi: form.chassi || null,
      placa: form.placa ? form.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
      serialNumber: form.serialNumber || null,
      renavam: form.renavam || null,
      seguro: form.seguro,
      seguradoraNome: form.seguradoraNome || null,
      vigenciaSeguro: form.vigenciaSeguro || null,
      dataProximaRevisao: form.dataProximaRevisao || null,
      kmAtual: form.kmAtual ? Number(form.kmAtual) : null,
      observations: form.observations || null,
    };
    try {
      const res = editId
        ? await apiFetch(`/api/equipamentos/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch('/api/equipamentos', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Erro ao salvar');
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar equipamento');
    } finally { setSubmitting(false); }
  };

  const setField = (k: keyof FrotaForm, v: any) => setForm(p => ({ ...p, [k]: v }));

  // Expande card e carrega histórico de OS (lazy)
  const handleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && !osHistory[next]) {
      setLoadingOs(p => ({ ...p, [next]: true }));
      apiFetch(`/api/service-orders?equipamentoId=${next}&limit=6`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then(d => setOsHistory(p => ({ ...p, [next]: d.data ?? [] })))
        .catch(() => setOsHistory(p => ({ ...p, [next]: [] })))
        .finally(() => setLoadingOs(p => ({ ...p, [next]: false })));
    }
  };

  // ── KPI Cards ───────────────────────────────────────────────────────────────
  const totalAtivos   = equipamentos.filter(e => e.ativo).length;
  const totalSeguros  = equipamentos.filter(e => e.seguro && !isSeguroVencido(e.vigenciaSeguro)).length;
  const totalAlertas  = alertas.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Frota</h1>
          <p className="text-slate-500 mt-1">Veículos, reboques e implementos cadastrados</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Equipamento
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Equipamentos Ativos', value: totalAtivos,          icon: Truck,         color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Com Seguro Vigente',  value: totalSeguros,         icon: Shield,        color: 'text-emerald-600', bg: 'bg-emerald-50'},
          { label: 'Alertas Pendentes',   value: totalAlertas,         icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: 'Total Cadastrados',   value: equipamentos.length,  icon: Car,           color: 'text-slate-600',  bg: 'bg-slate-100' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`${bg} p-2.5 rounded-lg`}><Icon className={`w-5 h-5 ${color}`} /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">{alertas.length} alerta(s) de seguro/revisão</p>
          </div>
          {alertas.slice(0, 5).map(e => (
            <div key={e.id} className="flex items-center gap-3 text-xs text-amber-700">
              <span className={`px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[e.tipo]}`}>{TIPO_LABELS[e.tipo]}</span>
              <span className="font-semibold">{e.placa ?? e.serialNumber ?? e.chassi ?? e.id.slice(0, 8)}</span>
              {e.marca && <span>{e.marca} {e.modelo}</span>}
              <span className="ml-auto flex gap-2">
                {(isSeguroVencido(e.vigenciaSeguro) || isSeguroVencendo(e.vigenciaSeguro)) && (
                  <span className={`px-2 py-0.5 rounded-full font-medium ${isSeguroVencido(e.vigenciaSeguro) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    Seguro {isSeguroVencido(e.vigenciaSeguro) ? 'vencido' : 'vence em breve'}
                  </span>
                )}
                {(isRevisaoAtrasada(e.dataProximaRevisao) || isRevisaoProxima(e.dataProximaRevisao)) && (
                  <span className={`px-2 py-0.5 rounded-full font-medium ${isRevisaoAtrasada(e.dataProximaRevisao) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    Revisão {isRevisaoAtrasada(e.dataProximaRevisao) ? 'atrasada' : 'próxima'}
                  </span>
                )}
              </span>
            </div>
          ))}
          {alertas.length > 5 && <p className="text-xs text-amber-600">…e mais {alertas.length - 5} equipamento(s)</p>}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa, chassi, RENAVAM, marca..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
        </div>
        <select
          value={tipoFilter}
          onChange={e => setTipoFilter(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todos os tipos</option>
          {(Object.keys(TIPO_LABELS) as TipoEquipamento[]).map(t => (
            <option key={t} value={t}>{TIPO_LABELS[t]}</option>
          ))}
        </select>
        <button onClick={load} disabled={loading} className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando frota...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum equipamento encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(eq => {
            const expanded = expandedId === eq.id;
            const seguroVencido  = isSeguroVencido(eq.vigenciaSeguro);
            const seguroVencendo = isSeguroVencendo(eq.vigenciaSeguro);
            const revisaoAtrasada = isRevisaoAtrasada(eq.dataProximaRevisao);
            const revisaoProxima  = isRevisaoProxima(eq.dataProximaRevisao);
            const temAlerta = seguroVencido || seguroVencendo || revisaoAtrasada || revisaoProxima;

            return (
              <div key={eq.id} className={`bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${temAlerta ? 'border-amber-300' : 'border-slate-200'}`}>
                {/* Linha principal */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0">
                    {eq.tipo === 'CAMINHAO' ? <Truck className="w-5 h-5 text-blue-500" /> : <Car className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_COLORS[eq.tipo]}`}>{TIPO_LABELS[eq.tipo]}</span>
                      <span className="text-sm font-bold text-slate-900">
                        {eq.placa ?? eq.serialNumber ?? eq.chassi?.slice(0, 8) ?? '—'}
                      </span>
                      {eq.marca && <span className="text-sm text-slate-600">{eq.marca} {eq.modelo}</span>}
                      {eq.anoFabricacao && <span className="text-xs text-slate-400">{eq.anoFabricacao}/{eq.anoModelo}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {/* Seguro */}
                      <div className={`flex items-center gap-1 text-xs ${
                        seguroVencido ? 'text-red-600' : seguroVencendo ? 'text-amber-600' : eq.seguro ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        {eq.seguro && !seguroVencido ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                        {eq.seguro
                          ? seguroVencido ? `Seguro vencido (${fmtDate(eq.vigenciaSeguro)})`
                            : seguroVencendo ? `Vence ${fmtDate(eq.vigenciaSeguro)}`
                            : eq.seguradoraNome || 'Segurado'
                          : 'Sem seguro'}
                      </div>
                      {/* Revisão */}
                      {eq.dataProximaRevisao && (
                        <div className={`flex items-center gap-1 text-xs ${revisaoAtrasada ? 'text-red-600' : revisaoProxima ? 'text-amber-600' : 'text-slate-400'}`}>
                          <Calendar className="w-3 h-3" />
                          {revisaoAtrasada ? `Revisão atrasada (${fmtDate(eq.dataProximaRevisao)})` : `Revisão: ${fmtDate(eq.dataProximaRevisao)}`}
                        </div>
                      )}
                      {/* KM */}
                      {eq.kmAtual != null && (
                        <span className="text-xs text-slate-400">{eq.kmAtual.toLocaleString('pt-BR')} km</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {temAlerta && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    <button
                      onClick={() => openEdit(eq)}
                      className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleExpand(eq.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50">
                    {/* Dados técnicos */}
                    <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-100">
                      <div>
                        <p className="text-xs text-slate-400 font-medium">RENAVAM</p>
                        <p className="text-sm font-semibold text-slate-800">{eq.renavam ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Chassi</p>
                        <p className="text-sm font-mono text-slate-800 break-all">{eq.chassi ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Seguradora</p>
                        <p className="text-sm text-slate-800">{eq.seguradoraNome ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Vigência Seguro</p>
                        <p className={`text-sm font-semibold ${seguroVencido ? 'text-red-600' : seguroVencendo ? 'text-amber-600' : 'text-slate-800'}`}>
                          {fmtDate(eq.vigenciaSeguro)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Próx. Revisão</p>
                        <p className={`text-sm font-semibold ${revisaoAtrasada ? 'text-red-600' : revisaoProxima ? 'text-amber-600' : 'text-slate-800'}`}>
                          {fmtDate(eq.dataProximaRevisao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Proprietário</p>
                        <p className="text-sm text-slate-800">{eq.proprietario?.razaoSocial ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Cor</p>
                        <p className="text-sm text-slate-800">{eq.cor ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">KM Atual</p>
                        <p className="text-sm text-slate-800">{eq.kmAtual != null ? eq.kmAtual.toLocaleString('pt-BR') + ' km' : '—'}</p>
                      </div>
                    </div>

                    {/* Histórico de manutenções */}
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Histórico de Manutenções</span>
                        </div>
                        <Link
                          href={`/oficina/ordens-servico/nova?equipamentoId=${eq.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Nova OS
                        </Link>
                      </div>

                      {loadingOs[eq.id] ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Carregando histórico...
                        </div>
                      ) : (osHistory[eq.id] ?? []).length === 0 ? (
                        <div className="flex items-center gap-3 py-3 text-sm text-slate-400">
                          <FileText className="w-4 h-4" />
                          Nenhuma OS registrada para este equipamento.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(osHistory[eq.id] ?? []).map((os) => (
                            <div key={os.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                              <span className="text-base shrink-0">{OS_TYPE_ICON[os.type] ?? '🔧'}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link
                                    href={`/oficina/ordens-servico/${os.id}`}
                                    className="text-sm font-bold text-rose-600 hover:underline font-mono"
                                  >
                                    {os.numero}
                                  </Link>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OS_STATUS_BADGE[os.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                    {OS_STATUS_LABELS[os.status] ?? os.status}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {new Date(os.dataEntrada).toLocaleDateString('pt-BR')}
                                    {os.dataEntrega && ` → ${new Date(os.dataEntrega).toLocaleDateString('pt-BR')}`}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{os.defeitoRelatado}</p>
                              </div>
                              <Link
                                href={`/oficina/ordens-servico/${os.id}`}
                                className="shrink-0 p-1 text-slate-400 hover:text-rose-500 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          ))}
                          {(osHistory[eq.id]?.length ?? 0) >= 6 && (
                            <Link
                              href={`/oficina/ordens-servico?equipamentoId=${eq.id}`}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline py-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Ver todas as OS deste equipamento
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-900">
                {editId ? 'Editar Equipamento' : 'Novo Equipamento'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
              {/* Tipo */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo *</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {(Object.keys(TIPO_LABELS) as TipoEquipamento[]).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setField('tipo', t)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${form.tipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {TIPO_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Identificação */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Marca</label>
                  <input value={form.marca} onChange={e => setField('marca', e.target.value)}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Modelo</label>
                  <input value={form.modelo} onChange={e => setField('modelo', e.target.value)}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano Fabricação</label>
                  <input type="number" value={form.anoFabricacao} onChange={e => setField('anoFabricacao', e.target.value)}
                    min={1980} max={2030}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano Modelo</label>
                  <input type="number" value={form.anoModelo} onChange={e => setField('anoModelo', e.target.value)}
                    min={1980} max={2030}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {['CAMINHAO', 'SEMIRREBOQUE', 'REBOQUE'].includes(form.tipo) && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Placa</label>
                    <input value={form.placa} onChange={e => setField('placa', e.target.value.toUpperCase())}
                      maxLength={8} placeholder="ABC1D23"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                {['CAMINHAO', 'SEMIRREBOQUE'].includes(form.tipo) && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chassi (VIN)</label>
                    <input value={form.chassi} onChange={e => setField('chassi', e.target.value.toUpperCase())}
                      maxLength={17} placeholder="17 caracteres"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                {form.tipo === 'CARROCERIA' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Número de Série</label>
                    <input value={form.serialNumber} onChange={e => setField('serialNumber', e.target.value.toUpperCase())}
                      placeholder="ND-2026-001"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
              </div>

              {/* Documentação */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documentação</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500">RENAVAM</label>
                    <input value={form.renavam} onChange={e => setField('renavam', e.target.value)}
                      maxLength={11} placeholder="9 ou 11 dígitos"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Cor</label>
                    <input value={form.cor} onChange={e => setField('cor', e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">KM Atual</label>
                    <input type="number" value={form.kmAtual} onChange={e => setField('kmAtual', e.target.value)}
                      min={0}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Próxima Revisão</label>
                    <input type="date" value={form.dataProximaRevisao} onChange={e => setField('dataProximaRevisao', e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Seguro */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="seguro" checked={form.seguro}
                    onChange={e => setField('seguro', e.target.checked)}
                    className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="seguro" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" /> Possui Seguro
                  </label>
                </div>
                {form.seguro && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-xs text-slate-500">Seguradora</label>
                      <input value={form.seguradoraNome} onChange={e => setField('seguradoraNome', e.target.value)}
                        placeholder="Nome da seguradora"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Vigência</label>
                      <input type="date" value={form.vigenciaSeguro} onChange={e => setField('vigenciaSeguro', e.target.value)}
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Observações</label>
                <textarea value={form.observations} onChange={e => setField('observations', e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editId ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
