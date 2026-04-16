/**
 * EFD-REINF (Escrituracao Fiscal Digital de Retencoes e Outras Informacoes Fiscais)
 * webservice configuration.
 */

export interface ReinfUrlConfig {
  enviarLoteEventos: string;
  consultarLoteEventos: string;
}

export const REINF_URLS: Record<string, ReinfUrlConfig> = {
  // Homologacao (Producao Restrita)
  '2': {
    enviarLoteEventos:
      'https://preprodefdreinf.receita.fazenda.gov.br/WsREINF/RecepcaoLoteReinf.svc',
    consultarLoteEventos:
      'https://preprodefdreinf.receita.fazenda.gov.br/WsREINF/ConsultasReinf.svc',
  },

  // Producao
  '1': {
    enviarLoteEventos:
      'https://reinf.receita.fazenda.gov.br/WsREINF/RecepcaoLoteReinf.svc',
    consultarLoteEventos:
      'https://reinf.receita.fazenda.gov.br/WsREINF/ConsultasReinf.svc',
  },
};

/**
 * Get REINF URLs based on ambiente.
 */
export function getReinfUrls(ambiente: '1' | '2'): ReinfUrlConfig {
  return REINF_URLS[ambiente];
}

/**
 * REINF event types for the current series (R-2xxx and R-4xxx).
 */
export const REINF_EVENTS = {
  // Serie R-1000 - Tabelas
  R_1000: 'R-1000', // Informacoes do Contribuinte
  R_1050: 'R-1050', // Tabela de Entidades Ligadas
  R_1070: 'R-1070', // Tabela de Processos Administrativos/Judiciais

  // Serie R-2xxx - Retencoes previdenciarias
  R_2010: 'R-2010', // Retencao contribuicao previdenciaria - servicos tomados
  R_2020: 'R-2020', // Retencao contribuicao previdenciaria - servicos prestados
  R_2055: 'R-2055', // Aquisicao producao rural
  R_2060: 'R-2060', // CPRB (Contribuicao Previdenciaria sobre Receita Bruta)
  R_2098: 'R-2098', // Reabertura dos eventos periodicos serie R-2000
  R_2099: 'R-2099', // Fechamento dos eventos periodicos serie R-2000

  // Serie R-4xxx - Retencoes na fonte (IR, CSLL, COFINS, PIS)
  R_4010: 'R-4010', // Pagamentos/creditos a beneficiario pessoa fisica
  R_4020: 'R-4020', // Pagamentos/creditos a beneficiario pessoa juridica
  R_4040: 'R-4040', // Pagamentos/creditos a beneficiarios nao identificados
  R_4080: 'R-4080', // Retencao no recebimento (auto-retencao)
  R_4099: 'R-4099', // Fechamento/reabertura eventos serie R-4000

  // Serie R-9xxx - Totalizadores
  R_9000: 'R-9000', // Exclusao de eventos
  R_9001: 'R-9001', // Bases e tributos - consolidado
  R_9005: 'R-9005', // Bases e tributos - por estabelecimento
  R_9011: 'R-9011', // Consolidacao rendimentos e retencoes
  R_9015: 'R-9015', // Consolidacao retencoes na fonte
} as const;

/** Max events per REINF batch */
export const REINF_MAX_EVENTS_PER_BATCH = 100;
