'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Truck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

const MODALIDADES = [
  { value: 'RODOVIARIO', label: 'Rodoviário' },
  { value: 'AEREO', label: 'Aéreo' },
  { value: 'AQUAVIARIO', label: 'Aquaviário' },
  { value: 'FERROVIARIO', label: 'Ferroviário' },
  { value: 'DUTOVIARIO', label: 'Dutoviário' },
  { value: 'MULTIMODAL', label: 'Multimodal' },
];

const CONDICOES_PAGAMENTO = [
  { value: 'CIF', label: 'CIF — frete por conta do remetente' },
  { value: 'FOB', label: 'FOB — frete por conta do destinatário' },
  { value: 'TERCEIROS', label: 'Terceiros' },
  { value: 'SEM_FRETE', label: 'Sem frete' },
];

interface FormData {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  transportadoraCnpj: string;
  transportadoraNome: string;
  transportadoraIe: string;
  remetenteNome: string;
  destinatarioNome: string;
  modalidade: string;
  cfop: string;
  valorFrete: string;
  valorSeguro: string;
  valorOutrasDespesas: string;
  valorDesconto: string;
  aliqIcms: string;
  creditoIcms: boolean;
  condicaoPagamento: string;
  dataVencimentoFrete: string;
  purchaseOrderId: string;
  nfeInboxId: string;
  observacoes: string;
}

