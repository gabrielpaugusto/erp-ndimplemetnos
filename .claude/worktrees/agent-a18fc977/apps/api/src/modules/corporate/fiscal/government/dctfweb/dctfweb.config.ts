/**
 * DCTF-Web (Declaracao de Debitos e Creditos Tributarios Federais Previdenciarios
 * e de Outras Entidades e Fundos) configuration.
 *
 * DCTF-Web is generated automatically from eSocial and REINF data by the RFB system.
 * The API allows consulting, editing, and transmitting the declaration.
 */

export interface DctfwebUrlConfig {
  gerarDeclaracao: string;
  consultarDeclaracao: string;
  transmitirDeclaracao: string;
}

export const DCTFWEB_URLS: Record<string, DctfwebUrlConfig> = {
  // Homologacao
  '2': {
    gerarDeclaracao:
      'https://preprod-dctfweb.receita.fazenda.gov.br/api/v1/declaracao/gerar',
    consultarDeclaracao:
      'https://preprod-dctfweb.receita.fazenda.gov.br/api/v1/declaracao/consultar',
    transmitirDeclaracao:
      'https://preprod-dctfweb.receita.fazenda.gov.br/api/v1/declaracao/transmitir',
  },

  // Producao
  '1': {
    gerarDeclaracao:
      'https://dctfweb.receita.fazenda.gov.br/api/v1/declaracao/gerar',
    consultarDeclaracao:
      'https://dctfweb.receita.fazenda.gov.br/api/v1/declaracao/consultar',
    transmitirDeclaracao:
      'https://dctfweb.receita.fazenda.gov.br/api/v1/declaracao/transmitir',
  },
};

/**
 * Get DCTF-Web URLs based on ambiente.
 */
export function getDctfwebUrls(ambiente: '1' | '2'): DctfwebUrlConfig {
  return DCTFWEB_URLS[ambiente];
}

/**
 * DCTF-Web declaration categories.
 */
export const DCTFWEB_CATEGORIES = {
  MENSAL: 'MENSAL', // Monthly declaration (regular)
  ANUAL_13: 'ANUAL_13', // Annual 13th salary
  DIARIA: 'DIARIA', // Daily (eventos desportivos)
  SEM_MOVIMENTO: 'SEM_MOVIMENTO', // No movement period
} as const;

/**
 * DCTF-Web declaration statuses.
 */
export const DCTFWEB_STATUS = {
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  GERADA: 'GERADA',
  EDITADA: 'EDITADA',
  TRANSMITIDA: 'TRANSMITIDA',
  RETIFICADA: 'RETIFICADA',
} as const;
