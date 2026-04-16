'use client'
import { useState, useEffect } from 'react'
import { Plus, Search, CheckCircle, XCircle, Download } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { fmtPercent } from '@/lib/format'

interface NbsCode {
  id: string
  codigo: string
  descricao: string
  unidade?: string
  aliquotaIss?: number
  ativo: boolean
}

export default function NbsPage() {
  const [codes, setCodes] = useState<NbsCode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const [form, setForm] = useState({
    codigo: '',
    descricao: '',
    unidade: '',
    aliquotaIss: '',
  })

  useEffect(() => {
    fetchCodes()
  }, [])

  async function fetchCodes() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/nbs${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const json = await res.json()
      setCodes(Array.isArray(json) ? json : [])
    } catch {
      setCodes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => fetchCodes(), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function handleCreate() {
    const res = await apiFetch('/api/nbs', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        aliquotaIss: form.aliquotaIss ? parseFloat(form.aliquotaIss) : undefined,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ codigo: '', descricao: '', unidade: '', aliquotaIss: '' })
      setMsg('Código NBS criado com sucesso')
      setMsgType('success')
      fetchCodes()
    } else {
      const err = await res.json()
      setMsg(`Erro: ${err.message ?? 'Não foi possível criar o código'}`)
      setMsgType('error')
    }
  }

  async function handleToggle(id: string, ativo: boolean) {
    await apiFetch(`/api/nbs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ativo: !ativo }),
    })
    fetchCodes()
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await apiFetch('/api/nbs/seed', { method: 'POST' })
      const json = await res.json()
      setMsg(json.message ?? 'Seed concluído')
      setMsgType('success')
      fetchCodes()
    } catch {
      setMsg('Erro ao executar seed')
      setMsgType('error')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tabela NBS</h1>
          <p className="text-sm text-gray-500">
            Nomenclatura Brasileira de Serviços — códigos para NFS-e Nacional
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-60 text-sm"
          >
            <Download size={16} />
            {seeding ? 'Importando...' : 'Importar Padrão'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} /> Novo Código
          </button>
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

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por código ou descrição..."
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
                <th className="px-4 py-3 text-left">Código NBS</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-center">Unidade</th>
                <th className="px-4 py-3 text-center">Alíquota ISS</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    Nenhum código encontrado. Clique em &quot;Importar Padrão&quot; para popular a tabela.
                  </td>
                </tr>
              ) : (
                codes.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${!c.ativo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700">{c.codigo}</td>
                    <td className="px-4 py-3 text-gray-700">{c.descricao}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{c.unidade ?? '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {c.aliquotaIss != null ? fmtPercent(c.aliquotaIss) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.ativo ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle size={11} /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          <XCircle size={11} /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(c.id, c.ativo)}
                        className={`text-xs px-3 py-1 rounded font-medium ${
                          c.ativo
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {c.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
            {codes.length} código(s) encontrado(s)
          </div>
        </div>
      )}

      {/* Modal Novo Código */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold">Novo Código NBS</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Código NBS *</label>
                  <input
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1.0901"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Unidade</label>
                  <input
                    value={form.unidade}
                    onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="UN, HR, MES"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Descrição *</label>
                <input
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Alíquota ISS padrão (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.aliquotaIss}
                  onChange={(e) => setForm((f) => ({ ...f, aliquotaIss: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="5.00"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Criar Código
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