const emptyForm: FormData = {
  chaveAcesso: '',
  numero: '',
  serie: '1',
  dataEmissao: new Date().toISOString().slice(0, 10),
  transportadoraCnpj: '',
  transportadoraNome: '',
  transportadoraIe: '',
  remetenteNome: '',
  destinatarioNome: '',
  modalidade: 'RODOVIARIO',
  cfop: '2352',
  valorFrete: '',
  valorSeguro: '',
  valorOutrasDespesas: '',
  valorDesconto: '',
  aliqIcms: '12',
  creditoIcms: true,
  condicaoPagamento: 'FOB',
  dataVencimentoFrete: '',
  purchaseOrderId: '',
  nfeInboxId: '',
  observacoes: '',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const selectClass = inputClass + ' bg-white';

export default function NovoCTePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.numero || !form.transportadoraCnpj || !form.transportadoraNome || !form.valorFrete || !form.dataEmissao) {
      setError('Preencha os campos obrigatórios: Número, Transportadora (CNPJ e Nome), Valor do Frete e Data de Emissão.');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        numero: form.numero,
        serie: form.serie || '1',
        dataEmissao: form.dataEmissao,
        transportadoraCnpj: form.transportadoraCnpj,
        transportadoraNome: form.transportadoraNome,
        modalidade: form.modalidade,
        cfop: form.cfop,
        valorFrete: parseFloat(form.valorFrete),
        aliqIcms: parseFloat(form.aliqIcms || '0'),
        creditoIcms: form.creditoIcms,
        condicaoPagamento: form.condicaoPagamento,
      };

      if (form.chaveAcesso) body.chaveAcesso = form.chaveAcesso;
      if (form.transportadoraIe) body.transportadoraIe = form.transportadoraIe;
      if (form.remetenteNome) body.remetenteNome = form.remetenteNome;
      if (form.destinatarioNome) body.destinatarioNome = form.destinatarioNome;
      if (form.valorSeguro) body.valorSeguro = parseFloat(form.valorSeguro);
      if (form.valorOutrasDespesas) body.valorOutrasDespesas = parseFloat(form.valorOutrasDespesas);
      if (form.valorDesconto) body.valorDesconto = parseFloat(form.valorDesconto);
      if (form.dataVencimentoFrete) body.dataVencimentoFrete = form.dataVencimentoFrete;
      if (form.purchaseOrderId) body.purchaseOrderId = form.purchaseOrderId;
      if (form.nfeInboxId) body.nfeInboxId = form.nfeInboxId;
      if (form.observacoes) body.observacoes = form.observacoes;

      const res = await apiFetch('/api/purchasing/cte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Erro ao registrar CT-e');
      }

      const created = await res.json();
      router.push(`/compras/cte/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/compras/cte" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registrar CT-e</h1>
          <p className="text-slate-500 text-sm mt-0.5">Conhecimento de Transporte Eletrônico de frete recebido</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Identificação */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">Identificação</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Número" required>
              <input type="text" value={form.numero} onChange={set('numero')} placeholder="000000000" className={inputClass} />
            </Field>
            <Field label="Série">
              <input type="text" value={form.serie} onChange={set('serie')} placeholder="1" className={inputClass} />
            </Field>
            <Field label="Data de Emissão" required>
              <input type="date" value={form.dataEmissao} onChange={set('dataEmissao')} className={inputClass} />
            </Field>
            <div className="md:col-span-3">
              <Field label="Chave de Acesso (44 dígitos)">
                <input
                  type="text"
                  value={form.chaveAcesso}
                  onChange={set('chaveAcesso')}
                  placeholder="00000000000000000000000000000000000000000000"
                  maxLength={44}
                  className={inputClass + ' font-mono'}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Transportadora */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Transportadora</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CNPJ" required>
              <input type="text" value={form.transportadoraCnpj} onChange={set('transportadoraCnpj')} placeholder="00.000.000/0001-00" className={inputClass} />
            </Field>
            <Field label="Inscrição Estadual">
              <input type="text" value={form.transportadoraIe} onChange={set('transportadoraIe')} className={inputClass} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Razão Social / Nome" required>
                <input type="text" value={form.transportadoraNome} onChange={set('transportadoraNome')} placeholder="Transportadora XYZ Ltda." className={inputClass} />
              </Field>
            </div>
          </div>
        </div>

        {/* Remetente / Destinatário */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Remetente e Destinatário</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Remetente (quem enviou a mercadoria)">
              <input type="text" value={form.remetenteNome} onChange={set('remetenteNome')} className={inputClass} />
            </Field>
            <Field label="Destinatário (quem recebeu)">
              <input type="text" value={form.destinatarioNome} onChange={set('destinatarioNome')} className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Transporte */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Dados do Transporte</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Modalidade" required>
              <select value={form.modalidade} onChange={set('modalidade')} className={selectClass}>
                {MODALIDADES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="CFOP" required>
              <input type="text" value={form.cfop} onChange={set('cfop')} placeholder="2352" maxLength={4} className={inputClass + ' font-mono'} />
            </Field>
            <Field label="Condição de Pagamento">
              <select value={form.condicaoPagamento} onChange={set('condicaoPagamento')} className={selectClass}>
                {CONDICOES_PAGAMENTO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Valores */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Valores</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Valor do Frete (R$)" required>
              <input type="number" step="0.01" min="0" value={form.valorFrete} onChange={set('valorFrete')} placeholder="0,00" className={inputClass} />
            </Field>
            <Field label="Seguro (R$)">
              <input type="number" step="0.01" min="0" value={form.valorSeguro} onChange={set('valorSeguro')} placeholder="0,00" className={inputClass} />
            </Field>
            <Field label="Outras Despesas (R$)">
              <input type="number" step="0.01" min="0" value={form.valorOutrasDespesas} onChange={set('valorOutrasDespesas')} placeholder="0,00" className={inputClass} />
            </Field>
            <Field label="Desconto (R$)">
              <input type="number" step="0.01" min="0" value={form.valorDesconto} onChange={set('valorDesconto')} placeholder="0,00" className={inputClass} />
            </Field>
          </div>
        </div>

        {/* ICMS */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">ICMS sobre o Frete</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Alíquota ICMS (%)">
              <input type="number" step="0.01" min="0" max="100" value={form.aliqIcms} onChange={set('aliqIcms')} placeholder="12" className={inputClass} />
            </Field>
            <Field label="Aproveitamento de Crédito ICMS">
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.creditoIcms}
                    onChange={(e) => setForm(prev => ({ ...prev, creditoIcms: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">Aproveitar crédito de ICMS sobre o frete</span>
                </label>
              </div>
            </Field>
            <Field label="Vencimento do Frete">
              <input type="date" value={form.dataVencimentoFrete} onChange={set('dataVencimentoFrete')} className={inputClass} />
            </Field>
          </div>
          {form.creditoIcms && form.valorFrete && form.aliqIcms && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
              Crédito estimado: <strong>{fmtCurrency(parseFloat(form.valorFrete || '0') * parseFloat(form.aliqIcms || '0') / 100)}</strong>
              {' '}— será lançado no livro fiscal ao escriturar.
            </div>
          )}
        </div>

        {/* Vínculos */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Vínculos (opcional)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="ID do Pedido de Compra">
              <input type="text" value={form.purchaseOrderId} onChange={set('purchaseOrderId')} placeholder="ID do pedido vinculado" className={inputClass} />
            </Field>
            <Field label="ID da NF-e de Entrada">
              <input type="text" value={form.nfeInboxId} onChange={set('nfeInboxId')} placeholder="ID da NF-e para rateio do frete" className={inputClass} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Ao vincular uma NF-e de Entrada, o custo do frete será rateado proporcionalmente nos itens ao escriturar o CT-e.
          </p>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <Field label="Observações">
            <textarea
              value={form.observacoes}
              onChange={set('observacoes')}
              rows={3}
              className={inputClass + ' resize-none'}
              placeholder="Informações complementares..."
            />
          </Field>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/compras/cte" className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Registrar CT-e'}
          </button>
        </div>
      </form>
    </div>
  );
}
