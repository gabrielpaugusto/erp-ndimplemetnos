'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, ArrowUpRight, Layers } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

export default function NovoContaReceberPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cliente, setCliente] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [contaBancaria, setContaBancaria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [numParcelas, setNumParcelas] = useState('1');
  const [intervaloDias, setIntervaloDias] = useState('30');
  const [showParcelas, setShowParcelas] = useState(false);

  // Dados carregados da API
  const [clientes, setClientes] = useState<{ id: string; razaoSocial: string }[]>([]);
  const [contasBancarias, setContasBancarias] = useState<{ id: string; nome: string; banco: string; conta: string }[]>([]);

  useEffect(() => {
    apiFetch('/api/persons?limit=200').then(r => r.json()).then(d => setClientes(d.data ?? d ?? [])).catch(() => {});
    apiFetch('/api/financial/bank-accounts?limit=50').then(r => r.json()).then(d => setContasBancarias(d.data ?? d ?? [])).catch(() => {});
  }, []);

  const metodosPagamento = [
    { id: 'boleto', name: 'Boleto Bancario' },
    { id: 'transferencia', name: 'Transferencia/PIX' },
    { id: 'cheque', name: 'Cheque' },
    { id: 'cartao', name: 'Cartao de Credito' },
  ];

  const centrosCusto = ['Producao', 'Calderaria', 'Montagem', 'Pintura', 'Administrativo', 'Comercial'];
  const categorias = ['3.1 - Receita Bruta de Vendas', '3.2 - Receita de Servicos', '3.3 - Outras Receitas Operacionais'];

  const parcelas: { num: number; valor: number; vencimento: string }[] = [];
  if (showParcelas && valor && dataVencimento && parseInt(numParcelas) > 0) {
    const valorParcela = parseFloat(valor) / parseInt(numParcelas);
    const baseDate = new Date(dataVencimento + 'T12:00:00');
    for (let i = 0; i < parseInt(numParcelas); i++) {
      const dt = new Date(baseDate);
      dt.setDate(dt.getDate() + i * parseInt(intervaloDias));
      parcelas.push({ num: i + 1, valor: valorParcela, vencimento: dt.toLocaleDateString('pt-BR') });
    }
  }

  const handleSave = async () => {
    setSaving(true); setError('');
    const nParcelas = showParcelas ? parseInt(numParcelas) : 1;
    const endpoint = nParcelas > 1 ? '/api/financial/movements/installments' : '/api/financial/movements';
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          type: 'RECEITA',
          personId: cliente || undefined,
          descricao: descricao.trim(),
          valor: parseFloat(valor),
          dataEmissao,
          dataVencimento,
          ...(metodoPagamento && { metodoPagamento }),
          ...(contaBancaria  && { contaBancariaId: contaBancaria }),
          ...(centroCusto    && { centroCusto }),
          ...(categoria      && { categoria }),
          ...(observacoes    && { observacoes: observacoes.trim() }),
          ...(nParcelas > 1  && { installments: nParcelas, intervaloDias: parseInt(intervaloDias) }),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message || 'Erro ao salvar titulo a receber');
        return;
      }
      router.push('/financeiro/contas-receber');
    } catch {
      setError('Erro de conexao. Verifique se o servidor esta rodando.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/financeiro/contas-receber" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Titulo a Receber</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastrar um novo titulo de conta a receber</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpRight className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Titulo</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
            <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione o cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor *</label>
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao *</label>
            <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Carroceria Bau Refrigerado 8m - NF 12450" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Emissao *</label>
            <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Vencimento *</label>
            <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Metodo de Pagamento</label>
            <select value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {metodosPagamento.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancaria</label>
            <select value={contaBancaria} onChange={(e) => setContaBancaria(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {contasBancarias.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.banco} {c.conta}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Custo</label>
            <select value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {centrosCusto.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria (Plano de Contas)</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Observacoes adicionais..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {/* Parcelas */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Gerar Parcelas</h2>
          </div>
          <button onClick={() => setShowParcelas(!showParcelas)} className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${showParcelas ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {showParcelas ? 'Ocultar' : 'Parcelar'}
          </button>
        </div>
        {showParcelas && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Numero de Parcelas</label>
                <input type="number" min="1" max="48" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Intervalo (dias)</label>
                <input type="number" min="1" value={intervaloDias} onChange={(e) => setIntervaloDias(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
            </div>
            {parcelas.length > 0 && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Parcela</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parcelas.map((p) => (
                    <tr key={p.num}>
                      <td className="px-3 py-2 text-sm text-slate-700">{p.num}/{numParcelas}</td>
                      <td className="px-3 py-2 text-sm text-right font-medium text-slate-900">{formatCurrency(p.valor)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{p.vencimento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/financeiro/contas-receber" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving || !descricao || !valor || !dataVencimento} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" />
          Salvar Titulo
        </button>
      </div>
    </div>
  );
}
