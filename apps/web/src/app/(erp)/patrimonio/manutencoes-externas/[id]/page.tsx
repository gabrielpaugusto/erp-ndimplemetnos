'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Wrench, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

const statusLabels: Record<string, string> = {
  ABERTA:              'Aberta',
  EM_EXECUCAO:         'Em Execução',
  AGUARDANDO_RETORNO:  'Aguardando Retorno',
  CONCLUIDA:           'Concluída',
  CANCELADA:           'Cancelada',
};

const statusColors: Record<string, string> = {
  ABERTA:             'bg-blue-100 text-blue-700',
  EM_EXECUCAO:        'bg-yellow-100 text-yellow-700',
  AGUARDANDO_RETORNO: 'bg-orange-100 text-orange-700',
  CONCLUIDA:          'bg-emerald-100 text-emerald-700',
  CANCELADA:          'bg-slate-100 text-slate-600',
};

interface ExternalMaintenance {
  id: string;
  numero: string;
  status: string;
  local: string;
  dataAbertura: string;
  dataEnvio: string | null;
  dataRetornoPrevista: string | null;
  dataRetornoReal: string | null;
  fornecedorNome: string | null;
  notaFiscalRemessa: string | null;
  notaFiscalRetorno: string | null;
  custoEstimado: number | null;
  custoReal: number | null;
  descricaoProblema: string | null;
  laudo: string | null;
  observacoes: string | null;
  atrasada: boolean;
  diasEmAberto: number;
  asset: {
    id: string;
    plaqueta: string;
    descricao: string;
    type: string;
    localizacao: string | null;
  };
}

export default function ManutencaoExternaDetailPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [maintenance, setMaintenance] = useState<ExternalMaintenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    status: '',
    fornecedorNome: '',
    dataEnvio: '',
    dataRetornoPrevista: '',
    dataRetornoReal: '',
    notaFiscalRemessa: '',
    notaFiscalRetorno: '',
    custoEstimado: '',
    custoReal: '',
    laudo: '',
    observacoes: '',
  });

  useEffect(() => {
    async function fetch() {
      try {
        const data = await apiFetch<ExternalMaintenance>(`/patrimonio/manutencoes-externas/${id}`);
        setMaintenance(data);
        setForm({
          status: data.status,
          fornecedorNome: data.fornecedorNome ?? '',
          dataEnvio: data.dataEnvio ? data.dataEnvio.slice(0, 10) : '',
          dataRetornoPrevista: data.dataRetornoPrevista ? data.dataRetornoPrevista.slice(0, 10) : '',
          dataRetornoReal: data.dataRetornoReal ? data.dataRetornoReal.slice(0, 10) : '',
          notaFiscalRemessa: data.notaFiscalRemessa ?? '',
          notaFiscalRetorno: data.notaFiscalRetorno ?? '',
          custoEstimado: data.custoEstimado != null ? String(data.custoEstimado) : '',
          custoReal: data.custoReal != null ? String(data.custoReal) : '',
          laudo: data.laudo ?? '',
          observacoes: data.observacoes ?? '',
        });
      } catch {
        toast.error('Erro ao carregar manutenção externa');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/patrimonio/manutencoes-externas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          dataEnvio: form.dataEnvio || null,
          dataRetornoPrevista: form.dataRetornoPrevista || null,
          dataRetornoReal: form.dataRetornoReal || null,
          custoEstimado: form.custoEstimado ? parseFloat(form.custoEstimado) : null,
          custoReal: form.custoReal ? parseFloat(form.custoReal) : null,
        }),
      });
      toast.success('Manutenção atualizada');
      router.refresh();
    } catch {
      toast.error('Erro ao salvar manutenção');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!maintenance) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        Manutenção não encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/patrimonio/manutencoes-externas" className="text-slate-500 hover:text-slate-700">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              Manutenção Externa #{maintenance.numero}
            </h1>
            <p className="text-sm text-slate-500">{maintenance.asset.plaqueta} — {maintenance.asset.descricao}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {maintenance.atrasada && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Atrasada {maintenance.diasEmAberto}d
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[maintenance.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {statusLabels[maintenance.status] ?? maintenance.status}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-700">Acompanhamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {Object.entries(statusLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Fornecedor</label>
            <input
              type="text"
              value={form.fornecedorNome}
              onChange={e => setForm(f => ({ ...f, fornecedorNome: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Data de Envio</label>
            <input
              type="date"
              value={form.dataEnvio}
              onChange={e => setForm(f => ({ ...f, dataEnvio: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Retorno Previsto</label>
            <input
              type="date"
              value={form.dataRetornoPrevista}
              onChange={e => setForm(f => ({ ...f, dataRetornoPrevista: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Retorno Real</label>
            <input
              type="date"
              value={form.dataRetornoReal}
              onChange={e => setForm(f => ({ ...f, dataRetornoReal: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">NF Remessa</label>
            <input
              type="text"
              value={form.notaFiscalRemessa}
              onChange={e => setForm(f => ({ ...f, notaFiscalRemessa: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">NF Retorno</label>
            <input
              type="text"
              value={form.notaFiscalRetorno}
              onChange={e => setForm(f => ({ ...f, notaFiscalRetorno: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Custo Estimado (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.custoEstimado}
              onChange={e => setForm(f => ({ ...f, custoEstimado: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Custo Real (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.custoReal}
              onChange={e => setForm(f => ({ ...f, custoReal: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Laudo Técnico</label>
            <textarea
              rows={3}
              value={form.laudo}
              onChange={e => setForm(f => ({ ...f, laudo: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Observações</label>
            <textarea
              rows={3}
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Asset info */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-slate-400" />
          Ativo em Manutenção
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Plaqueta</p>
            <p className="font-medium text-slate-700">{maintenance.asset.plaqueta}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Descrição</p>
            <p className="font-medium text-slate-700">{maintenance.asset.descricao}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Tipo</p>
            <p className="font-medium text-slate-700">{maintenance.asset.type}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Local</p>
            <p className="font-medium text-slate-700">{maintenance.asset.localizacao ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
