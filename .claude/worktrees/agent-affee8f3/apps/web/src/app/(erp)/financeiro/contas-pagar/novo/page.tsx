'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, ArrowDownRight, CreditCard, Layers } from 'lucide-react';

export default function NovoContaPagarPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [fornecedor, setFornecedor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataEmissao, setDataEmissao] = useState('2026-03-14');
  const [dataVencimento, setDataVencimento] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [contaBancaria, setContaBancaria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [numParcelas, setNumParcelas] = useState('1');
  const [intervaloDias, setIntervaloDias] = useState('30');
  const [showParcelas, setShowParcelas] = useState(false);

  const fornecedores = [
    { id: '1', name: 'Aco Inox Brasil Ltda' },
    { id: '2', name: 'Soldas e Eletrodos SA' },
    { id: '3', name: 'Tintas Industriais Marfim' },
    { id: '4', name: 'Parafusos e Fixadores Express' },
    { id: '5', name: 'Energia Eletrica SA' },
  ];

  const metodosPagamento = [
    { id: 'boleto', name: 'Boleto Bancario' },
    { id: 'transferencia', name: 'Transferencia/PIX' },
    { id: 'cheque', name: 'Cheque' },
    { id: 'dinheiro', name: 'Dinheiro' },
  ];

  const contasBancarias = [
    { id: '1', name: 'Banco do Brasil - Cc 56789-0' },
    { id: '2', name: 'Bradesco - Cc 12345-8' },
    { id: '3', name: 'Caixa Economica - Cc 98765-4' },
  ];

  const centrosCusto = [
    { id: '1', name: 'Producao' },
    { id: '2', name: 'Calderaria' },
    { id: '3', name: 'Montagem' },
    { id: '4', name: 'Pintura' },
    { id: '5', name: 'Administrativo' },
    { id: '6', name: 'Comercial' },
  ];

  const categorias = [
    { id: '1', name: '4.1 - Materia-prima' },
    { id: '2', name: '4.2 - Insumos de Producao' },
    { id: '3', name: '4.3 - Despesas Operacionais' },
    { id: '4', name: '4.4 - Despesas Administrativas' },
    { id: '5', name: '4.5 - Servicos de Terceiros' },
  ];

  const parcelas = [];
  if (showParcelas && valor && dataVencimento && parseInt(numParcelas) > 0) {
    const valorParcela = parseFloat(valor) / parseInt(numParcelas);
    const baseDate = new Date(dataVencimento);
    for (let i = 0; i < parseInt(numParcelas); i++) {
      const dt = new Date(baseDate);
      dt.setDate(dt.getDate() + i * parseInt(intervaloDias));
      parcelas.push({ num: i + 1, valor: valorParcela, vencimento: dt.toLocaleDateString('pt-BR') });
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      alert('Titulo a pagar cadastrado com sucesso! (mock)');
      router.push('/financeiro/contas-pagar');
    } catch {
      alert('Erro ao salvar titulo');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/financeiro/contas-pagar" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Titulo a Pagar</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastrar um novo titulo de conta a pagar</p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDownRight className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados do Titulo</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor *</label>
            <select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione o fornecedor...</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor *</label>
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao *</label>
            <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Chapas de aco inoxidavel 304" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
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
              {contasBancarias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Custo</label>
            <select value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria (Plano de Contas)</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          <button
            onClick={() => setShowParcelas(!showParcelas)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${showParcelas ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/financeiro/contas-pagar" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving || !fornecedor || !descricao || !valor || !dataVencimento}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Salvar Titulo
        </button>
      </div>
    </div>
  );
}
