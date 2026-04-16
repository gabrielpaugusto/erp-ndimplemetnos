'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { fmtPercent, fmtCurrency } from '@/lib/format';
import { BarChart3, Info } from 'lucide-react';

interface RelatorioPeriodo {
  ano: number;
  mes: number;
}

interface RelatorioItem {
  plaqueta: string;
  descricao: string;
  type: string;
  localizacao: string | null;
  valorAquisicao: number;
  valorDepreciacao: number;
  valorAcumulado: number;
  valorResidual: number;
  percentDepreciado: number;
}

interface CostCenterGroup {
  itens: RelatorioItem[];
  totalDepreciacao: number;
}

interface RelatorioData {
  periodo: RelatorioPeriodo;
  totalGeral: number;
  quantidadeAtivos: number;
  porCentrodeCusto: Record<string, CostCenterGroup>;
}

const CC_LABELS: Record<string, string> = {
  CC_IND: 'Industrial',
  CC_COM: 'Comercial',
  CC_OFI: 'Oficina',
  CC_ADM: 'Administrativo',
  CC_FI: 'F&I',
};

const TYPE_LABELS: Record<string, string> = {
  MAQUINA_EQUIPAMENTO: 'Máquina/Equip.',
  VEICULO: 'Veículo',
  MOVEL_UTENSILIO: 'Móvel/Util.',
  IMOVEL: 'Imóvel',
  INFORMATICA: 'Informática',
  FERRAMENTA: 'Ferramenta',
  OUTRO: 'Outro',
};

function formatCurrency(value: number) { return fmtCurrency(value); }

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function RelatorioDepreciacaoPage() {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [data, setData] = useState<RelatorioData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/patrimonio/relatorio-depreciacao?ano=${ano}&mes=${mes}`);
      const result = await (res as any).json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => agora.getFullYear() - 2 + i);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatório de Depreciação</h1>
        <p className="text-sm text-gray-500 mt-1">GGF mensal por centro de custo</p>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-lg border p-4 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Período:</span>
        <select
          value={mes}
          onChange={e => setMes(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={ano}
          onChange={e => setAno(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {loading && <span className="text-sm text-gray-400">Carregando...</span>}
      </div>

      {/* Total GGF card */}
      {data && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Total GGF do Mês</span>
              </div>
              <p className="text-3xl font-bold text-orange-900">{formatCurrency(data.totalGeral)}</p>
              <p className="text-sm text-orange-700 mt-1">
                {data.quantidadeAtivos} ativo(s) depreciado(s) em {String(mes).padStart(2, '0')}/{ano}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-orange-600 font-medium">
                {MONTHS[mes - 1]} de {ano}
              </p>
            </div>
          </div>
          {data.totalGeral > 0 && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-orange-100 rounded-lg">
              <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">
                Este valor total de <strong>{formatCurrency(data.totalGeral)}</strong> deve ser rateado entre as OPs do mês como
                Gastos Gerais de Fabricação (GGF). Registre o lançamento contábil correspondente.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Groups by cost center */}
      {data && Object.keys(data.porCentrodeCusto).length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma depreciação registrada para {MONTHS[mes - 1]}/{ano}</p>
          <p className="text-xs mt-1">Execute o processamento mensal no Dashboard do Patrimônio.</p>
        </div>
      ) : (
        data && Object.entries(data.porCentrodeCusto).map(([cc, group]) => (
          <div key={cc} className="bg-white rounded-lg border overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-800">{CC_LABELS[cc] || cc}</span>
                <span className="ml-2 text-xs text-gray-500 font-mono">{cc}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-orange-700">
                  Subtotal: {formatCurrency(group.totalDepreciacao)}
                </span>
                <span className="ml-3 text-xs text-gray-500">{group.itens.length} ativo(s)</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 text-xs">Plaqueta</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 text-xs">Descrição</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 text-xs">Tipo</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">Vl. Aquisição</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">Deprec. Mensal</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">Acumulado</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">Residual</th>
                    <th className="px-4 py-2.5 text-center font-medium text-gray-500 text-xs">% Deprec.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.itens.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-blue-700">{item.plaqueta}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{item.descricao}</div>
                        {item.localizacao && <div className="text-xs text-gray-500">{item.localizacao}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{TYPE_LABELS[item.type] || item.type}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.valorAquisicao)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-orange-700">{formatCurrency(item.valorDepreciacao)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.valorAcumulado)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.valorResidual)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${item.percentDepreciado > 80 ? 'bg-red-500' : item.percentDepreciado > 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(item.percentDepreciado, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{fmtPercent(item.percentDepreciado, 0)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-orange-50">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-orange-800">
                      Subtotal {CC_LABELS[cc] || cc}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-orange-800">
                      {formatCurrency(group.totalDepreciacao)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Footer note */}
      {data && data.totalGeral > 0 && (
        <div className="text-center text-xs text-gray-400 pb-4">
          Relatório de Depreciação — {MONTHS[mes - 1]}/{ano} —
          Total GGF: {formatCurrency(data.totalGeral)}
        </div>
      )}
    </div>
  );
}
