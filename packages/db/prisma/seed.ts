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

  // ============================================================================
  // 10. LC 116/2003 — SERVIÇOS ISS
  // ============================================================================
  await seedLc116();

  console.log('\n🎉 Seed concluído com sucesso!');
}

async function seedLc116() {
  const servicos = [
    // GRUPO 1 — INFORMÁTICA E CONGÊNERES
    { codigo: '1.01', descricao: 'Análise e desenvolvimento de sistemas' },
    { codigo: '1.02', descricao: 'Programação' },
    { codigo: '1.03', descricao: 'Processamento, armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação' },
    { codigo: '1.04', descricao: 'Elaboração de programas de computadores, inclusive de jogos eletrônicos' },
    { codigo: '1.05', descricao: 'Licenciamento ou cessão de direito de uso de programas de computação' },
    { codigo: '1.06', descricao: 'Assessoria e consultoria em informática' },
    { codigo: '1.07', descricao: 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados' },
    { codigo: '1.08', descricao: 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas' },
    // GRUPO 2 — PESQUISAS E DESENVOLVIMENTO
    { codigo: '2.01', descricao: 'Serviços de pesquisas e desenvolvimento de qualquer natureza' },
    // GRUPO 3 — LOCAÇÃO DE BENS MÓVEIS
    { codigo: '3.02', descricao: 'Cessão de direito de uso de marcas e de sinais de propaganda' },
    { codigo: '3.03', descricao: 'Exploração de salões de festas, centro de convenções, escritórios virtuais, stands, quadras esportivas, estádios, ginásios, auditórios, casas de espetáculos, parques de diversões, canchas e congêneres, para realização de eventos ou negócios' },
    { codigo: '3.04', descricao: 'Locação, sublocação, arrendamento, direito de passagem ou permissão de uso, compartilhado ou não, de ferrovia, rodovia, postes, cabos, dutos e condutos de qualquer natureza' },
    { codigo: '3.05', descricao: 'Cessão de andaimes, palcos, coberturas e outras estruturas de uso temporário' },
    // GRUPO 4 — SAÚDE, ASSISTÊNCIA MÉDICA E CONGÊNERES
    { codigo: '4.01', descricao: 'Medicina e biomedicina' },
    { codigo: '4.02', descricao: 'Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia, ultrassonografia, ressonância magnética, radiologia, tomografia e congêneres' },
    { codigo: '4.03', descricao: 'Hospitais, clínicas, laboratórios, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres' },
    { codigo: '4.04', descricao: 'Instrumentação cirúrgica' },
    { codigo: '4.05', descricao: 'Acupuntura' },
    { codigo: '4.06', descricao: 'Enfermagem, inclusive serviços auxiliares' },
    { codigo: '4.07', descricao: 'Serviços farmacêuticos' },
    { codigo: '4.08', descricao: 'Terapia ocupacional, fisioterapia e fonoaudiologia' },
    { codigo: '4.09', descricao: 'Terapias de qualquer espécie destinadas ao tratamento físico, orgânico e mental' },
    { codigo: '4.10', descricao: 'Nutrição' },
    { codigo: '4.11', descricao: 'Obstetrícia' },
    { codigo: '4.12', descricao: 'Odontologia' },
    { codigo: '4.13', descricao: 'Ortóptica' },
    { codigo: '4.14', descricao: 'Próteses sob encomenda' },
    { codigo: '4.15', descricao: 'Psicanálise' },
    { codigo: '4.16', descricao: 'Psicologia' },
    { codigo: '4.17', descricao: 'Casas de repouso e de recuperação, creches, asilos e congêneres' },
    { codigo: '4.18', descricao: 'Inseminação artificial, fertilização in vitro e congêneres' },
    { codigo: '4.19', descricao: 'Bancos de sangue, leite, pele, olhos, óvulos, sêmen e congêneres' },
    { codigo: '4.20', descricao: 'Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos de qualquer espécie' },
    { codigo: '4.21', descricao: 'Unidade de atendimento, assistência ou tratamento móvel e congêneres' },
    { codigo: '4.22', descricao: 'Planos de medicina de grupo ou individual e convênios para prestação de assistência médica, hospitalar, odontológica e congêneres' },
    { codigo: '4.23', descricao: 'Outros planos de saúde que se cumpram através de serviços de terceiros contratados, credenciados, cooperados ou apenas pagos pelo operador do plano mediante indicação do beneficiário' },
    // GRUPO 5 — MEDICINA E ASSISTÊNCIA VETERINÁRIA
    { codigo: '5.01', descricao: 'Medicina veterinária e zootecnia' },
    { codigo: '5.02', descricao: 'Hospitais, clínicas, ambulatórios, prontos-socorros e congêneres, na área veterinária' },
    { codigo: '5.03', descricao: 'Laboratórios de análise na área veterinária' },
    { codigo: '5.04', descricao: 'Inseminação artificial, fertilização in vitro e congêneres' },
    { codigo: '5.05', descricao: 'Bancos de sangue e de órgãos e congêneres' },
    { codigo: '5.06', descricao: 'Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos de qualquer espécie' },
    { codigo: '5.07', descricao: 'Unidade de atendimento, assistência ou tratamento móvel e congêneres' },
    { codigo: '5.08', descricao: 'Guarda, tratamento, amestramento, embelezamento, alojamento e congêneres' },
    { codigo: '5.09', descricao: 'Planos de atendimento e assistência médico-veterinária' },
    // GRUPO 6 — CUIDADOS PESSOAIS, ESTÉTICA E ATIVIDADES FÍSICAS
    { codigo: '6.01', descricao: 'Barbearia, cabeleireiros, manicuros, pedicuros e congêneres' },
    { codigo: '6.02', descricao: 'Esteticistas, tratamento de pele, depilação e congêneres' },
    { codigo: '6.03', descricao: 'Banhos, duchas, sauna, massagens e congêneres' },
    { codigo: '6.04', descricao: 'Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas' },
    { codigo: '6.05', descricao: 'Centros de emagrecimento, spa e congêneres' },
    // GRUPO 7 — ENGENHARIA, ARQUITETURA, GEOLOGIA, URBANISMO, CONSTRUÇÃO CIVIL
    { codigo: '7.01', descricao: 'Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo, paisagismo e congêneres' },
    { codigo: '7.02', descricao: 'Execução, por administração, empreitada ou subempreitada, de obras de construção civil, hidráulica ou elétrica e de outras obras semelhantes' },
    { codigo: '7.03', descricao: 'Elaboração de planos diretores, estudos de viabilidade, estudos organizacionais e outros relacionados com obras e serviços de engenharia' },
    { codigo: '7.04', descricao: 'Demolição' },
    { codigo: '7.05', descricao: 'Reparação, conservação e reforma de edifícios, estradas, pontes, portos e congêneres' },
    { codigo: '7.06', descricao: 'Colocação e instalação de tapetes, carpetes, assoalhos, cortinas, revestimentos de parede, vidros, divisórias, placas de gesso e congêneres' },
    { codigo: '7.07', descricao: 'Recuperação, raspagem, polimento e lustração de pisos e congêneres' },
    { codigo: '7.08', descricao: 'Calafetação' },
    { codigo: '7.09', descricao: 'Varrição, coleta, remoção, incineração, tratamento, reciclagem, separação e destinação final de lixo, rejeitos e outros resíduos quaisquer' },
    { codigo: '7.10', descricao: 'Limpeza, manutenção e conservação de vias e logradouros públicos, imóveis, chaminés, piscinas, parques, jardins e congêneres' },
    { codigo: '7.11', descricao: 'Decoração e jardinagem, inclusive corte e poda de árvores' },
    { codigo: '7.12', descricao: 'Controle e tratamento de efluentes de qualquer natureza e de agentes físicos, químicos e biológicos' },
    { codigo: '7.13', descricao: 'Dedetização, desinfecção, desinsetização, imunização, higienização, desratização, pulverização e congêneres' },
    { codigo: '7.14', descricao: 'Florestamento, reflorestamento, semeadura, adubação e congêneres' },
    { codigo: '7.15', descricao: 'Escoramento, contenção de encostas e serviços congêneres' },
    { codigo: '7.16', descricao: 'Limpeza e dragagem de rios, portos, canais, baías, lagos, lagoas, represas, açudes e congêneres' },
    { codigo: '7.17', descricao: 'Acompanhamento e fiscalização da execução de obras de engenharia, arquitetura e urbanismo' },
    { codigo: '7.18', descricao: 'Aerofotogrametria (inclusive interpretação), cartografia, mapeamento, levantamentos topográficos, batimétricos, hidrográficos, geodésicos, geológicos, geofísicos e congêneres' },
    { codigo: '7.19', descricao: 'Pesquisa, perfuração, cimentação, mergulho, perfilagem, concretação, testemunhagem, pescaria, estimulação e outros serviços relacionados com a exploração e explotação de petróleo, gás natural e de outros recursos minerais' },
    { codigo: '7.20', descricao: 'Nucleação e bombardeamento de nuvens e congêneres' },
    // GRUPO 8 — EDUCAÇÃO, ENSINO, ORIENTAÇÃO PEDAGÓGICA
    { codigo: '8.01', descricao: 'Ensino regular pré-escolar, fundamental, médio e superior' },
    { codigo: '8.02', descricao: 'Instrução, treinamento, orientação pedagógica e avaliação de conhecimentos de qualquer natureza' },
    // GRUPO 9 — HOSPEDAGEM, TURISMO, VIAGENS
    { codigo: '9.01', descricao: 'Hospedagem de qualquer natureza em hotéis, apart-service condominiais, flat, apart-hotéis, hotéis residência, residence-service, suite service, hotelaria marítima, motéis, pensões e congêneres' },
    { codigo: '9.02', descricao: 'Agenciamento, organização, promoção, intermediação e execução de programas de turismo, passeios, viagens, excursões, hospedagens e congêneres' },
    { codigo: '9.03', descricao: 'Guias de turismo' },
    // GRUPO 10 — INTERMEDIAÇÃO E CONGÊNERES
    { codigo: '10.01', descricao: 'Agenciamento, corretagem ou intermediação de câmbio, de seguros, de cartões de crédito, de planos de saúde e de planos de previdência privada' },
    { codigo: '10.02', descricao: 'Agenciamento, corretagem ou intermediação de títulos em geral, valores mobiliários e contratos quaisquer' },
    { codigo: '10.03', descricao: 'Agenciamento, corretagem ou intermediação de direitos de propriedade industrial, artística ou literária' },
    { codigo: '10.04', descricao: 'Agenciamento, corretagem ou intermediação de contratos de arrendamento mercantil (leasing), de franquia (franchising) e de faturização (factoring)' },
    { codigo: '10.05', descricao: 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis, não abrangidos em outros itens ou subitens' },
    { codigo: '10.06', descricao: 'Agenciamento marítimo' },
    { codigo: '10.07', descricao: 'Agenciamento de notícias' },
    { codigo: '10.08', descricao: 'Agenciamento e representação de qualquer natureza' },
    { codigo: '10.09', descricao: 'Distribuição, venda e representação comercial de combustíveis, lubrificantes, aditivos e derivados de petróleo' },
    // GRUPO 11 — GUARDA, ESTACIONAMENTO, ARMAZENAMENTO, VIGILÂNCIA
    { codigo: '11.01', descricao: 'Guarda e estacionamento de veículos terrestres automotores, de aeronaves e de embarcações' },
    { codigo: '11.02', descricao: 'Vigilância, segurança ou monitoramento de bens e pessoas' },
    { codigo: '11.03', descricao: 'Escolta, inclusive de veículos e cargas' },
    { codigo: '11.04', descricao: 'Armazenamento, depósito, carga, descarga, arrumação e guarda de bens de qualquer espécie' },
    // GRUPO 12 — DIVERSÕES, LAZER, ENTRETENIMENTO
    { codigo: '12.01', descricao: 'Espetáculos teatrais' },
    { codigo: '12.02', descricao: 'Exibições cinematográficas' },
    { codigo: '12.03', descricao: 'Espetáculos circenses' },
    { codigo: '12.04', descricao: 'Programas de auditório' },
    { codigo: '12.05', descricao: 'Parques de diversões, centros de lazer e congêneres' },
    { codigo: '12.06', descricao: 'Boates, taxi-dancing e congêneres' },
    { codigo: '12.07', descricao: 'Shows, ballet, danças, desfiles, bailes, óperas, concertos, recitais, festivais e congêneres' },
    { codigo: '12.08', descricao: 'Feiras, exposições, congressos e congêneres' },
    { codigo: '12.09', descricao: 'Bilhares, boliches e diversões eletrônicas ou não' },
    { codigo: '12.10', descricao: 'Corridas e competições de animais' },
    { codigo: '12.11', descricao: 'Competições esportivas ou de destreza física ou intelectual, com ou sem a participação do espectador' },
    { codigo: '12.12', descricao: 'Execução de música' },
    { codigo: '12.13', descricao: 'Produção, mediante ou sem encomenda prévia, de eventos, espetáculos, entrevistas, shows, ballet, danças, desfiles, bailes, teatros, óperas, concertos, recitais, festivais e congêneres' },
    { codigo: '12.14', descricao: 'Fornecimento de música para ambientes fechados ou não, mediante transmissão por qualquer processo' },
    { codigo: '12.15', descricao: 'Desfiles de blocos carnavalescos ou folclóricos, trios elétricos e congêneres' },
    { codigo: '12.16', descricao: 'Exibição de filmes, entrevistas, musicais, espetáculos, shows, concertos, desfiles, óperas, competições esportivas, de destreza intelectual ou congêneres' },
    { codigo: '12.17', descricao: 'Recreação e animação, inclusive em festas e eventos de qualquer natureza' },
    // GRUPO 13 — FONOGRAFIA, FOTOGRAFIA, CINEMATOGRAFIA E REPROGRAFIA
    { codigo: '13.01', descricao: 'Fonografia ou gravação de sons, inclusive trucagem, dublagem, mixagem e congêneres' },
    { codigo: '13.02', descricao: 'Fotografia e cinematografia, inclusive revelação, ampliação, cópia, reprodução, trucagem e congêneres' },
    { codigo: '13.03', descricao: 'Reprografia, mimeografia e carimbaria e congêneres' },
    { codigo: '13.04', descricao: 'Composição gráfica, fotocomposição, clicheria, zincografia, litografia, fotolitografia e congêneres' },
    // GRUPO 14 — LUBRIFICAÇÃO, LIMPEZA E MANUTENÇÃO
    { codigo: '14.01', descricao: 'Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos, aparelhos, equipamentos, motores, elevadores ou de qualquer objeto (exceto peças e partes empregadas, que ficam sujeitas ao ICMS)' },
    { codigo: '14.02', descricao: 'Assistência técnica' },
    { codigo: '14.03', descricao: 'Recondicionamento de motores (exceto peças e partes empregadas, que ficam sujeitas ao ICMS)' },
    { codigo: '14.04', descricao: 'Recauchutagem ou regeneração de pneus' },
    { codigo: '14.05', descricao: 'Restauração, recondicionamento, acondicionamento, pintura, beneficiamento, lavagem, secagem, tingimento, galvanoplastia, anodização, corte, recorte, polimento, plastificação e congêneres, de objetos quaisquer' },
    { codigo: '14.06', descricao: 'Instalação e montagem de aparelhos, máquinas e equipamentos, inclusive montagem industrial, prestados ao usuário final, exclusivamente com material por ele fornecido' },
    { codigo: '14.07', descricao: 'Colocação de molduras e congêneres' },
    { codigo: '14.08', descricao: 'Encadernação, gravação e douração de livros, revistas e congêneres' },
    { codigo: '14.09', descricao: 'Alfaiataria e costura, quando o material for fornecido pelo usuário final, exceto aviamento' },
    { codigo: '14.10', descricao: 'Tinturaria e lavanderia' },
    { codigo: '14.11', descricao: 'Tapeçaria e reforma de estofamentos em geral' },
    { codigo: '14.12', descricao: 'Funilaria e lanternagem' },
    { codigo: '14.13', descricao: 'Carpintaria e serralheria' },
    // GRUPO 15 — SERVIÇOS RELACIONADOS AO SETOR BANCÁRIO
    { codigo: '15.01', descricao: 'Administração de fundos quaisquer, de consórcio, de cartão de crédito ou débito e congêneres, de carteira de clientes, de cheques pré-datados e congêneres' },
    { codigo: '15.02', descricao: 'Abertura de contas em geral, inclusive conta-corrente, conta de investimentos e aplicação e caderneta de poupança, no País e no exterior, bem como a manutenção das referidas contas ativas e inativas' },
    { codigo: '15.03', descricao: 'Locação e manutenção de cofres particulares, de terminais eletrônicos, de terminais de atendimento e de bens e equipamentos em geral' },
    { codigo: '15.04', descricao: 'Fornecimento ou emissão de atestados em geral, inclusive atestado de idoneidade, atestado de capacidade financeira e congêneres' },
    { codigo: '15.05', descricao: 'Cadastro, elaboração de ficha cadastral, renovação cadastral e congêneres, inclusão ou exclusão no Cadastro de Emitentes de Cheques sem Fundos – CCF ou em quaisquer outros bancos cadastrais' },
    { codigo: '15.06', descricao: 'Emissão, reemissão e fornecimento de avisos, comprovantes e documentos em geral' },
    { codigo: '15.07', descricao: 'Abono de firmas' },
    { codigo: '15.08', descricao: 'Coleta e entrega de documentos, bens e valores' },
    { codigo: '15.09', descricao: 'Comunicação com outra agência ou com a administração central' },
    { codigo: '15.10', descricao: 'Licenciamento eletrônico de veículos' },
    { codigo: '15.11', descricao: 'Transferência de veículos' },
    { codigo: '15.12', descricao: 'Agenciamento fiduciário ou depositário' },
    { codigo: '15.13', descricao: 'Levantamentos cadastrais de qualquer natureza, inclusive comercial' },
    { codigo: '15.14', descricao: 'Emissão e reemissão de cartões magnéticos de crédito, débito, salário e congêneres' },
    { codigo: '15.15', descricao: 'Compensação de cheques e títulos quaisquer' },
    { codigo: '15.16', descricao: 'Liquidação de títulos bancários e prestação de serviços correlatos' },
    { codigo: '15.17', descricao: 'Emissão de boletos bancários, recibos e afins' },
    { codigo: '15.18', descricao: 'Cobrança em geral' },
    // GRUPO 16 — TRANSPORTE
    { codigo: '16.01', descricao: 'Serviços de transporte de natureza municipal' },
    // GRUPO 17 — APOIO ADMINISTRATIVO E CONGÊNERES
    { codigo: '17.01', descricao: 'Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista' },
    { codigo: '17.02', descricao: 'Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e infra-estrutura administrativa e congêneres' },
    { codigo: '17.03', descricao: 'Planejamento, coordenação, programação ou organização técnica, financeira ou administrativa' },
    { codigo: '17.04', descricao: 'Recrutamento, agenciamento, seleção e colocação de mão-de-obra' },
    { codigo: '17.05', descricao: 'Fornecimento de mão-de-obra, mesmo em caráter temporário, inclusive de empregados ou trabalhadores, avulsos ou temporários, contratados pelo prestador de serviço' },
    { codigo: '17.06', descricao: 'Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e demais peças publicitárias' },
    { codigo: '17.07', descricao: 'Franquia (franchising)' },
    { codigo: '17.08', descricao: 'Perícias, laudos, exames técnicos e análises técnicas' },
    { codigo: '17.09', descricao: 'Planejamento, organização e administração de feiras, exposições, congressos e congêneres' },
    { codigo: '17.10', descricao: 'Organização de festas e recepções; bufê (exceto o fornecimento de alimentação e bebidas, que fica sujeito ao ICMS)' },
    { codigo: '17.11', descricao: 'Administração em geral, inclusive de bens e negócios de terceiros' },
    { codigo: '17.12', descricao: 'Leilão e congêneres' },
    { codigo: '17.13', descricao: 'Advocacia' },
    { codigo: '17.14', descricao: 'Arbitragem de qualquer espécie, inclusive jurídica' },
    { codigo: '17.15', descricao: 'Auditoria' },
    { codigo: '17.16', descricao: 'Análise de Organização e Métodos' },
    { codigo: '17.17', descricao: 'Atuária e cálculos técnicos de qualquer natureza' },
    { codigo: '17.18', descricao: 'Contabilidade, inclusive serviços técnicos e auxiliares' },
    { codigo: '17.19', descricao: 'Consultoria e assessoria econômica ou financeira' },
    { codigo: '17.20', descricao: 'Estatística' },
    { codigo: '17.21', descricao: 'Cobrança em geral' },
    { codigo: '17.22', descricao: 'Assessoria, análise, avaliação, atendimento, consulta, cadastro, seleção, gerenciamento de informações, administração de contas a receber ou a pagar e em geral relacionados a operações de faturização (factoring)' },
    { codigo: '17.23', descricao: 'Apresentação de palestras, conferências, seminários e congêneres' },
    // GRUPO 18 — SERVIÇOS DE REGULAÇÃO DE SINISTROS
    { codigo: '18.01', descricao: 'Serviços de regulação de sinistros vinculados a contratos de seguros; inspeção e avaliação de riscos para cobertura de contratos de seguros' },
    // GRUPO 19 — DISTRIBUIÇÃO E VENDA DE BILHETES
    { codigo: '19.01', descricao: 'Serviços de distribuição e venda de bilhetes e demais produtos de loteria, bingos, cartões, pules ou cupons de apostas, sorteios, prêmios, inclusive os decorrentes de títulos de capitalização e congêneres' },
    // GRUPO 20 — PORT. MARÍTIMOS, AEROPORTUÁRIOS E TERMINAIS
    { codigo: '20.01', descricao: 'Serviços portuários, ferroportuários, utilização de porto, movimentação de passageiros, reboque de embarcações, rebocador escoteiro, atracação, desatracação, serviços de praticagem, capatazia, armazenagem de qualquer natureza, serviços acessórios, movimentação de mercadorias, serviços de apoio marítimo, de movimentação ao largo, serviços de armadores, estiva, conferência, logística e congêneres' },
    { codigo: '20.02', descricao: 'Serviços aeroportuários, utilização de aeroporto, movimentação de passageiros, armazenagem de qualquer natureza, capatazia, movimentação de aeronaves, serviços de apoio aeroportuários, serviços acessórios, movimentação de mercadorias, logística e congêneres' },
    { codigo: '20.03', descricao: 'Serviços de terminais rodoviários e ferroviários, utilização de terminal, serviços de apoio, movimentação de passageiros, de mercadorias, serviços acessórios e congêneres' },
    // GRUPO 21 — SERVIÇOS DE REGISTROS PÚBLICOS
    { codigo: '21.01', descricao: 'Serviços de registros públicos, cartorários e notariais' },
    // GRUPO 22 — EXPLORAÇÃO DE RODOVIAS
    { codigo: '22.01', descricao: 'Serviços de exploração de rodovias mediante cobrança de preço ou pedágio dos usuários, envolvendo execução de serviços de conservação, manutenção, melhoramentos para adequação de capacidade e segurança de trânsito, operação, monitoração, assistência aos usuários e outros serviços definidos em contratos, atos de concessão ou de permissão ou em normas oficiais' },
    // GRUPO 23 — PROGRAMAÇÃO E COMUNICAÇÃO VISUAL
    { codigo: '23.01', descricao: 'Serviços de programação e comunicação visual, desenho industrial e congêneres' },
    // GRUPO 24 — CHAVEIROS E SIMILARES
    { codigo: '24.01', descricao: 'Serviços de chaveiros, confecção de carimbos, placas, sinalização visual, banners, adesivos e congêneres' },
    // GRUPO 25 — SERVIÇOS FUNERÁRIOS
    { codigo: '25.01', descricao: 'Funerárias e congêneres' },
    { codigo: '25.02', descricao: 'Translado de corpos e ossadas' },
    { codigo: '25.03', descricao: 'Planos ou convênio funerários' },
    { codigo: '25.04', descricao: 'Cremação de corpos e partes de corpos cadavéricos' },
    // GRUPO 26 — COLETA, CUSTÓDIA, TRATAMENTO DE BENS
    { codigo: '26.01', descricao: 'Serviços de coleta, remessa ou entrega de correspondências, documentos, objetos, bens ou valores, inclusive pelos Correios e suas agências franqueadas; courrier e congêneres' },
    // GRUPO 27 — ASSISTÊNCIA SOCIAL
    { codigo: '27.01', descricao: 'Serviços de assistência social' },
    // GRUPO 28 — AVALIAÇÃO DE BENS
    { codigo: '28.01', descricao: 'Serviços de avaliação de bens e serviços de qualquer natureza' },
    // GRUPO 29 — BIBLIOTECONOMIA
    { codigo: '29.01', descricao: 'Serviços de biblioteconomia' },
    // GRUPO 30 — BIOLOGIA, BIOTECNOLOGIA E QUÍMICA
    { codigo: '30.01', descricao: 'Serviços de biologia, biotecnologia e química' },
    // GRUPO 31 — SERVIÇOS TÉCNICOS EM EDIFICAÇÕES
    { codigo: '31.01', descricao: 'Serviços técnicos em edificações, eletrônica, eletrotécnica, mecânica, telecomunicações e congêneres' },
    // GRUPO 32 — DESENHO TÉCNICO
    { codigo: '32.01', descricao: 'Serviços de desenho técnico' },
    // GRUPO 33 — DESEMBARAÇO ADUANEIRO
    { codigo: '33.01', descricao: 'Serviços de desembaraço aduaneiro, comissários, despachantes e congêneres' },
    // GRUPO 34 — INVESTIGAÇÕES PARTICULARES
    { codigo: '34.01', descricao: 'Serviços de investigações particulares, detetives e congêneres' },
    // GRUPO 35 — REPORTAGEM, ASSESSORIA DE IMPRENSA
    { codigo: '35.01', descricao: 'Serviços de reportagem, assessoria de imprensa, jornalismo e relações públicas' },
    // GRUPO 36 — METEOROLOGIA
    { codigo: '36.01', descricao: 'Serviços de meteorologia' },
    // GRUPO 37 — ARTISTAS, ATLETAS, MODELOS
    { codigo: '37.01', descricao: 'Serviços de artistas, atletas, modelos e manequins' },
    // GRUPO 38 — MUSEOLOGIA
    { codigo: '38.01', descricao: 'Serviços de museologia' },
    // GRUPO 39 — OURIVESARIA E LAPIDAÇÃO
    { codigo: '39.01', descricao: 'Serviços de ourivesaria e lapidação (quando o material for fornecido pelo tomador do serviço)' },
    // GRUPO 40 — OBRAS DE ARTE SOB ENCOMENDA
    { codigo: '40.01', descricao: 'Obras de arte sob encomenda' },
  ];

  console.log(`Populando ${servicos.length} serviços da LC 116/2003...`);

  for (const s of servicos) {
    await prisma.lc116Servico.upsert({
      where: { codigo: s.codigo },
      create: s,
      update: { descricao: s.descricao },
    });
  }
  console.log('✅ LC 116/2003 populada com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
