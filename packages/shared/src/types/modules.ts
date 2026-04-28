// Mapeamento de módulos do ERP para navegação e permissões
export const ERP_MODULES = {
  // Sprint 4.1 — Dashboards Operacionais
  DASHBOARDS: {
    label: 'Dashboards',
    icon: 'BarChart3',
    children: {
      DASHBOARDS_HUB:         { label: 'Visão Geral',       path: '/dashboards',                    icon: 'LayoutDashboard' },
      DASH_CHAO_FABRICA:      { label: 'Chão de Fábrica',   path: '/dashboards/chao-fabrica',       icon: 'Factory'         },
      DASH_COMERCIAL:         { label: 'Comercial',         path: '/dashboards/comercial',          icon: 'ShoppingCart'    },
      DASH_FINANCEIRO:        { label: 'Financeiro',        path: '/dashboards/financeiro',         icon: 'TrendingUp'      },
      DASH_COMPRAS_ESTOQUE:   { label: 'Compras/Estoque',   path: '/dashboards/compras-estoque',    icon: 'Package'         },
    },
  },

  // Domínio Industrial
  INDUSTRIAL: {
    label: 'Industrial',
    icon: 'Factory',
    children: {
      ENGINEERING: { label: 'Engenharia', path: '/engenharia', icon: 'Cog' },
      BOM_IMPORT: { label: 'Importar BOM', path: '/engenharia/importar-bom', icon: 'FileSpreadsheet' },
      PCP: { label: 'PCP', path: '/pcp', icon: 'CalendarClock' },
      MRP: { label: 'MRP', path: '/pcp/mrp', icon: 'ListChecks' },
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
      SERVICE_ORDER:    { label: 'Ordens de Serviço',    path: '/oficina/ordens-servico',      icon: 'ClipboardList' },
      AO_VIVO:          { label: 'Painel Ao Vivo',       path: '/oficina/ao-vivo',             icon: 'Activity'      },
      EQUIPAMENTOS:     { label: 'Equipamentos',         path: '/oficina/equipamentos',        icon: 'Truck'         },
      TAREFAS_CATALOGO: { label: 'Catálogo de Tarefas',  path: '/oficina/tarefas-catalogo',    icon: 'ClipboardList' },
      FROTA:            { label: 'Gestão de Frota',      path: '/oficina/frota',               icon: 'Car'           },
      EFICIENCIA:       { label: 'Eficiência Mecânicos', path: '/oficina/relatorios/eficiencia-mecanicos', icon: 'TrendingUp' },
      CALDERARIA:       { label: 'Calderaria',           path: '/calderaria',                  icon: 'Flame'         },
      REQUISITION:      { label: 'Requisições',          path: '/requisicoes',                 icon: 'ArrowRightLeft'},
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
      ADIANTAMENTOS: { label: 'Adiantamentos', path: '/financeiro/adiantamentos', icon: 'Wallet' },
      HR: { label: 'RH / Folha', path: '/rh', icon: 'UserCog' },
      JORNADA: { label: 'Jornada de Trabalho', path: '/rh/jornada', icon: 'Clock' },
      PURCHASING: { label: 'Compras', path: '/compras', icon: 'PackageSearch' },
      PURCHASE_REQUESTS: { label: 'Solicitações de Compra', path: '/compras/solicitacoes', icon: 'FileSearch' },
      QUOTATIONS: { label: 'Cotações', path: '/compras/cotacoes', icon: 'FileBarChart' },
      PURCHASE_ORDERS: { label: 'Ordens de Compra', path: '/compras/pedidos', icon: 'ClipboardList' },
      CTE: { label: 'CT-e Recebidos', path: '/compras/cte', icon: 'Truck' },
      NFE_ENTRADA: { label: 'NF-e Entrada', path: '/compras/nfe-entrada', icon: 'FileInput' },
      NFSE_RECEBIDAS: { label: 'NFS-e Recebidas', path: '/compras/nfse', icon: 'FileInput' },
      CATALOGO_FORNECEDORES: { label: 'Catálogo de Fornecedores', path: '/compras/catalogo-fornecedores', icon: 'BookMarked' },
      INVENTORY: { label: 'Estoque', path: '/estoque', icon: 'Warehouse' },
      PRODUCT_GROUPS: { label: 'Grupos e Subgrupos', path: '/estoque/grupos', icon: 'Layers' },
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
      IA_FISCAL: { label: 'IA Fiscal', path: '/fiscal/ia', icon: 'Brain' },
      IA_FISCAL_CHAT: { label: 'Chat FiscalBrain', path: '/fiscal/ia/chat', icon: 'MessageSquare' },
      IA_FISCAL_EXCECOES: { label: 'Exceções IA', path: '/fiscal/ia/excecoes', icon: 'AlertTriangle' },
      CONFIGURACAO_FISCAL: { label: 'Configuração Fiscal', path: '/fiscal/configuracao', icon: 'Scale' },
      NFE: { label: 'NF-e', path: '/fiscal/notas', icon: 'FileText' },
      NFSE_EMITIDAS: { label: 'NFS-e Emitidas', path: '/fiscal/nfse', icon: 'FileText' },
      APURACAO: { label: 'Apuração ICMS', path: '/fiscal/apuracao', icon: 'Calculator' },
      APURACAO_PIS_COFINS: { label: 'Apuração PIS/COFINS', path: '/fiscal/apuracao-pis-cofins', icon: 'TrendingDown' },
      CALENDARIO: { label: 'Calendário Fiscal', path: '/fiscal/calendario', icon: 'CalendarCheck' },
      NCM: { label: 'NCM', path: '/fiscal/indices/ncm', icon: 'Tag' },
      BANCOS: { label: 'Bancos', path: '/fiscal/indices/bancos', icon: 'Landmark' },
      PAISES: { label: 'Países', path: '/fiscal/indices/paises', icon: 'Globe' },
      ST_PROTOCOLO: { label: 'Protocolos ST/MVA', path: '/fiscal/indices/st-protocolo', icon: 'FileText' },
      AUDITORIA_NCM: { label: 'Auditoria NCM', path: '/fiscal/auditoria-ncm', icon: 'ShieldAlert' },
      OPERACOES_FISCAIS: { label: 'Operações Fiscais (TES)', path: '/fiscal/operacoes-fiscais', icon: 'ListChecks' },
      SPED: { label: 'SPED / EFD', path: '/fiscal/sped', icon: 'FileSpreadsheet' },
    },
  },

  // Patrimônio / Ativo Imobilizado
  PATRIMONIO: {
    label: 'Patrimônio',
    icon: 'Building2',
    children: {
      PATRIMONIO_DASHBOARD: { label: 'Dashboard', path: '/patrimonio', icon: 'BarChart3' },
      PATRIMONIO_ATIVOS: { label: 'Ativos', path: '/patrimonio/ativos', icon: 'Layers' },
      PATRIMONIO_RELATORIO: { label: 'Rel. Depreciação', path: '/patrimonio/relatorio', icon: 'TrendingDown' },
      PATRIMONIO_MANUTENCOES_EXTERNAS: { label: 'Manutenções Externas', path: '/patrimonio/manutencoes-externas', icon: 'Wrench' },
    },
  },

  // A14 — Obrigações Acessórias Digitais (eSocial, REINF, DCTF-Web)
  OBRIGACOES: {
    label: 'Obrigações Digitais',
    icon: 'Send',
    children: {
      ESOCIAL: { label: 'eSocial', path: '/rh/esocial', icon: 'Users' },
      REINF: { label: 'EFD-REINF', path: '/fiscal/reinf', icon: 'FileCheck' },
      DCTFWEB: { label: 'DCTF-Web', path: '/fiscal/dctfweb', icon: 'Receipt' },
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
