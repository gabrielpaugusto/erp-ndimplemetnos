// Guard: NEVER run seed in production
if (process.env.NODE_ENV === 'production') {
  console.error('');
  console.error('╔═══════════════════════════════════════════════╗');
  console.error('║  ERRO: Seed NÃO pode ser executado em        ║');
  console.error('║  ambiente de PRODUÇÃO!                        ║');
  console.error('║                                               ║');
  console.error('║  O seed insere dados fictícios que podem      ║');
  console.error('║  corromper dados reais do sistema.             ║');
  console.error('╚═══════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
// Reference table seed data (fiscal)
const CST_ICMS_DATA = [
  { code: '00', description: 'Tributada integralmente', categoria: 'TRIBUTADO' },
  { code: '10', description: 'Tributada e com cobrança do ICMS por substituição tributária', categoria: 'TRIBUTADO_ST' },
  { code: '20', description: 'Com redução de base de cálculo', categoria: 'TRIBUTADO_REDUCAO' },
  { code: '30', description: 'Isenta ou não tributada e com cobrança do ICMS por ST', categoria: 'ISENTO_ST' },
  { code: '40', description: 'Isenta', categoria: 'ISENTO' },
  { code: '41', description: 'Não tributada', categoria: 'NAO_TRIBUTADO' },
  { code: '50', description: 'Suspensão', categoria: 'SUSPENSAO' },
  { code: '51', description: 'Diferimento', categoria: 'DIFERIMENTO' },
  { code: '60', description: 'ICMS cobrado anteriormente por substituição tributária', categoria: 'ST_RECOLHIDO' },
  { code: '70', description: 'Com redução de base de cálculo e cobrança do ICMS por ST', categoria: 'REDUCAO_ST' },
  { code: '90', description: 'Outros', categoria: 'OUTROS' },
];

const CSOSN_DATA = [
  { code: '101', description: 'Tributada pelo Simples Nacional com permissão de crédito' },
  { code: '102', description: 'Tributada pelo Simples Nacional sem permissão de crédito' },
  { code: '103', description: 'Isenção do ICMS no Simples Nacional para faixa de receita bruta' },
  { code: '201', description: 'Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por ST' },
  { code: '202', description: 'Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por ST' },
  { code: '203', description: 'Isenção do ICMS no SN para faixa de receita bruta e com cobrança do ICMS por ST' },
  { code: '300', description: 'Imune' },
  { code: '400', description: 'Não tributada pelo Simples Nacional' },
  { code: '500', description: 'ICMS cobrado anteriormente por ST ou por antecipação' },
  { code: '900', description: 'Outros' },
];

const CST_IPI_DATA = [
  { code: '00', description: 'Entrada com recuperação de crédito', tipo: 'ENTRADA' },
  { code: '01', description: 'Entrada tributada com alíquota zero', tipo: 'ENTRADA' },
  { code: '02', description: 'Entrada isenta', tipo: 'ENTRADA' },
  { code: '03', description: 'Entrada não tributada', tipo: 'ENTRADA' },
  { code: '04', description: 'Entrada imune', tipo: 'ENTRADA' },
  { code: '05', description: 'Entrada com suspensão', tipo: 'ENTRADA' },
  { code: '49', description: 'Outras entradas', tipo: 'ENTRADA' },
  { code: '50', description: 'Saída tributada', tipo: 'SAIDA' },
  { code: '51', description: 'Saída tributável com alíquota zero', tipo: 'SAIDA' },
  { code: '52', description: 'Saída isenta', tipo: 'SAIDA' },
  { code: '53', description: 'Saída não tributada', tipo: 'SAIDA' },
  { code: '54', description: 'Saída imune', tipo: 'SAIDA' },
  { code: '55', description: 'Saída com suspensão', tipo: 'SAIDA' },
  { code: '99', description: 'Outras saídas', tipo: 'SAIDA' },
];

const CST_PIS_COFINS_DATA = [
  { code: '01', description: 'Op. tributável - BC = valor da operação, alíquota normal', tipo: 'SAIDA', regime: 'NAO_CUMULATIVO' },
  { code: '02', description: 'Op. tributável - BC = valor da operação, alíquota diferenciada', tipo: 'SAIDA', regime: 'NAO_CUMULATIVO' },
  { code: '03', description: 'Op. tributável - BC = quantidade vendida x alíquota por unidade', tipo: 'SAIDA', regime: 'NAO_CUMULATIVO' },
  { code: '04', description: 'Operação tributável - tributação monofásica (alíquota zero)', tipo: 'SAIDA', regime: 'AMBOS' },
  { code: '05', description: 'Operação tributável por substituição tributária', tipo: 'SAIDA', regime: 'NAO_CUMULATIVO' },
  { code: '06', description: 'Operação tributável a alíquota zero', tipo: 'SAIDA', regime: 'NAO_CUMULATIVO' },
  { code: '07', description: 'Operação isenta da contribuição', tipo: 'SAIDA', regime: 'AMBOS' },
  { code: '08', description: 'Operação sem incidência da contribuição', tipo: 'SAIDA', regime: 'AMBOS' },
  { code: '09', description: 'Operação com suspensão da contribuição', tipo: 'SAIDA', regime: 'AMBOS' },
  { code: '49', description: 'Outras saídas', tipo: 'SAIDA', regime: 'AMBOS' },
  { code: '50', description: 'Op. com direito a crédito - vinculada a receitas tributadas', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '51', description: 'Op. com direito a crédito - vinculada a receitas não-tributadas', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '52', description: 'Op. com direito a crédito - vinculada a receitas de exportação', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '53', description: 'Op. com direito a crédito - vinculada a rec. tributadas e não-tributadas', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '54', description: 'Op. com direito a crédito - vinculada a rec. tributadas e de exportação', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '55', description: 'Op. com direito a crédito - vinculada a rec. não-tributadas e de exportação', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '56', description: 'Op. com direito a crédito - vinculada a rec. tributadas, não-tributadas e exportação', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '60', description: 'Crédito presumido - op. de aquisição vinculada a receitas tributadas', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '70', description: 'Operação de aquisição sem direito a crédito', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '71', description: 'Operação de aquisição com isenção', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '72', description: 'Operação de aquisição com suspensão', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '73', description: 'Operação de aquisição a alíquota zero', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '74', description: 'Operação de aquisição sem incidência', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '75', description: 'Operação de aquisição por substituição tributária', tipo: 'ENTRADA', regime: 'NAO_CUMULATIVO' },
  { code: '98', description: 'Outras operações de entrada', tipo: 'ENTRADA', regime: 'AMBOS' },
  { code: '99', description: 'Outras operações', tipo: 'AMBOS', regime: 'AMBOS' },
];

const BANCOS_DATA = [
  { code: '001', ispb: '00000000', name: 'BANCO DO BRASIL S.A.', shortName: 'BB', tipo: 'BANCO_MULTIPLO' },
  { code: '033', ispb: '90400888', name: 'BANCO SANTANDER (BRASIL) S.A.', shortName: 'SANTANDER', tipo: 'BANCO_MULTIPLO' },
  { code: '041', ispb: '92702067', name: 'BANCO DO ESTADO DO RIO GRANDE DO SUL S.A.', shortName: 'BANRISUL', tipo: 'BANCO_MULTIPLO' },
  { code: '070', ispb: '00000208', name: 'BRB - BANCO DE BRASILIA S.A.', shortName: 'BRB', tipo: 'BANCO_MULTIPLO' },
  { code: '077', ispb: '00416968', name: 'BANCO INTER S.A.', shortName: 'INTER', tipo: 'BANCO_MULTIPLO' },
  { code: '104', ispb: '00360305', name: 'CAIXA ECONOMICA FEDERAL', shortName: 'CEF', tipo: 'CAIXA_ECONOMICA' },
  { code: '212', ispb: '92894922', name: 'BANCO ORIGINAL S.A.', shortName: 'ORIGINAL', tipo: 'BANCO_MULTIPLO' },
  { code: '237', ispb: '60746948', name: 'BANCO BRADESCO S.A.', shortName: 'BRADESCO', tipo: 'BANCO_MULTIPLO' },
  { code: '260', ispb: '18236120', name: 'NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO', shortName: 'NUBANK', tipo: 'INSTITUICAO_PAGAMENTO' },
  { code: '336', ispb: '92702067', name: 'BANCO C6 S.A.', shortName: 'C6', tipo: 'BANCO_MULTIPLO' },
  { code: '341', ispb: '60701190', name: 'ITAÚ UNIBANCO S.A.', shortName: 'ITAU', tipo: 'BANCO_MULTIPLO' },
  { code: '380', ispb: '09516419', name: 'PICPAY SERVICOS S.A.', shortName: 'PICPAY', tipo: 'INSTITUICAO_PAGAMENTO' },
  { code: '422', ispb: '58160789', name: 'BANCO SAFRA S.A.', shortName: 'SAFRA', tipo: 'BANCO_MULTIPLO' },
  { code: '748', ispb: '01181521', name: 'BANCO COOPERATIVO SICREDI S.A.', shortName: 'SICREDI', tipo: 'BANCO_COOPERATIVO' },
  { code: '756', ispb: '02038232', name: 'BANCO COOPERATIVO DO BRASIL S.A. - BANCOOB', shortName: 'SICOOB', tipo: 'BANCO_COOPERATIVO' },
];

const PAISES_DATA = [
  { code: '1058', iso2: 'BR', iso3: 'BRA', name: 'BRASIL', nameEn: 'BRAZIL' },
  { code: '0158', iso2: 'DE', iso3: 'DEU', name: 'ALEMANHA', nameEn: 'GERMANY' },
  { code: '0175', iso2: 'AR', iso3: 'ARG', name: 'ARGENTINA', nameEn: 'ARGENTINA' },
  { code: '0351', iso2: 'CN', iso3: 'CHN', name: 'CHINA', nameEn: 'CHINA' },
  { code: '0531', iso2: 'ES', iso3: 'ESP', name: 'ESPANHA', nameEn: 'SPAIN' },
  { code: '0558', iso2: 'US', iso3: 'USA', name: 'ESTADOS UNIDOS DA AMERICA', nameEn: 'UNITED STATES' },
  { code: '0586', iso2: 'FR', iso3: 'FRA', name: 'FRANCA', nameEn: 'FRANCE' },
  { code: '0643', iso2: 'GB', iso3: 'GBR', name: 'GRA BRETANHA', nameEn: 'UNITED KINGDOM' },
  { code: '0750', iso2: 'IN', iso3: 'IND', name: 'INDIA', nameEn: 'INDIA' },
  { code: '0845', iso2: 'IT', iso3: 'ITA', name: 'ITALIA', nameEn: 'ITALY' },
  { code: '0855', iso2: 'JP', iso3: 'JPN', name: 'JAPAO', nameEn: 'JAPAN' },
  { code: '1112', iso2: 'PY', iso3: 'PRY', name: 'PARAGUAI', nameEn: 'PARAGUAY' },
  { code: '1140', iso2: 'PE', iso3: 'PER', name: 'PERU', nameEn: 'PERU' },
  { code: '1175', iso2: 'PT', iso3: 'PRT', name: 'PORTUGAL', nameEn: 'PORTUGAL' },
  { code: '1310', iso2: 'SE', iso3: 'SWE', name: 'SUECIA', nameEn: 'SWEDEN' },
  { code: '1330', iso2: 'CH', iso3: 'CHE', name: 'SUICA', nameEn: 'SWITZERLAND' },
  { code: '1406', iso2: 'UY', iso3: 'URY', name: 'URUGUAI', nameEn: 'URUGUAY' },
  { code: '9999', iso2: 'EX', iso3: 'EXT', name: 'EXTERIOR', nameEn: 'EXTERIOR' },
];

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // ============================================================================
  // 1. EMPRESA
  // ============================================================================
  const company = await prisma.company.upsert({
    where: { cnpj: '00000000000100' },
    update: {},
    create: {
      cnpj: '00000000000100',
      razaoSocial: 'Implementos Rodoviários Ltda',
      nomeFantasia: 'Implementos Rod',
      inscricaoEstadual: 'ISENTO',
      taxRegime: 'LUCRO_REAL',
      cnaePrincipal: '29204/01',
      ambienteSefaz: 2, // homologação
      logradouro: 'Rua Industrial',
      numero: '1000',
      bairro: 'Distrito Industrial',
      municipio: 'Cidade Exemplo',
      codigoMunicipioIbge: '3550308',
      uf: 'SP',
      cep: '01000000',
      telefone: '1133334444',
      email: 'contato@implementosrod.com.br',
    },
  });
  console.log(`✅ Empresa criada: ${company.razaoSocial}`);

  // ============================================================================
  // 2. CNAEs
  // ============================================================================
  const cnaes = [
    { cnae: '29204/01', descricao: 'Fabricação de carrocerias para ônibus', principal: true },
    { cnae: '29204/02', descricao: 'Fabricação de carrocerias para caminhões e reboques', principal: false },
    { cnae: '45307/01', descricao: 'Comércio por atacado de peças e acessórios para veículos automotores', principal: false },
    { cnae: '33147/00', descricao: 'Manutenção e reparação de máquinas e equipamentos da indústria mecânica', principal: false },
    { cnae: '66223/00', descricao: 'Corretores e agentes de seguros', principal: false },
    { cnae: '66215/00', descricao: 'Atividades auxiliares dos seguros, da previdência complementar e dos planos de saúde', principal: false },
  ];

  for (const cnaeData of cnaes) {
    await prisma.companyCnae.upsert({
      where: { companyId_cnae: { companyId: company.id, cnae: cnaeData.cnae } },
      update: {},
      create: {
        companyId: company.id,
        ...cnaeData,
      },
    });
  }
  console.log(`✅ ${cnaes.length} CNAEs cadastrados`);

  // ============================================================================
  // 3. CENTROS DE CUSTO
  // ============================================================================
  const costCenters = [
    { code: 'CC_IND' as const, name: 'Industrial', description: 'Fabricação de carrocerias e implementos' },
    { code: 'CC_COM' as const, name: 'Comercial', description: 'Vendas, CRM, concessionária' },
    { code: 'CC_OFI' as const, name: 'Oficina / Calderaria', description: 'Manutenção, reparos, calderaria' },
    { code: 'CC_FI' as const, name: 'F&I', description: 'Financiamento, consórcio, seguro' },
    { code: 'CC_ADM' as const, name: 'Administrativo', description: 'RH, contabilidade, financeiro, TI' },
  ];

  for (const cc of costCenters) {
    await prisma.costCenter.upsert({
      where: { companyId_code: { companyId: company.id, code: cc.code } },
      update: {},
      create: {
        companyId: company.id,
        ...cc,
      },
    });
  }
  console.log(`✅ ${costCenters.length} centros de custo criados`);

  // ============================================================================
  // 4. PLANO DE CONTAS PADRÃO
  // ============================================================================
  const chartAccounts = [
    // Grupo 1 - ATIVO (nature: DEVEDORA)
    { code: '1.1.1.001', name: 'Caixa', type: 'ATIVO' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '1.1.1.002', name: 'Banco Conta Corrente', type: 'ATIVO' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '1.1.2.001', name: 'Clientes (Duplicatas a Receber)', type: 'ATIVO' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '1.1.4.001', name: 'Estoque - Matéria-Prima', type: 'ATIVO' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '1.1.4.002', name: 'Estoque - Produtos Acabados', type: 'ATIVO' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '1.1.4.003', name: 'Estoque - Mercadorias', type: 'ATIVO' as const, nature: 'DEVEDORA' as const, level: 4 },
    // Grupo 2 - PASSIVO (nature: CREDORA)
    { code: '2.1.1.001', name: 'Fornecedores (Duplicatas a Pagar)', type: 'PASSIVO' as const, nature: 'CREDORA' as const, level: 4 },
    { code: '2.1.2.001', name: 'Salários a Pagar', type: 'PASSIVO' as const, nature: 'CREDORA' as const, level: 4 },
    { code: '2.1.2.002', name: 'FGTS a Recolher', type: 'PASSIVO' as const, nature: 'CREDORA' as const, level: 4 },
    { code: '2.1.2.003', name: 'INSS a Recolher', type: 'PASSIVO' as const, nature: 'CREDORA' as const, level: 4 },
    // Grupo 3 - RECEITA (nature: CREDORA)
    { code: '3.1.1.001', name: 'Receita de Vendas de Produtos', type: 'RECEITA' as const, nature: 'CREDORA' as const, level: 4 },
    { code: '3.1.2.001', name: 'Receita de Serviços', type: 'RECEITA' as const, nature: 'CREDORA' as const, level: 4 },
    // Grupo 4 - DESPESA (nature: DEVEDORA)
    { code: '4.1.1.001', name: 'Custo das Mercadorias Vendidas (CMV)', type: 'DESPESA' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '4.2.1.001', name: 'Despesa com Salários', type: 'DESPESA' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '4.2.1.002', name: 'Despesa com FGTS', type: 'DESPESA' as const, nature: 'DEVEDORA' as const, level: 4 },
    { code: '4.2.1.003', name: 'Despesa com INSS Patronal', type: 'DESPESA' as const, nature: 'DEVEDORA' as const, level: 4 },
  ];

  for (const account of chartAccounts) {
    await prisma.chartOfAccount.upsert({
      where: { companyId_code: { companyId: company.id, code: account.code } },
      update: {},
      create: {
        companyId: company.id,
        code: account.code,
        name: account.name,
        type: account.type,
        nature: account.nature,
        level: account.level,
        acceptsEntries: true,
        active: true,
      },
    });
  }
  console.log(`✅ ${chartAccounts.length} contas do plano de contas criadas`);

  // ============================================================================
  // 5. CONFIG REGIME TRIBUTÁRIO (TRANSIÇÃO 2026-2033)
  // ============================================================================
  const transitionConfigs = [
    { ano: 2026, icms: 100, ibs: 0, pisCofins: 100, cbs: 10, cbsAtiva: true, ibsAtiva: false, isAtivo: false, splitPaymentAtivo: false },
    { ano: 2027, icms: 100, ibs: 0, pisCofins: 100, cbs: 10, cbsAtiva: true, ibsAtiva: false, isAtivo: false, splitPaymentAtivo: false },
    { ano: 2028, icms: 100, ibs: 0, pisCofins: 90, cbs: 100, cbsAtiva: true, ibsAtiva: false, isAtivo: false, splitPaymentAtivo: false },
    { ano: 2029, icms: 90, ibs: 10, pisCofins: 80, cbs: 100, cbsAtiva: true, ibsAtiva: true, isAtivo: true, splitPaymentAtivo: true },
    { ano: 2030, icms: 80, ibs: 20, pisCofins: 60, cbs: 100, cbsAtiva: true, ibsAtiva: true, isAtivo: true, splitPaymentAtivo: true },
    { ano: 2031, icms: 60, ibs: 40, pisCofins: 40, cbs: 100, cbsAtiva: true, ibsAtiva: true, isAtivo: true, splitPaymentAtivo: true },
    { ano: 2032, icms: 40, ibs: 60, pisCofins: 20, cbs: 100, cbsAtiva: true, ibsAtiva: true, isAtivo: true, splitPaymentAtivo: true },
    { ano: 2033, icms: 0, ibs: 100, pisCofins: 0, cbs: 100, cbsAtiva: true, ibsAtiva: true, isAtivo: true, splitPaymentAtivo: true },
  ];

  // Limpar configs anteriores
  await prisma.taxRegimeConfig.deleteMany({ where: { companyId: company.id } });

  for (const cfg of transitionConfigs) {
    await prisma.taxRegimeConfig.create({
      data: {
        companyId: company.id,
        taxSystem: 'TRANSICAO',
        vigenciaInicio: new Date(`${cfg.ano}-01-01`),
        vigenciaFim: new Date(`${cfg.ano}-12-31`),
        anoReferencia: cfg.ano,
        percentualIcms: cfg.icms,
        percentualIbs: cfg.ibs,
        percentualPisCofins: cfg.pisCofins,
        percentualCbs: cfg.cbs,
        cbsAtiva: cfg.cbsAtiva,
        ibsAtiva: cfg.ibsAtiva,
        isAtivo: cfg.isAtivo,
        splitPaymentAtivo: cfg.splitPaymentAtivo,
        pisCofinsAtiva: cfg.pisCofins > 0,
        icmsAtivo: cfg.icms > 0,
        ipiAtivo: cfg.ano < 2033,
        issAtivo: cfg.icms > 0,
      },
    });
  }
  console.log(`✅ ${transitionConfigs.length} configs de transição tributária criadas (2026-2033)`);

  // ============================================================================
  // 6. PERMISSÕES
  // ============================================================================
  const modules = [
    'ENGINEERING', 'PCP', 'PRODUCTION', 'QUALITY',
    'CRM', 'SALES', 'FI',
    'SERVICE_ORDER', 'CALDERARIA', 'REQUISITION',
    'FISCAL', 'ACCOUNTING', 'FINANCIAL', 'HR', 'PURCHASING', 'INVENTORY',
    'AI_ASSISTANT', 'SETTINGS', 'DASHBOARD',
  ] as const;

  const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT', 'MANAGE'] as const;

  let permCount = 0;
  for (const mod of modules) {
    for (const act of actions) {
      await prisma.permission.upsert({
        where: { module_action: { module: mod, action: act } },
        update: {},
        create: {
          module: mod,
          action: act,
          description: `${act} em ${mod}`,
        },
      });
      permCount++;
    }
  }
  console.log(`✅ ${permCount} permissões criadas`);

  // ============================================================================
  // 7. ROLES
  // ============================================================================
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrador do sistema — acesso total',
      isSystem: true,
    },
  });

  const gerenteRole = await prisma.role.upsert({
    where: { name: 'GERENTE' },
    update: {},
    create: {
      name: 'GERENTE',
      description: 'Gerente — acesso a leitura, criação e aprovação',
      isSystem: true,
    },
  });

  const operadorRole = await prisma.role.upsert({
    where: { name: 'OPERADOR' },
    update: {},
    create: {
      name: 'OPERADOR',
      description: 'Operador — acesso básico de leitura e criação',
      isSystem: true,
    },
  });

  console.log(`✅ 3 roles criadas: ADMIN, GERENTE, OPERADOR`);

  // Vincular TODAS as permissões ao ADMIN
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }
  console.log(`✅ ADMIN vinculado a ${allPermissions.length} permissões`);

  // GERENTE: READ, CREATE, UPDATE, APPROVE, EXPORT em todos os módulos
  const gerenteActions = ['CREATE', 'READ', 'UPDATE', 'APPROVE', 'EXPORT'] as const;
  const gerentePerms = allPermissions.filter((p) => gerenteActions.includes(p.action as any));
  for (const perm of gerentePerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: gerenteRole.id, permissionId: perm.id } },
      update: {},
      create: {
        roleId: gerenteRole.id,
        permissionId: perm.id,
      },
    });
  }

  // OPERADOR: READ, CREATE em todos os módulos
  const operadorActions = ['CREATE', 'READ'] as const;
  const operadorPerms = allPermissions.filter((p) => operadorActions.includes(p.action as any));
  for (const perm of operadorPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: operadorRole.id, permissionId: perm.id } },
      update: {},
      create: {
        roleId: operadorRole.id,
        permissionId: perm.id,
      },
    });
  }
  console.log(`✅ Permissões vinculadas a GERENTE e OPERADOR`);

  // ============================================================================
  // 8. USUÁRIO ADMIN
  // ============================================================================
  const passwordHash = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@erp.local' },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@erp.local',
      name: 'Administrador',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  // Vincular user ao role ADMIN
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log(`✅ Usuário admin criado: admin@erp.local / admin123`);

  // ============================================================================
  // 9. TABELAS DE REFERÊNCIA FISCAL
  // ============================================================================

  // CST ICMS
  for (const item of CST_ICMS_DATA) {
    await prisma.cstIcms.upsert({
      where: { code: item.code },
      create: item,
      update: { description: item.description, categoria: item.categoria },
    });
  }
  console.log(`✅ ${CST_ICMS_DATA.length} registros CST ICMS inseridos`);

  // CSOSN
  for (const item of CSOSN_DATA) {
    await prisma.csosn.upsert({
      where: { code: item.code },
      create: item,
      update: { description: item.description },
    });
  }
  console.log(`✅ ${CSOSN_DATA.length} registros CSOSN inseridos`);

  // CST IPI
  for (const item of CST_IPI_DATA) {
    await prisma.cstIpi.upsert({
      where: { code: item.code },
      create: item,
      update: { description: item.description, tipo: item.tipo },
    });
  }
  console.log(`✅ ${CST_IPI_DATA.length} registros CST IPI inseridos`);

  // CST PIS/COFINS
  for (const item of CST_PIS_COFINS_DATA) {
    await prisma.cstPisCofins.upsert({
      where: { code: item.code },
      create: item,
      update: { description: item.description, tipo: item.tipo, regime: item.regime },
    });
  }
  console.log(`✅ ${CST_PIS_COFINS_DATA.length} registros CST PIS/COFINS inseridos`);

  // Bancos
  for (const item of BANCOS_DATA) {
    await prisma.banco.upsert({
      where: { code: item.code },
      create: item,
      update: { name: item.name, shortName: item.shortName, ispb: item.ispb, tipo: item.tipo },
    });
  }
  console.log(`✅ ${BANCOS_DATA.length} bancos inseridos`);

  // Países
  for (const item of PAISES_DATA) {
    await prisma.pais.upsert({
      where: { code: item.code },
      create: item,
      update: { name: item.name, iso2: item.iso2, iso3: item.iso3, nameEn: item.nameEn },
    });
  }
  console.log(`✅ ${PAISES_DATA.length} países inseridos`);

  // ICMS Interestadual - matriz completa
  const UF_NORTE_NORDESTE_CO = ['AC','AL','AM','AP','BA','CE','GO','MA','MT','MS','PA','PB','PE','PI','RN','RO','RR','SE','TO'];
  const UF_SUL_SUDESTE_DF = ['DF','ES','MG','PR','RJ','RS','SC','SP'];
  const ALL_UF = [...UF_NORTE_NORDESTE_CO, ...UF_SUL_SUDESTE_DF];

  let icmsCount = 0;
  for (const ufOrigem of ALL_UF) {
    for (const ufDestino of ALL_UF) {
      if (ufOrigem === ufDestino) continue;
      const aliqNormal = UF_NORTE_NORDESTE_CO.includes(ufDestino) ? 7 : 12;
      await prisma.icmsInterestadual.upsert({
        where: { ufOrigem_ufDestino_tipo: { ufOrigem, ufDestino, tipo: 'NORMAL' } },
        create: { ufOrigem, ufDestino, aliquota: aliqNormal, tipo: 'NORMAL' },
        update: { aliquota: aliqNormal },
      });
      await prisma.icmsInterestadual.upsert({
        where: { ufOrigem_ufDestino_tipo: { ufOrigem, ufDestino, tipo: 'IMPORTADO' } },
        create: { ufOrigem, ufDestino, aliquota: 4, tipo: 'IMPORTADO' },
        update: { aliquota: 4 },
      });
      icmsCount += 2;
    }
  }
  console.log(`✅ ${icmsCount} registros ICMS interestadual inseridos`);

  // ─── Alíquotas internas ICMS por UF ────────────────────────────────────
  const aliquotasUf = [
    { uf: 'AC', nome: 'Acre',               aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'NORTE',    codigoIbge: '12' },
    { uf: 'AL', nome: 'Alagoas',            aliquotaPadrao: 19, aliquotaFcp: 2,   regiao: 'NORDESTE',  codigoIbge: '27' },
    { uf: 'AP', nome: 'Amapá',              aliquotaPadrao: 18, aliquotaFcp: 0,   regiao: 'NORTE',    codigoIbge: '16' },
    { uf: 'AM', nome: 'Amazonas',           aliquotaPadrao: 20, aliquotaFcp: 2,   regiao: 'NORTE',    codigoIbge: '13' },
    { uf: 'BA', nome: 'Bahia',              aliquotaPadrao: 20.5, aliquotaFcp: 2, regiao: 'NORDESTE',  codigoIbge: '29' },
    { uf: 'CE', nome: 'Ceará',              aliquotaPadrao: 20, aliquotaFcp: 2,   regiao: 'NORDESTE',  codigoIbge: '23' },
    { uf: 'DF', nome: 'Distrito Federal',   aliquotaPadrao: 20, aliquotaFcp: 2,   regiao: 'CENTRO_OESTE', codigoIbge: '53' },
    { uf: 'ES', nome: 'Espírito Santo',     aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'SUDESTE',  codigoIbge: '32' },
    { uf: 'GO', nome: 'Goiás',              aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'CENTRO_OESTE', codigoIbge: '52' },
    { uf: 'MA', nome: 'Maranhão',           aliquotaPadrao: 22, aliquotaFcp: 2,   regiao: 'NORDESTE',  codigoIbge: '21' },
    { uf: 'MT', nome: 'Mato Grosso',        aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'CENTRO_OESTE', codigoIbge: '51' },
    { uf: 'MS', nome: 'Mato Grosso do Sul', aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'CENTRO_OESTE', codigoIbge: '50' },
    { uf: 'MG', nome: 'Minas Gerais',       aliquotaPadrao: 18, aliquotaFcp: 0,   regiao: 'SUDESTE',  codigoIbge: '31' },
    { uf: 'PA', nome: 'Pará',               aliquotaPadrao: 19, aliquotaFcp: 2,   regiao: 'NORTE',    codigoIbge: '15' },
    { uf: 'PB', nome: 'Paraíba',            aliquotaPadrao: 20, aliquotaFcp: 2,   regiao: 'NORDESTE',  codigoIbge: '25' },
    { uf: 'PR', nome: 'Paraná',             aliquotaPadrao: 19, aliquotaFcp: 0,   regiao: 'SUL',      codigoIbge: '41' },
    { uf: 'PE', nome: 'Pernambuco',         aliquotaPadrao: 20.5, aliquotaFcp: 2, regiao: 'NORDESTE',  codigoIbge: '26' },
    { uf: 'PI', nome: 'Piauí',              aliquotaPadrao: 21, aliquotaFcp: 2,   regiao: 'NORDESTE',  codigoIbge: '22' },
    { uf: 'RJ', nome: 'Rio de Janeiro',     aliquotaPadrao: 22, aliquotaFcp: 2,   regiao: 'SUDESTE',  codigoIbge: '33' },
    { uf: 'RN', nome: 'Rio Grande do Norte',aliquotaPadrao: 20, aliquotaFcp: 2,   regiao: 'NORDESTE',  codigoIbge: '24' },
    { uf: 'RS', nome: 'Rio Grande do Sul',  aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'SUL',      codigoIbge: '43' },
    { uf: 'RO', nome: 'Rondônia',           aliquotaPadrao: 19.5, aliquotaFcp: 2, regiao: 'NORTE',    codigoIbge: '11' },
    { uf: 'RR', nome: 'Roraima',            aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'NORTE',    codigoIbge: '14' },
    { uf: 'SC', nome: 'Santa Catarina',     aliquotaPadrao: 17, aliquotaFcp: 0,   regiao: 'SUL',      codigoIbge: '42' },
    { uf: 'SP', nome: 'São Paulo',          aliquotaPadrao: 18, aliquotaFcp: 0,   regiao: 'SUDESTE',  codigoIbge: '35' },
    { uf: 'SE', nome: 'Sergipe',            aliquotaPadrao: 19, aliquotaFcp: 2,   regiao: 'NORDESTE',  codigoIbge: '28' },
    { uf: 'TO', nome: 'Tocantins',          aliquotaPadrao: 20, aliquotaFcp: 2,   regiao: 'NORTE',    codigoIbge: '17' },
  ];

  for (const item of aliquotasUf) {
    await prisma.aliquotaIcmsUf.upsert({
      where: { uf: item.uf },
      create: item,
      update: { aliquotaPadrao: item.aliquotaPadrao, aliquotaFcp: item.aliquotaFcp },
    });
  }
  console.log(`✅ ${aliquotasUf.length} alíquotas internas ICMS por UF inseridas`);

  console.log('\n🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
