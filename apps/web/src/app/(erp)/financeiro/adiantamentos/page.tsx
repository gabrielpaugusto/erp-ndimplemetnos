'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Plus,
  Wallet,
  TrendingDown,
  TrendingUp,
  Users,
  Truck,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtCurrency } from '@/lib/format';

// ── Tipos ──────────────────────────────────────────────────────────────────
type AdiantamentoTipo = 'CLIENTE' | 'FORNECEDOR';
type MovTipo = 'CREDITO' | 'DEBITO';

interface Pessoa {
  id: string;
  razaoSocial: string;
  cpfCnpj: string;
}

interface Movimento {
  id: string;
  tipo: MovTipo;
  valor: number;
  data: string;
  descricao: string;
  referencia?: string;
  paymentMethod?: string;
  bankAccount?: { id: string; name: string };
  user?: { id: string; name: string };
  createdAt: string;
}

interface ContaCorrente {
  id: string | null;
  personId: string;
  tipo: AdiantamentoTipo;
  person: Pessoa;
  saldoTotal: number;
  saldoUtilizado: number;
  saldoDisponivel: number;
  status: string;
  movimentos: Movimento[];
}

interface Resumo {
  clientes: { contas: number; saldoTotal: number; saldoUtilizado: number; saldoDisponivel: number };
  fornecedores: { contas: number; saldoTotal: number; saldoUtilizado: number; saldoDisponivel: number };
}

interface BankAccount { id: string; name: string }

const fmt = (v: number) => fmtCurrency(v);

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

const PAYMENT_METHODS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de Débito' },
];

