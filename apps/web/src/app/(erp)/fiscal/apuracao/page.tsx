'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Lock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtPercent, fmtCurrency } from '@/lib/format';

const formatCurrency = (value: number) => fmtCurrency(value);

type TaxType = 'ICMS' | 'IPI' | 'PIS' | 'COFINS' | 'IBS' | 'CBS' | 'IS';

interface ApuracaoData {
  tributo: TaxType;
  debitos: number;
  creditos: number;
  ajustesDebito: number;
  ajustesCredito: number;
  saldoAnterior: number;
  saldoApagar: number;
  creditoAcumulado: number;
  status: 'ABERTA' | 'FECHADA';
}

const TAX_TYPES: TaxType[] = ['ICMS', 'IPI', 'PIS', 'COFINS', 'IBS', 'CBS', 'IS'];

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];


export default function ApuracaoPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [selectedTab, setSelectedTab] = useState<TaxType>('ICMS');
  const [apuracoes, setApuracoes] = useState<ApuracaoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingPeriod, setClosingPeriod] = useState(false);

  const periodoKey = `${ano}-${String(mes).padStart(2, '0')}`;

  const fetchApuracoes = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        TAX_TYPES.map(async (taxType) => {
          try {
            const res = await apiFetch(
              `/api/fiscal/books/apuracao?periodoReferencia=${periodoKey}&taxType=${taxType}`,
            );
            if (!res.ok) return null;
            const d = await res.json();
            return {
              tributo: taxType,
              debitos: Number(d.totalDebitos ?? 0),
              creditos: Number(d.totalCreditos ?? 0),
              ajustesDebito: Number(d.ajustesDebito ?? 0),
              ajustesCredito: Number(d.ajustesCredito ?? 0),
              saldoAnterior: Number(d.saldoAnterior ?? 0),
              saldoApagar: Number(d.impostoAPagar ?? 0),
              creditoAcumulado: Number(d.saldoCredor ?? 0),
              status: (d.status ?? 'ABERTA') as 'ABERTA' | 'FECHADA',
            } as ApuracaoData;
          } catch {
            return null;
          }
        }),
      );
      setApuracoes(results.filter(Boolean) as ApuracaoData[]);
    } finally {
      setLoading(false);
    }
  }, [periodoKey]);

  useEffect(() => { fetchApuracoes(); }, [fetchApuracoes]);

  const selectedApuracao = apuracoes.find((a) => a.tributo === selectedTab);
  const periodoStatus = apuracoes.length > 0 ? apuracoes[0].status : 'ABERTA';

  const handleClosePeriodo = async () => {
    if (!selectedApuracao) return;
    setClosingPeriod(true);
    try {
      await apiFetch('/api/fiscal/books/apuracao/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoReferencia: periodoKey, taxType: selectedTab }),
      });
      await fetchApuracoes();
    } finally {
      setClosingPeriod(false);
    }
  };

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAno(ano - 1); }
    else setMes(mes - 1);
  };

  const nextMonth = () => {
    if (mes === 12) { setMes(1); setAno(ano + 1); }
    else setMes(mes + 1);
  };

  const isReforma = selectedTab === 'IBS' || selectedTab === 'CBS' || selectedTab === 'IS';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Apuração de Impostos</h1>
          <p className="text-slate-500 mt-1">
            Apuração mensal de tributos — débitos, créditos, ajustes e saldo
          </p>
        </div>
        <button
          onClick={fetchApuracoes}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-lg font-bold text-slate-900 min-w-[200px] text-center">
                {meses[mes - 1]} / {ano}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
              periodoStatus === 'ABERTA' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {periodoStatus === 'ABERTA' ? 'Aberta' : 'Fechada'}
            </span>
            {periodoStatus === 'ABERTA' && apuracoes.length > 0 && (
              <button
                onClick={handleClosePeriodo}
                disabled={closingPeriod}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Lock className="w-4 h-4" />
                {closingPeriod ? 'Fechando...' : 'Fechar Período'}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : apuracoes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma apuração encontrada para o período selecionado.</p>
          <p className="text-xs text-slate-400 mt-1">Use o botão Calcular no módulo de Livros Fiscais para gerar a apuração.</p>
        </div>
      ) : (
        <>
          {/* Tax Type Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="border-b border-slate-200">
              <div className="flex">
                {(['ICMS', 'IPI', 'PIS', 'COFINS'] as TaxType[]).map((tax) => (
                  <button
                    key={tax}
                    onClick={() => setSelectedTab(tax)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      selectedTab === tax
                        ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {tax}
                  </button>
                ))}
                <div className="w-px bg-slate-200 my-2" />
                {(['IBS', 'CBS', 'IS'] as TaxType[]).map((tax) => (
                  <button
                    key={tax}
                    onClick={() => setSelectedTab(tax)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      selectedTab === tax
                        ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {tax}
                      <ArrowRightLeft className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedApuracao && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedTab} — {meses[mes - 1]}/{ano}
                  </h2>
                  {isReforma && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-xs font-medium text-teal-700">
                      <ArrowRightLeft className="w-3 h-3" />
                      Reforma Tributária
                    </span>
                  )}
                </div>

                {/* Main values grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-xs text-red-600 font-medium mb-1">Débitos</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(selectedApuracao.debitos)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-xs text-emerald-600 font-medium mb-1">Créditos</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(selectedApuracao.creditos)}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-xs text-orange-600 font-medium mb-1">Ajustes (Débito)</p>
                    <p className="text-lg font-bold text-orange-700">{formatCurrency(selectedApuracao.ajustesDebito)}</p>
                  </div>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p className="text-xs text-sky-600 font-medium mb-1">Ajustes (Crédito)</p>
                    <p className="text-lg font-bold text-sky-700">{formatCurrency(selectedApuracao.ajustesCredito)}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-slate-500 font-medium mb-1">Saldo Anterior</p>
                    <p className={`text-lg font-bold ${selectedApuracao.saldoAnterior < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {formatCurrency(Math.abs(selectedApuracao.saldoAnterior))}
                      {selectedApuracao.saldoAnterior < 0 && <span className="text-xs ml-1">(crédito)</span>}
                    </p>
                  </div>
                  <div className={`rounded-lg p-4 border-2 ${
                    selectedApuracao.saldoApagar > 0
                      ? 'bg-red-50 border-red-300'
                      : 'bg-emerald-50 border-emerald-300'
                  }`}>
                    <p className={`text-xs font-medium mb-1 ${
                      selectedApuracao.saldoApagar > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {selectedApuracao.saldoApagar > 0 ? 'Saldo a Pagar' : 'Crédito Acumulado'}
                    </p>
                    <p className={`text-lg font-bold ${
                      selectedApuracao.saldoApagar > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {formatCurrency(selectedApuracao.saldoApagar > 0 ? selectedApuracao.saldoApagar : selectedApuracao.creditoAcumulado)}
                    </p>
                  </div>
                </div>

                {/* Visual bar showing débitos vs créditos */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Débitos vs Créditos</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-red-600 font-medium">Débitos</span>
                        <span className="text-sm font-bold text-red-700">{formatCurrency(selectedApuracao.debitos)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-5">
                        <div
                          className="h-5 rounded-full bg-red-500 flex items-center justify-end pr-2"
                          style={{
                            width: selectedApuracao.debitos > 0
                              ? `${Math.min(100, (selectedApuracao.debitos / Math.max(selectedApuracao.debitos, selectedApuracao.creditos)) * 100)}%`
                              : '0%',
                          }}
                        >
                          {selectedApuracao.debitos > 0 && (
                            <span className="text-[10px] font-bold text-white">
                              {fmtPercent((selectedApuracao.debitos / (selectedApuracao.debitos + selectedApuracao.creditos)) * 100, 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-emerald-600 font-medium">Créditos</span>
                        <span className="text-sm font-bold text-emerald-700">{formatCurrency(selectedApuracao.creditos)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-5">
                        <div
                          className="h-5 rounded-full bg-emerald-500 flex items-center justify-end pr-2"
                          style={{
                            width: selectedApuracao.creditos > 0
                              ? `${Math.min(100, (selectedApuracao.creditos / Math.max(selectedApuracao.debitos, selectedApuracao.creditos)) * 100)}%`
                              : '0%',
                          }}
                        >
                          {selectedApuracao.creditos > 0 && (
                            <span className="text-[10px] font-bold text-white">
                              {fmtPercent((selectedApuracao.creditos / (selectedApuracao.debitos + selectedApuracao.creditos)) * 100, 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Computation breakdown */}
                <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Memória de Cálculo</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Débitos do período</span>
                      <span className="font-medium text-red-600">+ {formatCurrency(selectedApuracao.debitos)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Créditos do período</span>
                      <span className="font-medium text-emerald-600">- {formatCurrency(selectedApuracao.creditos)}</span>
                    </div>
                    {selectedApuracao.ajustesDebito > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Ajustes a débito</span>
                        <span className="font-medium text-orange-600">+ {formatCurrency(selectedApuracao.ajustesDebito)}</span>
                      </div>
                    )}
                    {selectedApuracao.ajustesCredito > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Ajustes a crédito</span>
                        <span className="font-medium text-sky-600">- {formatCurrency(selectedApuracao.ajustesCredito)}</span>
                      </div>
                    )}
                    {selectedApuracao.saldoAnterior !== 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Saldo anterior ({selectedApuracao.saldoAnterior < 0 ? 'crédito' : 'débito'})</span>
                        <span className={`font-medium ${selectedApuracao.saldoAnterior < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {selectedApuracao.saldoAnterior < 0 ? '- ' : '+ '}{formatCurrency(Math.abs(selectedApuracao.saldoAnterior))}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold">
                      <span className="text-slate-900">
                        {selectedApuracao.saldoApagar > 0 ? 'Saldo a pagar' : 'Crédito acumulado'}
                      </span>
                      <span className={selectedApuracao.saldoApagar > 0 ? 'text-red-700' : 'text-emerald-700'}>
                        {formatCurrency(selectedApuracao.saldoApagar > 0 ? selectedApuracao.saldoApagar : selectedApuracao.creditoAcumulado)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Resumo da Apuração — {meses[mes - 1]}/{ano}</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Tributo</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Débitos</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Créditos</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Ajustes Déb.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Ajustes Créd.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Saldo Ant.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">A Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apuracoes.map((ap) => (
                    <tr
                      key={ap.tributo}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        selectedTab === ap.tributo ? 'bg-emerald-50/50' : ''
                      } ${ap.tributo === 'IBS' ? 'border-t-2 border-teal-200' : ''}`}
                      onClick={() => setSelectedTab(ap.tributo)}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {ap.tributo}
                          {(ap.tributo === 'IBS' || ap.tributo === 'CBS' || ap.tributo === 'IS') && (
                            <ArrowRightLeft className="w-3 h-3 text-teal-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">{formatCurrency(ap.debitos)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(ap.creditos)}</td>
                      <td className="px-3 py-2 text-right text-orange-600">{formatCurrency(ap.ajustesDebito)}</td>
                      <td className="px-3 py-2 text-right text-sky-600">{formatCurrency(ap.ajustesCredito)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {ap.saldoAnterior !== 0 ? formatCurrency(ap.saldoAnterior) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${ap.saldoApagar > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatCurrency(ap.saldoApagar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                    <td className="px-3 py-2 font-bold text-emerald-900">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-red-700">
                      {formatCurrency(apuracoes.reduce((s, a) => s + a.debitos, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">
                      {formatCurrency(apuracoes.reduce((s, a) => s + a.creditos, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-orange-700">
                      {formatCurrency(apuracoes.reduce((s, a) => s + a.ajustesDebito, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-sky-700">
                      {formatCurrency(apuracoes.reduce((s, a) => s + a.ajustesCredito, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-700">
                      {formatCurrency(apuracoes.reduce((s, a) => s + a.saldoAnterior, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-red-700">
                      {formatCurrency(apuracoes.reduce((s, a) => s + a.saldoApagar, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
