'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, User, Briefcase, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function NovoFuncionarioPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Dados Pessoais
  const [pessoa, setPessoa] = useState('');
  // Dados Funcionais
  const [matricula, setMatricula] = useState('');
  const [cargo, setCargo] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  // Contrato
  const [dataAdmissao, setDataAdmissao] = useState(new Date().toISOString().slice(0, 10));
  const [salarioBase, setSalarioBase] = useState('');
  const [jornadaSemanal, setJornadaSemanal] = useState('44');
  const [valorHora, setValorHora] = useState('');
  // Documentos
  const [ctps, setCtps] = useState('');
  const [pis, setPis] = useState('');

  // Dados carregados da API
  const [pessoas, setPessoas] = useState<{ id: string; razaoSocial: string }[]>([]);

  useEffect(() => {
    apiFetch('/api/persons?limit=200').then(r => r.json()).then(d => setPessoas(d.data ?? d ?? [])).catch(() => {});
  }, []);

  const departamentos = ['Producao', 'Calderaria', 'Montagem', 'Pintura', 'Comercial', 'Administrativo', 'Oficina', 'Financeiro'];
  const centrosCusto = ['Producao', 'Calderaria', 'Montagem', 'Pintura', 'Administrativo', 'Comercial'];

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await apiFetch('/api/hr/employees', {
        method: 'POST',
        body: JSON.stringify({
          personId: pessoa,
          matricula: matricula.trim(),
          cargo: cargo.trim(),
          departamento,
          ...(centroCusto && { centroCusto }),
          dataAdmissao,
          salarioBase: parseFloat(salarioBase),
          jornadaSemanal: parseInt(jornadaSemanal),
          ...(valorHora && { valorHora: parseFloat(valorHora) }),
          ...(ctps && { ctps: ctps.trim() }),
          ...(pis  && { pis:  pis.trim()  }),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message || 'Erro ao cadastrar funcionario');
        return;
      }
      router.push('/rh/funcionarios');
    } catch {
      setError('Erro de conexao. Verifique se o servidor esta rodando.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rh/funcionarios" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Funcionario</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastrar um novo funcionario</p>
        </div>
      </div>

      {/* Dados Pessoais */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados Pessoais</h2>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pessoa *</label>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
            <option value="">Selecione uma pessoa cadastrada...</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.razaoSocial}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-1">Selecione uma pessoa ja cadastrada no sistema ou cadastre uma nova em CRM &gt; Pessoas</p>
        </div>
      </div>

      {/* Dados Funcionais */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados Funcionais</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Matricula *</label>
            <input type="text" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex: MAT-009" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cargo *</label>
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Soldador, Montador, Analista..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Departamento *</label>
            <select value={departamento} onChange={(e) => setDepartamento(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Custo</label>
            <select value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
              <option value="">Selecione...</option>
              {centrosCusto.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Contrato */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Contrato</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Admissao *</label>
            <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Salario Base (R$) *</label>
            <input type="number" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} placeholder="0,00" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jornada Semanal (h)</label>
            <input type="number" value={jornadaSemanal} onChange={(e) => setJornadaSemanal(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Hora (R$/h)</label>
            <input type="number" value={valorHora} onChange={(e) => setValorHora(e.target.value)} placeholder="0,00" step="0.01" min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
            <p className="text-xs text-slate-400 mt-1">Usado para cálculo de custo real de mão de obra nos apontamentos</p>
          </div>
        </div>
      </div>

      {/* Documentos */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Documentos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CTPS (Numero/Serie)</label>
            <input type="text" value={ctps} onChange={(e) => setCtps(e.target.value)} placeholder="Ex: 12345/001-SP" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PIS/PASEP</label>
            <input type="text" value={pis} onChange={(e) => setPis(e.target.value)} placeholder="Ex: 123.45678.90-1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/rh/funcionarios" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button onClick={handleSave} disabled={saving || !pessoa || !matricula || !cargo || !departamento || !salarioBase} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" />
          Salvar Funcionario
        </button>
      </div>
    </div>
  );
}
