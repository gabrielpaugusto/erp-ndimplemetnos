'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  X,
} from 'lucide-react';
import { portalFetch } from '@/lib/api';

type DocCategory = string;

interface Document {
  id: string;
  title: string;
  category: DocCategory;
  date: string;
  fileType: string;
  size?: string;
}

const categoryColors: Record<string, string> = {
  'NF-e': 'bg-blue-100 text-blue-700',
  'Boleto': 'bg-amber-100 text-amber-700',
  'Orcamento': 'bg-violet-100 text-violet-700',
  'Contrato': 'bg-emerald-100 text-emerald-700',
  'OS': 'bg-orange-100 text-orange-700',
};

const fileIcons: Record<string, typeof FileText> = {
  PDF: FileText,
  XML: FileSpreadsheet,
  XLSX: FileSpreadsheet,
  DOCX: File,
};

const categories = ['NF-e', 'Boleto', 'Orcamento', 'Contrato', 'OS'];

export default function PortalDocumentosPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await portalFetch(`/api/portal/documents?${params}`);
      if (res.ok) {
        const d = await res.json();
        const items: Document[] = (d.data ?? d ?? []).map((doc: any) => ({
          id: doc.id,
          title: doc.title ?? doc.fileName ?? doc.description ?? 'Documento',
          category: doc.category ?? doc.type ?? 'Outros',
          date: doc.createdAt ?? doc.date ?? '',
          fileType: (doc.fileType ?? doc.mimeType ?? 'PDF').toUpperCase().replace('APPLICATION/', '').replace('TEXT/', ''),
          size: doc.size ?? doc.fileSize,
        }));
        setDocuments(items);
      }
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const filtered = search
    ? documents.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
    : documents;

  const hasFilters = search || categoryFilter;

  const handleDownload = async (doc: Document) => {
    try {
      const res = await portalFetch(`/api/portal/documents/${doc.id}/download`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silencioso */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Meus Documentos</h1>
        <p className="text-slate-500 mt-1 text-sm">Acesse notas fiscais, boletos, orcamentos e contratos.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setCategoryFilter(''); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Documento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                {filtered.some((d) => d.size) && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tamanho</th>
                )}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">Carregando...</td></tr>
              ) : filtered.map((doc) => {
                const IconComp = fileIcons[doc.fileType] || FileText;
                const catColor = categoryColors[doc.category] ?? 'bg-slate-100 text-slate-600';
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <IconComp className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${catColor}`}>
                        {doc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {doc.date ? new Date(doc.date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {doc.fileType}
                      </span>
                    </td>
                    {filtered.some((d) => d.size) && (
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">{doc.size ?? '—'}</td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhum documento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
