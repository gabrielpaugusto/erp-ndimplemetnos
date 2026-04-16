// Mapeamento de módulos do ERP para navegação e permissões
export const ERP_MODULES = {
  // Domínio Industrial
  INDUSTRIAL: {
    label: 'Industrial',
    icon: 'Factory',
    children: {
      ENGINEERING: { label: 'Engenharia', path: '/engenharia', icon: 'Cog' },
      PCP: { label: 'PCP', path: '/pcp', icon: 'CalendarClock' },
      PRODUCTION: { label: 'Produção', path: '/producao', icon: 'Hammer' },
    },
  },

  // Apontamentos Produtivos
  APONTAMENTOS: {
    label: 'Apontamentos',
    icon: 'Timer',
    children: {
      MEU_APONTAMENTO: { label: 'Meu Apontamento', path: '/apontamentos', icon: 'Play' },
      SINALEIRA: { label: 'Sinaleira ao Vivo', path: '/apontamentos/sinaleira', icon: 'Activity' },
      PRODUTIVIDADE: { label: 'Produtividade', path: '/apontamentos/produtividade', icon: 'TrendingUp' },
    },
  },

  // Domínio Comercial
  COMERCIAL: {
    label: 'Comercial',
    icon: 'Handshake',
    children: {
      CRM: { label: 'CRM', path: '/crm/pessoas', icon: 'Users' },
      PIPELINE: { label: 'Pipeline', path: '/crm/pipeline', icon: 'GitBranch' },
      SALES: { label: 'Orçamentos', path: '/comercial/orcamentos', icon: 'FileText' },
      ORDERS: { label: 'Pedidos', path: '/comercial/pedidos', icon: 'ShoppingCart' },
    },
  },

  // F&I
  FI: {
    label: 'F&I',
    icon: 'Landmark',
    children: {
      FINANCING: { label: 'Financiamento', path: '/fi/financiamento', icon: 'CreditCard' },
      CONSORTIUM: { label: 'Consórcio', path: '/fi/consorcio', icon: 'UsersRound' },
      INSURANCE: { label: 'Seguro', path: '/fi/seguro', icon: 'Shield' },
    },
  },

  // Domínio Oficina
  OFICINA: {
    label: 'Oficina',
    icon: 'Wrench',
    children: {
      SERVICE_ORDER: { label: 'Ordens de Serviço', path: '/oficina/ordens-servico', icon: 'ClipboardList' },
      CALDERARIA: { label: 'Calderaria', path: '/calderaria', icon: 'Flame' },
      REQUISITION: { label: 'Requisições', path: '/requisicoes', icon: 'ArrowRightLeft' },
    },
  },

  // Domínio Corporativo
  CORPORATIVO: {
    label: 'Corporativo',
    icon: 'Building2',
    children: {
      ACCOUNTING: { label: 'Contabilidade', path: '/contabilidade', icon: 'BookOpen' },
      DRE: { label: 'DRE', path: '/contabilidade/dre', icon: 'BarChart3' },
      FINANCIAL: { label: 'Financeiro', path: '/financeiro', icon: 'DollarSign' },
      HR: { label: 'RH / Folha', path: '/rh', icon: 'UserCog' },
      JORNADA: { label: 'Jornada de Trabalho', path: '/rh/jornada', icon: 'Clock' },
      PURCHASING: { label: 'Compras', path: '/compras', icon: 'PackageSearch' },
      CTE: { label: 'CT-e Recebidos', path: '/compras/cte', icon: 'Truck' },
      NFE_ENTRADA: { label: 'NF-e Entrada', path: '/compras/nfe-entrada', icon: 'FileInput' },
      INVENTORY: { label: 'Estoque', path: '/estoque', icon: 'Warehouse' },
      PRODUCTS: { label: 'Produtos', path: '/estoque/produtos', icon: 'Package' },
      STOCK_MOVES: { label: 'Movimentações', path: '/estoque/movimentacoes', icon: 'ArrowUpDown' },
    },
  },

  // Módulo Fiscal (top-level)
  FISCAL_MODULE: {
    label: 'Fiscal',
    icon: 'Scale',
    children: {
      FISCAL_DASHBOARD: { label: 'Dashboard Fiscal', path: '/fiscal', icon: 'Receipt' },
      NFE: { label: 'NF-e', path: '/fiscal/notas', icon: 'FileText' },
      APURACAO: { label: 'Apuração ICMS', path: '/fiscal/apuracao', icon: 'Calculator' },
      APURACAO_PIS_COFINS: { label: 'Apuração PIS/COFINS', path: '/fiscal/apuracao-pis-cofins', icon: 'TrendingDown' },
      MAPA_CFOP: { label: 'Mapa CFOP', path: '/fiscal/mapa-cfop', icon: 'BarChart3' },
      CALENDARIO: { label: 'Calendário Fiscal', path: '/fiscal/calendario', icon: 'CalendarCheck' },
      REGRAS: { label: 'Regras Tributárias', path: '/fiscal/regras', icon: 'BookOpenCheck' },
      SIMULADOR: { label: 'Simulador Fiscal', path: '/fiscal/regras/simulador', icon: 'Zap' },
      NCM: { label: 'NCM', path: '/fiscal/indices/ncm', icon: 'Tag' },
      CFOP: { label: 'CFOP', path: '/fiscal/indices/cfop', icon: 'ArrowLeftRight' },
      CST_REF: { label: 'Tabela CST/CSOSN', path: '/fiscal/indices/cst-referencia', icon: 'ShieldCheck' },
      ICMS_INTERESTADUAL: { label: 'ICMS Interestadual', path: '/fiscal/indices/icms-interestadual', icon: 'Map' },
      BANCOS: { label: 'Bancos', path: '/fiscal/indices/bancos', icon: 'Landmark' },
      PAISES: { label: 'Países', path: '/fiscal/indices/paises', icon: 'Globe' },
    },
  },

  // Chamados
  SUPORTE: {
    label: 'Suporte',
    icon: 'Headphones',
    children: {
      TICKETS: { label: 'Chamados', path: '/chamados', icon: 'MessageSquare' },
    },
  },
} as const;

export type ModuleGroup = keyof typeof ERP_MODULES;
