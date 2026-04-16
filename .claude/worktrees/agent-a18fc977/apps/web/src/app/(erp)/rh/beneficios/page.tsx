'use client';

import { useState, useEffect } from 'react';
import {
  Gift,
  Bus,
  UtensilsCrossed,
  ShoppingBag,
  HeartPulse,
  Shield,
  Plus,
  Save,
  X,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface BenefitSummaryType {
  id: string;
  tipo: string;
  descricao: string;
  custoTotal: number;
  funcionarios: number;
  icon: string;
}

const iconMap: Record<string, React.ReactNode> = {
  bus: <Bus className="w-5 h-5" />,
  food: <UtensilsCrossed className="w-5 h-5" />,
  shopping: <ShoppingBag className="w-5 h-5" />,
  health: <HeartPulse className="w-5 h-5" />,
  shield: <Shield className="w-5 h-5" />,
  default: <Gift className="w-5 h-5" />,
};

const colorMap: Record<string, string> = {
  bus: 'bg-blue-100 text-blue-600',
  food: 'bg-orange-100 text-orange-600',
  shopping: 'bg-green-100 text-green-600',
  health: 'bg-red-100 text-red-600',
  shield: 'bg-purple-100 text-purple-600',
  default: 'bg-sky-100 text-sky-600',
};

const typeToIcon: Record<string, string> = {
  VALE_TRANSPORTE: 'bus',
  VALE_REFEICAO: 'food',
  VALE_ALIMENTACAO: 'shopping',
  PLANO_SAUDE: 'health',
  SEGURO_VIDA: 'shield',
};

const typeToLabel: Record<string, string> = {
  VALE_TRANSPORTE: 'Vale Transporte',
  VALE_REFEICAO: 'Vale Refeicao',
  VALE_ALIMENTACAO: 'Vale Alimentacao',
  PLANO_SAUDE: 'Plano Saude',
  SEGURO_VIDA: 'Seguro Vida',
};

interface EmployeeBenefit {
  id: string;
  nome: string;
  matricula: string;
  departamento: string;
  beneficios: string[];
  custoMensal: number;
}

export default function BeneficiosPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTipo, setNewTipo] = useState('');
  const [newFuncionario, setNewFuncionario] = useState('');
  const [newValor, setNewValor] = useState('');
  const [benefitTypes, setBenefitTypes] = useState<BenefitSummaryType[]>([]);
  const [totalCustoGeral, setTotalCustoGeral] = useState(0);
  const [employees, setEmployees] = useState<EmployeeBenefit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ totalBenefits: number; totalCostEmpresa: number; byType: Record<string, { count: number; totalEmpresa: number; totalFuncionario: number }> }>('/hr/benefits/summary'),
      api<{ data: any[]; meta: any }>('/hr/benefits', { params: { limit: 100 } }),
    ])
      .then(([summary, benefitsList]) => {
        // Build summary cards from byType
        const types: BenefitSummaryType[] = Object.entries(summary.byType ?? {}).map(([type, info], idx) => ({
          id: String(idx),
          tipo: typeToLabel[type] ?? type,
          descricao: typeToLabel[type] ?? type,
          custoTotal: info.totalEmpresa,
          funcionarios: info.count,
          icon: typeToIcon[type] ?? 'default',
        }));
        setBenefitTypes(types);
        setTotalCustoGeral(summary.totalCostEmpresa ?? 0);

        // Group benefits by employee
        const empMap = new Map<string, EmployeeBenefit>();
        for (const b of benefitsList.data) {
          const empId = b.employee?.id ?? b.employeeId;
          const empName = b.employee?.person?.razaoSocial ?? empId;
          const empMatricula = b.employee?.matricula ?? '';
          const empDept = b.employee?.departamento ?? '';
          const tipoBeneficio = typeToLabel[b.type] ?? b.type;
          const custo = Number(b.valorEmpresa ?? 0);

          if (!empMap.has(empId)) {
            empMap.set(empId, { id: empId, nome: empName, matricula: empMatricula, departamento: empDept, beneficios: [], custoMensal: 0 });
          }
          const entry = empMap.get(empId)!;
          entry.beneficios.push(tipoBeneficio);
          entry.custoMensal += custo;
        }
        setEmployees(Array.from(empMap.values()));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = () => {
    alert('Beneficio adicionado com sucesso! (mock)');
    setShowAddForm(false);
    setNewTipo('');
    setNewFuncionario('');
    setNewValor('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Beneficios</h1>
          <p className="text-slate-500 mt-1">Gestao de beneficios dos funcionarios</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Adicionar Beneficio
        </button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {benefitTypes.map((b) => (
            <div key={b.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[b.icon] ?? colorMap.default}`}>
                  {iconMap[b.icon] ?? iconMap.default}
                </div>
                <h3 className="text-sm font-semibold text-slate-700">{b.tipo}</h3>
              </div>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(b.custoTotal)}</p>
              <p className="text-xs text-slate-500 mt-1">{b.funcionarios} funcionarios</p>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="bg-sky-50 rounded-lg border border-sky-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-sky-600" />
          <span className="text-sm font-medium text-sky-800">Custo Total Mensal de Beneficios</span>
        </div>
        <span className="text-xl font-bold text-sky-700">{formatCurrency(totalCustoGeral)}</span>
      </div>

      {/* Add Benefit Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-sky-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">Adicionar Beneficio</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Funcionario *</label>
              <select value={newFuncionario} onChange={(e) => setNewFuncionario(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                <option value="">Selecione...</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.matricula})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Beneficio *</label>
              <select value={newTipo} onChange={(e) => setNewTipo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                <option value="">Selecione...</option>
                {benefitTypes.map((b) => <option key={b.id} value={b.tipo}>{b.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Mensal (R$) *</label>
              <input type="number" value={newValor} onChange={(e) => setNewValor(e.target.value)} placeholder="0,00" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-4">
            <button onClick={() => setShowAddForm(false)} className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              <X className="w-4 h-4" />Cancelar
            </button>
            <button onClick={handleAdd} disabled={!newFuncionario || !newTipo || !newValor} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Save className="w-4 h-4" />Salvar
            </button>
          </div>
        </div>
      )}

      {/* Employee Benefits List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">Beneficios por Funcionario</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Matricula</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Funcionario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Departamento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Beneficios Ativos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo Mensal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Carregando...</td></tr>
              ) : employees.map((emp, index) => (
                <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-sm text-slate-600">{emp.matricula}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{emp.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{emp.departamento}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {emp.beneficios.map((b, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">{b}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(emp.custoMensal)}</td>
                </tr>
              ))}
              {!loading && employees.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum beneficio encontrado.</td></tr>
              )}
            </tbody>
            {!loading && employees.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-900">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-sky-700 text-right">
                    {formatCurrency(employees.reduce((s, e) => s + e.custoMensal, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