// ── Modal de lançamento ────────────────────────────────────────────────────
function ModalLancamento({
  conta,
  movTipo,
  bankAccounts,
  onClose,
  onSuccess,
}: {
  conta: ContaCorrente;
  movTipo: MovTipo;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [descricao, setDescricao] = useState('');
  const [referencia, setReferencia] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [bankAccountId, setBankAccountId] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCredito = movTipo === 'CREDITO';
  const endpoint = isCredito
    ? `/financial/adiantamentos/${conta.personId}/${conta.tipo}/creditar`
    : `/financial/adiantamentos/${conta.personId}/${conta.tipo}/debitar`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!valorNum || valorNum <= 0) { setError('Valor inválido'); return; }
    if (!descricao.trim()) { setError('Descrição obrigatória'); return; }
    if (!isCredito && valorNum > conta.saldoDisponivel) {
      setError(`Saldo insuficiente. Disponível: ${fmt(conta.saldoDisponivel)}`);
      return;
    }

    setLoading(true);
    try {
      await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          tipo: movTipo,
          valor: valorNum,
          data,
          descricao,
          referencia: referencia || undefined,
          paymentMethod: isCredito ? paymentMethod : undefined,
          bankAccountId: isCredito && bankAccountId ? bankAccountId : undefined,
          observations: observations || undefined,
        }),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar lançamento');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCredito
              ? <ArrowDownCircle className="h-6 w-6 text-emerald-600" />
              : <ArrowUpCircle className="h-6 w-6 text-red-500" />}
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isCredito ? 'Registrar Crédito (Recebimento Antecipado)' : 'Aplicar Débito (Usar Adiantamento)'}
              </h3>
              <p className="text-xs text-gray-500">{conta.person.razaoSocial}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isCredito && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            Saldo disponível: <span className="font-bold">{fmt(conta.saldoDisponivel)}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Valor (R$) *</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Data *</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Descrição *</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder={isCredito ? 'Ex: Adiantamento ref. Pedido #123' : 'Ex: Aplicado contra NF 001.234'}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Referência (NF, pedido, etc.)</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ex: NF 001.234"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>

          {isCredito && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Forma de Pagamento</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Conta Bancária</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  <option value="">Selecionar...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Observações</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${isCredito ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading ? 'Salvando...' : isCredito ? 'Registrar Crédito' : 'Aplicar Débito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Conta corrente detalhe ─────────────────────────────────────────────────
function ContaCorrenteDetalhe({
  conta,
  bankAccounts,
  onBack,
  onRefresh,
}: {
  conta: ContaCorrente;
  bankAccounts: BankAccount[];
  onBack: () => void;
  onRefresh: (personId: string, tipo: AdiantamentoTipo) => Promise<ContaCorrente>;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState(conta);
  const [modal, setModal] = useState<MovTipo | null>(null);
  const [estornando, setEstornando] = useState<string | null>(null);

  async function handleEstorno(movId: string) {
    if (!confirm('Confirma o estorno deste lançamento?')) return;
    setEstornando(movId);
    try {
      await api(`/financial/adiantamentos/movimentos/${movId}/estornar`, { method: 'POST' });
      const updated = await onRefresh(current.personId, current.tipo);
      setCurrent(updated);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao estornar');
    } finally {
      setEstornando(null);
    }
  }

  async function handleSuccess() {
    setModal(null);
    const updated = await onRefresh(current.personId, current.tipo);
    setCurrent(updated);
  }

  return (
    <div>
      {/* Header da conta */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50">
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">{current.person.razaoSocial}</h2>
          <p className="text-xs text-gray-500">{current.person.cpfCnpj} · Conta corrente de adiantamento — {current.tipo === 'CLIENTE' ? 'Cliente' : 'Fornecedor'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('DEBITO')}
            disabled={current.saldoDisponivel <= 0}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <ArrowUpCircle className="h-4 w-4" /> Aplicar Débito
          </button>
          <button
            onClick={() => setModal('CREDITO')}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <ArrowDownCircle className="h-4 w-4" /> Registrar Crédito
          </button>
        </div>
      </div>

      {/* Cards de saldo */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-1 text-xs font-medium text-emerald-700">Total Creditado</p>
          <p className="text-2xl font-bold text-emerald-700">{fmt(Number(current.saldoTotal))}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-xs font-medium text-red-600">Total Utilizado</p>
          <p className="text-2xl font-bold text-red-600">{fmt(Number(current.saldoUtilizado))}</p>
        </div>
        <div className={`rounded-xl border p-4 ${Number(current.saldoDisponivel) > 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
          <p className={`mb-1 text-xs font-medium ${Number(current.saldoDisponivel) > 0 ? 'text-blue-700' : 'text-gray-500'}`}>Saldo Disponível</p>
          <p className={`text-2xl font-bold ${Number(current.saldoDisponivel) > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{fmt(Number(current.saldoDisponivel))}</p>
          <p className="mt-1 text-xs text-gray-400">Status: {current.status}</p>
        </div>
      </div>

      {/* Extrato / conta corrente */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-800">Extrato da Conta Corrente</h3>
        </div>

        {current.movimentos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
            <Wallet className="h-10 w-10" />
            <p className="text-sm">Nenhum lançamento ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {current.movimentos.map((mov) => (
              <div key={mov.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${mov.tipo === 'CREDITO' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {mov.tipo === 'CREDITO'
                    ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                    : <TrendingDown className="h-4 w-4 text-red-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{mov.descricao}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{fmtDate(mov.data)}</span>
                    {mov.referencia && <span>· Ref: {mov.referencia}</span>}
                    {mov.bankAccount && <span>· {mov.bankAccount.name}</span>}
                    {mov.paymentMethod && <span>· {mov.paymentMethod}</span>}
                    {mov.user && <span>· por {mov.user.name}</span>}
                  </div>
                </div>
                <p className={`shrink-0 text-base font-bold ${mov.tipo === 'CREDITO' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {mov.tipo === 'CREDITO' ? '+' : '-'} {fmt(Number(mov.valor))}
                </p>
                {!mov.descricao.startsWith('ESTORNO') && (
                  <button
                    onClick={() => handleEstorno(mov.id)}
                    disabled={estornando === mov.id}
                    title="Estornar lançamento"
                    className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ModalLancamento
          conta={current}
          movTipo={modal}
          bankAccounts={bankAccounts}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function AdiantamentosPage() {
  const [tipo, setTipo] = useState<AdiantamentoTipo>('CLIENTE');
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [contaSelecionada, setContaSelecionada] = useState<ContaCorrente | null>(null);
  const [pessoaBusca, setPessoaBusca] = useState('');
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [showPessoaDropdown, setShowPessoaDropdown] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [c, r, b] = await Promise.all([
      api<ContaCorrente[]>(`/financial/adiantamentos?tipo=${tipo}`).catch(() => []),
      api<Resumo>('/financial/adiantamentos/resumo').catch(() => null),
      api<BankAccount[]>('/financial/bank-accounts').catch(() => []),
    ]);
    setContas(c);
    setResumo(r);
    setBankAccounts(b);
    setLoading(false);
  }, [tipo]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function searchPessoas(q: string) {
    if (q.length < 2) { setPessoas([]); return; }
    const result = await api<{ data: Pessoa[] }>(`/crm/persons?search=${encodeURIComponent(q)}&limit=10`).catch(() => ({ data: [] }));
    setPessoas(result.data || []);
  }

  async function abrirContaPorPessoa(person: Pessoa) {
    setShowPessoaDropdown(false);
    setPessoaBusca(person.razaoSocial);
    const conta = await api<ContaCorrente>(`/financial/adiantamentos/${person.id}/${tipo}`).catch(() => null);
    if (conta) setContaSelecionada(conta);
  }

  async function refreshConta(personId: string, tipoAdt: AdiantamentoTipo): Promise<ContaCorrente> {
    const updated = await api<ContaCorrente>(`/financial/adiantamentos/${personId}/${tipoAdt}`);
    await loadAll();
    return updated;
  }

  const contasFiltradas = contas.filter((c) =>
    c.person.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
    c.person.cpfCnpj.includes(search),
  );

  const resumoAtual = resumo ? (tipo === 'CLIENTE' ? resumo.clientes : resumo.fornecedores) : null;

  if (contaSelecionada) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <ContaCorrenteDetalhe
          conta={contaSelecionada}
          bankAccounts={bankAccounts}
          onBack={() => { setContaSelecionada(null); setPessoaBusca(''); loadAll(); }}
          onRefresh={refreshConta}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Adiantamentos</h1>
          <p className="text-sm text-gray-500">Conta corrente de adiantamentos de clientes e fornecedores</p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {/* Tabs Cliente / Fornecedor */}
      <div className="flex gap-2 rounded-xl border bg-gray-50 p-1">
        {(['CLIENTE', 'FORNECEDOR'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${tipo === t ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'CLIENTE' ? <Users className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
            {t === 'CLIENTE' ? 'Clientes' : 'Fornecedores'}
          </button>
        ))}
      </div>

      {/* Cards de resumo */}
      {resumoAtual && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Contas ativas', value: resumoAtual.contas.toString(), color: 'blue', icon: Wallet },
            { label: 'Total creditado', value: fmt(resumoAtual.saldoTotal), color: 'emerald', icon: TrendingUp },
            { label: 'Total utilizado', value: fmt(resumoAtual.saldoUtilizado), color: 'red', icon: TrendingDown },
            { label: 'Saldo disponível', value: fmt(resumoAtual.saldoDisponivel), color: 'indigo', icon: Wallet },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={`rounded-xl border border-${color}-200 bg-${color}-50 p-4`}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className={`h-4 w-4 text-${color}-600`} />
                <p className={`text-xs font-medium text-${color}-700`}>{label}</p>
              </div>
              <p className={`text-xl font-bold text-${color}-700`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Busca por pessoa + abrir nova conta */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Filtrar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <div className="flex overflow-hidden rounded-lg border border-gray-300">
            <div className="flex items-center gap-2 bg-gray-50 px-3">
              <Plus className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-500">Nova conta:</span>
            </div>
            <input
              className="w-64 border-0 py-2 px-3 text-sm focus:outline-none focus:ring-0"
              placeholder="Buscar pessoa..."
              value={pessoaBusca}
              onChange={(e) => { setPessoaBusca(e.target.value); searchPessoas(e.target.value); setShowPessoaDropdown(true); }}
            />
          </div>
          {showPessoaDropdown && pessoas.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
              {pessoas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => abrirContaPorPessoa(p)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.razaoSocial}</p>
                    <p className="text-xs text-gray-400">{p.cpfCnpj}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de contas correntes */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : contasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 py-16 text-gray-400">
          <Wallet className="h-12 w-12" />
          <p className="text-sm font-medium">Nenhuma conta corrente de adiantamento encontrada</p>
          <p className="text-xs">Use o campo "Nova conta" para abrir o extrato de um {tipo === 'CLIENTE' ? 'cliente' : 'fornecedor'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Pessoa</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600">Total Creditado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-500">Total Utilizado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700">Saldo Disponível</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contasFiltradas.map((c) => (
                <tr key={c.id ?? c.personId} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{c.person.razaoSocial}</p>
                    <p className="text-xs text-gray-400">{c.person.cpfCnpj}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(Number(c.saldoTotal))}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-500">{fmt(Number(c.saldoUtilizado))}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(Number(c.saldoDisponivel))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-700' : c.status === 'ENCERRADO' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setContaSelecionada(c)}
                      className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Ver extrato <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
