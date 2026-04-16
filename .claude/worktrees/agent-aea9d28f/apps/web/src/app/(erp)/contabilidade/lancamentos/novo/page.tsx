'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, Plus, Trash2, BookOpen, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface Partida {
  id: number;
  contaId: string;
  tipo: 'D' | 'C';
  valor: string;
  centroCusto: string;
  descricao: string;
}

interface ContaOption {
  id: string;
  code: string;
  name: string;
}

interface CentroCustoOption {
  id: string;
  name: string;
}

const staticCentrosCusto: CentroCustoOption[] = [
  { id: '1', name: 'Producao' },
  { id: '2', name: 'Calderaria' },
  { id: '3', name: 'Montagem' },
  { id: '4', name: 'Pintura' },
  { id: '5', name: 'Administrativo' },
  { id: '6', name: 'Comercial' },
];

let nextId = 3;

export default function NovoLancamentoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [contas, setContas] = useState<ContaOption[]>([]);
  const [loadingContas, setLoadingContas] = useState(true);
  const [partidas, setPartidas] = useState<Partida[]>([
    { id: 1, contaId: '', tipo: 'D', valor: '', centroCusto: '', descricao: '' },
    { id: 2, contaId: '', tipo: 'C', valor: '', centroCusto: '', descricao: '' },
  ]);

  useEffect(() => {
    const fetchContas = async () => {
      setLoadingContas(true);
      try {
        const res = await apiFetch('/api/accounting/chart?limit=500&acceptsEntries=true');
        if (res.ok) {
          const data = await res.json();
          const mapped: ContaOption[] = (data.data ?? []).map((c: {
            id: string;
            code: string;
            name: string;
          }) => ({
            id: c.id,
            code: c.code,
            name: c.name,
          }));
          setContas(mapped);
        }
      } catch {
        // silently handle
      } finally {
        setLoadingContas(false);
      }
    };

    fetchContas();
  }, []);

  const addPartida = () => {
    setPartidas((prev) => [
      ...prev,
      { id: nextId++, contaId: '', tipo: 'D', valor: '', centroCusto: '', descricao: '' },
    ]);
  };

  const removePartida = (id: number) => {
    if (partidas.length <= 2) return;
    setPartidas((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePartida = (id: number, field: keyof Partida, value: string) => {
    setPartidas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const totalDebitos = partidas
    .filter((p) => p.tipo === 'D')
    .reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);

  const totalCreditos = partidas
    .filter((p) => p.tipo === 'C')
    .reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);

  const isBalanced = Math.abs(totalDebitos - totalCreditos) < 0.01;
  const hasValues = totalDebitos > 0 || totalCreditos > 0;

  const handleSave = async () => {
    if (!isBalanced) {
      alert('Os debitos e creditos devem ser iguais!');
      return;
    }
    setSaving(true);
    try {
      const items = partidas.map((p) => ({
        accountId: p.contaId,
        type: p.tipo === 'D' ? 'DEVEDORA' : 'CREDORA',
        value: parseFloat(p.valor) || 0,
        ...(p.centroCusto ? { costCenterId: p.centroCusto } : {}),
        ...(p.descricao ? { description: p.descricao } : {}),
      }));

      const res = await apiFetch('/api/accounting/journal', {
        method: 'POST',
        body: JSON.stringify({ description, date, items }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao salvar lancamento' }));
        alert(err.message || 'Erro ao salvar lancamento');
        return;
      }

      router.push('/contabilidade/lancamentos');
    } catch {
      alert('Erro ao salvar lancamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/contabilidade/lancamentos"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Lancamento Contabil</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Registrar um novo lancamento no diario</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Lancamento</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Compra de materias-primas ref. NF 12345"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Partidas */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Partidas</h2>
          <button
            onClick={addPartida}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Linha
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Conta</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-24">D/C</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-36">Valor (R$)</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Centro de Custo</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Descricao</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partidas.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <select
                      value={p.contaId}
                      onChange={(e) => updatePartida(p.id, 'contaId', e.target.value)}
                      disabled={loadingContas}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      <option value="">{loadingContas ? 'Carregando...' : 'Selecione...'}</option>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <label className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs font-medium ${
                        p.tipo === 'D' ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-400'
                      }`}>
                        <input type="radio" name={`tipo-${p.id}`} value="D" checked={p.tipo === 'D'} onChange={() => updatePartida(p.id, 'tipo', 'D')} className="sr-only" />
                        D
                      </label>
                      <label className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs font-medium ${
                        p.tipo === 'C' ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 text-slate-400'
                      }`}>
                        <input type="radio" name={`tipo-${p.id}`} value="C" checked={p.tipo === 'C'} onChange={() => updatePartida(p.id, 'tipo', 'C')} className="sr-only" />
                        C
                      </label>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={p.valor}
                      onChange={(e) => updatePartida(p.id, 'valor', e.target.value)}
                      placeholder="0,00"
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={p.centroCusto}
                      onChange={(e) => updatePartida(p.id, 'centroCusto', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      <option value="">Opcional</option>
                      {staticCentrosCusto.map((cc) => (
                        <option key={cc.id} value={cc.id}>{cc.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={p.descricao}
                      onChange={(e) => updatePartida(p.id, 'descricao', e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removePartida(p.id)}
                      disabled={partidas.length <= 2}
                      className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-end gap-8">
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Debitos</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(totalDebitos)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Creditos</p>
              <p className="text-lg font-bold text-purple-700">{formatCurrency(totalCreditos)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Diferenca</p>
              <p className={`text-lg font-bold ${isBalanced && hasValues ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(totalDebitos - totalCreditos))}
              </p>
            </div>
          </div>

          {hasValues && !isBalanced && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-sm text-red-700">
                O lancamento esta desbalanceado. Os totais de debitos e creditos devem ser iguais.
              </p>
            </div>
          )}

          {hasValues && isBalanced && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-700">Lancamento balanceado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/contabilidade/lancamentos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving || !isBalanced || !hasValues}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Salvar Lancamento
        </button>
      </div>
    </div>
  );
}
