'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Truck, Plus, Search, ChevronRight, RefreshCw, X, Link2, Unlink,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  CAMINHAO:    { label: 'Caminhão',    color: 'bg-blue-100 text-blue-800' },
  REBOQUE:     { label: 'Reboque',     color: 'bg-slate-100 text-slate-800' },
  SEMIRREBOQUE:{ label: 'Semi-reboque',color: 'bg-purple-100 text-purple-800' },
  CARROCERIA:  { label: 'Carroceria',  color: 'bg-green-100 text-green-800' },
};

const STATUS_CARROCERIA: Record<string, string> = {
  EM_PRODUCAO:      'Em Produção',
  AGUARD_VEICULO:   'Aguard. Veículo',
  AGUARD_INSTALACAO:'Aguard. Instalação',
  INSTALADA:        'Instalada',
};

const TIPOS_VEICULOS = ['CAMINHAO', 'REBOQUE', 'SEMIRREBOQUE', 'CARROCERIA'];

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [tiposCarroceria, setTiposCarroceria] = useState<any[]>([]);
  const [modelosCarroceria, setModelosCarroceria] = useState<any[]>([]);

  // ── Busca ────────────────────────────────────────────────────────────────

  const fetchEquipamentos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (tipoFilter) params.set('tipo', tipoFilter);

      const res = await apiFetch(`/api/workshop/equipamentos?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setEquipamentos(json.data || []);
      setMeta(json.meta || { total: 0, totalPages: 1 });
    } catch {
      alert('Erro ao carregar equipamentos');
    } finally {
      setLoading(false);
    }
  }, [page, search, tipoFilter]);

  useEffect(() => { fetchEquipamentos(); }, [fetchEquipamentos]);

  useEffect(() => {
    apiFetch('/api/workshop/equipamentos/tipos-carroceria')
      .then(r => r.ok ? r.json() : [])
      .then(setTiposCarroceria)
      .catch(() => {});
  }, []);

  // ── Modelos por tipo ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!form.tipoCarroceriaId) { setModelosCarroceria([]); return; }
    apiFetch(`/api/workshop/equipamentos/modelos-carroceria?tipoCarroceriaId=${form.tipoCarroceriaId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setModelosCarroceria)
      .catch(() => {});
  }, [form.tipoCarroceriaId]);

  // ── Modal ─────────────────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setForm({ tipo: 'CAMINHAO', ativo: true });
    setModalOpen(true);
  }

  function openEdit(eq: any) {
    setEditing(eq);
    setForm({ ...eq });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editing
        ? `/api/workshop/equipamentos/${editing.id}`
        : '/api/workshop/equipamentos';
      const method = editing ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao salvar');
      }

      setModalOpen(false);
      fetchEquipamentos();
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar equipamento');
    } finally {
      setSaving(false);
    }
  }

  // ── Vínculo ───────────────────────────────────────────────────────────────

  const [vinculoTarget, setVinculoTarget]   = useState<any>(null); // equipamento alvo
  const [vinculoPickList, setVinculoPickList] = useState<any[]>([]);
  const [vinculoPickId, setVinculoPickId]   = useState('');
  const [vinculoObs, setVinculoObs]         = useState('');
  const [vinculoLoading, setVinculoLoading] = useState(false);
  const [vinculoSaving, setVinculoSaving]   = useState(false);

  async function openVincular(eq: any, e: React.MouseEvent) {
    e.stopPropagation();
    setVinculoTarget(eq);
    setVinculoPickId('');
    setVinculoObs('');
    setVinculoLoading(true);
    try {
      // Para carroceria → listar veículos (CAMINHAO, SEMIRREBOQUE, REBOQUE)
      // Para veículos → listar carrocerias disponíveis (status AGUARD_VEICULO ou EM_PRODUCAO)
      const isCarroceria = eq.tipo === 'CARROCERIA';
      const tipoParam = isCarroceria ? '' : 'tipo=CARROCERIA';
      const res = await apiFetch(`/api/workshop/equipamentos?limit=200${tipoParam ? '&' + tipoParam : ''}`);
      if (res.ok) {
        const json = await res.json();
        const lista = (json.data || []).filter((e2: any) => {
          if (isCarroceria) return e2.tipo !== 'CARROCERIA' && e2.id !== eq.id;
          return e2.tipo === 'CARROCERIA' && e2.id !== eq.id;
        });
        setVinculoPickList(lista);
      }
    } finally {
      setVinculoLoading(false);
    }
  }

  async function confirmVincular() {
    if (!vinculoPickId || !vinculoTarget) return;
    setVinculoSaving(true);
    try {
      const isCarroceria = vinculoTarget.tipo === 'CARROCERIA';
      const body = isCarroceria
        ? { carroceriaId: vinculoTarget.id, veiculoId: vinculoPickId, observations: vinculoObs || undefined }
        : { carroceriaId: vinculoPickId, veiculoId: vinculoTarget.id, observations: vinculoObs || undefined };
      const res = await apiFetch('/api/workshop/equipamentos/vinculos', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Erro ao vincular');
        return;
      }
      setVinculoTarget(null);
      fetchEquipamentos();
    } finally {
      setVinculoSaving(false);
    }
  }

  async function desvincular(vinculoId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Desvincular este equipamento?')) return;
    const res = await apiFetch(`/api/workshop/equipamentos/vinculos/${vinculoId}/desvincular`, { method: 'PATCH' });
    if (res.ok) {
      fetchEquipamentos();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Erro ao desvincular');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold">Equipamentos</h1>
            <p className="text-sm text-slate-500">
              Caminhões, reboques, semi-reboques e carrocerias
            </p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Novo Equipamento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar por placa, chassi, série, marca..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={tipoFilter}
          onChange={e => { setTipoFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todos os tipos</option>
          {TIPOS_VEICULOS.map(t => (
            <option key={t} value={t}>{TIPO_LABELS[t]?.label}</option>
          ))}
        </select>
        <button
          className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
          onClick={fetchEquipamentos}
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium text-slate-600">Tipo</th>
              <th className="text-left p-3 font-medium text-slate-600">Identificação</th>
              <th className="text-left p-3 font-medium text-slate-600">Marca / Modelo</th>
              <th className="text-left p-3 font-medium text-slate-600">Proprietário</th>
              <th className="text-left p-3 font-medium text-slate-600">Status / Vínculo</th>
              <th className="p-3 text-right font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Carregando...</td></tr>
            ) : equipamentos.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum equipamento encontrado</td></tr>
            ) : equipamentos.map(eq => (
              <tr key={eq.id} className="border-t hover:bg-slate-50">
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_LABELS[eq.tipo]?.color}`}>
                    {TIPO_LABELS[eq.tipo]?.label}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs">
                  {eq.tipo === 'CARROCERIA' ? (
                    <div>
                      <div className="font-semibold">{eq.serialNumber || '—'}</div>
                      {eq.tipoCarroceria && <div className="text-slate-400">{eq.tipoCarroceria.nome}</div>}
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold">{eq.placa || '—'}</div>
                      {eq.chassi && <div className="text-slate-400">{eq.chassi}</div>}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div>{eq.marca || '—'}</div>
                  {eq.modelo && <div className="text-slate-400 text-xs">{eq.modelo} {eq.anoModelo ? `(${eq.anoModelo})` : ''}</div>}
                </td>
                <td className="p-3 text-slate-500">
                  {eq.proprietario?.razaoSocial || '—'}
                </td>
                <td className="p-3">
                  <div className="space-y-1">
                    {eq.tipo === 'CARROCERIA' && eq.carroceriaStatus ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium border border-slate-300 text-slate-600 block w-fit">
                        {STATUS_CARROCERIA[eq.carroceriaStatus] || eq.carroceriaStatus}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium block w-fit ${eq.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {eq.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                    {/* Vínculo ativo para carroceria */}
                    {eq.tipo === 'CARROCERIA' && eq.carroceriaVinculos?.filter((v: any) => v.ativo).map((v: any) => (
                      <div key={v.id} className="flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 w-fit">
                        <Link2 className="h-2.5 w-2.5" />
                        <span className="font-mono font-semibold">{v.veiculo?.placa || v.veiculo?.tipo}</span>
                      </div>
                    ))}
                    {/* Vínculos ativos para veículo */}
                    {eq.tipo !== 'CARROCERIA' && eq.veiculoVinculos?.filter((v: any) => v.ativo).map((v: any) => (
                      <div key={v.id} className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 rounded px-1.5 py-0.5 w-fit">
                        <Link2 className="h-2.5 w-2.5" />
                        <span className="font-mono font-semibold">{v.carroceria?.serialNumber || '—'}</span>
                        {v.carroceria?.tipoCarroceria?.nome && (
                          <span className="text-green-500">· {v.carroceria.tipoCarroceria.nome}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                    {/* Desvincular carroceria ativa */}
                    {eq.tipo === 'CARROCERIA' && eq.carroceriaVinculos?.filter((v: any) => v.ativo).map((v: any) => (
                      <button
                        key={v.id}
                        onClick={(e) => desvincular(v.id, e)}
                        title="Desvincular veículo"
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    ))}
                    {/* Desvincular carroceria(s) ativas do veículo */}
                    {eq.tipo !== 'CARROCERIA' && eq.veiculoVinculos?.filter((v: any) => v.ativo).map((v: any) => (
                      <button
                        key={v.id}
                        onClick={(e) => desvincular(v.id, e)}
                        title="Desvincular carroceria"
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    ))}
                    {/* Vincular */}
                    <button
                      onClick={(e) => openVincular(eq, e)}
                      title={eq.tipo === 'CARROCERIA' ? 'Vincular a veículo' : 'Vincular carroceria'}
                      className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(eq); }}
                      title="Editar"
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{meta.total} equipamentos</span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-40 hover:bg-slate-50"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </button>
            <span className="py-1 px-2">Pág. {page} de {meta.totalPages}</span>
            <button
              className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-40 hover:bg-slate-50"
              disabled={page === meta.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Modal de cadastro / edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Equipamento' : 'Novo Equipamento'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tipo + Marca */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.tipo || ''}
                    onChange={e => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="" disabled>Selecione</option>
                    {TIPOS_VEICULOS.map(t => (
                      <option key={t} value={t}>{TIPO_LABELS[t]?.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.marca || ''}
                    onChange={e => setForm({ ...form, marca: e.target.value })}
                    placeholder="Ex: Volvo, Randon..."
                  />
                </div>
              </div>

              {/* Modelo + Anos */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.modelo || ''}
                    onChange={e => setForm({ ...form, modelo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ano Fabricação</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.anoFabricacao || ''}
                    onChange={e => setForm({ ...form, anoFabricacao: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ano Modelo</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.anoModelo || ''}
                    onChange={e => setForm({ ...form, anoModelo: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Campos para veículos (não carroceria) */}
              {form.tipo !== 'CARROCERIA' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
                    <input
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.placa || ''}
                      onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                      placeholder="ABC1D23"
                    />
                  </div>
                  {['CAMINHAO', 'SEMIRREBOQUE'].includes(form.tipo) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chassi (VIN — 17 caracteres)</label>
                      <input
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.chassi || ''}
                        onChange={e => setForm({ ...form, chassi: e.target.value.toUpperCase() })}
                        placeholder="9BWHE21JX24060831"
                        maxLength={17}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Campos de carroceria */}
              {form.tipo === 'CARROCERIA' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Carroceria</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.tipoCarroceriaId || ''}
                        onChange={e => setForm({ ...form, tipoCarroceriaId: e.target.value, modeloCarroceriaId: '' })}
                      >
                        <option value="">Selecione</option>
                        {tiposCarroceria.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.codigoLegal} — {t.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Modelo de Carroceria</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.modeloCarroceriaId || ''}
                        onChange={e => setForm({ ...form, modeloCarroceriaId: e.target.value })}
                        disabled={!form.tipoCarroceriaId}
                      >
                        <option value="">Selecione o tipo primeiro</option>
                        {modelosCarroceria.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.nome}{m.fabricante ? ` (${m.fabricante})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Número de Série (auto-gerado se vazio)</label>
                      <input
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.serialNumber || ''}
                        onChange={e => setForm({ ...form, serialNumber: e.target.value.toUpperCase() })}
                        placeholder="ND-2026-001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Montagem</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.tipoMontagem || ''}
                        onChange={e => setForm({ ...form, tipoMontagem: e.target.value })}
                      >
                        <option value="">Selecione</option>
                        <option value="INTERNO">Interno (pela ND)</option>
                        <option value="EXTERNO">Externo (terceiro)</option>
                        <option value="KIT_ENVIADO">Kit enviado</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Marca Guerra */}
              {form.tipo === 'SEMIRREBOQUE' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="marcaGuerra"
                    checked={form.marcaGuerra || false}
                    onChange={e => setForm({ ...form, marcaGuerra: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="marcaGuerra" className="text-sm font-medium text-slate-700">
                    Marca Guerra (garantia especial)
                  </label>
                </div>
              )}

              {/* KM para caminhões */}
              {form.tipo === 'CAMINHAO' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">KM Atual</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.kmAtual || ''}
                    onChange={e => setForm({ ...form, kmAtual: Number(e.target.value) })}
                  />
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.observations || ''}
                  onChange={e => setForm({ ...form, observations: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Vínculo Carroceria ↔ Veículo */}
      {vinculoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {vinculoTarget.tipo === 'CARROCERIA' ? 'Vincular Carroceria a Veículo' : 'Vincular Carroceria ao Veículo'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {vinculoTarget.tipo === 'CARROCERIA'
                    ? `Carroceria: ${vinculoTarget.serialNumber || vinculoTarget.id.slice(0, 8)}`
                    : `Veículo: ${vinculoTarget.placa || vinculoTarget.tipo}`
                  }
                </p>
              </div>
              <button onClick={() => setVinculoTarget(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {vinculoLoading ? (
                <p className="text-center text-slate-400 py-6 text-sm">Carregando...</p>
              ) : vinculoPickList.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">
                  {vinculoTarget.tipo === 'CARROCERIA'
                    ? 'Nenhum veículo encontrado.'
                    : 'Nenhuma carroceria disponível.'}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {vinculoTarget.tipo === 'CARROCERIA' ? 'Selecione o veículo:' : 'Selecione a carroceria:'}
                  </label>
                  {vinculoPickList.map((item: any) => {
                    const label = item.tipo === 'CARROCERIA'
                      ? `${item.serialNumber || '—'} · ${item.tipoCarroceria?.nome || item.tipo}`
                      : `${item.placa || '—'} · ${TIPO_LABELS[item.tipo]?.label || item.tipo} ${item.marca ? '· ' + item.marca : ''}`;
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 p-2.5 border-2 rounded-xl cursor-pointer transition-all ${
                          vinculoPickId === item.id
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="vinculoPick"
                          value={item.id}
                          checked={vinculoPickId === item.id}
                          onChange={() => setVinculoPickId(item.id)}
                          className="text-blue-600"
                        />
                        <span className="text-sm font-medium text-slate-800">{label}</span>
                        {item.tipo !== 'CARROCERIA' && item.veiculoVinculos?.some((v: any) => v.ativo) && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-auto shrink-0">
                            Já tem carroceria
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações (opcional)</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={vinculoObs}
                  onChange={e => setVinculoObs(e.target.value)}
                  placeholder="Ex: Instalação para entrega..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setVinculoTarget(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmVincular}
                  disabled={!vinculoPickId || vinculoSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Link2 className="h-4 w-4" />
                  {vinculoSaving ? 'Vinculando...' : 'Confirmar Vínculo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
