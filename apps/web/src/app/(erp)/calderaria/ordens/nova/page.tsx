'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import {
  ChevronLeft, Save, X, Flame, Scissors, ArrowDownUp, Zap,
  CircleDot, Cog, Thermometer, Wind, Boxes, FileText, Clock,
  Settings, Wrench, PackagePlus, Package, Briefcase,
  DollarSign, Hash, Ruler,
} from 'lucide-react';

type ServiceType = 'CORTE' | 'DOBRA' | 'SOLDA' | 'CONFORMACAO' | 'USINAGEM' | 'TRATAMENTO_TERMICO' | 'JATEAMENTO' | 'MONTAGEM_ESTRUTURAL';
type CalderariaModo = 'SERVICO_INTERNO' | 'INSTALACAO' | 'FABRICACAO_AVULSA';
type ResultadoTipo = 'ITEM' | 'SERVICO';

interface CldForm {
  modo: CalderariaModo;
  serviceType: ServiceType;
  linkedOsId: string;
  linkedOpId: string;
  description: string;
  materialDescription: string;
  technicalSpecs: string;
  estimatedTime: string;
  observations: string;
  // Fabricação Avulsa
  resultadoTipo: ResultadoTipo;
  resultadoNome: string;
  resultadoNcm: string;
  resultadoCodigoServico: string;
  resultadoUnidade: string;
  resultadoQtd: string;
  valorVenda: string;
  margemPercentual: string;
}

interface DropdownItem { id: string; label: string }

const serviceTypeOptions: { key: ServiceType; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'CORTE',               label: 'Corte',              desc: 'CNC, plasma, oxi-corte',       icon: <Scissors className="w-5 h-5" /> },
  { key: 'DOBRA',               label: 'Dobra',              desc: 'Dobra em prensa viradeira',     icon: <ArrowDownUp className="w-5 h-5" /> },
  { key: 'SOLDA',               label: 'Solda',              desc: 'MIG/MAG, TIG, eletrodo',        icon: <Zap className="w-5 h-5" /> },
  { key: 'CONFORMACAO',         label: 'Conformação',        desc: 'Calandragem, repuxo, estampo',  icon: <CircleDot className="w-5 h-5" /> },
  { key: 'USINAGEM',            label: 'Usinagem',           desc: 'Torno, fresa, furadeira',       icon: <Cog className="w-5 h-5" /> },
  { key: 'TRATAMENTO_TERMICO',  label: 'Trat. Térmico',      desc: 'Têmpera, revenimento',          icon: <Thermometer className="w-5 h-5" /> },
  { key: 'JATEAMENTO',          label: 'Jateamento',         desc: 'Granalha, areia, jato d\'água', icon: <Wind className="w-5 h-5" /> },
  { key: 'MONTAGEM_ESTRUTURAL', label: 'Montagem Estrutural',desc: 'Montagem e gabaritos',          icon: <Boxes className="w-5 h-5" /> },
];

const modoOptions: { key: CalderariaModo; label: string; desc: string; color: string; icon: React.ReactNode }[] = [
  {
    key: 'SERVICO_INTERNO',
    label: 'Serviço Interno',
    desc: 'Suporte à produção/OS sem cobrança ao cliente. Custos ficam no centro de custo interno.',
    color: 'border-slate-400 bg-slate-50 ring-slate-200',
    icon: <Settings className="w-6 h-6 text-slate-600" />,
  },
  {
    key: 'INSTALACAO',
    label: 'Instalação',
    desc: 'Instalação de carroceria em caminhão. Os custos são agregados automaticamente ao custo do produto (OP).',
    color: 'border-blue-500 bg-blue-50 ring-blue-200',
    icon: <Wrench className="w-6 h-6 text-blue-600" />,
  },
  {
    key: 'FABRICACAO_AVULSA',
    label: 'Fabricação Avulsa',
    desc: 'Fabrica peça ou kit sob medida. O resultado vira item faturável na OS vinculada — sem entrar no estoque.',
    color: 'border-orange-500 bg-orange-50 ring-orange-200',
    icon: <PackagePlus className="w-6 h-6 text-orange-600" />,
  },
];

const unidadeOptions = ['UN', 'PC', 'KG', 'M', 'M²', 'M³', 'L', 'CJ', 'PR'];

function defaultForm(): CldForm {
  return {
    modo: 'SERVICO_INTERNO',
    serviceType: 'SOLDA',
    linkedOsId: '', linkedOpId: '',
    description: '', materialDescription: '',
    technicalSpecs: '', estimatedTime: '', observations: '',
    resultadoTipo: 'ITEM', resultadoNome: '', resultadoNcm: '',
    resultadoCodigoServico: '', resultadoUnidade: 'UN',
    resultadoQtd: '1', valorVenda: '', margemPercentual: '',
  };
}

