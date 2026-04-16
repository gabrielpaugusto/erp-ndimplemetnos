'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Filter,
  X,
} from 'lucide-react';

type DocCategory = 'NF-e' | 'Boleto' | 'Orcamento' | 'Contrato' | 'OS';

interface Document {
  id: string;
  title: string;
  category: DocCategory;
  date: string;
  fileType: string;
  size: string;
}

const categoryColors: Record<DocCategory, string> = {
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

const mockDocuments: Document[] = [
  { id: '1', title: 'NF-e 001234 - Carroceria Bau Refrigerado 8m', category: 'NF-e', date: '2026-03-14', fileType: 'PDF', size: '245 KB' },
  { id: '2', title: 'NF-e 001234 - XML Autorizacao', category: 'NF-e', date: '2026-03-14', fileType: 'XML', size: '18 KB' },
  { id: '3', title: 'Boleto #5678 - Parcela 3/12', category: 'Boleto', date: '2026-03-12', fileType: 'PDF', size: '85 KB' },
  { id: '4', title: 'Boleto #5679 - Parcela 4/12', category: 'Boleto', date: '2026-03-12', fileType: 'PDF', size: '85 KB' },
  { id: '5', title: 'Orcamento ORC-2026-045 - Carroceria Sider 10m', category: 'Orcamento', date: '2026-03-10', fileType: 'PDF', size: '520 KB' },
  { id: '6', title: 'Contrato de Venda CV-2026-012', category: 'Contrato', date: '2026-03-05', fileType: 'PDF', size: '1.2 MB' },
  { id: '7', title: 'NF-e 001198 - Plataforma Carga Seca 7m', category: 'NF-e', date: '2026-02-28', fileType: 'PDF', size: '238 KB' },
  { id: '8', title: 'OS-2026-089 - Manutencao Preventiva', category: 'OS', date: '2026-02-25', fileType: 'PDF', size: '312 KB' },
  { id: '9', title: 'Orcamento ORC-2026-038 - Semi-Reboque Basculante', category: 'Orcamento', date: '2026-02-20', fileType: 'PDF', size: '480 KB' },
  { id: '10', title: 'Contrato de Manutencao CM-2026-003', category: 'Contrato', date: '2026-02-15', fileType: 'PDF', size: '890 KB' },
];

const categories: DocCategory[] = ['NF-e', 'Boleto', 'Orcamento', 'Contrato', 'OS'];

export default function PortalDocumentosPage() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    let filtered = [...mockDocuments];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((d) => d.title.toLowerCase().includes(q));
    }
    if (categoryFilter) {
      filtered = filtered.filter((d) => d.category === categoryFilter);
    }
    setDocuments(filtered);
  }, [search, categoryFilter]);

  const hasFilters = search || categoryFilter;

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
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tamanho</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => {
                const IconComp = fileIcons[doc.fileType] || FileText;
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <IconComp className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryColors[doc.category]}`}>
                        {doc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(doc.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {doc.fileType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 text-right">{doc.size}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {documents.length === 0 && (
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
