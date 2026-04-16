'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, CheckCircle, XCircle, Clock, Info } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { fmtCurrency, fmtPercent } from '@/lib/format'

interface NbsCode {
  id: string
  codigo: string
  descricao: string
  aliquotaIrrf?: number
  requerRetencaoInss?: boolean
}

interface Lc116Servico {
  id: string
  codigo: string
  descricao: string
  aliquotaIss?: number | null
}

interface TomadorFiscalData {
  id?: string
  type?: string
  taxRegime?: string | null
  optanteSimples?: boolean
  retencaoIss?: boolean
}

interface NfseEmitida {
  id: string
  numero: number
  serie: string
  tomadorNome: string
  tomadorCpfCnpj: string
  discriminacao: string
  valorServico: number
  valorIss: number
  aliquotaIss: number
  status: 'PENDENTE' | 'AUTORIZADA' | 'CANCELADA' | 'REJEITADA'
  dataEmissao: string
  dataCompetencia: string
  codigoVerificacao?: string
  nbsCode?: NbsCode
}

interface EmpresaFiscal {
  taxRegime?: string | null
  issRetidoMunicipio?: boolean
}

interface RetentionConfig {
  minimoRetencaoPisCofinsCsll: number
  minimoRetencaoIrrf: number
  minimoRetencaoInss: number
  minimoRetencaoIss: number
  usarSistemaNovo: boolean
  periodoReforma: string | null
  aliquotaCbs: number
  aliquotaIbs: number
}

const statusConfig = {
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  AUTORIZADA: { label: 'Autorizada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600', icon: XCircle },
  REJEITADA: { label: 'Rejeitada', color: 'bg-red-100 text-red-800', icon: XCircle },
}

