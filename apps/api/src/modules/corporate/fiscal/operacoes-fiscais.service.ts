import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────

export interface DeterminarOperacaoParams {
  tipo?:                   'ENTRADA' | 'SAIDA';
  destinacao?:             string;
  /** @deprecated Use ramoAtividade + taxRegimeFornecedor. Mantido para compatibilidade com regras customizadas no BD. */
  tipoFornecedor?:         string;
  // Novos campos (Fase 2) — substituem tipoFornecedor nas entradas
  ramoAtividade?:          string;   // ENTRADAS: ramo de atividade do fornecedor (INDUSTRIA, COMERCIO, PRESTADOR_SERVICO…)
  taxRegimeFornecedor?:    string;   // ENTRADAS: regime tributário do fornecedor (SIMPLES_NACIONAL, LUCRO_REAL…)
  tipoCliente?:            string;   // SAÍDAS: tipo do destinatário
  ufFornecedor?:           string;
  ufCliente?:              string;   // SAÍDAS: UF do destinatário
  ufEmpresa?:              string;
  temST?:                  boolean;
  stRetida?:               boolean;
  finalidade?:             string;
  freteContaDestinatario?: boolean;
  taxRegimeEmpresa?:       string;
}

export interface ResultadoOperacaoFiscal {
  operacaoId:          string;
  codigo:              string;
  descricao:           string;
  cfop:                string;
  cstIcms:             string;
  cstIpi:              string;
  cstPis:              string;
  cstCofins:           string;
  // créditos (entradas)
  creditaIcms:         boolean;
  creditaIpi:          boolean;
  creditaPisCofins:    boolean;
  icmsSimplesPCredSN:  boolean;
  ciap:                boolean;
  pisCofins24x:        boolean;
  // retenções (NFS-e tomadas)
  retencaoIss:         boolean;
  retencaoFederal:     boolean;
  retencaoInss:        boolean;
  // débitos (saídas) — derivados dos CSTs
  debitaIcms:          boolean;
  debitaIpi:           boolean;
  debitaPisCofins:     boolean;
  contaDebitoCode:     string | null;
  intraestadual:       boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers derivados de CST
// ──────────────────────────────────────────────────────────────────────────────

function deveDebitarIcms(cstIcms: string): boolean {
  // Exonerados: 040 isento, 041 NT, 050 suspensão, 051 diferimento, 060 ST já recolhida, 400 SN NT, 500 SN ST retida
  const exonerados = ['040','041','050','051','060','300','400','500'];
  return !exonerados.includes(cstIcms);
}

function deveDebitarIpi(cstIpi: string): boolean {
  // Só CST 50 (saída tributada) gera débito de IPI
  return cstIpi === '50';
}

function deveDebitarPisCofins(cstPis: string): boolean {
  // CSTs 01, 02, 03 = tributável; demais = isento/zero/suspensão
  return ['01','02','03'].includes(cstPis);
}

// ──────────────────────────────────────────────────────────────────────────────
// Resolver: converte ramoAtividade + taxRegimeFornecedor → tipoFornecedor efetivo
// para manter compatibilidade com REGRAS_PADRAO e regras customizadas no BD.
//
// Lógica:
//   - Fornecedor Simples Nacional (qualquer ramo) → 'SIMPLES_NACIONAL'
//     (sem crédito ICMS via pCredSN normal; usa alíquota pCredSN do DAS)
//   - Demais: usa o código do ramo diretamente (INDUSTRIA, COMERCIO, etc.)
//   - Fallback: tipoFornecedor legado (campo ainda presente no BD durante migração)
// ──────────────────────────────────────────────────────────────────────────────
export function resolveEfetivaTipoFornecedor(
  ramoAtividade?: string,
  taxRegimeFornecedor?: string,
  tipoFornecedorLegado?: string,
): string | undefined {
  if (ramoAtividade || taxRegimeFornecedor) {
    if (taxRegimeFornecedor === 'SIMPLES_NACIONAL') return 'SIMPLES_NACIONAL';
    return ramoAtividade;
  }
  return tipoFornecedorLegado;
}

// ──────────────────────────────────────────────────────────────────────────────
// Regras padrão do sistema (seed)
// ──────────────────────────────────────────────────────────────────────────────

const REGRAS_PADRAO: any[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ENTRADAS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── MATÉRIA-PRIMA / INSUMO / GGF / EMBALAGEM / COMPONENTE ────────────────
  { tipo:'ENTRADA', codigo:'ENT-MP-IND-INTRA-NST', descricao:'Compra MP/Insumo — Indústria/Equiparado — Mesmo Estado — Sem ST',     destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:['INDUSTRIA','ATACADISTA_EQUIPARADO'], intraestadual:true,  temST:false, cfop:'1101', cstIcms:'000', cstIpi:'00', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:true,  creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:100 },
  { tipo:'ENTRADA', codigo:'ENT-MP-IND-INTER-NST', descricao:'Compra MP/Insumo — Indústria/Equiparado — Outro Estado — Sem ST',     destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:['INDUSTRIA','ATACADISTA_EQUIPARADO'], intraestadual:false, temST:false, cfop:'2101', cstIcms:'000', cstIpi:'00', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:true,  creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:100 },
  { tipo:'ENTRADA', codigo:'ENT-MP-COM-INTRA-NST',  descricao:'Compra MP/Insumo — Comércio — Mesmo Estado — Sem ST',                destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:['COMERCIO'],                            intraestadual:true,  temST:false, cfop:'1101', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:90  },
  { tipo:'ENTRADA', codigo:'ENT-MP-COM-INTER-NST',  descricao:'Compra MP/Insumo — Comércio — Outro Estado — Sem ST',                destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:['COMERCIO'],                            intraestadual:false, temST:false, cfop:'2101', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:90  },
  { tipo:'ENTRADA', codigo:'ENT-MP-SIM-INTRA-NST',  descricao:'Compra MP/Insumo — Simples Nacional — Mesmo Estado — Sem ST',        destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:['SIMPLES_NACIONAL','MEI'],               intraestadual:true,  temST:false, cfop:'1101', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:false, creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:true,  ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:90  },
  { tipo:'ENTRADA', codigo:'ENT-MP-SIM-INTER-NST',  descricao:'Compra MP/Insumo — Simples Nacional — Outro Estado — Sem ST',        destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:['SIMPLES_NACIONAL','MEI'],               intraestadual:false, temST:false, cfop:'2101', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:false, creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:true,  ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:90  },
  { tipo:'ENTRADA', codigo:'ENT-MP-TODOS-INTRA-ST',  descricao:'Compra MP/Insumo — Qualquer fornecedor — Mesmo Estado — Com ST',    destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:null,                                    intraestadual:true,  temST:true,  cfop:'1401', cstIcms:'010', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:110 },
  { tipo:'ENTRADA', codigo:'ENT-MP-TODOS-INTER-ST',  descricao:'Compra MP/Insumo — Qualquer fornecedor — Outro Estado — Com ST',    destinacao:['MATERIA_PRIMA','INSUMO_PRODUCAO','GGF','EMBALAGEM','COMPONENTE'], tipoFornecedor:null,                                    intraestadual:false, temST:true,  cfop:'2401', cstIcms:'010', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.4.01', prioridade:110 },

  // ── PRODUTO PARA REVENDA ──────────────────────────────────────────────────
  { tipo:'ENTRADA', codigo:'ENT-REV-IND-INTRA-NST', descricao:'Compra Revenda — Indústria/Equiparado — Mesmo Estado — Sem ST',     destinacao:['PRODUTO_REVENDA'], tipoFornecedor:['INDUSTRIA','ATACADISTA_EQUIPARADO'], intraestadual:true,  temST:false, cfop:'1102', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.3.01', prioridade:100 },
  { tipo:'ENTRADA', codigo:'ENT-REV-IND-INTER-NST', descricao:'Compra Revenda — Indústria/Equiparado — Outro Estado — Sem ST',     destinacao:['PRODUTO_REVENDA'], tipoFornecedor:['INDUSTRIA','ATACADISTA_EQUIPARADO'], intraestadual:false, temST:false, cfop:'2102', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.3.01', prioridade:100 },
  { tipo:'ENTRADA', codigo:'ENT-REV-COM-INTRA-NST', descricao:'Compra Revenda — Comércio — Mesmo Estado — Sem ST',                 destinacao:['PRODUTO_REVENDA'], tipoFornecedor:['COMERCIO'],                            intraestadual:true,  temST:false, cfop:'1102', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.3.01', prioridade:90  },
  { tipo:'ENTRADA', codigo:'ENT-REV-COM-INTER-NST', descricao:'Compra Revenda — Comércio — Outro Estado — Sem ST',                 destinacao:['PRODUTO_REVENDA'], tipoFornecedor:['COMERCIO'],                            intraestadual:false, temST:false, cfop:'2102', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.3.01', prioridade:90  },
  { tipo:'ENTRADA', codigo:'ENT-REV-SIM-TODOS-NST', descricao:'Compra Revenda — Simples Nacional — Sem ST',                       destinacao:['PRODUTO_REVENDA'], tipoFornecedor:['SIMPLES_NACIONAL','MEI'],               intraestadual:null,  temST:false, cfop:'1102', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:false, creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:true,  ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.3.01', prioridade:90  },
  { tipo:'ENTRADA', codigo:'ENT-REV-TODOS-INTRA-ST',descricao:'Compra Revenda — Qualquer fornecedor — Mesmo Estado — Com ST',     destinacao:['PRODUTO_REVENDA'], tipoFornecedor:null,                                    intraestadual:true,  temST:true,  cfop:'1403', cstIcms:'060', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:false, creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.3.01', prioridade:110 },
  { tipo:'ENTRADA', codigo:'ENT-REV-TODOS-INTER-ST',descricao:'Compra Revenda — Qualquer fornecedor — Outro Estado — Com ST',     destinacao:['PRODUTO_REVENDA'], tipoFornecedor:null,                                    intraestadual:false, temST:true,  cfop:'2403', cstIcms:'060', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:false, creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.1.3.01', prioridade:110 },

  // ── MATERIAL DE USO E CONSUMO ─────────────────────────────────────────────
  { tipo:'ENTRADA', codigo:'ENT-UC-TODOS-INTRA', descricao:'Compra Uso e Consumo — Qualquer fornecedor — Mesmo Estado',     destinacao:['MATERIAL_USO_CONSUMO'], tipoFornecedor:null, intraestadual:true,  temST:null, cfop:'1556', cstIcms:'040', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:80  },
  { tipo:'ENTRADA', codigo:'ENT-UC-TODOS-INTER', descricao:'Compra Uso e Consumo — Qualquer fornecedor — Outro Estado',     destinacao:['MATERIAL_USO_CONSUMO'], tipoFornecedor:null, intraestadual:false, temST:null, cfop:'2556', cstIcms:'040', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:80  },

  // ── ATIVO IMOBILIZADO ─────────────────────────────────────────────────────
  { tipo:'ENTRADA', codigo:'ENT-ATIVO-TODOS-INTRA', descricao:'Compra Ativo Imobilizado — Mesmo Estado', destinacao:['IMOBILIZADO'], tipoFornecedor:null, intraestadual:true,  temST:null, cfop:'1551', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:true,  pisCofins24x:true,  retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.2.1.01', prioridade:80  },
  { tipo:'ENTRADA', codigo:'ENT-ATIVO-TODOS-INTER', descricao:'Compra Ativo Imobilizado — Outro Estado', destinacao:['IMOBILIZADO'], tipoFornecedor:null, intraestadual:false, temST:null, cfop:'2551', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:true,  pisCofins24x:true,  retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.2.1.01', prioridade:80  },

  // ── CT-e FRETE ────────────────────────────────────────────────────────────
  { tipo:'ENTRADA', codigo:'ENT-FRETE-FOB-INTRA', descricao:'CT-e FOB — Destinatário paga — Mesmo Estado — Crédito ICMS+PIS/COF', destinacao:['FRETE'], tipoFornecedor:null, intraestadual:true,  temST:null, freteContaDestinatario:true,  cfop:'1352', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.2.01', prioridade:150 },
  { tipo:'ENTRADA', codigo:'ENT-FRETE-FOB-INTER', descricao:'CT-e FOB — Destinatário paga — Outro Estado — Crédito ICMS+PIS/COF', destinacao:['FRETE'], tipoFornecedor:null, intraestadual:false, temST:null, freteContaDestinatario:true,  cfop:'2352', cstIcms:'000', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:true,  creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.2.01', prioridade:150 },
  { tipo:'ENTRADA', codigo:'ENT-FRETE-CIF-INTRA', descricao:'CT-e CIF — Emitente paga — Mesmo Estado — Sem Crédito',             destinacao:['FRETE'], tipoFornecedor:null, intraestadual:true,  temST:null, freteContaDestinatario:false, cfop:'1352', cstIcms:'040', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.2.01', prioridade:150 },
  { tipo:'ENTRADA', codigo:'ENT-FRETE-CIF-INTER', descricao:'CT-e CIF — Emitente paga — Outro Estado — Sem Crédito',             destinacao:['FRETE'], tipoFornecedor:null, intraestadual:false, temST:null, freteContaDestinatario:false, cfop:'2352', cstIcms:'040', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.2.01', prioridade:150 },
  { tipo:'ENTRADA', codigo:'ENT-FRETE-GERAL-INTRA', descricao:'CT-e Frete — Modalidade não informada — Mesmo Estado',            destinacao:['FRETE'], tipoFornecedor:null, intraestadual:true,  temST:null, freteContaDestinatario:null,  cfop:'1352', cstIcms:'000', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.2.01', prioridade:120 },
  { tipo:'ENTRADA', codigo:'ENT-FRETE-GERAL-INTER', descricao:'CT-e Frete — Modalidade não informada — Outro Estado',            destinacao:['FRETE'], tipoFornecedor:null, intraestadual:false, temST:null, freteContaDestinatario:null,  cfop:'2352', cstIcms:'000', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.2.01', prioridade:120 },

  // ── NFS-e TOMADA ──────────────────────────────────────────────────────────
  { tipo:'ENTRADA', codigo:'ENT-SERV-LUCROREAL',  descricao:'NFS-e Tomada — Lucro Real — Crédito PIS/COFINS + Retenção Federal',          destinacao:['SERVICO_TOMADO'], tipoFornecedor:null, intraestadual:null, temST:null, cfop:'1933', cstIcms:'041', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:false, creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:true,  retencaoFederal:true,  retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:130, regimeTributario:'LUCRO_REAL'     },
  { tipo:'ENTRADA', codigo:'ENT-SERV-PRESUMIDO',  descricao:'NFS-e Tomada — Lucro Presumido — Sem Crédito PIS/COFINS + Retenção Federal', destinacao:['SERVICO_TOMADO'], tipoFornecedor:null, intraestadual:null, temST:null, cfop:'1933', cstIcms:'041', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:true,  retencaoFederal:true,  retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:130, regimeTributario:'LUCRO_PRESUMIDO'},
  { tipo:'ENTRADA', codigo:'ENT-SERV-SIMPLES',    descricao:'NFS-e Tomada — Simples Nacional do Prestador — Sem Crédito + Retenção ISS',   destinacao:['SERVICO_TOMADO'], tipoFornecedor:['SIMPLES_NACIONAL','MEI'], intraestadual:null, temST:null, cfop:'1933', cstIcms:'041', cstIpi:'49', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:true,  retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:140 },
  { tipo:'ENTRADA', codigo:'ENT-SERV-MOB-INSS',   descricao:'NFS-e Tomada — Cessão de Mão de Obra — Retenção INSS 11%',                   destinacao:['SERVICO_TOMADO'], tipoFornecedor:null, intraestadual:null, temST:null, cfop:'1933', cstIcms:'041', cstIpi:'49', cstPis:'50', cstCofins:'50', creditaIcms:false, creditaIpi:false, creditaPisCofins:true,  icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:true,  retencaoFederal:true,  retencaoInss:true,  contaDebitoCode:'3.2.1.01', prioridade:135 },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAÍDAS — Lucro Real / Lucro Presumido (regimeTributario: null = ambos)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── PRODUTO INDUSTRIALIZADO ────────────────────────────────────────────────
  // Contribuinte ICMS (empresa tributada normalmente)
  { tipo:'SAIDA', codigo:'SAI-IND-CONT-INTRA',       descricao:'Venda Produto Industrial — Contribuinte — Mesmo Estado',              destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE',          intraestadual:true,  temST:false, cfop:'5101', cstIcms:'000', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  { tipo:'SAIDA', codigo:'SAI-IND-CONT-INTER',        descricao:'Venda Produto Industrial — Contribuinte — Outro Estado',              destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE',          intraestadual:false, temST:false, cfop:'6101', cstIcms:'000', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  // Contribuinte Simples Nacional
  { tipo:'SAIDA', codigo:'SAI-IND-CSIMPLES-INTRA',   descricao:'Venda Produto Industrial — Contribuinte Simples — Mesmo Estado',       destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE_SIMPLES',  intraestadual:true,  temST:false, cfop:'5101', cstIcms:'000', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  { tipo:'SAIDA', codigo:'SAI-IND-CSIMPLES-INTER',   descricao:'Venda Produto Industrial — Contribuinte Simples — Outro Estado',       destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE_SIMPLES',  intraestadual:false, temST:false, cfop:'6101', cstIcms:'000', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  // Não Contribuinte (PF ou empresa sem IE)
  { tipo:'SAIDA', codigo:'SAI-IND-NCONT-INTRA',      descricao:'Venda Produto Industrial — Não Contribuinte — Mesmo Estado',           destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'NAO_CONTRIBUINTE',      intraestadual:true,  temST:false, cfop:'5102', cstIcms:'000', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  { tipo:'SAIDA', codigo:'SAI-IND-NCONT-INTER',      descricao:'Venda Produto Industrial — Não Contribuinte — Outro Estado (DIFAL)',   destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'NAO_CONTRIBUINTE',      intraestadual:false, temST:false, cfop:'6108', cstIcms:'000', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  // Com ST (emitente recolhe)
  { tipo:'SAIDA', codigo:'SAI-IND-CONT-INTRA-ST',    descricao:'Venda Produto Industrial — Contribuinte — Mesmo Estado — Com ST',      destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE',          intraestadual:true,  temST:true,  cfop:'5401', cstIcms:'010', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:110 },
  { tipo:'SAIDA', codigo:'SAI-IND-CONT-INTER-ST',    descricao:'Venda Produto Industrial — Contribuinte — Outro Estado — Com ST',      destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE',          intraestadual:false, temST:true,  cfop:'6401', cstIcms:'010', cstIpi:'50', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:110 },

  // ── PRODUTO REVENDA ────────────────────────────────────────────────────────
  { tipo:'SAIDA', codigo:'SAI-REV-CONT-INTRA',       descricao:'Venda Mercadoria Revenda — Contribuinte — Mesmo Estado',               destinacao:['PRODUTO_REVENDA'], tipoCliente:'CONTRIBUINTE',          intraestadual:true,  temST:false, cfop:'5102', cstIcms:'000', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  { tipo:'SAIDA', codigo:'SAI-REV-CONT-INTER',        descricao:'Venda Mercadoria Revenda — Contribuinte — Outro Estado',               destinacao:['PRODUTO_REVENDA'], tipoCliente:'CONTRIBUINTE',          intraestadual:false, temST:false, cfop:'6102', cstIcms:'000', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  { tipo:'SAIDA', codigo:'SAI-REV-NCONT-INTRA',      descricao:'Venda Mercadoria Revenda — Não Contribuinte — Mesmo Estado',            destinacao:['PRODUTO_REVENDA'], tipoCliente:'NAO_CONTRIBUINTE',      intraestadual:true,  temST:false, cfop:'5102', cstIcms:'000', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  { tipo:'SAIDA', codigo:'SAI-REV-NCONT-INTER',      descricao:'Venda Mercadoria Revenda — Não Contribuinte — Outro Estado (DIFAL)',    destinacao:['PRODUTO_REVENDA'], tipoCliente:'NAO_CONTRIBUINTE',      intraestadual:false, temST:false, cfop:'6108', cstIcms:'000', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:100 },
  // ST já retida anteriormente (CST 060)
  { tipo:'SAIDA', codigo:'SAI-REV-CONT-INTRA-STRET', descricao:'Venda Mercadoria Revenda — Contribuinte — Mesmo Estado — ST Retida',   destinacao:['PRODUTO_REVENDA'], tipoCliente:'CONTRIBUINTE',          intraestadual:true,  temST:false, stRetida:true,  cfop:'5405', cstIcms:'060', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:120 },
  { tipo:'SAIDA', codigo:'SAI-REV-CONT-INTER-STRET', descricao:'Venda Mercadoria Revenda — Contribuinte — Outro Estado — ST Retida',   destinacao:['PRODUTO_REVENDA'], tipoCliente:'CONTRIBUINTE',          intraestadual:false, temST:false, stRetida:true,  cfop:'6404', cstIcms:'060', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:120 },

  // ── ATIVO IMOBILIZADO SAÍDA ────────────────────────────────────────────────
  { tipo:'SAIDA', codigo:'SAI-ATIVO-TODOS-INTRA', descricao:'Venda Ativo Imobilizado — Qualquer — Mesmo Estado',  destinacao:['IMOBILIZADO'], tipoCliente:null, intraestadual:true,  temST:null, cfop:'5551', cstIcms:'041', cstIpi:'99', cstPis:'06', cstCofins:'06', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.2.1.01', prioridade:80  },
  { tipo:'SAIDA', codigo:'SAI-ATIVO-TODOS-INTER', descricao:'Venda Ativo Imobilizado — Qualquer — Outro Estado',  destinacao:['IMOBILIZADO'], tipoCliente:null, intraestadual:false, temST:null, cfop:'6551', cstIcms:'041', cstIpi:'99', cstPis:'06', cstCofins:'06', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'1.2.1.01', prioridade:80  },

  // ── REMESSA E DEVOLUÇÃO DE COMPRA ─────────────────────────────────────────
  { tipo:'SAIDA', codigo:'SAI-REMESSA-IND-INTRA', descricao:'Remessa p/ Industrialização — Mesmo Estado — Diferimento ICMS',          destinacao:['PRODUTO_INDUSTRIALIZADO','MATERIA_PRIMA'], tipoCliente:null, intraestadual:true,  finalidade:'REMESSA',    cfop:'5901', cstIcms:'051', cstIpi:'55', cstPis:'09', cstCofins:'09', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:null, prioridade:90  },
  { tipo:'SAIDA', codigo:'SAI-REMESSA-IND-INTER', descricao:'Remessa p/ Industrialização — Outro Estado — Diferimento ICMS',          destinacao:['PRODUTO_INDUSTRIALIZADO','MATERIA_PRIMA'], tipoCliente:null, intraestadual:false, finalidade:'REMESSA',    cfop:'6901', cstIcms:'051', cstIpi:'55', cstPis:'09', cstCofins:'09', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:null, prioridade:90  },
  { tipo:'SAIDA', codigo:'SAI-DEV-COMPRA-INTRA',   descricao:'Devolução de Compra — Mesmo Estado',                                    destinacao:['PRODUTO_INDUSTRIALIZADO','PRODUTO_REVENDA','MATERIA_PRIMA'], tipoCliente:null, intraestadual:true,  finalidade:'DEVOLUCAO', cfop:'5201', cstIcms:'000', cstIpi:'53', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:null, prioridade:90  },
  { tipo:'SAIDA', codigo:'SAI-DEV-COMPRA-INTER',   descricao:'Devolução de Compra — Outro Estado',                                    destinacao:['PRODUTO_INDUSTRIALIZADO','PRODUTO_REVENDA','MATERIA_PRIMA'], tipoCliente:null, intraestadual:false, finalidade:'DEVOLUCAO', cfop:'6201', cstIcms:'000', cstIpi:'53', cstPis:'70', cstCofins:'70', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:null, prioridade:90  },

  // ── SERVIÇO EMITIDO (NFS-e) — Lucro Real ─────────────────────────────────
  { tipo:'SAIDA', codigo:'SAI-SERV-LR-INTRA',  descricao:'NFS-e Emitida — Lucro Real — Mesmo Estado — PIS/COFINS não-cumulativo',   destinacao:['SERVICO_EMITIDO'], tipoCliente:null, intraestadual:true,  cfop:'5933', cstIcms:'041', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:130, regimeTributario:'LUCRO_REAL'      },
  { tipo:'SAIDA', codigo:'SAI-SERV-LR-INTER',  descricao:'NFS-e Emitida — Lucro Real — Outro Estado',                              destinacao:['SERVICO_EMITIDO'], tipoCliente:null, intraestadual:false, cfop:'6933', cstIcms:'041', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:130, regimeTributario:'LUCRO_REAL'      },
  // Lucro Presumido
  { tipo:'SAIDA', codigo:'SAI-SERV-LP-INTRA',  descricao:'NFS-e Emitida — Lucro Presumido — Mesmo Estado — PIS/COFINS cumulativo',  destinacao:['SERVICO_EMITIDO'], tipoCliente:null, intraestadual:true,  cfop:'5933', cstIcms:'041', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:130, regimeTributario:'LUCRO_PRESUMIDO' },
  { tipo:'SAIDA', codigo:'SAI-SERV-LP-INTER',  descricao:'NFS-e Emitida — Lucro Presumido — Outro Estado',                         destinacao:['SERVICO_EMITIDO'], tipoCliente:null, intraestadual:false, cfop:'6933', cstIcms:'041', cstIpi:'99', cstPis:'01', cstCofins:'01', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:130, regimeTributario:'LUCRO_PRESUMIDO' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAÍDAS — Simples Nacional (regimeTributario: SIMPLES_NACIONAL)
  // CSOSN: 400 = NT pelo SN; 101 = tributada com pCredSN; 201 = ST com crédito
  // PIS/COFINS CST 07 = isento (incluído no DAS)
  // ═══════════════════════════════════════════════════════════════════════════
  { tipo:'SAIDA', codigo:'SAI-SN-IND-CONT-INTRA',      descricao:'Venda Produto Industrial — SN — Contribuinte — Mesmo Estado',         destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE',         intraestadual:true,  temST:false, cfop:'5101', cstIcms:'400', cstIpi:'99', cstPis:'07', cstCofins:'07', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:160, regimeTributario:'SIMPLES_NACIONAL' },
  { tipo:'SAIDA', codigo:'SAI-SN-IND-CONT-INTRA-CRED', descricao:'Venda Produto Industrial — SN com pCredSN — Contribuinte — Mesmo Est.', destinacao:['PRODUTO_INDUSTRIALIZADO'], tipoCliente:'CONTRIBUINTE_SIMPLES', intraestadual:true,  temST:false, cfop:'5101', cstIcms:'101', cstIpi:'99', cstPis:'07', cstCofins:'07', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:true,  ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:160, regimeTributario:'SIMPLES_NACIONAL' },
  { tipo:'SAIDA', codigo:'SAI-SN-REV-CONT-INTRA',      descricao:'Venda Mercadoria Revenda — SN — Contribuinte — Mesmo Estado',          destinacao:['PRODUTO_REVENDA'], tipoCliente:'CONTRIBUINTE',             intraestadual:true,  temST:false, cfop:'5102', cstIcms:'400', cstIpi:'99', cstPis:'07', cstCofins:'07', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:160, regimeTributario:'SIMPLES_NACIONAL' },
  { tipo:'SAIDA', codigo:'SAI-SN-NCONT-INTRA',         descricao:'Venda — SN — Não Contribuinte — Mesmo Estado',                        destinacao:['PRODUTO_INDUSTRIALIZADO','PRODUTO_REVENDA'], tipoCliente:'NAO_CONTRIBUINTE', intraestadual:true, temST:false, cfop:'5102', cstIcms:'400', cstIpi:'99', cstPis:'07', cstCofins:'07', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:160, regimeTributario:'SIMPLES_NACIONAL' },
  { tipo:'SAIDA', codigo:'SAI-SN-CONT-INTRA-ST',       descricao:'Venda — SN — Com ST — Mesmo Estado',                                  destinacao:['PRODUTO_INDUSTRIALIZADO','PRODUTO_REVENDA'], tipoCliente:'CONTRIBUINTE',     intraestadual:true, temST:true,  cfop:'5401', cstIcms:'201', cstIpi:'99', cstPis:'07', cstCofins:'07', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.1.1.01', prioridade:170, regimeTributario:'SIMPLES_NACIONAL' },
  { tipo:'SAIDA', codigo:'SAI-SN-SERV-INTRA',          descricao:'NFS-e Emitida — Simples Nacional — Mesmo Estado',                     destinacao:['SERVICO_EMITIDO'], tipoCliente:null, intraestadual:true, cfop:'5933', cstIcms:'400', cstIpi:'99', cstPis:'07', cstCofins:'07', creditaIcms:false, creditaIpi:false, creditaPisCofins:false, icmsSimplesPCredSN:false, ciap:false, pisCofins24x:false, retencaoIss:false, retencaoFederal:false, retencaoInss:false, contaDebitoCode:'3.2.1.01', prioridade:160, regimeTributario:'SIMPLES_NACIONAL' },
];

@Injectable()
export class OperacoesFiscaisService {
  constructor(private prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // MOTOR PRINCIPAL
  // ──────────────────────────────────────────────────────────────────────────
  async determinar(companyId: string, params: DeterminarOperacaoParams): Promise<ResultadoOperacaoFiscal | null> {
    const {
      tipo, destinacao, tipoCliente,
      ufFornecedor, ufCliente, ufEmpresa,
      temST, stRetida, finalidade, freteContaDestinatario, taxRegimeEmpresa,
    } = params;

    // Resolve tipoFornecedor efetivo: prioriza novos campos, fallback para legado
    const tipoFornecedor = resolveEfetivaTipoFornecedor(
      params.ramoAtividade,
      params.taxRegimeFornecedor,
      params.tipoFornecedor,
    );

    // Calcula intraestadual
    const ufContraparte = tipo === 'SAIDA' ? ufCliente : ufFornecedor;
    const intraestadual = ufContraparte && ufEmpresa
      ? ufContraparte.toUpperCase() === ufEmpresa.toUpperCase()
      : null;

    // ── Filtro comum (compatível com DB rows — valores escalares) ────────────
    const matchDb = (r: any): boolean => {
      if (tipo        && r.tipo          && r.tipo          !== tipo)        return false;
      if (destinacao  && r.destinacao    && r.destinacao    !== destinacao)  return false;
      if (tipo === 'SAIDA') {
        if (tipoCliente   && r.tipoCliente   && r.tipoCliente   !== tipoCliente)  return false;
      } else {
        if (tipoFornecedor && r.tipoFornecedor && r.tipoFornecedor !== tipoFornecedor) return false;
      }
      if (taxRegimeEmpresa && r.regimeTributario != null && r.regimeTributario !== taxRegimeEmpresa) return false;
      if (intraestadual !== null && r.intraestadual != null && r.intraestadual !== intraestadual) return false;
      if (temST         !== undefined && r.temST        != null && r.temST        !== temST)        return false;
      if (stRetida      !== undefined && r.stRetida     != null && r.stRetida     !== stRetida)      return false;
      if (finalidade    && r.finalidade  && r.finalidade  !== finalidade)    return false;
      if (freteContaDestinatario !== undefined && r.freteContaDestinatario != null && r.freteContaDestinatario !== freteContaDestinatario) return false;
      return true;
    };

    // ── Filtro para REGRAS_PADRAO (in-memory) — destinacao/tipoFornecedor podem ser arrays ──
    const matchMem = (r: any): boolean => {
      const ruleIncludes = (ruleVal: any, paramVal: string | undefined) => {
        if (!paramVal) return true;
        if (!ruleVal)  return true;               // null na regra = qualquer
        return Array.isArray(ruleVal) ? ruleVal.includes(paramVal) : ruleVal === paramVal;
      };

      if (tipo && r.tipo && r.tipo !== tipo) return false;
      if (!ruleIncludes(r.destinacao,    destinacao))    return false;
      if (tipo === 'SAIDA') {
        if (tipoCliente && r.tipoCliente && r.tipoCliente !== tipoCliente) return false;
      } else {
        if (!ruleIncludes(r.tipoFornecedor, tipoFornecedor)) return false;
      }
      if (taxRegimeEmpresa && r.regimeTributario != null && r.regimeTributario !== taxRegimeEmpresa) return false;
      if (intraestadual !== null && r.intraestadual != null && r.intraestadual !== intraestadual) return false;
      if (temST         !== undefined && r.temST        != null && r.temST        !== temST)        return false;
      if (stRetida      !== undefined && r.stRetida     != null && r.stRetida     !== stRetida)      return false;
      if (finalidade    && r.finalidade  && r.finalidade  !== finalidade)    return false;
      if (freteContaDestinatario !== undefined && r.freteContaDestinatario != null && r.freteContaDestinatario !== freteContaDestinatario) return false;
      return true;
    };

    // ── 1ª tentativa: regras customizadas da empresa no BD ───────────────────
    const dbRegras = await (this.prisma as any).operacaoFiscal.findMany({
      where: { companyId, ativo: true },
      orderBy: { prioridade: 'desc' },
    });
    const match = dbRegras.find(matchDb) ?? null;

    // ── 2ª tentativa: fallback nas REGRAS_PADRAO in-memory ───────────────────
    const regra: any = match ?? [...REGRAS_PADRAO]
      .sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0))
      .find(matchMem) ?? null;

    if (!regra) return null;

    return this.buildResult(regra, intraestadual, taxRegimeEmpresa);
  }

  /** Monta o ResultadoOperacaoFiscal a partir de um match (DB row ou regra in-memory) */
  private buildResult(r: any, intraestadual: boolean | null, taxRegimeEmpresa?: string): ResultadoOperacaoFiscal {
    const podeCredPisCofins = taxRegimeEmpresa === 'LUCRO_REAL';
    return {
      operacaoId:          r.id ?? r.codigo,  // in-memory não tem id
      codigo:              r.codigo,
      descricao:           r.descricao,
      cfop:                r.cfop,
      cstIcms:             r.cstIcms,
      cstIpi:              r.cstIpi,
      cstPis:              r.cstPis,
      cstCofins:           r.cstCofins,
      creditaIcms:         r.creditaIcms        ?? false,
      creditaIpi:          r.creditaIpi         ?? false,
      creditaPisCofins:    (r.creditaPisCofins  ?? false) && podeCredPisCofins,
      icmsSimplesPCredSN:  r.icmsSimplesPCredSN ?? false,
      ciap:                r.ciap               ?? false,
      pisCofins24x:        r.pisCofins24x       ?? false,
      retencaoIss:         r.retencaoIss        ?? false,
      retencaoFederal:     r.retencaoFederal    ?? false,
      retencaoInss:        r.retencaoInss       ?? false,
      debitaIcms:          deveDebitarIcms(r.cstIcms),
      debitaIpi:           deveDebitarIpi(r.cstIpi),
      debitaPisCofins:     deveDebitarPisCofins(r.cstPis),
      contaDebitoCode:     r.contaDebitoCode    ?? null,
      intraestadual:       intraestadual        ?? true,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SEED
  // ──────────────────────────────────────────────────────────────────────────
  async seedRegrasPadrao(companyId: string): Promise<{ criadas: number; existentes: number }> {
    let criadas = 0;
    let existentes = 0;

    for (const r of REGRAS_PADRAO) {
      const { destinacao: dests, tipoFornecedor: tipos, tipoCliente: tcliente, ...rest } = r;

      const destinacaoList: (string | null)[] = Array.isArray(dests) ? dests : (dests ? [dests] : [null]);
      const tipoFornList: (string | null)[]   = Array.isArray(tipos) ? tipos : (tipos ? [tipos] : [null]);

      for (const dest of destinacaoList) {
        for (const tipoForn of tipoFornList) {
          // Código único derivado dos atributos para evitar colisão no seed
          const sfx = [dest?.slice(0,4), tipoForn?.slice(0,4), tcliente?.slice(0,4)].filter(Boolean).join('-');
          const codigoFinal = sfx ? `${rest.codigo}-${sfx}` : rest.codigo;

          const existing = await (this.prisma as any).operacaoFiscal.findFirst({
            where: { companyId, codigo: codigoFinal },
          });
          if (existing) { existentes++; continue; }

          await (this.prisma as any).operacaoFiscal.create({
            data: {
              companyId,
              codigo:                  codigoFinal,
              descricao:               dest ? `${rest.descricao} [${dest}]` : rest.descricao,
              tipo:                    rest.tipo ?? 'ENTRADA',
              destinacao:              dest     ?? undefined,
              tipoFornecedor:          tipoForn ?? undefined,
              tipoCliente:             tcliente ?? undefined,
              intraestadual:           rest.intraestadual ?? undefined,
              temST:                   rest.temST         ?? undefined,
              stRetida:                rest.stRetida      ?? undefined,
              finalidade:              rest.finalidade    ?? undefined,
              regimeTributario:        rest.regimeTributario ?? undefined,
              freteContaDestinatario:  rest.freteContaDestinatario ?? undefined,
              cfop:                    rest.cfop,
              cstIcms:                 rest.cstIcms,
              cstIpi:                  rest.cstIpi,
              cstPis:                  rest.cstPis,
              cstCofins:               rest.cstCofins,
              creditaIcms:             rest.creditaIcms,
              creditaIpi:              rest.creditaIpi,
              creditaPisCofins:        rest.creditaPisCofins,
              icmsSimplesPCredSN:      rest.icmsSimplesPCredSN,
              ciap:                    rest.ciap,
              pisCofins24x:            rest.pisCofins24x,
              retencaoIss:             rest.retencaoIss     ?? false,
              retencaoFederal:         rest.retencaoFederal  ?? false,
              retencaoInss:            rest.retencaoInss     ?? false,
              contaDebitoCode:         rest.contaDebitoCode ?? undefined,
              prioridade:              rest.prioridade,
              isDefault:               true,
              ativo:                   true,
            },
          });
          criadas++;
        }
      }
    }
    return { criadas, existentes };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────────
  async findAll(companyId: string) {
    return (this.prisma as any).operacaoFiscal.findMany({
      where: { companyId },
      orderBy: [{ tipo: 'asc' }, { prioridade: 'desc' }, { codigo: 'asc' }],
    });
  }

  async findOne(companyId: string, id: string) {
    const reg = await (this.prisma as any).operacaoFiscal.findFirst({ where: { id, companyId } });
    if (!reg) throw new NotFoundException(`Operação fiscal ${id} não encontrada`);
    return reg;
  }

  async create(companyId: string, data: any) {
    const existing = await (this.prisma as any).operacaoFiscal.findFirst({
      where: { companyId, codigo: data.codigo },
    });
    if (existing) throw new ConflictException(`Código ${data.codigo} já existe`);
    return (this.prisma as any).operacaoFiscal.create({ data: { ...data, companyId } });
  }

  async update(companyId: string, id: string, data: any) {
    await this.findOne(companyId, id);
    return (this.prisma as any).operacaoFiscal.update({ where: { id }, data });
  }

  async remove(companyId: string, id: string) {
    const reg = await this.findOne(companyId, id);
    if (reg.isDefault) throw new ConflictException('Regras padrão do sistema não podem ser excluídas');
    return (this.prisma as any).operacaoFiscal.delete({ where: { id } });
  }
}
