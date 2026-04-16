'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, ArrowLeftRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, switchCompany } from '@/lib/api';

interface Empresa {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  uf: string | null;
  municipio: string | null;
}

export default function EmpresasPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaAtualId, setEmpresaAtualId] = useState('');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ cnpj: '', razaoSocial: '', nomeFantasia: '', uf: '', municipio: '', taxRegime: 'LUCRO_PRESUMIDO' });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    setEmpresaAtualId(user?.company?.id ?? '');
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api<Empresa[]>('/company/all');
      setEmpresas(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitch(companyId: string) {
    if (switching) return;
    setSwitching(companyId);
    try {
      const res = await switchCompany(companyId);
      const user = JSON.parse(localStorage.getItem('user') ?? '{}');
      user.company = res.company;
      localStorage.setItem('user', JSON.stringify(user));
      window.location.href = '/dashboard';
    } catch {
      setMsg({ type: 'err', text: 'Erro ao trocar de empresa.' });
    } finally {
      setSwitching('');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api('/company/create', { method: 'POST', body: JSON.stringify(form) });
      setMsg({ type: 'ok', text: 'Empresa adicionada com sucesso.' });
      setShowForm(false);
      setForm({ cnpj: '', razaoSocial: '', nomeFantasia: '', uf: '', municipio: '', taxRegime: 'LUCRO_PRESUMIDO' });
      await load();
      // Atualiza lista no localStorage
      const data = await api<Empresa[]>('/company/all');
      const user = JSON.parse(localStorage.getItem('user') ?? '{}');
      user.empresas = data;
      localStorage.setItem('user', JSON.stringify(user));
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message ?? 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  }

  const fmtCnpj = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Empresas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie as empresas vinculadas ao seu usuário</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Adicionar empresa
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold text-slate-700">Nova empresa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">CNPJ *</label>
              <input
                className="input"
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value.replace(/\D/g, '') }))}
                maxLength={14}
                required
              />
            </div>
            <div>
              <label className="label">Razão Social *</label>
              <input className="input" value={form.razaoSocial} onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Nome Fantasia</label>
              <input className="input" value={form.nomeFantasia} onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))} />
            </div>
            <div>
              <label className="label">Regime Tributário *</label>
              <select className="input" value={form.taxRegime} onChange={(e) => setForm((f) => ({ ...f, taxRegime: e.target.value }))}>
                <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                <option value="LUCRO_REAL">Lucro Real</option>
                <option value="MEI">MEI</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">UF</label>
                <input className="input" maxLength={2} value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Município</label>
                <input className="input" value={form.municipio} onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {empresas.map((emp) => {
            const isAtual = emp.id === empresaAtualId;
            return (
              <div key={emp.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm ${isAtual ? 'border-primary-300 bg-primary-50' : 'border-slate-200'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isAtual ? 'bg-primary-600' : 'bg-slate-100'}`}>
                  <Building2 className={`w-5 h-5 ${isAtual ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{emp.nomeFantasia || emp.razaoSocial}</p>
                  {emp.nomeFantasia && <p className="text-xs text-slate-500 truncate">{emp.razaoSocial}</p>}
                  <p className="text-xs text-slate-400">{fmtCnpj(emp.cnpj)}{emp.municipio ? ` — ${emp.municipio}/${emp.uf}` : ''}</p>
                </div>
                {isAtual ? (
                  <span className="text-xs font-semibold text-primary-600 bg-primary-100 px-2 py-1 rounded-full shrink-0">Ativa</span>
                ) : (
                  <button
                    onClick={() => handleSwitch(emp.id)}
                    disabled={!!switching}
                    className="btn-secondary text-xs flex items-center gap-1 shrink-0"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    {switching === emp.id ? 'Trocando...' : 'Acessar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
