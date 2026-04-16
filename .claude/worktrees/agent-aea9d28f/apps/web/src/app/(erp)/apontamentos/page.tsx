'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Square, ChevronDown, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

type TipoVinculo = 'PRODUCAO' | 'OFICINA' | 'CALDERARIA';
type ApontamentoStatus = 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO';

interface ApontamentoAtivo {
  id: string;
  status: ApontamentoStatus;
  inicio: string;
  pausado: boolean;
  productionOrder?: { numero: string; product: { description: string } } | null;
  routingStep?: { description: string; stepNumber: number } | null;
  serviceOrder?: { numero: string; veiculoDescricao: string; veiculoPlaca?: string } | null;
  etapaOs?: { descricao: string; sequencia: number } | null;
  calderariaOrder?: { numero: string; description: string } | null;
  etapaCalderaria?: { descricao: string; sequencia: number } | null;
}

interface OrdemItem {
  id: string;
  numero: string;
  status: string;
  product?: { description: string };
  veiculoDescricao?: string;
  veiculoPlaca?: string;
  person?: { razaoSocial: string };
  description?: string;
  serviceType?: string;
}

interface Ordens {
  producao: OrdemItem[];
  oficina: OrdemItem[];
  calderaria: OrdemItem[];
}

interface Etapa {
  id: string;
  description?: string;
  descricao?: string;
  stepNumber?: number;
  sequencia?: number;
  status?: string;
}

interface PararModalData {
  quantidadeProduzida: string;
  quantidadeRejeitada: string;
  motivoParada: string;
  observations: string;
}

