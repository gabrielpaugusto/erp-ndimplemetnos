'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';

type EmployeeStatus = 'ATIVO' | 'FERIAS' | 'AFASTADO' | 'DEMITIDO';

interface Employee {
  id: string;
  matricula: string;
  nome: string;
  cargo: string;
  departamento: string;
  salarioBase: number;
  status: EmployeeStatus;
}

const statusLabels: Record<EmployeeStatus, string> = {
  ATIVO: 'Ativo',
  FERIAS: 'Ferias',
  AFASTADO: 'Afastado',
  DEMITIDO: 'Demitido',
};

const statusColors: Record<EmployeeStatus, string> = {
  ATIVO: 'bg-emerald-100 text-emerald-700',
  FERIAS: 'bg-sky-100 text-sky-700',
  AFASTADO: 'bg-yellow-100 text-yellow-700',
  DEMITIDO: 'bg-red-100 text-red-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const departamentos = ['Producao', 'Calderaria', 'Montagem', 'Pintura', 'Comercial', 'Administrativo', 'Oficina', 'Financeiro'];

export default function FuncionariosListPage() {
  const [entries, setEntries] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ data: any[]; meta: { total: number; totalPages: number } }>(
        '/hr/employees',
        {
          params: {
            search: search || undefined,
            status: statusFilter || undefined,
            departamento: deptFilter || undefined,
            page,
            limit,
          },
        },
      );
      const mapped: Employee[] = result.data.map((e) => ({
        id: e.id,
        matricula: e.matricula,
        nome: e.person?.razaoSocial ?? e.matricula,
        cargo: e.cargo,
        departamento: e.departamento,
        salarioBase: Number(e.salarioBase),
        status: e.status as EmployeeStatus,
      }));
      setEntries(mapped);
      setTotal(result.meta.total);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, deptFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, deptFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const totalPages = Math.ceil(total / limit);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setDeptFilter(''); };
  const hasActiveFilters = search || statusFilter || deptFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Funcionarios</h1>
          <p className="text-slate-500 mt-1">Cadastro e gestao de funcionarios</p>
        </div>
        <Link href="/rh/funcionarios/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Novo Funcionario
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por matricula, nome ou cargo..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" />Limpar
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                <option value="">Todos</option>
                {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Matricula</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Departamento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Salario Base</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Carregando...</td></tr>
              ) : entries.map((emp, index) => (
                <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{emp.matricula}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">{emp.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{emp.cargo}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{emp.departamento}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(emp.salarioBase)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[emp.status]}`}>
                      {statusLabels[emp.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/rh/funcionarios/${emp.id}`} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors inline-flex">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && entries.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum funcionario encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">Mostrando <span className="font-medium">{entries.length}</span> de <span className="font-medium">{total}</span> registros</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />Anterior
            </button>
            <span className="text-sm text-slate-700">Pagina {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Proxima<ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
