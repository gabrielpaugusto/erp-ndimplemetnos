'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { AlertTriangle, Wrench, DollarSign, Clock, X } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';

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
  atrasada: boolean;
  diasEmAberto: number;
  diasAtraso: number;
  asset: {
    plaqueta: string;
    descricao: string;
    type: string;
    localizacao: string | null;
  };
}

interface Stats {
  porStatus: Array<{ status: string; _count: { id: number } }>;
  externasEmAberto: number;
  atrasadas: number;
  custoMesAtual: number;
}

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

function formatCurrency(value: number) { return fmtCurrency(value); }

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ---- Modal Registrar Retorno ----
function RegistrarRetornoModal({
  maintenance,
  onClose,
  onSaved,
}: {
  maintenance: ExternalMaintenance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    dataRetornoReal: new Date().toISOString().split('T')[0],
    notaFiscalRetorno: '',
    notaFiscalServico: '',
    valorServico: '',
    descricaoServico: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.descricaoServico) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/patrimonio/manutencoes/${maintenance.id}/concluir`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          valorServico: form.valorServico ? parseFloat(form.valorServico) : undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Registrar Retorno</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg text-sm">
          <p className="font-medium text-gray-800">{maintenance.numero} — {maintenance.asset.plaqueta}</p>
          <p className="text-gray-500 mt-0.5">{maintenance.asset.descricao}</p>
          {maintenance.fornecedorNome && (
            <p className="text-gray-500 mt-0.5">Fornecedor: {maintenance.fornecedorNome}</p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de Retorno Real <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.dataRetornoReal}
              onChange={e => setForm(prev => ({ ...prev, dataRetornoReal: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição do Serviço <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={form.descricaoServico}
              onChange={e => setForm(prev => ({ ...prev, descricaoServico: e.target.value }))}
              placeholder="Descreva o que foi realizado..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NF de Retorno</label>
              <input
                type="text"
                value={form.notaFiscalRetorno}
                onChange={e => setForm(prev => ({ ...prev, notaFiscalRetorno: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NF do Serviço</label>
              <input
                type="text"
                value={form.notaFiscalServico}
                onChange={e => setForm(prev => ({ ...prev, notaFiscalServico: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Serviço</label>
            <input
              type="number"
              step="0.01"
              value={form.valorServico}
              onChange={e => setForm(prev => ({ ...prev, valorServico: e.target.value }))}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
            disabled={submitting || !form.descricaoServico}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? 'Salvando...' : 'Registrar Retorno'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Página Principal ----
export default function ManutencoesExternasPage() {
  const [manutencoes, setManutencoes] = useState<ExternalMaintenance[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMaintenance, setSelectedMaintenance] = useState<ExternalMaintenance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [externasRes, statsRes] = await Promise.all([
        apiFetch('/api/patrimonio/manutencoes/externas-em-aberto'),
        apiFetch('/api/patrimonio/manutencoes/stats'),
      ]);
      const [externasData, statsData] = await Promise.all([
        (externasRes as any).json(),
        (statsRes as any).json(),
      ]);
      setManutencoes(externasData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter
    ? manutencoes.filter(m => m.status === statusFilter)
    : manutencoes;

  const atrasadas = manutencoes.filter(m => m.atrasada).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-blue-600" />
          Manutenções Externas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ativos enviados para manutenção externa aguardando retorno
        </p>
      </div>

      {/* Cards de Resumo */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.externasEmAberto}</p>
              <p className="text-sm text-gray-500">Em Aberto</p>
            </div>
          </div>
          <div className={`bg-white rounded-lg border p-4 flex items-center gap-4 ${atrasadas > 0 ? 'border-red-200' : ''}`}>
            <div className={`p-3 rounded-lg ${atrasadas > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <AlertTriangle className={`w-6 h-6 ${atrasadas > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${atrasadas > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.atrasadas}</p>
              <p className="text-sm text-gray-500">Atrasadas</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.custoMesAtual)}</p>
              <p className="text-sm text-gray-500">Custo do Mês</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtro de Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 font-medium">Filtrar por status:</span>
        <div className="flex gap-2">
          {['', 'ABERTA', 'EM_EXECUCAO', 'AGUARDANDO_RETORNO'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s === '' ? 'Todos' : MAINTENANCE_STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela Principal */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma manutenção externa em aberto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Nº</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ativo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Fornecedor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Data Envio</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Retorno Previsto</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Dias em Aberto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">NF Remessa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(m => (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50 transition-colors ${m.atrasada ? 'bg-red-50 hover:bg-red-100' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600 whitespace-nowrap">{m.numero}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{m.asset.plaqueta}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{m.asset.descricao}</p>
                        {m.asset.localizacao && (
                          <p className="text-xs text-gray-400">{m.asset.localizacao}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.fornecedorNome || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(m.dataEnvio)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.dataRetornoPrevista ? (
                        <span className={`flex items-center gap-1 ${m.atrasada ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                          {m.atrasada && <AlertTriangle className="w-3.5 h-3.5" />}
                          {formatDate(m.dataRetornoPrevista)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-10 h-7 rounded-full text-xs font-bold ${
                        m.diasEmAberto > 30 ? 'bg-red-100 text-red-700' :
                        m.diasEmAberto > 14 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {m.diasEmAberto}
                      </span>
                      {m.atrasada && m.diasAtraso > 0 && (
                        <p className="text-xs text-red-600 mt-0.5">{m.diasAtraso}d atraso</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.notaFiscalRemessa || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MAINTENANCE_STATUS_BADGES[m.status] || 'bg-gray-100'}`}>
                        {MAINTENANCE_STATUS_LABELS[m.status] || m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedMaintenance(m)}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                      >
                        Registrar Retorno
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Registrar Retorno */}
      {selectedMaintenance && (
        <RegistrarRetornoModal
          maintenance={selectedMaintenance}
          onClose={() => setSelectedMaintenance(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
