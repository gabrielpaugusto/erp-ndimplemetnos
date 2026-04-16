'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  User,
  Briefcase,
  FileText,
  Gift,
  Plus,
  Clock,
  XCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const statusColors: Record<string, string> = {
  ATIVO: 'bg-emerald-100 text-emerald-700',
  FERIAS: 'bg-sky-100 text-sky-700',
  AFASTADO: 'bg-yellow-100 text-yellow-700',
  DEMITIDO: 'bg-red-100 text-red-700',
};

interface Employee {
  id: string;
  matricula: string;
  cargo: string;
  departamento: string;
  dataAdmissao: string;
  dataDemissao?: string | null;
  salarioBase: number;
  jornadaSemanal: number;
  ctps?: string | null;
  pis?: string | null;
  status: string;
  person?: {
    razaoSocial: string;
    cpfCnpj?: string | null;
    telefone?: string | null;
    email?: string | null;
    dataNascimento?: string | null;
  } | null;
  costCenter?: { id: string; code: string; name: string } | null;
  benefits?: { id: string; type: string; description?: string | null; valorFuncionario: number }[];
}

export default function FuncionarioDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showDemitirModal, setShowDemitirModal] = useState(false);
  const [demitindo, setDemitindo] = useState(false);

  useEffect(() => {
    async function fetchEmployee() {
      try {
        const data = await api<Employee>(`/hr/employees/${id}`);
        setEmployee(data);
      } catch (err: any) {
        if (err?.message?.includes('not found') || err?.status === 404) {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchEmployee();
  }, [id]);

  const handleDemitir = async () => {
    if (!employee) return;
    setDemitindo(true);
    try {
      const updated = await api<Employee>(`/hr/employees/${id}/terminate`, { method: 'POST' });
      setEmployee(updated);
      setShowDemitirModal(false);
    } catch (err: any) {
      alert(err?.message || 'Erro ao demitir funcionario');
    } finally {
      setDemitindo(false);
    }
  };

  const bancoHoras = 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    );
  }

  if (notFound || !employee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-700 font-medium">Funcionario nao encontrado</p>
        <Link href="/rh/funcionarios" className="text-sky-600 hover:underline text-sm">Voltar para lista</Link>
      </div>
    );
  }

  const nome = employee.person?.razaoSocial ?? '—';
  const cpf = employee.person?.cpfCnpj ?? '—';
  const telefone = employee.person?.telefone ?? '—';
  const email = employee.person?.email ?? '—';
  const dataNascimento = employee.person?.dataNascimento ?? null;
  const centroCusto = employee.costCenter?.name ?? '—';
  const benefits = employee.benefits ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/rh/funcionarios" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{nome}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[employee.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {employee.status}
              </span>
            </div>
            <p className="text-slate-500 mt-0.5 text-sm">{employee.matricula} - {employee.cargo}</p>
          </div>
        </div>
        {employee.status === 'ATIVO' && (
          <button onClick={() => setShowDemitirModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors">
            <XCircle className="w-4 h-4" />
            Demitir
          </button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-slate-700">Dados Pessoais</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-500">CPF</span><span className="text-sm font-medium text-slate-900">{cpf}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Nascimento</span><span className="text-sm font-medium text-slate-900">{dataNascimento ? new Date(dataNascimento).toLocaleDateString('pt-BR') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Telefone</span><span className="text-sm font-medium text-slate-900">{telefone}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Email</span><span className="text-sm font-medium text-slate-900 text-right truncate max-w-[180px]">{email}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-slate-700">Dados Funcionais</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Cargo</span><span className="text-sm font-medium text-slate-900">{employee.cargo}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Departamento</span><span className="text-sm font-medium text-slate-900">{employee.departamento}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Centro Custo</span><span className="text-sm font-medium text-slate-900">{centroCusto}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Jornada</span><span className="text-sm font-medium text-slate-900">{employee.jornadaSemanal}h/semana</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-slate-700">Contrato</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Admissao</span><span className="text-sm font-medium text-slate-900">{new Date(employee.dataAdmissao).toLocaleDateString('pt-BR')}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Salario Base</span><span className="text-sm font-bold text-slate-900">{formatCurrency(Number(employee.salarioBase))}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">CTPS</span><span className="text-sm font-medium text-slate-900">{employee.ctps ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">PIS</span><span className="text-sm font-medium text-slate-900">{employee.pis ?? '—'}</span></div>
          </div>
        </div>
      </div>

      {/* Banco de Horas */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-sky-600" />
          <h3 className="text-sm font-semibold text-slate-700">Banco de Horas</h3>
        </div>
        <div className="flex items-center gap-4">
          <p className={`text-2xl font-bold ${bancoHoras >= 0 ? 'text-sky-700' : 'text-red-700'}`}>{bancoHoras > 0 ? '+' : ''}{bancoHoras}h</p>
          <span className="text-sm text-slate-500">saldo acumulado</span>
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">Beneficios</h2>
          </div>
          <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {benefits.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum beneficio cadastrado</p>
          )}
          {benefits.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-900">{b.description ?? b.type}</p>
                <p className="text-xs text-slate-500">{b.type}</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(Number(b.valorFuncionario))}/mes</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payroll History placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Historico de Folha (Ultimos 6 meses)</h2>
        </div>
        <p className="text-sm text-slate-400">Historico disponivel na listagem de folhas de pagamento.</p>
      </div>

      {/* Demitir Modal */}
      {showDemitirModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Confirmar Demissao</h3>
                <p className="text-sm text-slate-500">Esta acao nao pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Tem certeza que deseja demitir o funcionario <strong>{nome}</strong> ({employee.matricula})?
              Sera necessario gerar a folha de rescisao e calcular as verbas rescisorias.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowDemitirModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">
                Cancelar
              </button>
              <button onClick={handleDemitir} disabled={demitindo} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <XCircle className="w-4 h-4" />
                {demitindo ? 'Aguarde...' : 'Confirmar Demissao'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
