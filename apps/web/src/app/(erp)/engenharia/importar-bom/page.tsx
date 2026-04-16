'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ChevronRight, Search, X, Loader2 } from 'lucide-react';
import { api, apiFetch } from '@/lib/api';

interface ParsedRow {
  item: string;
  partNumber: string;
  descricao: string;
  material: string;
  quantidade: number;
  unidade: string;
  peso: number | null;
  acabamento: string;
  revisao: string;
  observacoes: string;
}

interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

interface Product {
  id: string;
  code: string;
  description: string;
  type: string;
  unit: string;
}

type Step = 1 | 2 | 3;

export default function ImportarBomPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — selecionar produto pai
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Step 2 — upload e preview
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 3 — confirmação / resultado
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ bomId: string; version: number; totalItens: number } | null>(null);
  const [importError, setImportError] = useState('');

  // ── Busca de produtos ──────────────────────────────────────────────────────
  const searchProducts = useCallback(async (q: string) => {
    if (q.length < 2) { setProducts([]); return; }
    setSearching(true);
    try {
      const data = await api<{ data: Product[] }>(`/engineering/products?search=${encodeURIComponent(q)}&limit=10`);
      setProducts(data.data ?? []);
    } catch {
      setProducts([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    searchProducts(v);
  };

  // ── Upload e parse ─────────────────────────────────────────────────────────
  const handleFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    setParseResult(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const resp = await apiFetch('/api/engineering/bom/parse', {
        method: 'POST',
        body: fd,
      });
      const data: ParseResult = await resp.json();
      if (!resp.ok) throw new Error((data as any).message || 'Erro ao processar arquivo.');
      setParseResult(data);
    } catch (err: any) {
      setParseResult({ rows: [], errors: [err.message ?? 'Erro ao processar arquivo.'] });
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Confirmar importação ───────────────────────────────────────────────────
  const handleImport = async () => {
    if (!selectedProduct || !parseResult || parseResult.rows.length === 0) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await api<{ bomId: string; version: number; totalItens: number }>('/engineering/bom/import', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.id,
          rows: parseResult.rows,
          description: `BOM importada do SolidWorks — ${file?.name ?? ''}`,
        }),
      });
      setImportResult(result);
      setStep(3);
    } catch (err: any) {
      setImportError(err.message ?? 'Erro ao importar BOM.');
    } finally {
      setImporting(false);
    }
  };

  // ── Reiniciar ──────────────────────────────────────────────────────────────
  const reset = () => {
    setStep(1);
    setSearch(''); setProducts([]); setSelectedProduct(null);
    setFile(null); setParseResult(null);
    setImportResult(null); setImportError('');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Importar BOM do SolidWorks</h1>
        <p className="text-sm text-slate-500 mt-0.5">Importa lista de materiais exportada do SolidWorks (.xlsx)</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {(['1', '2', '3'] as const).map((s, idx) => {
          const labels = ['Selecionar Produto', 'Upload e Preview', 'Confirmar'];
          const active = step === (idx + 1 as Step);
          const done   = step > (idx + 1);
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${active ? 'bg-primary-700 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <span>{s}</span>}
                {labels[idx]}
              </div>
              {idx < 2 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Selecionar produto pai ─────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Qual produto esta BOM pertence?</h2>
          <p className="text-sm text-slate-500 mb-4">Busque pelo código ou descrição do produto pai (ex: a carroceria ou implemento que está sendo montado).</p>

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Buscar por código ou descrição..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />}
          </div>

          {products.length > 0 && !selectedProduct && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProduct(p); setProducts([]); setSearch(`${p.code} — ${p.description}`); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.description}</p>
                    <p className="text-xs text-slate-400">{p.code} · {p.type} · {p.unit}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>
          )}

          {selectedProduct && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-green-800">{selectedProduct.description}</p>
                <p className="text-xs text-green-600">{selectedProduct.code} · {selectedProduct.type}</p>
              </div>
              <button onClick={() => { setSelectedProduct(null); setSearch(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            disabled={!selectedProduct}
            onClick={() => setStep(2)}
            className="mt-2 bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm"
          >
            Próximo — Upload do Arquivo
          </button>
        </div>
      )}

      {/* ── STEP 2: Upload e preview ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Dropzone */}
          {!parseResult && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-slate-300 bg-slate-50 hover:border-primary-400 hover:bg-slate-100'}`}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {parsing ? (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
                  <p className="text-sm font-medium">Processando arquivo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <FileSpreadsheet className="w-10 h-10 text-primary-500" />
                  <div>
                    <p className="font-medium text-slate-700">Arraste o arquivo Excel aqui</p>
                    <p className="text-sm mt-0.5">ou clique para selecionar (.xlsx)</p>
                  </div>
                  <p className="text-xs text-slate-400">Máx. 10 MB · Exportado do SolidWorks via "Salvar Como Excel"</p>
                </div>
              )}
            </div>
          )}

          {/* Erros de parse */}
          {parseResult && parseResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm font-semibold text-red-700">Avisos ({parseResult.errors.length})</p>
              </div>
              <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
                {parseResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Preview tabela */}
          {parseResult && parseResult.rows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {file?.name} — {parseResult.rows.length} itens encontrados
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    BOM para: <span className="font-medium text-slate-600">{selectedProduct?.description}</span>
                  </p>
                </div>
                <button onClick={() => { setFile(null); setParseResult(null); }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                  <X className="w-3 h-3" /> Trocar arquivo
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-12">Item</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Part Number</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Descrição</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Material</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500">Qtd</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Un</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500">Peso (kg)</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parseResult.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400">{row.item}</td>
                        <td className="px-4 py-2 font-mono font-medium text-slate-700">{row.partNumber}</td>
                        <td className="px-4 py-2 text-slate-700">{row.descricao}</td>
                        <td className="px-4 py-2 text-slate-500">{row.material}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-700">{row.quantidade}</td>
                        <td className="px-4 py-2 text-slate-500">{row.unidade}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{row.peso ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-400 max-w-xs truncate">
                          {[row.acabamento, row.revisao ? `Rev.${row.revisao}` : '', row.observacoes].filter(Boolean).join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parseResult && parseResult.rows.length === 0 && parseResult.errors.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Upload className="w-10 h-10 mx-auto mb-2" />
              <p>Nenhum item válido encontrado no arquivo.</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-lg text-sm hover:bg-slate-50">
              Voltar
            </button>
            {parseResult && parseResult.rows.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : `Confirmar Importação (${parseResult.rows.length} itens)`}
              </button>
            )}
          </div>

          {importError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {importError}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Resultado ─────────────────────────────────────────────── */}
      {step === 3 && importResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-1">BOM importada com sucesso!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Produto: <span className="font-semibold text-slate-700">{selectedProduct?.description}</span>
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xl font-bold text-primary-700">v{importResult.version}</p>
              <p className="text-xs text-slate-500">Versão</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xl font-bold text-slate-800">{importResult.totalItens}</p>
              <p className="text-xs text-slate-500">Itens</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xl font-bold text-green-700">OK</p>
              <p className="text-xs text-slate-500">Status</p>
            </div>
          </div>
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-lg text-sm hover:bg-slate-50">
              Importar outro arquivo
            </button>
            <a href="/pcp/bom" className="bg-primary-700 hover:bg-primary-800 text-white font-medium px-5 py-2.5 rounded-lg text-sm">
              Ver BOMs no PCP
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
