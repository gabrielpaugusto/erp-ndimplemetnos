/**
 * eSocial webservice configuration.
 * Layout S-1.2 (simplified version).
 */

export interface EsocialUrlConfig {
  enviarLoteEventos: string;
  consultarLoteEventos: string;
}

export const ESOCIAL_URLS: Record<string, EsocialUrlConfig> = {
  // Homologacao (Producao Restrita)
  '2': {
    enviarLoteEventos:
      'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
    consultarLoteEventos:
      'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
  },

  // Producao
  '1': {
    enviarLoteEventos:
      'https://webservices.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
    consultarLoteEventos:
      'https://webservices.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
  },
};

/**
 * Get eSocial URLs based on ambiente.
 */
export function getEsocialUrls(ambiente: '1' | '2'): EsocialUrlConfig {
  return ESOCIAL_URLS[ambiente];
}

/**
 * eSocial event groups for batch submission rules.
 */
export const ESOCIAL_EVENT_GROUPS = {
  TABELAS: ['S-1000', 'S-1005', 'S-1010', 'S-1020', 'S-1070'],
  NAO_PERIODICOS: [
    'S-2190', 'S-2200', 'S-2205', 'S-2206', 'S-2210',
    'S-2220', 'S-2230', 'S-2240', 'S-2298', 'S-2299',
    'S-2300', 'S-2306', 'S-2399', 'S-2400',
  ],
  PERIODICOS: [
    'S-1200', 'S-1210', 'S-1260', 'S-1270', 'S-1280',
    'S-1298', 'S-1299',
  ],
};

/** Max events per batch */
export const ESOCIAL_MAX_EVENTS_PER_BATCH = 50;