function formatTempo(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tipoLabel(tipo: TipoVinculo) {
  return { PRODUCAO: 'Produção', OFICINA: 'Oficina', CALDERARIA: 'Calderaria' }[tipo];
}

export default function ApontamentosPage() {
  const [ativo, setAtivo] = useState<ApontamentoAtivo | null>(null);
  const [ordens, setOrdens] = useState<Ordens>({ producao: [], oficina: [], calderaria: [] });
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoVinculo>('PRODUCAO');
  const [ordemExpandida, setOrdemExpandida] = useState<string | null>(null);
  const [etapas, setEtapas] = useState<{ [orderId: string]: Etapa[] }>({});
  const [loadingEtapas, setLoadingEtapas] = useState<string | null>(null);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [showPararModal, setShowPararModal] = useState(false);
  const [pararData, setPararData] = useState<PararModalData>({
    quantidadeProduzida: '', quantidadeRejeitada: '', motivoParada: '', observations: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarAtivo = useCallback(async () => {
    try {
      const data = await api<ApontamentoAtivo>('/apontamentos/meu-ativo');
      setAtivo(data);
    } catch {
      setAtivo(null);
    }
  }, []);

  const carregarOrdens = useCallback(async () => {
    try {
      const data = await api<Ordens>('/apontamentos/ordens-disponiveis');
      setOrdens(data);
    } catch {
      setOrdens({ producao: [], oficina: [], calderaria: [] });
    }
  }, []);

  useEffect(() => {
    carregarAtivo();
    carregarOrdens();
  }, [carregarAtivo, carregarOrdens]);

  // Cronômetro
  useEffect(() => {
    if (ativo && ativo.status === 'EM_ANDAMENTO') {
      const inicioMs = new Date(ativo.inicio).getTime();
      timerRef.current = setInterval(() => {
        setTempo(Date.now() - inicioMs);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setTempo(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ativo]);

  const carregarEtapas = async (tipo: TipoVinculo, orderId: string) => {
    if (etapas[orderId]) return;
    setLoadingEtapas(orderId);
    try {
      const data = await api<Etapa[]>(`/apontamentos/etapas/${tipo}/${orderId}`);
      setEtapas((prev) => ({ ...prev, [orderId]: data }));
    } catch {
      setEtapas((prev) => ({ ...prev, [orderId]: [] }));
    } finally {
      setLoadingEtapas(null);
    }
  };

  const toggleOrdem = (tipo: TipoVinculo, orderId: string) => {
    if (ordemExpandida === orderId) {
      setOrdemExpandida(null);
    } else {
      setOrdemExpandida(orderId);
      carregarEtapas(tipo, orderId);
    }
  };

  const iniciar = async (tipo: TipoVinculo, ordem: OrdemItem, etapa: Etapa) => {
    setLoadingAcao(true);
    setError('');
    try {
      const body: any = { tipo };
      if (tipo === 'PRODUCAO') {
        body.productionOrderId = ordem.id;
        body.routingStepId = etapa.id;
      } else if (tipo === 'OFICINA') {
        body.serviceOrderId = ordem.id;
        body.etapaOsId = etapa.id;
      } else {
        body.calderariaOrderId = ordem.id;
        body.etapaCalderariaId = etapa.id;
      }
      await api<unknown>('/apontamentos/iniciar', { method: 'POST', body: JSON.stringify(body) });
      setSuccess('Apontamento iniciado!');
      await carregarAtivo();
      await carregarOrdens();
    } catch (e: any) {
      setError(e.message || 'Erro ao iniciar apontamento');
    } finally {
      setLoadingAcao(false);
    }
  };

  const pausar = async () => {
    setLoadingAcao(true);
    try {
      await api<unknown>('/apontamentos/pausar', { method: 'POST' });
      await carregarAtivo();
    } catch (e: any) {
      setError(e.message || 'Erro ao pausar');
    } finally {
      setLoadingAcao(false);
    }
  };

  const retomar = async () => {
    setLoadingAcao(true);
    try {
      await api<unknown>('/apontamentos/retomar', { method: 'POST' });
      await carregarAtivo();
    } catch (e: any) {
      setError(e.message || 'Erro ao retomar');
    } finally {
      setLoadingAcao(false);
    }
  };

  const parar = async () => {
    setLoadingAcao(true);
    try {
      await api<unknown>('/apontamentos/parar', {
        method: 'POST',
        body: JSON.stringify({
          quantidadeProduzida: pararData.quantidadeProduzida ? Number(pararData.quantidadeProduzida) : undefined,
          quantidadeRejeitada: pararData.quantidadeRejeitada ? Number(pararData.quantidadeRejeitada) : undefined,
          motivoParada: pararData.motivoParada || undefined,
          observations: pararData.observations || undefined,
        }),
      });
      setShowPararModal(false);
      setPararData({ quantidadeProduzida: '', quantidadeRejeitada: '', motivoParada: '', observations: '' });
      setSuccess('Apontamento encerrado com sucesso!');
      setAtivo(null);
      await carregarOrdens();
    } catch (e: any) {
      setError(e.message || 'Erro ao parar');
    } finally {
      setLoadingAcao(false);
    }
  };

  const ordemLabel = (ordem: OrdemItem, tipo: TipoVinculo) => {
    if (tipo === 'PRODUCAO') return `${ordem.numero} — ${ordem.product?.description ?? ''}`;
    if (tipo === 'OFICINA') return `${ordem.numero} — ${ordem.veiculoDescricao ?? ''}${ordem.veiculoPlaca ? ` (${ordem.veiculoPlaca})` : ''}`;
    return `${ordem.numero} — ${ordem.description ?? ''}`;
  };

  const etapaLabel = (e: Etapa) => e.description ?? e.descricao ?? '';
  const etapaSeq = (e: Etapa) => e.stepNumber ?? e.sequencia ?? 0;

  const ordensExibidas = tipoSelecionado === 'PRODUCAO'
    ? ordens.producao
    : tipoSelecionado === 'OFICINA'
      ? ordens.oficina
      : ordens.calderaria;

  const ativoLabel = () => {
    if (!ativo) return '';
    if (ativo.productionOrder) return `${ativo.productionOrder.numero} — ${ativo.productionOrder.product.description}`;
    if (ativo.serviceOrder) return `${ativo.serviceOrder.numero} — ${ativo.serviceOrder.veiculoDescricao}`;
    if (ativo.calderariaOrder) return `${ativo.calderariaOrder.numero} — ${ativo.calderariaOrder.description}`;
    return '';
  };

  const etapaAtivoLabel = () => {
    if (!ativo) return '';
    if (ativo.routingStep) return `Etapa ${ativo.routingStep.stepNumber}: ${ativo.routingStep.description}`;
    if (ativo.etapaOs) return `Etapa ${ativo.etapaOs.sequencia}: ${ativo.etapaOs.descricao}`;
    if (ativo.etapaCalderaria) return `Etapa ${ativo.etapaCalderaria.sequencia}: ${ativo.etapaCalderaria.descricao}`;
    return '';
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Meu Apontamento</h1>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 mb-4">
          <CheckCircle className="w-4 h-4" />
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto text-green-500">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500">✕</button>
        </div>
      )}

      {/* Bloco apontamento ativo */}
      {ativo && (
        <div className={`rounded-xl border-2 p-5 mb-6 ${ativo.status === 'EM_ANDAMENTO' ? 'border-green-400 bg-green-50' : 'border-yellow-400 bg-yellow-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${ativo.status === 'EM_ANDAMENTO' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <span className={`font-semibold text-sm ${ativo.status === 'EM_ANDAMENTO' ? 'text-green-700' : 'text-yellow-700'}`}>
                {ativo.status === 'EM_ANDAMENTO' ? 'EM ANDAMENTO' : 'PAUSADO'}
              </span>
            </div>
            <span className="text-3xl font-mono font-bold text-slate-800">{formatTempo(tempo)}</span>
          </div>
          <p className="font-semibold text-slate-800">{ativoLabel()}</p>
          {etapaAtivoLabel() && <p className="text-sm text-slate-600 mt-1">{etapaAtivoLabel()}</p>}
          <p className="text-xs text-slate-500 mt-1">Início: {new Date(ativo.inicio).toLocaleTimeString('pt-BR')}</p>

          <div className="flex gap-3 mt-4">
            {ativo.status === 'EM_ANDAMENTO' && (
              <button
                onClick={pausar}
                disabled={loadingAcao}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
              >
                <Pause className="w-4 h-4" /> Pausar
              </button>
            )}
            {ativo.status === 'PAUSADO' && (
              <button
                onClick={retomar}
                disabled={loadingAcao}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
              >
                <Play className="w-4 h-4" /> Retomar
              </button>
            )}
            <button
              onClick={() => setShowPararModal(true)}
              disabled={loadingAcao}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              <Square className="w-4 h-4" /> Parar e Registrar
            </button>
          </div>
        </div>
      )}

      {/* Seleção de tipo */}
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-600 mb-2">SELECIONAR ATIVIDADE</p>
        <div className="flex gap-2">
          {(['PRODUCAO', 'OFICINA', 'CALDERARIA'] as TipoVinculo[]).map((tipo) => (
            <button
              key={tipo}
              onClick={() => { setTipoSelecionado(tipo); setOrdemExpandida(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                tipoSelecionado === tipo
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
              }`}
            >
              {tipoLabel(tipo)}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de ordens */}
      <div className="space-y-2">
        {ordensExibidas.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p>Nenhuma ordem em andamento para {tipoLabel(tipoSelecionado)}</p>
          </div>
        )}
        {ordensExibidas.map((ordem) => (
          <div key={ordem.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <button
              onClick={() => toggleOrdem(tipoSelecionado, ordem.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-left"
            >
              <div>
                <span className="font-medium text-slate-800">{ordemLabel(ordem, tipoSelecionado)}</span>
                <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-medium ${
                  ordem.status === 'EM_PRODUCAO' || ordem.status === 'EM_EXECUCAO'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {ordem.status.replace('_', ' ')}
                </span>
              </div>
              {ordemExpandida === ordem.id
                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-slate-400" />
              }
            </button>

            {ordemExpandida === ordem.id && (
              <div className="border-t border-slate-100 bg-slate-50 p-3">
                {loadingEtapas === ordem.id && (
                  <div className="flex items-center gap-2 text-slate-500 py-2 px-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando etapas...
                  </div>
                )}
                {!loadingEtapas && etapas[ordem.id]?.length === 0 && (
                  <p className="text-sm text-slate-400 px-3 py-2">Nenhuma etapa cadastrada nesta ordem.</p>
                )}
                {!loadingEtapas && etapas[ordem.id]?.map((etapa) => (
                  <div key={etapa.id} className="flex items-center justify-between py-2 px-3 hover:bg-white rounded-lg group">
                    <div>
                      <span className="text-xs text-slate-400 mr-2">#{etapaSeq(etapa)}</span>
                      <span className="text-sm text-slate-700">{etapaLabel(etapa)}</span>
                      {etapa.status && etapa.status !== 'PENDENTE' && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                          etapa.status === 'EM_EXECUCAO' ? 'bg-yellow-100 text-yellow-700' :
                          etapa.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {etapa.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {!ativo && etapa.status !== 'CONCLUIDA' && (
                      <button
                        onClick={() => iniciar(tipoSelecionado, ordem, etapa)}
                        disabled={loadingAcao}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {loadingAcao ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Iniciar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal PARAR */}
      {showPararModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Encerrar Apontamento</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Qtd. Produzida</label>
                  <input
                    type="number"
                    value={pararData.quantidadeProduzida}
                    onChange={(e) => setPararData((p) => ({ ...p, quantidadeProduzida: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Qtd. Rejeitada</label>
                  <input
                    type="number"
                    value={pararData.quantidadeRejeitada}
                    onChange={(e) => setPararData((p) => ({ ...p, quantidadeRejeitada: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Motivo de Parada (se houver)</label>
                <input
                  type="text"
                  value={pararData.motivoParada}
                  onChange={(e) => setPararData((p) => ({ ...p, motivoParada: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Falta de material, manutenção..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Observações</label>
                <textarea
                  value={pararData.observations}
                  onChange={(e) => setPararData((p) => ({ ...p, observations: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowPararModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={parar}
                disabled={loadingAcao}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingAcao && <Loader2 className="w-4 h-4 animate-spin" />}
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
