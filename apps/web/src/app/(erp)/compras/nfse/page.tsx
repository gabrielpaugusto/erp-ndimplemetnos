'use client'
import { useState, useEffect } from 'react'
import { Search, RefreshCw, Building2, Calendar, DollarSign, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { fmtCurrency } from '@/lib/format'

interface NfseRecebida {
  id: string
  numero: string
  prestadorCnpj: string
  prestadorNome: string
  prestadorMunicipio?: string
  prestadorUf?: string
  prestadorRegime?: string | null
  discriminacao?: string
  valorServico: number
  valorIss: number
  aliquotaIss: number
  issRetido: boolean
  // Retenções pré-calculadas pelo backend (sincronizarRecebidas)
  valorPisRetido?: number
  valorCofinsRetido?: number
  valorCsllRetido?: number
  valorIrRetido?: number
  valorIssAReter?: number
  dataEmissao: string
  dataCompetencia?: string
  status: string
}

interface CompanyFiscal {
  taxRegime?: string | null
  optanteSimples?: boolean
}

interface RetentionConfig {
  minimoRetencaoPisCofinsCsll: number
  minimoRetencaoIrrf: number
  minimoRetencaoInss: number
  minimoRetencaoIss: number
}

interface SyncResult {
  importadas: number
  periodo: string
}

export default function NfseRecebidas() {
  const [notas, setNotas] = useState<NfseRecebida[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'info' | 'error'>('info')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [companyFiscal, setCompanyFiscal] = useState<CompanyFiscal>({})
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [taxRates, setTaxRates] = useState({
    aliquotaPis: 0.65,
    aliquotaCofins: 3.0,
    aliquotaCsll: 1.0,
    aliquotaIr: 1.5,
    aliquotaInss: 11.0,
  })
  const [retentionConfig, setRetentionConfig] = useState<RetentionConfig>({
    minimoRetencaoPisCofinsCsll: 215.05,
    minimoRetencaoIrrf: 10.00,
    minimoRetencaoInss: 0.00,
    minimoRetencaoIss: 0.00,
  })

  useEffect(() => {
    fetchNotas()
    fetchCompanyFiscal()
    async function fetchTaxRates() {
      try {
        const res = await apiFetch('/api/company/tax-rates')
        if (res.ok) {
          const data = await res.json()
          setTaxRates({
            aliquotaPis: data.aliquotaPis ?? 0.65,
            aliquotaCofins: data.aliquotaCofins ?? 3.0,
            aliquotaCsll: data.aliquotaCsll ?? 1.0,
            aliquotaIr: data.aliquotaIr ?? 1.5,
            aliquotaInss: data.aliquotaInss ?? 11.0,
          })
        }
      } catch { /* usa defaults */ }
    }
    async function fetchRetentionConfig() {
      try {
        const res = await apiFetch('/api/company/tax-retention-config')
        if (res.ok) {
          const data = await res.json()
          setRetentionConfig({
            minimoRetencaoPisCofinsCsll: data.minimoRetencaoPisCofinsCsll ?? 215.05,
            minimoRetencaoIrrf: data.minimoRetencaoIrrf ?? 10.00,
            minimoRetencaoInss: data.minimoRetencaoInss ?? 0.00,
            minimoRetencaoIss: data.minimoRetencaoIss ?? 0.00,
          })
        }
      } catch { /* usa defaults */ }
    }
    fetchTaxRates()
    fetchRetentionConfig()
  }, [])

  async function fetchCompanyFiscal() {
    try {
      const res = await apiFetch('/api/company')
      if (res.ok) {
        const data = await res.json()
        setCompanyFiscal({ taxRegime: data.taxRegime, optanteSimples: data.optanteSimples })
      }
    } catch {
      // use defaults
    }
  }

  function calcularRetencoes(nota: NfseRecebida) {
    // Se o backend já calculou as retenções (novos registros), usar os valores salvos
    const temRetencaoCalculada =
      nota.valorPisRetido !== undefined ||
      nota.valorCofinsRetido !== undefined ||
      nota.valorCsllRetido !== undefined ||
      nota.valorIrRetido !== undefined ||
      nota.valorIssAReter !== undefined

    if (temRetencaoCalculada) {
      const valorPis = Number(nota.valorPisRetido ?? 0)
      const valorCofins = Number(nota.valorCofinsRetido ?? 0)
      const valorCsll = Number(nota.valorCsllRetido ?? 0)
      const valorIr = Number(nota.valorIrRetido ?? 0)
      const valorIss = Number(nota.valorIssAReter ?? 0)
      const deveReterFederal = (valorPis + valorCofins + valorCsll + valorIr) > 0
      const deveReterIss = valorIss > 0
      return {
        deveReterIss,
        deveReterFederal,
        deveReterInss: false,
        valorIss,
        valorPis,
        valorCofins,
        valorCsll,
        valorIr,
        valorInss: 0,
        totalRetencoes: valorIss + valorPis + valorCofins + valorCsll + valorIr,
      }
    }

    // Cálculo em tempo real para registros antigos (sem retenção salva)
    const valor = Number(nota.valorServico)
    const limiteFederal = retentionConfig.minimoRetencaoPisCofinsCsll
    const limiteIrrf = retentionConfig.minimoRetencaoIrrf
    const limiteIss = retentionConfig.minimoRetencaoIss

    const empresaNaoSimples =
      !companyFiscal.optanteSimples &&
      companyFiscal.taxRegime !== 'SIMPLES_NACIONAL' &&
      companyFiscal.taxRegime !== 'MEI'

    // Empresa é tomador — reter apenas se prestador NÃO for Simples/MEI
    const deveReter = empresaNaoSimples &&
      nota.prestadorRegime !== 'SIMPLES_NACIONAL' &&
      nota.prestadorRegime !== 'MEI'

    const deveReterIss = deveReter && !nota.issRetido && valor >= limiteIss
    const deveReterFederal = deveReter && valor >= limiteFederal
    const deveReterIrrf = deveReter && valor >= limiteIrrf
    // INSS: apenas se houver indicação explícita de cessão de mão de obra (campo prestadorRegime presente)
    const deveReterInss = deveReter && nota.prestadorRegime != null

    const valorPis = deveReterFederal ? valor * (taxRates.aliquotaPis / 100) : 0
    const valorCofins = deveReterFederal ? valor * (taxRates.aliquotaCofins / 100) : 0
    const valorCsll = deveReterFederal ? valor * (taxRates.aliquotaCsll / 100) : 0
    const valorIr = deveReterIrrf ? valor * (taxRates.aliquotaIr / 100) : 0

    const valorIss = deveReterIss ? valor * (Number(nota.aliquotaIss) / 100) : 0
    const valorInss = deveReterInss ? valor * (taxRates.aliquotaInss / 100) : 0

    return {
      deveReterIss,
      deveReterFederal,
      deveReterInss,
      valorIss,
      valorPis,
      valorCofins,
      valorCsll,
      valorIr,
      valorInss,
      totalRetencoes: valorIss + valorPis + valorCofins + valorCsll + valorIr + valorInss,
    }
  }

  async function fetchNotas() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/fiscal/nfse/recebidas')
      const json = await res.json()
      setNotas(json.data ?? [])
    } catch {
      setNotas([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setMsg('')
    setSyncResult(null)
    try {
      const res = await apiFetch('/api/fiscal/nfse/recebidas/sync', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg(json.message ?? 'Sincronização concluída')
        setMsgType('info')
        if (json.periodo !== undefined && json.importadas !== undefined) {
          setSyncResult({ importadas: json.importadas, periodo: json.periodo })
        }
        fetchNotas()
      } else {
        // Extrair mensagem real da API (pode ser string ou array de erros de validação)
        const errMsg = Array.isArray(json.message)
          ? json.message.join(' | ')
          : (json.message ?? json.error ?? 'Falha na comunicação com a RFB')
        setMsg(`Erro na sincronização: ${errMsg}`)
        setMsgType('error')
      }
    } catch {
      setMsg('Erro de conexão com o servidor')
      setMsgType('error')
    } finally {
      setSyncing(false)
    }
  }

  const filtered = notas.filter(
    (n) =>
      n.prestadorNome.toLowerCase().includes(search.toLowerCase()) ||
      n.prestadorCnpj.includes(search) ||
      n.numero.includes(search),
  )

  const totalValor = filtered.reduce((acc, n) => acc + Number(n.valorServico), 0)
  const totalIss = filtered.reduce((acc, n) => acc + Number(n.valorIss), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NFS-e Recebidas</h1>
          <p className="text-sm text-gray-500">
            Notas Fiscais de Serviço recebidas — sincronizadas via API Nacional da Receita Federal
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar RFB'}
          </button>
          {syncResult && (
            <p className="text-xs text-gray-500 mt-1">
              {syncResult.periodo} — {syncResult.importadas} nota(s) importada(s)
            </p>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`border px-4 py-3 rounded-lg text-sm ${
            msgType === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {msg}
        </div>
      )}

      {/* Totalizadores */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
            <Building2 size={14} /> NOTAS RECEBIDAS
          </div>
          <div className="text-2xl font-bold text-gray-900">{filtered.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
            <DollarSign size={14} /> VALOR TOTAL
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {fmtCurrency(totalValor)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
            <Calendar size={14} /> ISS TOTAL
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {fmtCurrency(totalIss)}
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por prestador, CNPJ ou número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Prestador</th>
                <th className="px-4 py-3 text-left">Município</th>
                <th className="px-4 py-3 text-left">Serviço</th>
                <th className="px-4 py-3 text-left">Emissão</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">ISS</th>
                <th className="px-4 py-3 text-center">ISS Retido</th>
                <th className="px-4 py-3 text-center">Retenções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    Nenhuma NFS-e recebida encontrada. Clique em &quot;Sincronizar RFB&quot; para buscar notas.
                  </td>
                </tr>
              ) : (
                filtered.map((n) => {
                  const ret = calcularRetencoes(n)
                  const isExpanded = expandedId === n.id
                  const temObrigacao = ret.deveReterIss || ret.deveReterFederal || ret.deveReterInss
                  return (
                    <>
                      <tr
                        key={n.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : n.id)}
                      >
                        <td className="px-4 py-3 font-mono font-semibold">{n.numero}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{n.prestadorNome}</div>
                          <div className="text-xs text-gray-400">{n.prestadorCnpj}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {n.prestadorMunicipio
                            ? `${n.prestadorMunicipio}${n.prestadorUf ? `/${n.prestadorUf}` : ''}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px] truncate">
                          {n.discriminacao ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(n.dataEmissao).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {fmtCurrency(Number(n.valorServico))}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fmtCurrency(Number(n.valorIss))}
                          <span className="ml-1 text-xs text-gray-400">({n.aliquotaIss}%)</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {n.issRetido ? (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                              Retido
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Não
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {temObrigacao && (
                              <AlertCircle size={14} className="text-amber-500" />
                            )}
                            {isExpanded ? (
                              <ChevronUp size={14} className="text-gray-400" />
                            ) : (
                              <ChevronDown size={14} className="text-gray-400" />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${n.id}-detail`}>
                          <td colSpan={9} className="px-4 py-4 bg-amber-50 border-t border-amber-100">
                            <div className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                              <AlertCircle size={16} />
                              Obrigações de Retenção — como Tomador de Serviços
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* ISS */}
                              <div className={`rounded-lg p-3 border ${ret.deveReterIss ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-semibold mb-1 text-gray-700">ISS Municipal</div>
                                {ret.deveReterIss ? (
                                  <>
                                    <div className="text-lg font-bold text-orange-700">
                                      {fmtCurrency(ret.valorIss)}
                                    </div>
                                    <div className="text-xs text-orange-600 mt-1">Deve reter e recolher guia municipal (DAM/ISS)</div>
                                  </>
                                ) : (
                                  <div className="text-xs text-gray-500">
                                    {n.issRetido
                                      ? 'ISS já retido pelo prestador'
                                      : (n.prestadorRegime === 'SIMPLES_NACIONAL' || n.prestadorRegime === 'MEI')
                                        ? 'Prestador Simples/MEI — isento de retenção (LC 123/2006)'
                                        : 'Não se aplica (empresa optante Simples/MEI)'}
                                  </div>
                                )}
                              </div>

                              {/* PIS/COFINS/CSLL/IR */}
                              <div className={`rounded-lg p-3 border ${ret.deveReterFederal ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-semibold mb-1 text-gray-700">Retenções Federais (PIS/COFINS/CSLL/IR)</div>
                                {ret.deveReterFederal ? (
                                  <>
                                    <div className="text-lg font-bold text-blue-700">
                                      {fmtCurrency(ret.valorPis + ret.valorCofins + ret.valorCsll + ret.valorIr)}
                                    </div>
                                    <div className="text-xs text-blue-600 space-y-0.5 mt-1">
                                      <div>PIS: {fmtCurrency(ret.valorPis)}</div>
                                      <div>COFINS: {fmtCurrency(ret.valorCofins)}</div>
                                      <div>CSLL: {fmtCurrency(ret.valorCsll)}</div>
                                      <div>IR: {fmtCurrency(ret.valorIr)}</div>
                                      <div className="font-medium mt-1">Guia: DARF (código 5952)</div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs text-gray-500">
                                    {(n.prestadorRegime === 'SIMPLES_NACIONAL' || n.prestadorRegime === 'MEI')
                                      ? 'Prestador Simples/MEI — isento de retenção (LC 123/2006)'
                                      : Number(n.valorServico) < retentionConfig.minimoRetencaoPisCofinsCsll
                                        ? `Valor abaixo do limite (${fmtCurrency(retentionConfig.minimoRetencaoPisCofinsCsll)})`
                                        : 'Não se aplica (empresa optante Simples/MEI)'}
                                  </div>
                                )}
                              </div>

                              {/* INSS */}
                              <div className={`rounded-lg p-3 border ${ret.deveReterInss ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-semibold mb-1 text-gray-700">INSS (cessão mão de obra)</div>
                                {ret.deveReterInss ? (
                                  <>
                                    <div className="text-lg font-bold text-green-700">
                                      {fmtCurrency(ret.valorInss)}
                                    </div>
                                    <div className="text-xs text-green-600 mt-1">Alíquota 11% — Guia GPS</div>
                                    <div className="text-xs text-green-600">Somente para cessão de mão de obra</div>
                                  </>
                                ) : (
                                  <div className="text-xs text-gray-500">
                                    {(n.prestadorRegime === 'SIMPLES_NACIONAL' || n.prestadorRegime === 'MEI')
                                      ? 'Prestador Simples/MEI — isento de retenção (LC 123/2006)'
                                      : 'Não se aplica (empresa optante Simples/MEI)'}
                                  </div>
                                )}
                              </div>
                            </div>

                            {ret.totalRetencoes > 0 && (
                              <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between items-center">
                                <span className="text-sm font-semibold text-amber-800">Total de retenções a recolher:</span>
                                <span className="text-lg font-bold text-amber-900">
                                  {fmtCurrency(ret.totalRetencoes)}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