export default function NovaOrdemCalderariaPage() {
  const toast  = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [osList, setOsList] = useState<DropdownItem[]>([]);
  const [opList, setOpList] = useState<DropdownItem[]>([]);
  const [form,   setForm]   = useState<CldForm>(defaultForm());

  const set = (k: keyof CldForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    apiFetch('/api/service-orders?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setOsList((j.data || []).map((o: any) => ({
        id: o.id,
        label: `${o.numero}${o.veiculoDescricao ? ' — ' + o.veiculoDescricao : ''}`,
      }))))
      .catch(() => {});

    apiFetch('/api/production/orders?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setOpList((j.data || []).map((o: any) => ({
        id: o.id,
        label: `${o.numero}${o.description ? ' — ' + o.description : ''}`,
      }))))
      .catch(() => {});
  }, []);

  // Calcula preço automaticamente quando modo=FABRICACAO_AVULSA e margem é preenchida
  const calcPrecoSugerido = () => {
    const margem = parseFloat(form.margemPercentual);
    if (!isNaN(margem) && margem > 0) {
      return `Preço com ${margem}% de margem será calculado automaticamente ao concluir`;
    }
    return null;
  };

  const handleSave = async () => {
    if (!form.description.trim()) { toast.error('Descrição do serviço é obrigatória'); return; }
    if (!form.estimatedTime)      { toast.error('Tempo estimado é obrigatório'); return; }

    if (form.modo === 'FABRICACAO_AVULSA') {
      if (!form.resultadoNome.trim()) { toast.error('Nome do resultado é obrigatório para Fabricação Avulsa'); return; }
      if (!form.linkedOsId)           { toast.error('Vincule uma OS para Fabricação Avulsa'); return; }
      if (form.resultadoTipo === 'ITEM' && !form.resultadoNcm.trim()) {
        toast.error('NCM é obrigatório para resultado do tipo ITEM'); return;
      }
    }

    if (form.modo === 'INSTALACAO' && !form.linkedOpId) {
      toast.error('Vincule uma OP para o modo Instalação'); return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        serviceType:            form.serviceType,
        modo:                   form.modo,
        description:            form.description,
        materialDescription:    form.materialDescription || undefined,
        tempoEstimado:          parseFloat(form.estimatedTime),
        especificacoesTecnicas: form.technicalSpecs || undefined,
        observations:           form.observations   || undefined,
      };

      if (form.linkedOsId) body.serviceOrderId    = form.linkedOsId;
      if (form.linkedOpId) body.productionOrderId  = form.linkedOpId;

      if (form.modo === 'FABRICACAO_AVULSA') {
        body.resultadoTipo          = form.resultadoTipo;
        body.resultadoNome          = form.resultadoNome;
        body.resultadoUnidade       = form.resultadoUnidade;
        body.resultadoQtd           = parseFloat(form.resultadoQtd) || 1;
        if (form.resultadoTipo === 'ITEM')    body.resultadoNcm           = form.resultadoNcm;
        if (form.resultadoTipo === 'SERVICO') body.resultadoCodigoServico = form.resultadoCodigoServico;
        if (form.valorVenda)        body.valorVenda          = parseFloat(form.valorVenda);
        if (form.margemPercentual)  body.margemPercentual    = parseFloat(form.margemPercentual);
      }

      const res = await apiFetch('/api/calderaria', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao criar ordem');
      }
      const criada = await res.json();
      router.push(`/calderaria/ordens/${criada.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar ordem de calderaria');
    } finally {
      setSaving(false);
    }
  };

  const isFabAvulsa  = form.modo === 'FABRICACAO_AVULSA';
  const isInstalacao = form.modo === 'INSTALACAO';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/calderaria/ordens" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Ordem de Calderaria</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Selecione o modo de operação e preencha os detalhes</p>
        </div>
      </div>

      {/* ── MODO ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Modo de Operação *</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modoOptions.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => set('modo', opt.key)}
              className={`flex flex-col items-start gap-3 p-4 border-2 rounded-xl text-left transition-all ${
                form.modo === opt.key
                  ? `${opt.color} ring-2`
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {opt.icon}
                <span className="font-semibold text-slate-900 text-sm">{opt.label}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── FABRICAÇÃO AVULSA — Resultado ─────────────────────────────────── */}
      {isFabAvulsa && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <PackagePlus className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-semibold text-orange-900">Resultado da Fabricação</h2>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Será faturado na OS</span>
          </div>

          {/* Tipo de resultado */}
          <div className="grid grid-cols-2 gap-3">
            {(['ITEM', 'SERVICO'] as ResultadoTipo[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('resultadoTipo', t)}
                className={`flex items-center gap-3 p-3 border-2 rounded-xl transition-all ${
                  form.resultadoTipo === t
                    ? 'border-orange-500 bg-orange-100'
                    : 'border-slate-200 bg-white hover:border-orange-300'
                }`}
              >
                {t === 'ITEM' ? <Package className="w-5 h-5 text-orange-600" /> : <Briefcase className="w-5 h-5 text-orange-600" />}
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">{t === 'ITEM' ? 'Peça / Item Físico' : 'Serviço'}</p>
                  <p className="text-xs text-slate-500">{t === 'ITEM' ? 'Exige NCM' : 'Exige código LC116'}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nome do resultado *</label>
              <input
                value={form.resultadoNome}
                onChange={e => set('resultadoNome', e.target.value)}
                placeholder={form.resultadoTipo === 'ITEM' ? 'Ex: Suporte dianteiro regulável 80x40mm' : 'Ex: Usinagem especial de flange'}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              />
            </div>

            {form.resultadoTipo === 'ITEM' ? (
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">NCM *</label>
                <input
                  value={form.resultadoNcm}
                  onChange={e => set('resultadoNcm', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000000 (8 dígitos)"
                  maxLength={8}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Código Serviço (LC116)</label>
                <input
                  value={form.resultadoCodigoServico}
                  onChange={e => set('resultadoCodigoServico', e.target.value)}
                  placeholder="Ex: 14.05"
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Unidade</label>
              <select
                value={form.resultadoUnidade}
                onChange={e => set('resultadoUnidade', e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                {unidadeOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quantidade</label>
              <input
                type="number" min="0.001" step="0.001"
                value={form.resultadoQtd}
                onChange={e => set('resultadoQtd', e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Preço de Venda (R$)
              </label>
              <input
                type="number" min="0" step="0.01"
                value={form.valorVenda}
                onChange={e => set('valorVenda', e.target.value)}
                placeholder="0,00 — ou defina a margem →"
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Margem sobre custo (%)</label>
              <input
                type="number" min="0" max="500" step="1"
                value={form.margemPercentual}
                onChange={e => set('margemPercentual', e.target.value)}
                placeholder="Ex: 30 → calculado ao concluir"
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              />
              {calcPrecoSugerido() && (
                <p className="text-xs text-orange-600 mt-1">{calcPrecoSugerido()}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tipo de Serviço ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-zinc-600" />
          <h2 className="text-base font-semibold text-slate-900">Tipo de Serviço *</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {serviceTypeOptions.map(opt => (
            <label
              key={opt.key}
              className={`flex flex-col items-center p-4 border rounded-xl cursor-pointer transition-colors text-center ${
                form.serviceType === opt.key
                  ? 'border-zinc-500 bg-zinc-50 ring-2 ring-zinc-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input type="radio" name="serviceType" value={opt.key}
                checked={form.serviceType === opt.key}
                onChange={() => set('serviceType', opt.key)}
                className="sr-only"
              />
              <div className={`mb-2 ${form.serviceType === opt.key ? 'text-zinc-700' : 'text-slate-400'}`}>{opt.icon}</div>
              <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
              <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Vínculo OS/OP ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-zinc-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Vínculo{isFabAvulsa ? ' — OS obrigatória' : isInstalacao ? ' — OP obrigatória' : ' (opcional)'}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ordem de Serviço (OS){isFabAvulsa ? ' *' : ''}
            </label>
            <select
              value={form.linkedOsId}
              onChange={e => { set('linkedOsId', e.target.value); if (e.target.value) set('linkedOpId', ''); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                isFabAvulsa && !form.linkedOsId ? 'border-orange-400' : 'border-slate-300'
              }`}
            >
              <option value="">Nenhuma OS vinculada</option>
              {osList.map(os => <option key={os.id} value={os.id}>{os.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ordem de Produção (OP){isInstalacao ? ' *' : ''}
            </label>
            <select
              value={form.linkedOpId}
              onChange={e => { set('linkedOpId', e.target.value); if (e.target.value) set('linkedOsId', ''); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                isInstalacao && !form.linkedOpId ? 'border-blue-400' : 'border-slate-300'
              }`}
            >
              <option value="">Nenhuma OP vinculada</option>
              {opList.map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Detalhes ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-5 h-5 text-zinc-600" />
          <h2 className="text-base font-semibold text-slate-900">Detalhes do Serviço</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Serviço *</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            placeholder="Descreva o serviço de calderaria a ser executado..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Material</label>
          <input
            type="text" value={form.materialDescription}
            onChange={e => set('materialDescription', e.target.value)}
            placeholder="Ex: Chapa Aço ASTM A36 6mm, Tubo Retangular 100x50x3mm"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Especificações Técnicas</label>
          <textarea
            value={form.technicalSpecs}
            onChange={e => set('technicalSpecs', e.target.value)}
            rows={4}
            placeholder="Tolerâncias, normas, processos de solda, tratamentos, acabamentos..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
          />
        </div>
      </div>

      {/* ── Tempo ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-zinc-600" />
          <h2 className="text-base font-semibold text-slate-900">Tempo Estimado</h2>
        </div>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-slate-700 mb-1">Horas estimadas *</label>
          <input
            type="number" value={form.estimatedTime}
            onChange={e => set('estimatedTime', e.target.value)}
            min="0.5" step="0.5" placeholder="Ex: 4"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
      </div>

      {/* ── Observações ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
        <textarea
          value={form.observations}
          onChange={e => set('observations', e.target.value)}
          rows={3}
          placeholder="Informações adicionais..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
        />
      </div>

      {/* ── Ações ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Link href="/calderaria/ordens"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 text-sm font-semibold transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Criando...' : 'Criar Ordem'}
        </button>
      </div>
    </div>
  );
}
