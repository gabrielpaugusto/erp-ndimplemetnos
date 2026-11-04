'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  Trash2,
  Building2,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductSupplier {
  id: string;
  codigoFornecedor: string;
  descricaoFornecedor: string;
  ncmFornecedor: string | null;
  unidadeFornecedor: string | null;
  fatorConversao: number | null;
  precoUltCompra: number | null;
  prazoEntregaDias: number | null;
  preferred: boolean;
  person: {
    id: string;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    cpfCnpj: string | null;
  } | null;
  product: {
    id: string;
    code: string;
    description: string;
    unit: string;
  } | null;
}

interface FormState {
  codigoFornecedor: string;
  descricaoFornecedor: string;
  ncmFornecedor: string;
  unidadeFornecedor: string;
  fatorConversao: string;
  precoUltCompra: string;
  prazoEntregaDias: string;
  preferred: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCnpj(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return raw;
}

function supplierName(record: ProductSupplier): string {
  return record.person?.razaoSocial || record.person?.nomeFantasia || '—';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogoFornecedorEditPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = params?.id as string;

  const [record, setRecord] = useState<ProductSupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormState>({
    codigoFornecedor: '',
    descricaoFornecedor: '',
    ncmFornecedor: '',
    unidadeFornecedor: '',
    fatorConversao: '1',
    precoUltCompra: '',
    prazoEntregaDias: '',
    preferred: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/purchasing/product-suppliers/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as any).message || 'Registro não encontrado');
        return;
      }
      const data: ProductSupplier = await res.json();
      setRecord(data);
      setForm({
        codigoFornecedor: data.codigoFornecedor ?? '',
        descricaoFornecedor: data.descricaoFornecedor ?? '',
        ncmFornecedor: data.ncmFornecedor ?? '',
        unidadeFornecedor: data.unidadeFornecedor ?? '',
        fatorConversao: String(data.fatorConversao ?? 1),
        precoUltCompra: data.precoUltCompra != null ? String(data.precoUltCompra) : '',
        prazoEntregaDias: data.prazoEntregaDias != null ? String(data.prazoEntregaDias) : '',
        preferred: data.preferred ?? false,
      });
    } catch {
      setError('Erro ao carregar registro. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function handleChange(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        codigoFornecedor: form.codigoFornecedor,
        descricaoFornecedor: form.descricaoFornecedor,
        preferred: form.preferred,
      };
      if (form.ncmFornecedor.trim()) payload.ncmFornecedor = form.ncmFornecedor.trim();
      if (form.unidadeFornecedor.trim()) payload.unidadeFornecedor = form.unidadeFornecedor.trim();
      if (form.fatorConversao.trim()) payload.fatorConversao = Number(form.fatorConversao);
      if (form.precoUltCompra.trim()) payload.precoUltCompra = Number(form.precoUltCompra);
      if (form.prazoEntregaDias.trim()) payload.prazoEntregaDias = Number(form.prazoEntregaDias);

      const res = await apiFetch(`/api/purchasing/product-suppliers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao salvar');
        return;
      }
      toast.success('Vínculo atualizado com sucesso.');
      router.push('/compras/catalogo-fornecedores');
    } catch {
      toast.error('Erro de conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/purchasing/product-suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message || 'Erro ao excluir');
        setConfirmDelete(false);
        return;
      }
      toast.success('Vínculo excluído.');
      router.push('/compras/catalogo-fornecedores');
    } catch {
      toast.error('Erro de conexão ao excluir.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-sm">Carregando...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <Link href="/compras/catalogo-fornecedores" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error || 'Registro não encontrado.'}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/compras/catalogo-fornecedores"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Catálogo de Fornecedores
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Editar Vínculo</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Atualize os dados de mapeamento entre produto do fornecedor e catálogo interno.
        </p>
      </div>

      {/* Read-only context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex items-start gap-3">
          <Building2 className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Fornecedor</p>
            <p className="font-semibold text-slate-800 truncate">{supplierName(record)}</p>
            <p className="text-xs text-slate-400 font-mono">{formatCnpj(record.person?.cpfCnpj)}</p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex items-start gap-3">
          <Package className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Produto Interno</p>
            <p className="font-semibold text-slate-800 truncate">{record.product?.description || '—'}</p>
            <p className="text-xs text-slate-400 font-mono">{record.product?.code || '—'} · {record.product?.unit || '—'}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white rounded-lg border border-slate-200 shadow-sm divide-y divide-slate-100">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Dados do Fornecedor</h2>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Código Fornecedor */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Código do Fornecedor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.codigoFornecedor}
              onChange={(e) => handleChange('codigoFornecedor', e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Ex: SUP-001"
            />
          </div>

          {/* NCM Fornecedor */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              NCM Fornecedor
            </label>
            <input
              type="text"
              value={form.ncmFornecedor}
              onChange={(e) => handleChange('ncmFornecedor', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Ex: 8708.99.90"
            />
          </div>

          {/* Descrição Fornecedor */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descrição do Fornecedor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.descricaoFornecedor}
              onChange={(e) => handleChange('descricaoFornecedor', e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descrição conforme catálogo do fornecedor"
            />
          </div>

          {/* Unidade Fornecedor */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Unidade do Fornecedor
            </label>
            <input
              type="text"
              value={form.unidadeFornecedor}
              onChange={(e) => handleChange('unidadeFornecedor', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: CX, PC, KG"
            />
          </div>

          {/* Fator de Conversão */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Fator de Conversão
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.fatorConversao}
              onChange={(e) => handleChange('fatorConversao', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1"
            />
            <p className="text-xs text-slate-400 mt-1">Unidades do fornecedor por unidade interna</p>
          </div>

          {/* Preço Última Compra */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Preço Última Compra (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.precoUltCompra}
              onChange={(e) => handleChange('precoUltCompra', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0,00"
            />
          </div>

          {/* Prazo de Entrega */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Prazo de Entrega (dias)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={form.prazoEntregaDias}
              onChange={(e) => handleChange('prazoEntregaDias', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 7"
            />
          </div>

          {/* Fornecedor Preferencial */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.preferred}
                onChange={(e) => handleChange('preferred', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Fornecedor Preferencial</span>
              <span className="text-xs text-slate-400">(aparece em destaque nas cotações)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Excluir
          </button>

          <div className="flex items-center gap-3">
            <Link
              href="/compras/catalogo-fornecedores"
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </form>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Excluir vínculo?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Esta ação é irreversível. O mapeamento entre{' '}
              <strong>{supplierName(record)}</strong> e{' '}
              <strong>{record.product?.description}</strong> será removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
