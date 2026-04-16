export interface NfseMunicipalConfig {
  provider: string;
  urlHom: string;
  urlProd: string;
  version?: string;
}

/**
 * Map of IBGE municipality code to NFS-e provider configuration.
 * Includes major Brazilian cities with their respective NFS-e systems.
 */
export const NFSE_MUNICIPAL_URLS: Record<string, NfseMunicipalConfig> = {
  // Sao Paulo - SP (Sistema proprio - NFe Paulistana)
  '3550308': {
    provider: 'SP_PAULISTANA',
    urlHom: 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx',
    urlProd: 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx',
    version: '1',
  },

  // Rio de Janeiro - RJ (Nota Carioca - ABRASF)
  '3304557': {
    provider: 'ABRASF',
    urlHom: 'https://homologacao.notacarioca.rio.gov.br/WSNacional/nfse.asmx',
    urlProd: 'https://notacarioca.rio.gov.br/WSNacional/nfse.asmx',
    version: '2.04',
  },

  // Belo Horizonte - MG (GINFES / BHISS Digital)
  '3106200': {
    provider: 'GINFES',
    urlHom: 'https://homologacao.ginfes.com.br/ServiceGinfesImpl?wsdl',
    urlProd: 'https://producao.ginfes.com.br/ServiceGinfesImpl?wsdl',
    version: '3',
  },

  // Curitiba - PR (ISSCuritiba - ISSNet)
  '4106902': {
    provider: 'ISSNET',
    urlHom: 'https://isshom.curitiba.pr.gov.br/Iss.NfseWebService/nfsews.asmx',
    urlProd: 'https://iss.curitiba.pr.gov.br/Iss.NfseWebService/nfsews.asmx',
    version: '2.04',
  },

  // Porto Alegre - RS (ISSNet)
  '4314902': {
    provider: 'ISSNET',
    urlHom:
      'https://nfse-hom.procempa.com.br/bhiss-ws/nfse?wsdl',
    urlProd:
      'https://nfe.portoalegre.rs.gov.br/bhiss-ws/nfse?wsdl',
    version: '2.04',
  },

  // Salvador - BA (ABRASF)
  '2927408': {
    provider: 'ABRASF',
    urlHom:
      'https://notahom.salvador.ba.gov.br/ws/nfse.asmx',
    urlProd: 'https://nota.salvador.ba.gov.br/ws/nfse.asmx',
    version: '2.04',
  },

  // Brasilia - DF (ABRASF)
  '5300108': {
    provider: 'ABRASF',
    urlHom:
      'https://homologacao.nfse.df.gov.br/WSNacional/nfse.asmx',
    urlProd: 'https://producao.nfse.df.gov.br/WSNacional/nfse.asmx',
    version: '2.04',
  },

  // Recife - PE (ABRASF)
  '2611606': {
    provider: 'ABRASF',
    urlHom:
      'https://nfse-hom.recife.pe.gov.br/WSNacional/nfse.asmx',
    urlProd: 'https://nfse.recife.pe.gov.br/WSNacional/nfse.asmx',
    version: '2.04',
  },

  // Fortaleza - CE (GINFES)
  '2304400': {
    provider: 'GINFES',
    urlHom: 'https://homologacao.ginfes.com.br/ServiceGinfesImpl?wsdl',
    urlProd: 'https://producao.ginfes.com.br/ServiceGinfesImpl?wsdl',
    version: '3',
  },

  // Campinas - SP (ISSNet)
  '3509502': {
    provider: 'ISSNET',
    urlHom:
      'https://homologacao.issnetonline.com.br/webserviceabrasf/campinas/servicos.asmx',
    urlProd:
      'https://www.issnetonline.com.br/webserviceabrasf/campinas/servicos.asmx',
    version: '2.04',
  },

  // Goiania - GO (ISSNet)
  '5208707': {
    provider: 'ISSNET',
    urlHom:
      'https://homologacao.issnetonline.com.br/webserviceabrasf/goiania/servicos.asmx',
    urlProd:
      'https://www.issnetonline.com.br/webserviceabrasf/goiania/servicos.asmx',
    version: '2.04',
  },

  // Guarulhos - SP (GINFES)
  '3518800': {
    provider: 'GINFES',
    urlHom: 'https://homologacao.ginfes.com.br/ServiceGinfesImpl?wsdl',
    urlProd: 'https://producao.ginfes.com.br/ServiceGinfesImpl?wsdl',
    version: '3',
  },
};

/**
 * Resolve NFS-e config for a given municipality IBGE code.
 */
export function getNfseConfig(
  codigoMunicipioIbge: string,
): NfseMunicipalConfig | null {
  return NFSE_MUNICIPAL_URLS[codigoMunicipioIbge] || null;
}

/**
 * Resolve the URL based on municipality and ambiente.
 */
export function getNfseUrl(
  codigoMunicipioIbge: string,
  ambiente: '1' | '2',
): string | null {
  const config = getNfseConfig(codigoMunicipioIbge);
  if (!config) return null;
  return ambiente === '1' ? config.urlProd : config.urlHom;
}
