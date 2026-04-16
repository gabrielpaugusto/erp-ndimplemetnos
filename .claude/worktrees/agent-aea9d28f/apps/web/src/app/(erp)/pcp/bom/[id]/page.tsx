'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  Layers,
  Package,
  Zap,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface BomItem {
  id: string;
  bomId: string;
  productId: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  product: { id: string; code: string; description: string; unit: string };
}

interface BOM {
  id: string;
  productId: string;
  version: number;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  product: { id: string; code: string; description: string };
  _count: { items: number };
  items?: BomItem[];
}

interface ExplodedItem {
  productId: string;
  productDescription: string;
  productCode: string;
  unit: string;
  quantity: number;
  level: number;
  path: string;
}

function SkeletonDetail() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 h-24" />
        ))}
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-64" />
    </div>
  );
}

export default function BOMDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [bom, setBom] = useState<BOM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exploding, setExploding] = useState(false);
  const [explodedItems, setExplodedItems] = useState<ExplodedItem[] | null>(null);

  const fetchBOM = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/pcp/bom/${id}`);
      if (!res.ok) throw new Error('BOM não encontrada');
      const data: BOM = await res.json();
      setBom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar BOM');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBOM();
  }, [fetchBOM]);

  const handleToggleActive = async () => {
    if (!bom) return;
    setToggling(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/pcp/bom/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !bom.active }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar status');
      const updated: BOM = await res.json();
      setBom((prev) => prev ? { ...prev, active: updated.active } : prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!bom) return;
    if (!confirm(`Deseja excluir a BOM "${bom.product.description}" v${bom.version}? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/pcp/bom/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir BOM');
      router.push('/pcp/bom');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao excluir');
      setDeleting(false);
    }
  };

  const handleExplode = async () => {
    if (explodedItems) {
      setExplodedItems(null);
      return;
    }
    setExploding(true);
    setActionError('');
    try {
      const res = await apiFetch(`/api/pcp/bom/${id}/explode`);
      if (!res.ok) throw new Error('Erro ao explodir BOM');
      const data = await res.json();
      setExplodedItems(data.items ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao explodir BOM');
    } finally {
      setExploding(false);
    }
  };

  if (loading) return <SkeletonDetail />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pcp/bom" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">BOM</h1>
        </div>
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const items = bom?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/pcp/bom"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{bom?.product.code}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              bom?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {bom?.active ? 'Ativa' : 'Inativa'}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 font-mono">
              v{bom?.version}
            </span>
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">{bom?.product.description}</p>
          {bom?.description && <p className="text-xs text-slate-400 mt-0.5">{bom.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExplode}
            disabled={exploding}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              explodedItems
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            {exploding ? 'Explodindo...' : explodedItems ? 'Recolher BOM' : 'Explodir BOM'}
          </button>
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              bom?.active
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            {bom?.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {bom?.active ? 'Desativar' : 'Ativar'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="ml-auto p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900 truncate">{bom?.product.description}</p>
          <p className="text-xs text-slate-500 mt-1 font-mono">{bom?.product.code}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Versão</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">v{bom?.version}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Componentes</h3>
          </div>
          <p className="text-2xl font-bold text-orange-700">{bom?._count.items ?? items.length}</p>
          <p className="text-xs text-slate-500 mt-1">itens diretos</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Atualização</h3>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {bom ? new Date(bom.updatedAt).toLocaleDateString('pt-BR') : '-'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Criada em {bom ? new Date(bom.createdAt).toLocaleDateString('pt-BR') : '-'}
          </p>
        </div>
      </div>

      {/* Flat items table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-slate-900">Componentes Diretos</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Quantidade</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Unidade</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Perda (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum componente cadastrado nesta BOM.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className={`hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-4 py-2.5 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{item.product.code}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-900 font-medium">{item.product.description}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-900 text-center">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 text-center">{item.unit}</td>
                    <td className="px-4 py-2.5 text-sm text-center">
                      {item.wastagePercent > 0 ? (
                        <span className="text-amber-600 font-medium">{item.wastagePercent}%</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exploded BOM section */}
      {explodedItems && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">BOM Explodida</h2>
            <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {explodedItems.length} itens
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nível</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Quantidade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Unidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {explodedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                        {item.level}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ paddingLeft: `${16 + item.level * 16}px` }}>
                      <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{item.productCode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-900">{item.productDescription}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-900 text-center">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 text-center">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
