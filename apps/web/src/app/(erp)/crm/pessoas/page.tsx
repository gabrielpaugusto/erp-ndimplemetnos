'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  Filter,
  X,
  ShoppingCart,
  Truck,
  Package,
  UserCheck,
  Wrench,
  Star,
  Users,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { EmptyStateRow } from '@/components/ui/empty-state';
import { maskCpfCnpj } from '@/lib/masks';

interface Person {
  id: string;
  type: 'PF' | 'PJ';
  cpfCnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  roles: string[];
  active: boolean;
}

// Configuração de cada role: label, cor do badge
const ROLE_CONFIG: Record<string, { label: string; badge: string }> = {
  CLIENTE:        { label: 'Cliente',        badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  FORNECEDOR:     { label: 'Fornecedor',     badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  TRANSPORTADORA: { label: 'Transportadora', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  FUNCIONARIO:    { label: 'Funcionário',    badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  PRESTADOR:      { label: 'Prestador',      badge: 'bg-teal-100 text-teal-700 border-teal-200' },
  REPRESENTANTE:  { label: 'Representante',  badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  OUTROS:         { label: 'Outros',         badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const QUICK_TABS: { key: string; label: string; icon: ReactNode }[] = [
  { key: '',              label: 'Todos',          icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'CLIENTE',       label: 'Clientes',       icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  { key: 'FORNECEDOR',    label: 'Fornecedores',   icon: <Package className="w-3.5 h-3.5" /> },
  { key: 'TRANSPORTADORA',label: 'Transportadoras',icon: <Truck className="w-3.5 h-3.5" /> },
  { key: 'FUNCIONARIO',   label: 'Funcionários',   icon: <UserCheck className="w-3.5 h-3.5" /> },
  { key: 'PRESTADOR',     label: 'Prestadores',    icon: <Wrench className="w-3.5 h-3.5" /> },
  { key: 'REPRESENTANTE', label: 'Representantes', icon: <Star className="w-3.5 h-3.5" /> },
];

export default function PessoasPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(20);

  const getCompanyId = () => {
    try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.company?.id ?? ''; } catch { return ''; }
  };

  const loadPersons = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = getCompanyId();
      const params = new URLSearchParams({ companyId, page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter !== '') params.set('active', activeFilter);

      const res = await apiFetch(`/api/persons?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPersons(json.data ?? json);
        setTotal(json.meta?.total ?? (json.data ?? json).length);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, roleFilter, activeFilter, limit]);

  useEffect(() => { loadPersons(); }, [loadPersons]);

  const handleDelete = async (id: string) => {
    if (!confirm('Confirma a exclusão desta pessoa?')) return;
    await apiFetch(`/api/persons/${id}`, { method: 'DELETE' });
    loadPersons();
  };

  const handleQuickTab = (role: string) => {
    setRoleFilter(role);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch(''); setTypeFilter(''); setRoleFilter(''); setActiveFilter(''); setPage(1);
  };

  const hasActiveFilters = search || typeFilter || roleFilter || activeFilter !== '';
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Pessoas</h1>
          <p className="text-slate-500 mt-1">Clientes, fornecedores, transportadoras, funcionários e prestadores — tudo em um único lugar</p>
        </div>
        <Link
          href="/crm/pessoas/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Pessoa
        </Link>
      </div>

      {/* Quick-filter tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-1 p-1.5 overflow-x-auto scrollbar-none">
          {QUICK_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleQuickTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                roleFilter === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Busca + filtros avançados */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ ou nome fantasia..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || (typeFilter || activeFilter !== '')
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {(typeFilter || activeFilter !== '') && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>
            )}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" /> Limpar tudo
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Pessoa</label>
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                <option value="PF">Pessoa Física (PF)</option>
                <option value="PJ">Pessoa Jurídica (PJ)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Papel</label>
              <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF/CNPJ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome / Razão Social</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Papéis</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">Carregando...</td>
                </tr>
              ) : persons.length === 0 ? (
                <EmptyStateRow
                  colSpan={6}
                  icon={Users}
                  title="Nenhuma pessoa encontrada"
                  description={hasActiveFilters ? 'Tente ajustar os filtros de busca.' : 'Cadastre a primeira pessoa clicando em "Nova Pessoa".'}
                  filtered={!!hasActiveFilters}
                />
              ) : persons.map((person, index) => (
                <tr key={person.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-sm text-slate-900 font-mono">
                    {maskCpfCnpj(person.cpfCnpj)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{person.razaoSocial}</div>
                    {person.nomeFantasia && <div className="text-xs text-slate-500">{person.nomeFantasia}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      person.type === 'PJ' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                    }`}>{person.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(person.roles) ? person.roles : [person.roles]).map((role) => {
                        const cfg = ROLE_CONFIG[role] ?? { label: role, badge: 'bg-slate-100 text-slate-600 border-slate-200' };
                        return (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${cfg.badge}`}
                          >
                            {cfg.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      person.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${person.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {person.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/crm/pessoas/${person.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Visualizar">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link href={`/crm/pessoas/${person.id}`}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Editar">
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(person.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-medium">{persons.length}</span> de <span className="font-medium">{total}</span> registros
            {roleFilter && ROLE_CONFIG[roleFilter] && (
              <span className="ml-1 text-slate-400">({ROLE_CONFIG[roleFilter].label})</span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Por página:</span>
              <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm text-slate-700">Página {page} de {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
