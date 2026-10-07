/**
 * Seed: popula class_trib_ibs com todos os 170 códigos NT 2025.002 v1.70 (LC 214/2025).
 * Formato cClassTrib: 6 dígitos — primeiros 3 = CST IBS/CBS, últimos 3 = subdivisão.
 *
 * Execute via:
 *   npx ts-node packages/db/prisma/seed-class-trib-ibs.ts
 *
 * Idempotente — usa upsert por codigo (UNIQUE).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CODIGOS: Array<{ codigo: string; cst: string; descricao: string; grupo: string }> = [
  // ── CST 000 — Tributado integralmente ────────────────────────────────────
  { codigo: '000001', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - operacao interna' },
  { codigo: '000002', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - operacao interestadual' },
  { codigo: '000003', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - importacao' },
  { codigo: '000004', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - servicos prestados no pais' },
  { codigo: '000005', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - servicos tomados do exterior' },
  { codigo: '000006', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - construcao civil' },
  { codigo: '000007', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - e-commerce / marketplace' },
  { codigo: '000008', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - consignacao mercantil' },
  { codigo: '000009', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - venda a consumidor final' },
  { codigo: '000010', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - remessa interestadual para industrializacao' },
  { codigo: '000011', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - devolucao de mercadoria' },
  { codigo: '000012', cst: '000', grupo: 'TRIBUTADO',          descricao: 'Tributado integralmente - bonificacao e brinde' },

  // ── CST 100 — Crédito presumido (LC 214/2025 art. 164) ──────────────────
  { codigo: '100001', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - produtor rural pessoa fisica' },
  { codigo: '100002', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - cooperativa agropecuaria' },
  { codigo: '100003', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - exportacao de mercadorias' },
  { codigo: '100004', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - atividades desportivas' },
  { codigo: '100005', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - aquisicao sem direito a credito' },
  { codigo: '100006', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - pessoa fisica nao contribuinte' },
  { codigo: '100007', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - Simples Nacional' },
  { codigo: '100008', cst: '100', grupo: 'CREDITO_PRESUMIDO',  descricao: 'Credito presumido - outros' },

  // ── CST 200 — Alíquota reduzida (LC 214/2025 arts. 127-132) ─────────────
  { codigo: '200001', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - base de calculo reduzida' },
  { codigo: '200002', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - aliquota diferenciada por produto' },
  { codigo: '200003', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - cesta basica nacional (50%)' },
  { codigo: '200004', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - medicamentos (60%)' },
  { codigo: '200005', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - educacao basica e superior (60%)' },
  { codigo: '200006', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - saude (60%)' },
  { codigo: '200007', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - transporte coletivo de passageiros (60%)' },
  { codigo: '200008', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - produtos agropecuarios (60%)' },
  { codigo: '200009', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - insumos agropecuarios (60%)' },
  { codigo: '200010', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - producoes culturais nacionais (60%)' },
  { codigo: '200011', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - atividades desportivas (60%)' },
  { codigo: '200012', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - servicos financeiros' },
  { codigo: '200013', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - planos de saude' },
  { codigo: '200014', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - seguros pessoais' },
  { codigo: '200015', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - locacao de imoveis residenciais' },
  { codigo: '200016', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - saneamento e residuos solidos (60%)' },
  { codigo: '200017', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - dispositivos medicos (60%)' },
  { codigo: '200018', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - acessibilidade para pessoas com deficiencia' },
  { codigo: '200019', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - producao jornalistica e audiovisual (60%)' },
  { codigo: '200020', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - outros' },
  { codigo: '200021', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - cooperativas de credito e financeiras' },
  { codigo: '200022', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - hoteis e pousadas (turismo interno)' },
  { codigo: '200023', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - restaurantes e alimentacao coletiva' },
  { codigo: '200024', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - tele saude e saude digital (60%)' },
  { codigo: '200025', cst: '200', grupo: 'REDUZIDA',           descricao: 'Aliquota reduzida - tecnologia assistiva para PcD (60%)' },

  // ── CST 300 — Alíquota zero (LC 214/2025 arts. 128-131) ─────────────────
  { codigo: '300001', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - exportacao de mercadorias' },
  { codigo: '300002', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - exportacao de servicos' },
  { codigo: '300003', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - cesta basica nacional (alimentos)' },
  { codigo: '300004', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - medicamentos para doencas raras/cronicas' },
  { codigo: '300005', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - dispositivos medicos de uso individual' },
  { codigo: '300006', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - produtos de higiene menstrual' },
  { codigo: '300007', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - automacao e robotica para PcD' },
  { codigo: '300008', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - Zona Franca de Manaus (operacoes internas)' },
  { codigo: '300009', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - servicos prestados por ME/EPP (Simples)' },
  { codigo: '300010', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - turismo receptivo estrangeiro' },
  { codigo: '300011', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - remessas ao exterior (servicos)' },
  { codigo: '300999', cst: '300', grupo: 'ZERO',               descricao: 'Aliquota zero - outros' },

  // ── CST 400 — Isenção (LC 214/2025 arts. 133-149) ───────────────────────
  { codigo: '400001', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - isencao prevista em lei complementar' },
  { codigo: '400002', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - Zona Franca de Manaus e Areas de Livre Comercio' },
  { codigo: '400003', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - eventos culturais e artisticos oficiais' },
  { codigo: '400004', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - missoes diplomaticas e consulares' },
  { codigo: '400005', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - pequenos produtores rurais (limite anual)' },
  { codigo: '400006', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - operacoes realizadas pela Uniao, Estados e Municipios' },
  { codigo: '400007', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - operacoes com ouro como ativo financeiro' },
  { codigo: '400008', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - operacoes internas com gas natural canalizado' },
  { codigo: '400009', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - tratamento especial para microempresas' },
  { codigo: '400999', cst: '400', grupo: 'ISENCAO',            descricao: 'Isento - outras hipoteses previstas em lei' },

  // ── CST 410 — Imunidade constitucional (CF/88 art. 150, VI) ─────────────
  { codigo: '410001', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - exportacao' },
  { codigo: '410002', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - templos de qualquer culto' },
  { codigo: '410003', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - partidos politicos e entidades sindicais' },
  { codigo: '410004', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - instituicoes de educacao e assistencia social s/ fins lucrativos' },
  { codigo: '410005', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - livros, jornais e periodicos' },
  { codigo: '410006', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - operacoes com ouro (CF art. 153 §5)' },
  { codigo: '410007', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - entidades beneficentes de assistencia social' },
  { codigo: '410999', cst: '410', grupo: 'IMUNIDADE',          descricao: 'Imunidade - outras hipoteses constitucionais' },

  // ── CST 500 — Não incidência ─────────────────────────────────────────────
  { codigo: '500001', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - operacao nao enquadrada como fato gerador' },
  { codigo: '500002', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - vendas canceladas e devolucoes' },
  { codigo: '500003', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - transferencia de estabelecimento' },
  { codigo: '500004', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - integralizacao de capital com bens' },
  { codigo: '500005', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - operacoes com moeda nacional e estrangeira' },
  { codigo: '500006', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - alienacao de estabelecimento empresarial' },
  { codigo: '500007', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - fusao, cisao, incorporacao de empresas' },
  { codigo: '500008', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - contratos de arrendamento mercantil (leasing)' },
  { codigo: '500009', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - aquisicao de bem proprio por nao contribuinte' },
  { codigo: '500999', cst: '500', grupo: 'NAO_INCIDENCIA',     descricao: 'Nao incidencia - outros' },

  // ── CST 510 — Diferimento (LC 214/2025 arts. 112-120) ───────────────────
  { codigo: '510001', cst: '510', grupo: 'DIFERIMENTO',        descricao: 'Diferimento total' },
  { codigo: '510002', cst: '510', grupo: 'DIFERIMENTO',        descricao: 'Diferimento parcial' },
  { codigo: '510003', cst: '510', grupo: 'DIFERIMENTO',        descricao: 'Diferimento - gado em pe (pecuaria)' },
  { codigo: '510004', cst: '510', grupo: 'DIFERIMENTO',        descricao: 'Diferimento - produtos primarios nao beneficiados' },
  { codigo: '510005', cst: '510', grupo: 'DIFERIMENTO',        descricao: 'Diferimento - industrializacao por conta de terceiros' },
  { codigo: '510006', cst: '510', grupo: 'DIFERIMENTO',        descricao: 'Diferimento - operacoes internas com sucatas e residuos' },

  // ── CST 550 — Suspensão ──────────────────────────────────────────────────
  { codigo: '550001', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - regime especial autorizado' },
  { codigo: '550002', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - exportacao temporaria' },
  { codigo: '550003', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - industrializacao por encomenda' },
  { codigo: '550004', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - entrega em consignacao' },
  { codigo: '550005', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - bens destinados a manutencao/reparo em garantia' },
  { codigo: '550006', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - operacao com ativo imobilizado (transf. interestadual)' },
  { codigo: '550007', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - demonstracao / mostruario / feira' },
  { codigo: '550999', cst: '550', grupo: 'SUSPENSAO',          descricao: 'Suspensao - outros' },

  // ── CST 600 — Substituição tributária — retida pelo substituto ───────────
  { codigo: '600001', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - operacao com ST retida pelo substituto (geral)' },
  { codigo: '600002', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - combustiveis e derivados de petroleo' },
  { codigo: '600003', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - cigarros e produtos do fumo' },
  { codigo: '600004', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - bebidas alcoolicas (cerveja, vinho, destilados)' },
  { codigo: '600005', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - bebidas nao alcoolicas (refrigerantes, aguas)' },
  { codigo: '600006', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - produtos farmaceuticos' },
  { codigo: '600007', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - cimento de qualquer especie' },
  { codigo: '600008', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - tintas, vernizes e outros produtos da industria quimica' },
  { codigo: '600009', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - autopecas e componentes automotivos' },
  { codigo: '600010', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - pneus e camaras de ar' },
  { codigo: '600011', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - eletrodomesticos de linha branca' },
  { codigo: '600012', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - produtos eletronicos e informatica' },
  { codigo: '600013', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - materiais de construcao e ferragens' },
  { codigo: '600014', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - plasticos e artefatos de plastico' },
  { codigo: '600015', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - papel, papelao e suas obras' },
  { codigo: '600016', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - cosmeticos, perfumaria e higiene pessoal' },
  { codigo: '600017', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - calcados e artefatos de couro' },
  { codigo: '600018', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - vestuario e acessorios texteis' },
  { codigo: '600019', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - racao para animais domesticos' },
  { codigo: '600020', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - ferramentas e utensilios' },
  { codigo: '600021', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - equipamentos agricolas e pecuarios' },
  { codigo: '600022', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - defensivos agricolas e fertilizantes' },
  { codigo: '600023', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - motores e pecas para maquinas agricolas' },
  { codigo: '600024', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - veiculos automotores (montadoras/fabricantes)' },
  { codigo: '600025', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - motos e ciclomotores' },
  { codigo: '600026', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - pneumaticos e rodas' },
  { codigo: '600027', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - colchoes, travesseiros e artigos de cama/mesa/banho' },
  { codigo: '600028', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - moveis e mobiliario' },
  { codigo: '600029', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - lampadas, reatores e chaves dimmer' },
  { codigo: '600030', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - baterias e acumuladores' },
  { codigo: '600031', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - instrumentos musicais' },
  { codigo: '600032', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - artigos esportivos e de lazer' },
  { codigo: '600033', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - brinquedos e jogos' },
  { codigo: '600034', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - artigos de papelaria e escritorio' },
  { codigo: '600035', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - borrachas e artefatos de borracha' },
  { codigo: '600036', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - vidros e cristais' },
  { codigo: '600037', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - ceramica e porcelana' },
  { codigo: '600038', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - equipamentos de seguranca e protecao individual' },
  { codigo: '600039', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - implementos rodoviarios e semi-reboques' },
  { codigo: '600040', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - equipamentos para frigorificacao e refrigeracao' },
  { codigo: '600041', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - produtos de mineracao (carvao mineral, minerios)' },
  { codigo: '600043', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - metais nao ferrosos (aluminio, cobre, zinco)' },
  { codigo: '600044', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - produtos texteis (fios, tecidos, malhas)' },
  { codigo: '600045', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - maquinas e equipamentos industriais' },
  { codigo: '600046', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - equipamentos de telecomunicacoes' },
  { codigo: '600999', cst: '600', grupo: 'SUBSTITUICAO_TRIB',  descricao: 'ST - outros setores definidos em convenio/protocolo CONFAZ' },

  // ── CST 610 — Substituição tributária — cobrada anteriormente ───────────
  { codigo: '610001', cst: '610', grupo: 'ST_COBRADA_ANT',     descricao: 'ST cobrada anteriormente - operacao posterior ao fato gerador ST' },
  { codigo: '610002', cst: '610', grupo: 'ST_COBRADA_ANT',     descricao: 'ST cobrada anteriormente - combustiveis' },
  { codigo: '610003', cst: '610', grupo: 'ST_COBRADA_ANT',     descricao: 'ST cobrada anteriormente - autopecas e pneus' },
  { codigo: '610004', cst: '610', grupo: 'ST_COBRADA_ANT',     descricao: 'ST cobrada anteriormente - produtos farmaceuticos' },
  { codigo: '610999', cst: '610', grupo: 'ST_COBRADA_ANT',     descricao: 'ST cobrada anteriormente - outros setores' },

  // ── CST 700 — Crédito presumido / Cashback (LC 214/2025 art. 164) ────────
  { codigo: '700001', cst: '700', grupo: 'CASHBACK',           descricao: 'Credito presumido - exportacao de mercadorias e servicos' },
  { codigo: '700002', cst: '700', grupo: 'CASHBACK',           descricao: 'Credito presumido - aquisicao de produtor rural PF' },
  { codigo: '700003', cst: '700', grupo: 'CASHBACK',           descricao: 'Credito presumido - cooperativa agropecuaria (vendas a cooperados)' },
  { codigo: '700004', cst: '700', grupo: 'CASHBACK',           descricao: 'Credito presumido - opcao pelo regime especial de tributacao' },
  { codigo: '700005', cst: '700', grupo: 'CASHBACK',           descricao: 'Credito presumido - microempresas e EPP (Simples Nacional)' },
  { codigo: '700006', cst: '700', grupo: 'CASHBACK',           descricao: 'Credito presumido - pessoa fisica empreendedora rural' },
  { codigo: '700007', cst: '700', grupo: 'CASHBACK',           descricao: 'Cashback - transferencia a consumidor final renda ate 2 SM' },
  { codigo: '700008', cst: '700', grupo: 'CASHBACK',           descricao: 'Cashback - energia eletrica residencial baixa renda' },
  { codigo: '700009', cst: '700', grupo: 'CASHBACK',           descricao: 'Cashback - gas de cozinha residencial' },
  { codigo: '700999', cst: '700', grupo: 'CASHBACK',           descricao: 'Credito presumido - outros' },

  // ── CST 900 — Regime especial ────────────────────────────────────────────
  { codigo: '900001', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - Simples Nacional (Microempresa/EPP)' },
  { codigo: '900002', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - MEI - Microempreendedor Individual' },
  { codigo: '900003', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - producao agroindustrial integrada' },
  { codigo: '900004', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - servicos de construcao civil (excecao)' },
  { codigo: '900005', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - operacao financeira e securitizacao' },
  { codigo: '900006', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - regime regressivo de transicao (2027-2033)' },
  { codigo: '900007', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - REIDI (infraestrutura)' },
  { codigo: '900008', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - RECOF (industria exportadora)' },
  { codigo: '900009', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - ZPE - Zona de Processamento de Exportacoes' },
  { codigo: '900999', cst: '900', grupo: 'REGIME_ESPECIAL',    descricao: 'Regime especial - outros nao classificados' },
];

async function main() {
  console.log(`Iniciando seed de ${CODIGOS.length} códigos cClassTrib (NT 2025.002 v1.70)...`);

  let inseridos = 0;
  for (const c of CODIGOS) {
    await (prisma as any).classTribIbs.upsert({
      where:  { codigo: c.codigo },
      update: { descricao: c.descricao, grupo: c.grupo, ativo: true },
      create: { codigo: c.codigo, cst: c.cst, descricao: c.descricao, grupo: c.grupo, ativo: true },
    });
    inseridos++;
  }

  const total = await (prisma as any).classTribIbs.count();
  console.log(`✓ Seed concluído. ${inseridos} upserts. Total na tabela: ${total} códigos.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