export default function NfseEmitidas() {
  const [notas, setNotas] = useState<NfseEmitida[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [nbsCodes, setNbsCodes] = useState<NbsCode[]>([])
  const [lc116Servicos, setLc116Servicos] = useState<Lc116Servico[]>([])
  const [lc116Search, setLc116Search] = useState('')
  const [emitindo, setEmitindo] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'info' | 'error'>('info')
  const [tomadorFiscalData, setTomadorFiscalData] = useState<TomadorFiscalData | null>(null)
  const [loadingFiscal, setLoadingFiscal] = useState(false)
  const [empresaFiscal, setEmpresaFiscal] = useState<EmpresaFiscal>({})
  const [taxRates, setTaxRates] = useState({
    aliquotaIss: 5.0,
  })
  const [retentionConfig, setRetentionConfig] = useState<RetentionConfig>({
    minimoRetencaoPisCofinsCsll: 215.05,
    minimoRetencaoIrrf: 10.00,
    minimoRetencaoInss: 0.00,
    minimoRetencaoIss: 0.00,
    usarSistemaNovo: false,
    periodoReforma: null,
    aliquotaCbs: 0.9,
    aliquotaIbs: 0.1,
  })

  const [form, setForm] = useState({
    tomadorCpfCnpj: '',
    tomadorNome: '',
    tomadorEmail: '',
    tomadorTelefone: '',
    tomadorLogradouro: '',
    tomadorNumero: '',
    tomadorBairro: '',
    tomadorMunicipio: '',
    tomadorCodMunicipio: '',
    tomadorUf: '',
    tomadorCep: '',
    nbsCodeId: '',
    lc116ServicoId: '',
    discriminacao: '',
    valorServico: '',
    aliquotaIss: '5',
    issRetido: false,
    dataCompetencia: new Date().toISOString().substring(0, 7),
  })

  useEffect(() => {
    fetchNotas()
    fetchNbs()
    fetchTaxRates()
    fetchEmpresaFiscal()
    fetchRetentionConfig()
  }, [])

  // Buscar LC 116 com debounce ao digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLc116(lc116Search)
    }, 300)
    return () => clearTimeout(timer)
  }, [lc116Search])

  async function fetchNotas() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/fiscal/nfse/emitidas')
      const json = await res.json()
      setNotas(json.data ?? [])
    } catch {
      setNotas([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchNbs() {
    try {
      const res = await apiFetch('/api/nbs')
      const json = await res.json()
      setNbsCodes(Array.isArray(json) ? json : [])
    } catch {
      setNbsCodes([])
    }
  }

  async function fetchLc116(search: string) {
    try {
      const url = search ? `/api/fiscal/lc116?search=${encodeURIComponent(search)}` : '/api/fiscal/lc116'
      const res = await apiFetch(url)
      const json = await res.json()
      setLc116Servicos(Array.isArray(json) ? json : [])
    } catch {
      setLc116Servicos([])
    }
  }

  async function fetchTaxRates() {
    try {
      const res = await apiFetch('/api/company/tax-rates')
      if (res.ok) {
        const data = await res.json()
        setTaxRates({ aliquotaIss: data.aliquotaIss ?? 5.0 })
        setForm((prev) => ({ ...prev, aliquotaIss: String(data.aliquotaIss ?? 5.0) }))
      }
    } catch {
      // use defaults
    }
  }

  async function fetchEmpresaFiscal() {
    try {
      const res = await apiFetch('/api/company')
      if (res.ok) {
        const data = await res.json()
        setEmpresaFiscal({ taxRegime: data.taxRegime, issRetidoMunicipio: data.issRetidoMunicipio })
      }
    } catch {
      // use defaults
    }
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
          usarSistemaNovo: data.usarSistemaNovo ?? false,
          periodoReforma: data.periodoReforma ?? null,
          aliquotaCbs: data.aliquotaCbs ?? 0.9,
          aliquotaIbs: data.aliquotaIbs ?? 0.1,
        })
      }
    } catch {
      // use defaults
    }
  }

  const fetchTomadorFiscalData = useCallback(async (cpfCnpj: string) => {
    const cleaned = cpfCnpj.replace(/\D/g, '')
    if (cleaned.length < 11) return
    setLoadingFiscal(true)
    try {
      const res = await apiFetch(`/api/crm/persons/fiscal-data?cpfCnpj=${cleaned}`)
      if (res.ok) {
        const data: TomadorFiscalData = await res.json()
        if (data) {
          setTomadorFiscalData(data)
          // Calcular ISS retido automaticamente
          const prestadorSimples = empresaFiscal.taxRegime === 'SIMPLES_NACIONAL' || empresaFiscal.taxRegime === 'MEI'
          const tomadorSimples = data.optanteSimples || data.taxRegime === 'SIMPLES_NACIONAL' || data.taxRegime === 'MEI'
          const aplicar = !prestadorSimples && !tomadorSimples && data.type === 'PJ'
          const autoIssRetido = aplicar && (data.retencaoIss || empresaFiscal.issRetidoMunicipio || false)
          setForm((f) => ({ ...f, issRetido: autoIssRetido }))
        } else {
          setTomadorFiscalData(null)
        }
      } else {
        setTomadorFiscalData(null)
      }
    } catch {
      setTomadorFiscalData(null)
    } finally {
      setLoadingFiscal(false)
    }
  }, [empresaFiscal])

  const taxRegimeLabel: Record<string, string> = {
    SIMPLES_NACIONAL: 'Simples Nacional',
    LUCRO_PRESUMIDO: 'Lucro Presumido',
    LUCRO_REAL: 'Lucro Real',
    MEI: 'MEI',
  }

  // Calcular retenções em tempo real
  const valorServico = parseFloat(form.valorServico || '0')
  const aliquotaIssPct = parseFloat(form.aliquotaIss || '0')
  const selectedNbs = nbsCodes.find((n) => n.id === form.nbsCodeId) ?? null
  const selectedLc116 = lc116Servicos.find((s) => s.id === form.lc116ServicoId) ?? null

  const prestadorSimplesOuMei = empresaFiscal.taxRegime === 'SIMPLES_NACIONAL' || empresaFiscal.taxRegime === 'MEI'
  const tomadorSimplesOuMei = tomadorFiscalData?.optanteSimples ||
    tomadorFiscalData?.taxRegime === 'SIMPLES_NACIONAL' ||
    tomadorFiscalData?.taxRegime === 'MEI'
  const aplicarRetencoes = !prestadorSimplesOuMei && !tomadorSimplesOuMei && tomadorFiscalData?.type === 'PJ'

  const usarSistemaNovo = retentionConfig.usarSistemaNovo
  const minimoRetencaoPisCofinsCsll = retentionConfig.minimoRetencaoPisCofinsCsll
  const minimoRetencaoIrrf = retentionConfig.minimoRetencaoIrrf
  const minimoRetencaoInss = retentionConfig.minimoRetencaoInss
  const minimoRetencaoIss = retentionConfig.minimoRetencaoIss

  // ISS (comum a ambos os sistemas)
  const issAplica = valorServico >= minimoRetencaoIss
  const valorIss = issAplica ? valorServico * (aliquotaIssPct / 100) : 0
  const issRetidoFinal = issAplica ? form.issRetido : false

  // IRRF alíquota
  const aliquotaIrrf = (selectedNbs?.aliquotaIrrf ?? 1.5) / 100

  // SISTEMA ATUAL
  const retencaoPisCofinsCsll = !usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoPisCofinsCsll
  const retencaoIrrf = !usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoIrrf
  const inssRetido = aplicarRetencoes && (selectedNbs?.requerRetencaoInss ?? false) && valorServico >= minimoRetencaoInss

  const valorPis = retencaoPisCofinsCsll ? valorServico * 0.0065 : 0
  const valorCofins = retencaoPisCofinsCsll ? valorServico * 0.03 : 0
  const valorCsll = retencaoPisCofinsCsll ? valorServico * 0.01 : 0
  const valorIr = retencaoIrrf ? valorServico * aliquotaIrrf : 0
  const valorInss = inssRetido ? valorServico * 0.11 : 0

  // SISTEMA NOVO (Reforma Tributária — CBS + IBS)
  const valorCbs = usarSistemaNovo && aplicarRetencoes ? valorServico * (retentionConfig.aliquotaCbs / 100) : 0
  const valorIbs = usarSistemaNovo && aplicarRetencoes ? valorServico * (retentionConfig.aliquotaIbs / 100) : 0
  const valorCsllReforma = usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoPisCofinsCsll ? valorServico * 0.01 : 0
  const valorIrReforma = usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoIrrf ? valorServico * aliquotaIrrf : 0

  const totalRetencoes = usarSistemaNovo
    ? (issRetidoFinal ? valorIss : 0) + valorCbs + valorIbs + valorCsllReforma + valorIrReforma + valorInss
    : (issRetidoFinal ? valorIss : 0) + valorPis + valorCofins + valorCsll + valorIr + valorInss
  const valorLiquido = valorServico - totalRetencoes

  async function handleSalvar() {
    const res = await apiFetch('/api/fiscal/nfse/emitidas', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        valorServico,
        aliquotaIss: aliquotaIssPct,
        valorDeducoes: 0,
        dataCompetencia: form.dataCompetencia + '-01',
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setMsg('NFS-e criada! Clique em "Emitir" para transmitir à Receita Federal.')
      setMsgType('info')
      fetchNotas()
    } else {
      const err = await res.json()
      setMsg(`Erro ao criar NFS-e: ${err.message ?? 'Verifique os dados'}`)
      setMsgType('error')
    }
  }

  async function handleEmitir(id: string) {
    setEmitindo(id)
    setMsg('')
    try {
      const res = await apiFetch(`/api/fiscal/nfse/emitidas/${id}/emitir`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setMsg('NFS-e transmitida com sucesso para a Receita Federal!')
        setMsgType('info')
        fetchNotas()
      } else {
        setMsg(`Erro na transmissão: ${json.message ?? 'Falha na comunicação com a RFB'}`)
        setMsgType('error')
      }
    } catch {
      setMsg('Erro de conexão com o servidor')
      setMsgType('error')
    } finally {
      setEmitindo(null)
    }
  }

  const filtered = notas.filter(
    (n) =>
      n.tomadorNome.toLowerCase().includes(search.toLowerCase()) ||
      n.tomadorCpfCnpj.includes(search) ||
      String(n.numero).includes(search),
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NFS-e Emitidas</h1>
          <p className="text-sm text-gray-500">
            Notas Fiscais de Serviço Eletrônicas — API Nacional Receita Federal
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Nova NFS-e
        </button>
      </div>

      {msg && (
        <div
          className={`border px-4 py-3 rounded-lg text-sm ${
            msgType === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {msg}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por tomador, CPF/CNPJ ou número..."
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
                <th className="px-4 py-3 text-left">Tomador</th>
                <th className="px-4 py-3 text-left">Serviço (LC 116 / NBS)</th>
                <th className="px-4 py-3 text-left">Competência</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Nenhuma NFS-e encontrada
                  </td>
                </tr>
              ) : (
                filtered.map((n) => {
                  const cfg = statusConfig[n.status]
                  const StatusIcon = cfg.icon
                  return (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold">
                        {String(n.numero).padStart(6, '0')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{n.tomadorNome}</div>
                        <div className="text-xs text-gray-400">{n.tomadorCpfCnpj}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">
                        {(n as any).lc116Servico
                          ? `${(n as any).lc116Servico.codigo} — ${(n as any).lc116Servico.descricao}`
                          : n.nbsCode
                          ? `${n.nbsCode.codigo} — ${n.nbsCode.descricao}`
                          : n.discriminacao.substring(0, 50)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {n.dataCompetencia
                          ? new Date(n.dataCompetencia).toLocaleDateString('pt-BR', {
                              month: '2-digit',
                              year: 'numeric',
                              timeZone: 'UTC',
                            })
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmtCurrency(Number(n.valorServico))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}
                        >
                          <StatusIcon size={12} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {n.status === 'PENDENTE' && (
                          <button
                            onClick={() => handleEmitir(n.id)}
                            disabled={emitindo === n.id}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                          >
                            {emitindo === n.id ? 'Enviando...' : 'Emitir'}
                          </button>
                        )}
                        {n.status === 'AUTORIZADA' && n.codigoVerificacao && (
                          <span className="text-xs text-gray-500 font-mono">
                            #{n.codigoVerificacao}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova NFS-e */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold">Nova NFS-e</h2>
              <p className="text-sm text-gray-500">Preencha os dados do serviço prestado</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">CPF/CNPJ do Tomador *</label>
                  <input
                    value={form.tomadorCpfCnpj}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, tomadorCpfCnpj: e.target.value }))
                      setTomadorFiscalData(null)
                    }}
                    onBlur={(e) => fetchTomadorFiscalData(e.target.value)}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="00.000.000/0000-00"
                  />
                  {loadingFiscal && (
                    <p className="text-xs text-gray-400 mt-1">Buscando dados fiscais...</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nome / Razão Social *</label>
                  <input
                    value={form.tomadorNome}
                    onChange={(e) => setForm((f) => ({ ...f, tomadorNome: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">E-mail</label>
                  <input
                    type="email"
                    value={form.tomadorEmail}
                    onChange={(e) => setForm((f) => ({ ...f, tomadorEmail: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Telefone</label>
                  <input
                    value={form.tomadorTelefone}
                    onChange={(e) => setForm((f) => ({ ...f, tomadorTelefone: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Label sistema tributário */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
                {usarSistemaNovo
                  ? <span className="text-blue-700 font-medium">Reforma Tributária ativo — usando NBS (CBS/IBS)</span>
                  : <span className="text-amber-700 font-medium">Sistema atual — usando LC 116/2003 (ISS)</span>
                }
              </div>

              {usarSistemaNovo ? (
                <div>
                  <label className="text-xs font-medium text-gray-600">Código NBS (Reforma Tributária) *</label>
                  <select
                    value={form.nbsCodeId}
                    onChange={(e) => setForm((f) => ({ ...f, nbsCodeId: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o serviço prestado (NBS)</option>
                    {nbsCodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.codigo} — {n.descricao}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-gray-600">Código de Serviço LC 116/2003 (ISS) *</label>
                  <input
                    type="text"
                    placeholder="Digite código (ex: 14.01) ou descrição..."
                    value={lc116Search}
                    onChange={(e) => setLc116Search(e.target.value)}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {lc116Servicos.length > 0 && (
                    <select
                      value={form.lc116ServicoId}
                      onChange={(e) => {
                        const sel = lc116Servicos.find(s => s.id === e.target.value)
                        setForm((f) => ({
                          ...f,
                          lc116ServicoId: e.target.value,
                          aliquotaIss: sel?.aliquotaIss != null ? String(sel.aliquotaIss) : f.aliquotaIss,
                        }))
                      }}
                      className="w-full mt-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Selecione o código de serviço</option>
                      {lc116Servicos.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.codigo} — {s.descricao}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedLc116 && (
                    <p className="text-xs text-amber-700 mt-1">
                      Selecionado: {selectedLc116.codigo} — {selectedLc116.descricao}
                      {selectedLc116.aliquotaIss != null ? ` | ISS padrão: ${fmtPercent(selectedLc116.aliquotaIss)}` : ''}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600">Discriminação do Serviço *</label>
                <textarea
                  value={form.discriminacao}
                  onChange={(e) => setForm((f) => ({ ...f, discriminacao: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descreva detalhadamente o serviço prestado..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Valor do Serviço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valorServico}
                    onChange={(e) => setForm((f) => ({ ...f, valorServico: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Alíquota ISS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={form.aliquotaIss}
                    onChange={(e) => setForm((f) => ({ ...f, aliquotaIss: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Competência</label>
                  <input
                    type="month"
                    value={form.dataCompetencia}
                    onChange={(e) => setForm((f) => ({ ...f, dataCompetencia: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {tomadorFiscalData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-blue-700">
                        Regime tributário detectado: {tomadorFiscalData.taxRegime ? (taxRegimeLabel[tomadorFiscalData.taxRegime] ?? tomadorFiscalData.taxRegime) : 'Não informado'}
                      </p>
                      <p className="text-blue-600 text-xs mt-0.5">Retenções calculadas automaticamente conforme IN RFB 2.145/2023.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bloco de retenções — exibir quando tomador selecionado */}
              {tomadorFiscalData && valorServico > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 mb-3">Retenções na Fonte</h4>
                  {tomadorSimplesOuMei ? (
                    <p className="text-sm text-green-700">Tomador Simples/MEI — sem retenções (LC 123/2006)</p>
                  ) : prestadorSimplesOuMei ? (
                    <p className="text-sm text-green-700">Empresa (prestador) Simples/MEI — sem retenções (LC 123/2006)</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {usarSistemaNovo ? (
                        <>
                          <div className="mb-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded inline-block">
                              Reforma Tributaria — {retentionConfig.periodoReforma ?? 'TESTE_2026'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">CBS ({retentionConfig.aliquotaCbs}%)</span>
                            <span className="font-medium">{fmtCurrency(valorCbs)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">IBS ({retentionConfig.aliquotaIbs}%)</span>
                            <span className="font-medium">{fmtCurrency(valorIbs)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">CSLL (1,00%){valorServico < minimoRetencaoPisCofinsCsll ? ' — abaixo do minimo' : ''}</span>
                            <span className="font-medium">{fmtCurrency(valorCsllReforma)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">IRRF ({fmtPercent(selectedNbs?.aliquotaIrrf ?? 1.5)}){valorServico < minimoRetencaoIrrf ? ' — abaixo do minimo' : ''}</span>
                            <span className="font-medium">{fmtCurrency(valorIrReforma)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">PIS (0,65%){valorServico < minimoRetencaoPisCofinsCsll ? ' — abaixo do minimo' : ''}</span>
                            <span className="font-medium">{fmtCurrency(valorPis)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">COFINS (3,00%){valorServico < minimoRetencaoPisCofinsCsll ? ' — abaixo do minimo' : ''}</span>
                            <span className="font-medium">{fmtCurrency(valorCofins)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">CSLL (1,00%){valorServico < minimoRetencaoPisCofinsCsll ? ' — abaixo do minimo' : ''}</span>
                            <span className="font-medium">{fmtCurrency(valorCsll)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">IRRF ({fmtPercent(selectedNbs?.aliquotaIrrf ?? 1.5)}){valorServico < minimoRetencaoIrrf ? ' — abaixo do minimo' : ''}</span>
                            <span className="font-medium">{fmtCurrency(valorIr)}</span>
                          </div>
                        </>
                      )}
                      {inssRetido && (
                        <div className="flex justify-between text-red-700">
                          <span>INSS (11,00%) — cessao de mao de obra</span>
                          <span className="font-medium">{fmtCurrency(valorInss)}</span>
                        </div>
                      )}
                      {issRetidoFinal && (
                        <div className="flex justify-between text-orange-700">
                          <span>ISS ({fmtPercent(aliquotaIssPct)}) — retido na fonte</span>
                          <span className="font-medium">{fmtCurrency(valorIss)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Retido</span>
                        <span className="text-red-700">{fmtCurrency(totalRetencoes)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-green-700">
                        <span>Valor Liquido</span>
                        <span>{fmtCurrency(valorLiquido)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle ISS Retido — apenas quando não é Simples/MEI */}
              {!tomadorSimplesOuMei && !prestadorSimplesOuMei && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="issRetido"
                    checked={form.issRetido}
                    onChange={(e) => setForm((f) => ({ ...f, issRetido: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="issRetido" className="text-sm text-gray-700">
                    ISS retido na fonte pelo tomador
                  </label>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => { setShowForm(false); setTomadorFiscalData(null) }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Salvar Rascunho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
