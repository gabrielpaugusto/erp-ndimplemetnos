'use client';

import { useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Database,
  BookOpen,
  BarChart3,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { fmtFileSize } from '@/lib/format';

// ── Types ────────────────────────────────────────────────────────────────────

type SpedType = 'fiscal' | 'contribuicoes' | 'ecd' | 'ecf';

interface PreviewData {
  totalLinhas: number;
  tamanhoBytes: number;
  periodo: { inicio: string; fim: string };
  registros: Record<string, number>;
  primeiros100: string[];
}

// ── Metadata ─────────────────────────────────────────────────────────────────

const SPED_EFD = [
  {
    key: 'fiscal' as SpedType,
    title: 'EFD ICMS/IPI',
    subtitle: 'SPED Fiscal — Layout 017',
    desc: 'Escrituração Fiscal Digital de ICMS e IPI. Contempla Bloco 0, C (NF-e), E (apuração ICMS), G (CIAP), H (inventário), K (produção) e Bloco 9.',
    color: 'blue',
    icon: FileText,
    blocos: ['0 — Identificação', 'C — Mercadorias NF-e', 'E — Apuração ICMS', 'G — CIAP', 'H — Inventário', 'K — Produção', '9 — Encerramento'],
  },
  {
    key: 'contribuicoes' as SpedType,
    title: 'EFD Contribuições',
    subtitle: 'EFD PIS/COFINS — Layout 006',
    desc: 'Escrituração Fiscal Digital de PIS e COFINS. Contempla Bloco 0, A (serviços), C (mercadorias), M (apuração PIS/COFINS) e Bloco 9.',
    color: 'violet',
    icon: FileText,
    blocos: ['0 — Identificação', 'A — Serviços NFS-e', 'C — Mercadorias NF-e', 'M — Apuração PIS/COFINS', '9 — Encerramento'],
  },
];

const SPED_CONTABIL = [
  {
    key: 'ecd' as SpedType,
    title: 'ECD — SPED Contábil',
    subtitle: 'Escrituração Contábil Digital — Layout 010',
    desc: 'Escrituração Contábil Digital. Contempla o Plano de Contas (I050), Lançamentos (I200/I250), Totalização por conta (I355), Balanço Patrimonial (J100) e DRE sintética (J210).',
    color: 'emerald',
    icon: BookOpen,
    blocos: ['0 — Identificação', 'I — Lançamentos Contábeis', 'I050 — Plano de Contas', 'I200/I250 — Diário Geral', 'J100 — Balanço Patrimonial', 'J210 — DRE', '9 — Encerramento'],
  },
  {
    key: 'ecf' as SpedType,
    title: 'ECF — Escrituração Fiscal',
    subtitle: 'Escrituração Contábil Fiscal — Layout 010',
    desc: 'Declaração anual de Imposto de Renda (IRPJ) e CSLL pelo regime de Lucro Real. Contempla Balanço/DRE (Bloco L), e-LALUR (Bloco M) e cálculo do IRPJ/CSLL (Bloco N).',
    color: 'amber',
    icon: BarChart3,
    blocos: ['0 — Identificação', 'C — Dados da Empresa', 'L — Balanço e DRE (Lucro Real)', 'M — e-LALUR / e-LACS', 'N — IRPJ (15%+10% adicional) e CSLL (9%)', '9 — Encerramento'],
  },
];

// ── Color maps ────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, Record<string, string>> = {
  blue: {
    card: 'border-blue-200', header: 'bg-blue-50 border-blue-200', icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700',
    btnOutline: 'border-blue-300 text-blue-600 hover:bg-blue-50',
  },
  violet: {
    card: 'border-violet-200', header: 'bg-violet-50 border-violet-200', icon: 'text-violet-600',
    badge: 'bg-violet-100 text-violet-700', btn: 'bg-violet-600 hover:bg-violet-700',
    btnOutline: 'border-violet-300 text-violet-600 hover:bg-violet-50',
  },
  emerald: {
    card: 'border-emerald-200', header: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700',
    btnOutline: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50',
  },
  amber: {
    card: 'border-amber-200', header: 'bg-amber-50 border-amber-200', icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700',
    btnOutline: 'border-amber-300 text-amber-600 hover:bg-amber-50',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFirstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getLastDayOfMonth() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function fmtBytes(bytes: number) {
  return fmtFileSize(bytes);
}

// ── Component ─────────────────────────────────────────────────────────────────

const initialLoading = { fiscal: false, contribuicoes: false, ecd: false, ecf: false };
const initialPreviews = { fiscal: null, contribuicoes: null, ecd: null, ecf: null };

export default function SpedPage() {
  const toast = useToast();

  // EFD period (mensal)
  const [periodoInicio, setPeriodoInicio] = useState(getFirstDayOfMonth());
  const [periodoFim, setPeriodoFim] = useState(getLastDayOfMonth());

  // ECD/ECF year
  const [anoContabil, setAnoContabil] = useState(new Date().getFullYear());

  const [loading, setLoading]     = useState<Record<SpedType, boolean>>(initialLoading);
  const [previewing, setPreviewing] = useState<Record<SpedType, boolean>>(initialLoading);
  const [previews, setPreviews]   = useState<Record<SpedType, PreviewData | null>>(initialPreviews);
  const [activePreview, setActivePreview] = useState<SpedType | null>(null);
  const [showLines, setShowLines] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const isContabil = (type: SpedType) => type === 'ecd' || type === 'ecf';

  const buildParams = (type: SpedType) => {
    if (isContabil(type)) return new URLSearchParams({ ano: String(anoContabil) });
    return new URLSearchParams({ periodoInicio, periodoFim });
  };

  const buildFilename = (type: SpedType) => {
    if (type === 'ecd') return `ECD_${anoContabil}.txt`;
    if (type === 'ecf') return `ECF_${anoContabil}.txt`;
    const anoMes = periodoInicio.substring(0, 7).replace('-', '');
    return type === 'fiscal' ? `EFD_ICMS_IPI_${anoMes}.txt` : `EFD_CONTRIBUICOES_${anoMes}.txt`;
  };

  const handleDownload = async (type: SpedType) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const res = await apiFetch(`/api/sped/${type}?${buildParams(type)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        toast.error(err.message || `Erro ao gerar ${type.toUpperCase()}`);
        return;
      }
      const blob = await res.blob();
      const filename = buildFilename(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${filename} gerado com sucesso`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar arquivo');
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handlePreview = async (type: SpedType) => {
    setPreviewing(prev => ({ ...prev, [type]: true }));
    try {
      const res = await apiFetch(`/api/sped/${type}/preview?${buildParams(type)}`);
      if (res.ok) {
        const data: PreviewData = await res.json();
        setPreviews(prev => ({ ...prev, [type]: data }));
        setActivePreview(type);
        setShowLines(false);
      } else {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        toast.error(err.message || 'Erro ao gerar preview');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar preview');
    } finally {
      setPreviewing(prev => ({ ...prev, [type]: false }));
    }
  };

  // ── Preview title ────────────────────────────────────────────────────────────

  const previewTitle = (type: SpedType) => {
    if (type === 'ecd') return 'ECD — SPED Contábil';
    if (type === 'ecf') return 'ECF — Escrituração Fiscal';
    if (type === 'fiscal') return 'EFD ICMS/IPI';
    return 'EFD Contribuições';
  };

  // ── Render card ──────────────────────────────────────────────────────────────

  const renderCard = (sped: typeof SPED_EFD[0]) => {
    const c = COLOR_MAP[sped.color];
    const Icon = sped.icon;
    const prev = previews[sped.key];

    return (
      <div key={sped.key} className={`bg-white rounded-xl border ${c.card} overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${c.header}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${c.icon}`} />
              <div>
                <h3 className="font-semibold text-slate-900">{sped.title}</h3>
                <p className="text-xs text-slate-500">{sped.subtitle}</p>
              </div>
            </div>
            {prev && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}`}>
                <CheckCircle className="w-3 h-3" />
                {prev.totalLinhas.toLocaleString('pt-BR')} linhas
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">{sped.desc}</p>

          {/* Blocos */}
          <div className="space-y-1">
            {sped.blocos.map(bloco => (
              <div key={bloco} className="flex items-center gap-2 text-xs text-slate-500">
                <ChevronRight className="w-3 h-3 text-slate-400" />
                {bloco}
              </div>
            ))}
          </div>

          {/* Preview summary */}
          {prev && (
            <div className={`p-3 rounded-lg ${c.header} space-y-1`}>
              <p className="text-xs font-medium text-slate-700">Última prévia gerada:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {Object.entries(prev.registros)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .slice(0, 10)
                  .map(([reg, count]) => (
                    <span key={reg} className="text-xs text-slate-600">
                      <span className="font-mono font-medium">{reg}</span>: {count}
                    </span>
                  ))}
                {Object.keys(prev.registros).length > 10 && (
                  <span className="text-xs text-slate-400">+{Object.keys(prev.registros).length - 10} registros...</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Tamanho: {fmtBytes(prev.tamanhoBytes)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleDownload(sped.key)}
              disabled={loading[sped.key]}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${c.btn}`}
            >
              {loading[sped.key] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loading[sped.key] ? 'Gerando...' : 'Baixar .txt'}
            </button>
            <button
              onClick={() => handlePreview(sped.key)}
              disabled={previewing[sped.key]}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${c.btnOutline}`}
            >
              {previewing[sped.key] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              Prévia
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SPED — Escrituração Digital</h1>
        <p className="text-sm text-slate-500 mt-1">
          Geração dos arquivos EFD (fiscal/mensal) e SPED Contábil/Fiscal (ECD e ECF — anual).
        </p>
      </div>

      {/* ── EFD — Período mensal ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">EFD — Período de Apuração (mensal)</h2>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Início</label>
            <input
              type="date"
              value={periodoInicio}
              onChange={e => setPeriodoInicio(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fim</label>
            <input
              type="date"
              value={periodoFim}
              onChange={e => setPeriodoFim(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2 mt-4">
            <button
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                const y = d.getFullYear(); const m = d.getMonth() + 1;
                const last = new Date(y, m, 0).getDate();
                setPeriodoInicio(`${y}-${String(m).padStart(2, '0')}-01`);
                setPeriodoFim(`${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`);
              }}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >Mês anterior</button>
            <button
              onClick={() => { setPeriodoInicio(getFirstDayOfMonth()); setPeriodoFim(getLastDayOfMonth()); }}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >Mês atual</button>
          </div>
        </div>
      </div>

      {/* EFD cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SPED_EFD.map(renderCard)}
      </div>

      {/* ── ECD/ECF — Ano de referência ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-700">ECD / ECF — Ano-Calendário</h2>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ano de Referência</label>
            <input
              type="number"
              min="2020"
              max="2099"
              value={anoContabil}
              onChange={e => setAnoContabil(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-end gap-2 mt-4">
            <button
              onClick={() => setAnoContabil(new Date().getFullYear() - 1)}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >Ano anterior</button>
            <button
              onClick={() => setAnoContabil(new Date().getFullYear())}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >Ano atual</button>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            ECD: entrega até 31/07 do ano seguinte · ECF: entrega até 31/07 do ano seguinte
          </p>
        </div>
      </div>

      {/* ECD/ECF cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SPED_CONTABIL.map(renderCard)}
      </div>

      {/* ── Preview detail panel ── */}
      {activePreview && previews[activePreview] && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Prévia — {previewTitle(activePreview)}
              </h3>
              <span className="text-xs text-slate-400">
                {previews[activePreview]!.periodo.inicio} a {previews[activePreview]!.periodo.fim}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLines(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {showLines ? 'Ocultar registros' : 'Ver primeiros 100'}
              </button>
              <button
                onClick={() => setActivePreview(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Fechar
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Total de Linhas</p>
                <p className="text-xl font-bold text-slate-900">{previews[activePreview]!.totalLinhas.toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Tamanho do Arquivo</p>
                <p className="text-xl font-bold text-slate-900">{fmtBytes(previews[activePreview]!.tamanhoBytes)}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Tipos de Registro</p>
                <p className="text-xl font-bold text-slate-900">{Object.keys(previews[activePreview]!.registros).length}</p>
              </div>
            </div>

            {/* Register counts table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Registro</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Qtd Linhas</th>
                    <th className="px-3 py-2 w-48"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(previews[activePreview]!.registros)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([reg, count]) => {
                      const maxCount = Math.max(...Object.values(previews[activePreview]!.registros));
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <tr key={reg} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-medium text-slate-700">{reg}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">{count.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2">
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Raw lines preview */}
            {showLines && (
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">
                  {previews[activePreview]!.primeiros100.join('\n')}
                </pre>
              </div>
            )}

            {!previews[activePreview]!.primeiros100.length && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-amber-700">
                  Nenhum dado encontrado para o período/ano selecionado. Verifique se há lançamentos contábeis ou documentos escriturados.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
