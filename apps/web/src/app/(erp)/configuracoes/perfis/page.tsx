'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Lock,
  Users,
  ChevronDown,
  ChevronRight,
  Check,
  GitBranch,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Eye,
  FileText,
  Settings,
  Layers,
  Building2,
  ShoppingCart,
  Package,
  Wrench,
  BarChart3,
  CreditCard,
  ClipboardList,
  Factory,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtPercent } from '@/lib/format';

// ---------------------------------------------------------------------------
// PERMISSION TREE — Hierarquia 3 níveis: Departamento → Sub-área → Operação
// ---------------------------------------------------------------------------

/** Uma operação mapeia para uma ou mais ações do backend */
interface OperationDef {
  id: string;
  label: string;
  actions: string[];         // backend PermissionAction values
  colorClass: string;        // classes Tailwind para o chip
  description?: string;
}

interface SubAreaDef {
  id: string;
  label: string;
  module: string;            // backend Module enum value
  restricted?: boolean;      // mostra badge ⚠️ RESTRITO
  operations: OperationDef[];
}

interface DepartmentDef {
  id: string;
  label: string;
  colorClass: string;        // cor do header
  subAreas: SubAreaDef[];
}

// Operações reutilizáveis
const OP = {
  consultar:  { id: 'consultar',  label: 'Consultar',      actions: ['READ'],             colorClass: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  lancar:     { id: 'lancar',     label: 'Lançar',          actions: ['CREATE', 'UPDATE'], colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  incluir:    { id: 'incluir',    label: 'Incluir',         actions: ['CREATE'],           colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  alterar:    { id: 'alterar',    label: 'Alterar',         actions: ['UPDATE'],           colorClass: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  excluir:    { id: 'excluir',    label: 'Excluir',         actions: ['DELETE'],           colorClass: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
  aprovar:    { id: 'aprovar',    label: 'Aprovar',         actions: ['APPROVE'],          colorClass: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100' },
  relatorios: { id: 'relatorios', label: 'Relatórios',      actions: ['EXPORT'],           colorClass: 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100' },
  configurar: { id: 'configurar', label: 'Configurar',      actions: ['MANAGE'],           colorClass: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' },
  emitir:     { id: 'emitir',     label: 'Emitir',          actions: ['CREATE', 'UPDATE'], colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  cancelar:   { id: 'cancelar',   label: 'Cancelar/Excluir',actions: ['DELETE'],           colorClass: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
};

const DEPARTMENT_TREE: DepartmentDef[] = [
  {
    id: 'industrial',
    label: 'Industrial',
    colorClass: 'bg-orange-50 border-orange-200',
    subAreas: [
      {
        id: 'engenharia',
        label: 'Engenharia / PCP',
        module: 'ENGINEERING',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.relatorios, OP.configurar],
      },
      {
        id: 'producao',
        label: 'Produção',
        module: 'PRODUCTION',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.relatorios],
      },
      {
        id: 'qualidade',
        label: 'Qualidade',
        module: 'QUALITY',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.relatorios],
      },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    colorClass: 'bg-emerald-50 border-emerald-200',
    subAreas: [
      {
        id: 'crm',
        label: 'CRM / Relacionamento',
        module: 'CRM',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.relatorios],
      },
      {
        id: 'vendas',
        label: 'Orçamentos e Pedidos de Venda',
        module: 'SALES',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.aprovar, OP.relatorios, OP.configurar],
      },
      {
        id: 'fi',
        label: 'F&I (Financiamento / Seguro / Consórcio)',
        module: 'FI',
        operations: [OP.consultar, OP.lancar, OP.aprovar, OP.relatorios],
      },
    ],
  },
  {
    id: 'oficina',
    label: 'Oficina',
    colorClass: 'bg-cyan-50 border-cyan-200',
    subAreas: [
      {
        id: 'ordens_servico',
        label: 'Ordens de Serviço',
        module: 'SERVICE_ORDER',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.aprovar, OP.relatorios],
      },
      {
        id: 'calderaria',
        label: 'Calderaria / Produção Especial',
        module: 'CALDERARIA',
        operations: [OP.consultar, OP.lancar, OP.relatorios],
      },
      {
        id: 'requisicoes',
        label: 'Requisições Internas',
        module: 'REQUISITION',
        operations: [OP.consultar, OP.lancar, OP.aprovar, OP.relatorios],
      },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    colorClass: 'bg-amber-50 border-amber-200',
    subAreas: [
      {
        id: 'nfe_emissao',
        label: 'Emissão de NF-e / NFS-e',
        module: 'FISCAL',
        operations: [OP.consultar, OP.emitir, OP.cancelar, OP.relatorios],
      },
      {
        id: 'fiscal_config',
        label: 'Configuração Fiscal',
        module: 'FISCAL',
        restricted: true,
        operations: [OP.configurar],
      },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    colorClass: 'bg-blue-50 border-blue-200',
    subAreas: [
      {
        id: 'movimentacoes_fin',
        label: 'Movimentações Financeiras',
        module: 'FINANCIAL',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.aprovar, OP.relatorios],
      },
      {
        id: 'config_financeiro',
        label: 'Configuração Financeira',
        module: 'FINANCIAL',
        restricted: true,
        operations: [OP.configurar],
      },
    ],
  },
  {
    id: 'contabilidade',
    label: 'Contabilidade',
    colorClass: 'bg-indigo-50 border-indigo-200',
    subAreas: [
      {
        id: 'lancamentos_contabeis',
        label: 'Lançamentos Contábeis / DRE',
        module: 'ACCOUNTING',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.relatorios, OP.configurar],
      },
    ],
  },
  {
    id: 'rh',
    label: 'RH',
    colorClass: 'bg-violet-50 border-violet-200',
    subAreas: [
      {
        id: 'folha_rh',
        label: 'Folha de Pagamento / RH',
        module: 'HR',
        operations: [OP.consultar, OP.lancar, OP.aprovar, OP.relatorios, OP.configurar],
      },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    colorClass: 'bg-rose-50 border-rose-200',
    subAreas: [
      {
        id: 'processo_compras',
        label: 'Processo de Compras',
        module: 'PURCHASING',
        operations: [OP.consultar, OP.lancar, OP.aprovar, OP.relatorios, OP.configurar],
      },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    colorClass: 'bg-teal-50 border-teal-200',
    subAreas: [
      {
        id: 'controle_estoque',
        label: 'Controle de Estoque',
        module: 'INVENTORY',
        operations: [OP.consultar, OP.lancar, OP.excluir, OP.aprovar, OP.relatorios, OP.configurar],
      },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    colorClass: 'bg-slate-50 border-slate-200',
    subAreas: [
      {
        id: 'assistente_ia',
        label: 'Assistente IA',
        module: 'AI_ASSISTANT',
        operations: [OP.consultar, OP.configurar],
      },
      {
        id: 'configuracoes',
        label: 'Configurações do Sistema',
        module: 'SETTINGS',
        restricted: true,
        operations: [OP.consultar, OP.configurar],
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        module: 'DASHBOARD',
        operations: [OP.consultar],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Approval constants
// ---------------------------------------------------------------------------

const APPROVAL_MODULE_LABELS: Record<string, string> = {
  COMPRAS:    'Compras',
  VENDAS:     'Vendas',
  RH:         'RH',
  FINANCEIRO: 'Financeiro',
  ESTOQUE:    'Estoque',
};

const APPROVAL_DOC_TYPE_LABELS: Record<string, string> = {
  SOLICITACAO_COMPRA: 'Solicitação de Compra',
  COTACAO:            'Cotação',
  ORDEM_COMPRA:       'Ordem de Compra',
  PEDIDO_VENDA:       'Pedido de Venda',
  PAGAMENTO:          'Pagamento',
  FOLHA_PAGAMENTO:    'Folha de Pagamento',
  FERIAS:             'Férias',
  ADMISSAO:           'Admissão',
  DEMISSAO:           'Demissão',
  REQUISICAO:         'Requisição Interna',
  AJUSTE_ESTOQUE:     'Ajuste de Estoque',
};

const APPROVAL_TRIGGER_LABELS: Record<string, string> = {
  SEMPRE:           'Sempre exige aprovação',
  VALOR_ACIMA:      'Apenas quando valor acima de',
  PERCENTUAL_ACIMA: 'Apenas quando percentual acima de',
};

const APPROVAL_EXPIRED_LABELS: Record<string, string> = {
  ESCALAR:     'Escalar para próximo nível',
  REJEITAR:    'Rejeitar automaticamente',
  APROVAR_AUTO: 'Aprovar automaticamente',
};

const APPROVAL_MODULES = Object.keys(APPROVAL_MODULE_LABELS);
const APPROVAL_DOC_TYPES = Object.keys(APPROVAL_DOC_TYPE_LABELS);
const APPROVAL_TRIGGERS = Object.keys(APPROVAL_TRIGGER_LABELS);
const APPROVAL_EXPIRED_ACTIONS = Object.keys(APPROVAL_EXPIRED_LABELS);

const MODULE_COLOR_MAP: Record<string, string> = {
  COMPRAS:    'bg-amber-100 text-amber-700',
  VENDAS:     'bg-emerald-100 text-emerald-700',
  RH:         'bg-violet-100 text-violet-700',
  FINANCEIRO: 'bg-blue-100 text-blue-700',
  ESTOQUE:    'bg-rose-100 text-rose-700',
};

// Human-friendly labels for modules (used in role card summary)
const MODULE_DEPT_MAP: Record<string, string> = {
  ENGINEERING: 'Industrial', PRODUCTION: 'Industrial', QUALITY: 'Industrial', PCP: 'Industrial',
  CRM: 'Comercial', SALES: 'Comercial', FI: 'Comercial',
  SERVICE_ORDER: 'Oficina', CALDERARIA: 'Oficina', REQUISITION: 'Oficina',
  FISCAL: 'Fiscal', ACCOUNTING: 'Contabilidade',
  FINANCIAL: 'Financeiro', HR: 'RH', PURCHASING: 'Compras', INVENTORY: 'Estoque',
  AI_ASSISTANT: 'Sistema', SETTINGS: 'Sistema', DASHBOARD: 'Sistema',
};

const MODULE_LABEL_MAP: Record<string, string> = {
  ENGINEERING: 'Engenharia/PCP', PCP: 'PCP', PRODUCTION: 'Produção', QUALITY: 'Qualidade',
  CRM: 'CRM', SALES: 'Vendas', FI: 'F&I',
  SERVICE_ORDER: 'O.S.', CALDERARIA: 'Calderaria', REQUISITION: 'Requisições',
  FISCAL: 'Fiscal', ACCOUNTING: 'Contabilidade',
  FINANCIAL: 'Financeiro', HR: 'RH', PURCHASING: 'Compras', INVENTORY: 'Estoque',
  AI_ASSISTANT: 'IA', SETTINGS: 'Config.', DASHBOARD: 'Dashboard',
};

const ACTION_SHORT: Record<string, string> = {
  READ: 'Ver', CREATE: 'Criar', UPDATE: 'Editar', DELETE: 'Excluir',
  APPROVE: 'Aprovar', EXPORT: 'Export.', MANAGE: 'Gerenciar',
};

const DEPT_ICONS: Record<string, React.ElementType> = {
  industrial: Factory, comercial: BarChart3, oficina: Wrench, fiscal: FileText,
  financeiro: CreditCard, contabilidade: ClipboardList, rh: Users, compras: ShoppingCart,
  estoque: Package, sistema: Settings,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: Permission }[];
  _count: { users: number };
}

interface ApprovalLevel {
  id?: string;
  ordem: number;
  roleId: string;
  prazoHoras: number;
  acaoEsgotado: string;
  role?: { id: string; name: string };
}

interface ApprovalPolicy {
  id: string;
  module: string;
  documentType: string;
  enabled: boolean;
  triggerType: string;
  triggerValue: string | null;
  description: string | null;
  levels: ApprovalLevel[];
}

// ---------------------------------------------------------------------------
// Permission Tree helpers
// ---------------------------------------------------------------------------

function getPermIds(allPermissions: Permission[], module: string, actions: string[]): string[] {
  return allPermissions
    .filter((p) => p.module === module && actions.includes(p.action))
    .map((p) => p.id);
}

function getSubAreaPermIds(allPermissions: Permission[], subArea: SubAreaDef): string[] {
  const ids: string[] = [];
  subArea.operations.forEach((op) => {
    getPermIds(allPermissions, subArea.module, op.actions).forEach((id) => ids.push(id));
  });
  return [...new Set(ids)];
}

function getDeptPermIds(allPermissions: Permission[], dept: DepartmentDef): string[] {
  const ids: string[] = [];
  dept.subAreas.forEach((sa) => {
    getSubAreaPermIds(allPermissions, sa).forEach((id) => ids.push(id));
  });
  return [...new Set(ids)];
}

type CheckState = 'all' | 'some' | 'none';

function getCheckState(permIds: string[], selected: Set<string>): CheckState {
  if (permIds.length === 0) return 'none';
  const checked = permIds.filter((id) => selected.has(id));
  if (checked.length === permIds.length) return 'all';
  if (checked.length > 0) return 'some';
  return 'none';
}

// ---------------------------------------------------------------------------
// CascadeCheckbox — checkbox com 3 estados
// ---------------------------------------------------------------------------

function CascadeCheckbox({
  state,
  onClick,
  disabled,
  size = 'md',
}: {
  state: CheckState;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${dim} rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
        state === 'all'
          ? 'bg-blue-600 border-blue-600 text-white'
          : state === 'some'
          ? 'bg-blue-200 border-blue-400 text-blue-700'
          : 'border-slate-300 bg-white hover:border-blue-400'
      } ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
    >
      {state === 'all' && <Check className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
      {state === 'some' && <div className={size === 'sm' ? 'w-1.5 h-0.5 bg-blue-700 rounded' : 'w-2 h-0.5 bg-blue-700 rounded'} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PermissionTree — componente principal (substitui PermissionMatrix)
// ---------------------------------------------------------------------------

function PermissionTree({
  allPermissions,
  selected,
  onChange,
  readOnly,
}: {
  allPermissions: Permission[];
  selected: Set<string>;
  onChange: (ids: string[], checked: boolean) => void;
  readOnly: boolean;
}) {
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>(
    Object.fromEntries(DEPARTMENT_TREE.map((d) => [d.id, true]))
  );
  const [expandedSubAreas, setExpandedSubAreas] = useState<Record<string, boolean>>({});

  const toggleDept = (id: string) =>
    setExpandedDepts((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSubArea = (id: string) =>
    setExpandedSubAreas((prev) => ({ ...prev, [id]: !prev[id] }));

  // Memoize permId lookups per dept and sub-area
  const deptPermIds = useMemo(
    () => Object.fromEntries(DEPARTMENT_TREE.map((d) => [d.id, getDeptPermIds(allPermissions, d)])),
    [allPermissions]
  );

  const subAreaPermIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    DEPARTMENT_TREE.forEach((d) =>
      d.subAreas.forEach((sa) => { map[sa.id] = getSubAreaPermIds(allPermissions, sa); })
    );
    return map;
  }, [allPermissions]);

  const opPermIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    DEPARTMENT_TREE.forEach((d) =>
      d.subAreas.forEach((sa) =>
        sa.operations.forEach((op) => {
          const key = `${sa.id}__${op.id}`;
          map[key] = getPermIds(allPermissions, sa.module, op.actions);
        })
      )
    );
    return map;
  }, [allPermissions]);

  const handleDeptToggle = (dept: DepartmentDef) => {
    if (readOnly) return;
    const ids = deptPermIds[dept.id];
    const state = getCheckState(ids, selected);
    onChange(ids, state !== 'all');
  };

  const handleSubAreaToggle = (subArea: SubAreaDef) => {
    if (readOnly) return;
    const ids = subAreaPermIds[subArea.id];
    const state = getCheckState(ids, selected);
    onChange(ids, state !== 'all');
  };

  const handleOpToggle = (subAreaId: string, op: OperationDef) => {
    if (readOnly) return;
    const key = `${subAreaId}__${op.id}`;
    const ids = opPermIds[key];
    const state = getCheckState(ids, selected);
    onChange(ids, state !== 'all');
  };

  return (
    <div className="space-y-2">
      {DEPARTMENT_TREE.map((dept) => {
        const DeptIcon = DEPT_ICONS[dept.id] ?? Layers;
        const deptState = getCheckState(deptPermIds[dept.id], selected);
        const isExpanded = expandedDepts[dept.id];

        return (
          <div key={dept.id} className={`border rounded-xl overflow-hidden ${dept.colorClass}`}>
            {/* Departamento header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <CascadeCheckbox
                state={deptState}
                onClick={() => handleDeptToggle(dept)}
                disabled={readOnly}
              />
              <button
                type="button"
                onClick={() => toggleDept(dept.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <DeptIcon className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-sm font-bold text-slate-800">{dept.label}</span>
                <span className="text-xs text-slate-400 ml-1">
                  ({dept.subAreas.length} sub-{dept.subAreas.length === 1 ? 'área' : 'áreas'})
                </span>
                <span className="ml-auto">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </span>
              </button>
            </div>

            {/* Sub-áreas */}
            {isExpanded && (
              <div className="bg-white border-t border-slate-100 divide-y divide-slate-50">
                {dept.subAreas.map((subArea) => {
                  const saState = getCheckState(subAreaPermIds[subArea.id], selected);
                  const saExpanded = expandedSubAreas[subArea.id] !== false; // default expanded

                  return (
                    <div key={subArea.id} className="pl-8">
                      {/* Sub-área header */}
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <CascadeCheckbox
                          state={saState}
                          onClick={() => handleSubAreaToggle(subArea)}
                          disabled={readOnly}
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={() => toggleSubArea(subArea.id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <span className="text-sm font-medium text-slate-700">{subArea.label}</span>
                          {subArea.restricted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md border border-amber-200">
                              <AlertTriangle className="w-2.5 h-2.5" /> RESTRITO
                            </span>
                          )}
                          <span className="ml-auto">
                            {saExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                          </span>
                        </button>
                      </div>

                      {/* Operações */}
                      {saExpanded && (
                        <div className="pl-6 pr-4 pb-3 flex flex-wrap gap-2">
                          {subArea.operations.map((op) => {
                            const key = `${subArea.id}__${op.id}`;
                            const opIds = opPermIds[key];
                            const opState = getCheckState(opIds, selected);
                            const hasPerms = opIds.length > 0;

                            if (!hasPerms) return null;

                            return (
                              <button
                                key={op.id}
                                type="button"
                                onClick={() => handleOpToggle(subArea.id, op)}
                                disabled={readOnly || !hasPerms}
                                title={`${op.label} — ${op.actions.join(', ')}`}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                  opState === 'all'
                                    ? op.colorClass.replace('hover:', '') + ' ring-1 ring-inset ring-current/30'
                                    : opState === 'some'
                                    ? 'bg-slate-50 border-slate-200 text-slate-500 opacity-70'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                } ${readOnly || !hasPerms ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                                  opState === 'all'
                                    ? 'bg-current border-current text-white'
                                    : 'border-current/40'
                                }`}>
                                  {opState === 'all' && <Check className="w-2.5 h-2.5 text-white" />}
                                  {opState === 'some' && <div className="w-1.5 h-0.5 bg-current rounded" />}
                                </span>
                                {op.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Criar / Editar perfil
// ---------------------------------------------------------------------------

function RoleModal({
  role,
  allPermissions,
  onClose,
  onSaved,
}: {
  role: Role | null;
  allPermissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!role;
  const isSystem = role?.isSystem ?? false;

  const [name, setName] = useState(role?.name ?? '');
  const [desc, setDesc] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role?.permissions.map((rp) => rp.permission.id) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const toggleAll = (check: boolean) => {
    setSelected(check ? new Set(allPermissions.map((p) => p.id)) : new Set());
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Nome do perfil é obrigatório'); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/roles/${role!.id}` : '/api/roles';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || undefined,
          permissionIds: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao salvar perfil');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selected.size;
  const totalCount = allPermissions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isEdit ? `Editar Perfil: ${role!.name}` : 'Novo Perfil de Acesso'}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedCount} de {totalCount} permissões selecionadas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Nome + Descrição */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome do Perfil *
                {isSystem && <span className="ml-2 text-xs text-violet-600">(perfil de sistema)</span>}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                disabled={isSystem}
                className="input font-mono uppercase"
                placeholder="Ex: VENDEDOR_EXTERNO"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="input"
                placeholder="Descrição do perfil e suas responsabilidades"
              />
            </div>
          </div>

          {/* Legend + bulk actions */}
          <div className="flex items-center justify-between py-2 border-y border-slate-100">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-blue-500" /> Consultar = visualizar registros
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Lançar = incluir e alterar
              </span>
              <span className="hidden md:flex items-center gap-1">
                <Settings className="w-3.5 h-3.5 text-rose-500" /> Configurar = acesso total ao módulo
              </span>
            </div>
            {!isSystem && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAll(true)}
                  className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium transition-colors"
                >
                  Marcar tudo
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                >
                  Desmarcar tudo
                </button>
              </div>
            )}
          </div>

          {/* Árvore de permissões em cascata */}
          <PermissionTree
            allPermissions={allPermissions}
            selected={selected}
            onChange={handleChange}
            readOnly={isSystem}
          />

          {isSystem && (
            <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-violet-700 text-sm">
              <Lock className="w-4 h-4 shrink-0" />
              Perfis de sistema não podem ter permissões alteradas. Para ajustar o acesso, crie um perfil personalizado.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <span className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{selectedCount}</span> permissões selecionadas
          </span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors">
              {isSystem ? 'Fechar' : 'Cancelar'}
            </button>
            {!isSystem && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {isEdit ? 'Salvar Alterações' : 'Criar Perfil'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Criar / Editar regra de aprovação
// ---------------------------------------------------------------------------

function emptyLevel(ordem: number): ApprovalLevel {
  return { ordem, roleId: '', prazoHoras: 24, acaoEsgotado: 'ESCALAR' };
}

function ApprovalPolicyModal({
  policy,
  roles,
  onClose,
  onSaved,
}: {
  policy: ApprovalPolicy | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!policy;

  const [module, setModule] = useState(policy?.module ?? APPROVAL_MODULES[0]);
  const [documentType, setDocumentType] = useState(policy?.documentType ?? APPROVAL_DOC_TYPES[0]);
  const [enabled, setEnabled] = useState(policy?.enabled ?? true);
  const [triggerType, setTriggerType] = useState(policy?.triggerType ?? 'SEMPRE');
  const [triggerValue, setTriggerValue] = useState(policy?.triggerValue ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [levels, setLevels] = useState<ApprovalLevel[]>(
    policy?.levels && policy.levels.length > 0
      ? policy.levels.map((l) => ({ ...l }))
      : [emptyLevel(1)]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLevel = () => setLevels((prev) => [...prev, emptyLevel(prev.length + 1)]);

  const removeLevel = (idx: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, ordem: i + 1 })));
  };

  const updateLevel = (idx: number, field: keyof ApprovalLevel, value: string | number) => {
    setLevels((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const handleSubmit = async () => {
    setError('');
    if (levels.some((l) => !l.roleId)) { setError('Selecione um perfil para cada nível'); return; }
    if ((triggerType === 'VALOR_ACIMA' || triggerType === 'PERCENTUAL_ACIMA') && !triggerValue) {
      setError('Informe o valor do gatilho'); return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/approvals/config', {
        method: 'POST',
        body: JSON.stringify({
          module, documentType, enabled, triggerType,
          triggerValue: triggerValue ? Number(triggerValue) : undefined,
          description: description.trim() || undefined,
          levels: levels.map((l) => ({
            ordem: l.ordem, roleId: l.roleId, prazoHoras: l.prazoHoras, acaoEsgotado: l.acaoEsgotado,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao salvar');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {isEdit ? 'Editar Regra de Aprovação' : 'Nova Regra de Aprovação'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Módulo *</label>
              <select value={module} onChange={(e) => setModule(e.target.value)} className="input">
                {APPROVAL_MODULES.map((m) => (
                  <option key={m} value={m}>{APPROVAL_MODULE_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento *</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="input">
                {APPROVAL_DOC_TYPES.map((d) => (
                  <option key={d} value={d}>{APPROVAL_DOC_TYPE_LABELS[d]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Regra habilitada</label>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="Ex: Aprovação obrigatória para compras acima de R$ 5.000"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Gatilho de ativação</label>
            <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="input">
              {APPROVAL_TRIGGERS.map((t) => (
                <option key={t} value={t}>{APPROVAL_TRIGGER_LABELS[t]}</option>
              ))}
            </select>
            {(triggerType === 'VALOR_ACIMA' || triggerType === 'PERCENTUAL_ACIMA') && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  className="input w-48"
                  placeholder={triggerType === 'VALOR_ACIMA' ? 'Valor em R$' : 'Percentual (%)'}
                  min="0"
                  step="0.01"
                />
                <span className="text-sm text-slate-500">
                  {triggerType === 'VALOR_ACIMA' ? 'R$' : '%'}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Níveis de Aprovação ({levels.length})
              </label>
              <button
                type="button"
                onClick={addLevel}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Nível
              </button>
            </div>

            <div className="space-y-2">
              {levels.map((level, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white text-xs font-bold rounded-full shrink-0">
                    {level.ordem}
                  </span>
                  <select
                    value={level.roleId}
                    onChange={(e) => updateLevel(idx, 'roleId', e.target.value)}
                    className="input flex-1 text-sm"
                  >
                    <option value="">Selecionar perfil...</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={level.prazoHoras}
                      onChange={(e) => updateLevel(idx, 'prazoHoras', Number(e.target.value))}
                      className="input w-16 text-sm text-center"
                      min="1"
                      title="Prazo em horas"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">h</span>
                  </div>
                  <select
                    value={level.acaoEsgotado}
                    onChange={(e) => updateLevel(idx, 'acaoEsgotado', e.target.value)}
                    className="input text-sm"
                    title="Ação ao esgotar prazo"
                  >
                    {APPROVAL_EXPIRED_ACTIONS.map((a) => (
                      <option key={a} value={a}>{APPROVAL_EXPIRED_LABELS[a]}</option>
                    ))}
                  </select>
                  {levels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLevel(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Cada nível representa um perfil que precisa aprovar. A aprovação segue a sequência numérica.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
            {isEdit ? 'Salvar Alterações' : 'Criar Regra'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Regras de Aprovação
// ---------------------------------------------------------------------------

function ApprovalRulesTab({ roles }: { roles: Role[] }) {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNew, setModalNew] = useState(false);
  const [modalEdit, setModalEdit] = useState<ApprovalPolicy | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/approvals/config');
      const data = await res.json();
      setPolicies(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (policy: ApprovalPolicy) => {
    if (!confirm(`Excluir a regra de aprovação para "${APPROVAL_DOC_TYPE_LABELS[policy.documentType] ?? policy.documentType}"?`)) return;
    setDeleting(policy.id);
    try {
      const res = await apiFetch(`/api/approvals/config/${policy.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao excluir');
      }
      showToast('success', 'Regra excluída com sucesso');
      load();
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      {modalNew && (
        <ApprovalPolicyModal
          policy={null}
          roles={roles}
          onClose={() => setModalNew(false)}
          onSaved={() => { load(); showToast('success', 'Regra criada com sucesso'); }}
        />
      )}
      {modalEdit && (
        <ApprovalPolicyModal
          policy={modalEdit}
          roles={roles}
          onClose={() => setModalEdit(null)}
          onSaved={() => { load(); showToast('success', 'Regra atualizada com sucesso'); }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Configure quais documentos exigem aprovação e os perfis responsáveis por cada etapa.
        </p>
        <button
          onClick={() => setModalNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Regra
        </button>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-1">
        <p className="font-semibold">Como funciona o fluxo de aprovação:</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-700">
          <li>Cada regra define um módulo e tipo de documento que requer aprovação</li>
          <li>O gatilho determina <strong>quando</strong> a aprovação é acionada (sempre, ou por valor)</li>
          <li>Os níveis definem a <strong>sequência hierárquica</strong> de aprovadores</li>
          <li>O prazo define quantas horas o aprovador tem para agir antes da ação automática</li>
        </ul>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {policies.map((policy) => (
            <div key={policy.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-100">
                      <GitBranch className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${MODULE_COLOR_MAP[policy.module] ?? 'bg-slate-100 text-slate-600'}`}>
                          {APPROVAL_MODULE_LABELS[policy.module] ?? policy.module}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {APPROVAL_DOC_TYPE_LABELS[policy.documentType] ?? policy.documentType}
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${policy.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {policy.enabled
                            ? <><ToggleRight className="w-3.5 h-3.5" /> Ativa</>
                            : <><ToggleLeft className="w-3.5 h-3.5" /> Inativa</>}
                        </span>
                      </div>
                      {policy.description && (
                        <p className="text-xs text-slate-500 mt-1">{policy.description}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                        <span>
                          <strong>Gatilho:</strong>{' '}
                          {APPROVAL_TRIGGER_LABELS[policy.triggerType] ?? policy.triggerType}
                          {policy.triggerValue ? ` ${Number(policy.triggerValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span><strong>{policy.levels.length}</strong> nível{policy.levels.length !== 1 ? 'is' : ''}</span>
                      </div>
                      {policy.levels.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {policy.levels.map((level, idx) => (
                            <span key={level.id ?? idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                              <span className="w-4 h-4 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full">{level.ordem}</span>
                              <span className="font-medium">{level.role?.name ?? level.roleId}</span>
                              <span className="text-slate-400">{level.prazoHoras}h</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setModalEdit(policy)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(policy)}
                      disabled={deleting === policy.id}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting === policy.id
                        ? <div className="animate-spin w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {policies.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
              <GitBranch className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma regra de aprovação cadastrada</p>
              <p className="text-xs mt-1">Clique em &quot;+ Nova Regra&quot; para criar a primeira</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type Tab = 'perfis' | 'aprovacoes';

export default function PerfisPage() {
  const [activeTab, setActiveTab] = useState<Tab>('perfis');
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNew, setModalNew] = useState(false);
  const [modalEdit, setModalEdit] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch('/api/roles'),
        apiFetch('/api/roles/permissions'),
      ]);
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setAllPermissions(Array.isArray(permsData) ? permsData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Excluir o perfil "${role.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(role.id);
    try {
      const res = await apiFetch(`/api/roles/${role.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao excluir');
      }
      showToast('success', `Perfil "${role.name}" excluído`);
      load();
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  const totalCount = allPermissions.length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Modais */}
      {modalNew && (
        <RoleModal
          role={null}
          allPermissions={allPermissions}
          onClose={() => setModalNew(false)}
          onSaved={() => { load(); showToast('success', 'Perfil criado com sucesso'); }}
        />
      )}
      {modalEdit && (
        <RoleModal
          role={modalEdit}
          allPermissions={allPermissions}
          onClose={() => setModalEdit(null)}
          onSaved={() => { load(); showToast('success', 'Perfil atualizado com sucesso'); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Perfis e Aprovações</h1>
          <p className="text-slate-500 mt-1">Gerencie perfis de acesso e regras de aprovação do sistema</p>
        </div>
        {activeTab === 'perfis' && (
          <button
            onClick={() => setModalNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Perfil
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('perfis')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'perfis' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Perfis de Acesso
          </span>
        </button>
        <button
          onClick={() => setActiveTab('aprovacoes')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'aprovacoes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Regras de Aprovação
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'aprovacoes' ? (
        <ApprovalRulesTab roles={roles} />
      ) : (
        <>
          {/* Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <p className="font-semibold mb-1">Hierarquia de permissões em 3 níveis:</p>
            <div className="flex items-start gap-6 text-blue-700">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 shrink-0" />
                <span><strong>Departamento</strong> → marcar seleciona todas as sub-áreas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 shrink-0" />
                <span><strong>Sub-área</strong> → marcar seleciona todas as operações</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 shrink-0" />
                <span><strong>Operação</strong> → controle individual (Consultar / Lançar / Aprovar...)</span>
              </div>
            </div>
          </div>

          {/* Lista de perfis */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {roles.map((role) => {
                const permCount = role.permissions.length;
                const pct = totalCount > 0 ? Math.round((permCount / totalCount) * 100) : 0;

                // Agrupar por departamento para o resumo
                const deptSummary: Record<string, Set<string>> = {};
                role.permissions.forEach(({ permission: p }) => {
                  const dept = MODULE_DEPT_MAP[p.module] ?? p.module;
                  if (!deptSummary[dept]) deptSummary[dept] = new Set();
                  deptSummary[dept].add(ACTION_SHORT[p.action] ?? p.action);
                });

                return (
                  <div key={role.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            role.isSystem ? 'bg-violet-100' : 'bg-blue-100'
                          }`}>
                            {role.isSystem
                              ? <Lock className="w-5 h-5 text-violet-600" />
                              : <Shield className="w-5 h-5 text-blue-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 font-mono">{role.name}</h3>
                              {role.isSystem && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-600 rounded-full uppercase">Sistema</span>
                              )}
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Users className="w-3 h-3" />
                                {role._count.users} usuário{role._count.users !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {role.description && (
                              <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>
                            )}

                            {/* Barra de progresso */}
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-400'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                {permCount}/{totalCount} ({fmtPercent(pct, 0)})
                              </span>
                            </div>

                            {/* Resumo por departamento */}
                            {Object.keys(deptSummary).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {Object.entries(deptSummary).map(([dept, actions]) => (
                                  <span key={dept} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                                    <span className="font-semibold">{dept}</span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-500">{Array.from(actions).join(', ')}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setModalEdit(role)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {role.isSystem ? 'Ver' : 'Editar'}
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDelete(role)}
                              disabled={deleting === role.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deleting === role.id
                                ? <div className="animate-spin w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {roles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
                  <Shield className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum perfil cadastrado</p>
                  <p className="text-xs mt-1">Clique em &quot;+ Novo Perfil&quot; para criar o primeiro</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
