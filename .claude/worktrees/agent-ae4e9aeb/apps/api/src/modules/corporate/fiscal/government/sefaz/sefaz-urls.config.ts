export interface SefazUrlConfig {
  autorizacao: string;
  retAutorizacao: string;
  consultaProtocolo: string;
  statusServico: string;
  inutilizacao: string;
  recepcaoEvento: string;
  distribuicaoDFe: string;
}

// ============================================================================
// Servidores Virtuais (compartilhados por múltiplos estados)
// ============================================================================

const SVRS_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  statusServico:
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  inutilizacao:
    'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  recepcaoEvento:
    'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const SVRS_PRODUCAO: SefazUrlConfig = {
  autorizacao:
    'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  statusServico:
    'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  inutilizacao:
    'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  recepcaoEvento:
    'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const SVAN_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  statusServico:
    'https://hom.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
  inutilizacao:
    'https://hom.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
  recepcaoEvento:
    'https://hom.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const SVAN_PRODUCAO: SefazUrlConfig = {
  autorizacao:
    'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  statusServico:
    'https://www.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
  inutilizacao:
    'https://www.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
  recepcaoEvento:
    'https://www.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

// ============================================================================
// Estados com Servidor Próprio
// ============================================================================

const SP_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
  retAutorizacao:
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
  consultaProtocolo:
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
  statusServico:
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
  inutilizacao:
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
  recepcaoEvento:
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const SP_PRODUCAO: SefazUrlConfig = {
  autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
  retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
  consultaProtocolo:
    'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
  statusServico: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
  inutilizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
  recepcaoEvento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const MG_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
  retAutorizacao:
    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
  consultaProtocolo:
    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
  statusServico:
    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
  inutilizacao:
    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4',
  recepcaoEvento:
    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const MG_PRODUCAO: SefazUrlConfig = {
  autorizacao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
  retAutorizacao:
    'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
  consultaProtocolo:
    'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
  statusServico:
    'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
  inutilizacao:
    'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4',
  recepcaoEvento:
    'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const BA_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://hnfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  statusServico:
    'https://hnfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
  inutilizacao:
    'https://hnfe.sefaz.ba.gov.br/webservices/NFeInutilizacao4/NFeInutilizacao4.asmx',
  recepcaoEvento:
    'https://hnfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const BA_PRODUCAO: SefazUrlConfig = {
  autorizacao:
    'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://nfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  statusServico:
    'https://nfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
  inutilizacao:
    'https://nfe.sefaz.ba.gov.br/webservices/NFeInutilizacao4/NFeInutilizacao4.asmx',
  recepcaoEvento:
    'https://nfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const PR_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4?wsdl',
  retAutorizacao:
    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4?wsdl',
  statusServico:
    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4?wsdl',
  inutilizacao:
    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4?wsdl',
  recepcaoEvento:
    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const PR_PRODUCAO: SefazUrlConfig = {
  autorizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4?wsdl',
  retAutorizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4?wsdl',
  statusServico: 'https://nfe.sefa.pr.gov.br/nfe/NFeStatusServico4?wsdl',
  inutilizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4?wsdl',
  recepcaoEvento: 'https://nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const PE_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4',
  retAutorizacao:
    'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4',
  consultaProtocolo:
    'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
  statusServico:
    'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4',
  inutilizacao:
    'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4',
  recepcaoEvento:
    'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const PE_PRODUCAO: SefazUrlConfig = {
  autorizacao:
    'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4',
  retAutorizacao:
    'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4',
  consultaProtocolo:
    'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
  statusServico:
    'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4',
  inutilizacao:
    'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4',
  recepcaoEvento:
    'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const GO_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4?wsdl',
  retAutorizacao:
    'https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4?wsdl',
  statusServico:
    'https://homolog.sefaz.go.gov.br/nfe/services/NFeStatusServico4?wsdl',
  inutilizacao:
    'https://homolog.sefaz.go.gov.br/nfe/services/NFeInutilizacao4?wsdl',
  recepcaoEvento:
    'https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const GO_PRODUCAO: SefazUrlConfig = {
  autorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4?wsdl',
  retAutorizacao:
    'https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4?wsdl',
  statusServico:
    'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4?wsdl',
  inutilizacao:
    'https://nfe.sefaz.go.gov.br/nfe/services/NFeInutilizacao4?wsdl',
  recepcaoEvento:
    'https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const MT_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4?wsdl',
  retAutorizacao:
    'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4?wsdl',
  statusServico:
    'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4?wsdl',
  inutilizacao:
    'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4?wsdl',
  recepcaoEvento:
    'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const MT_PRODUCAO: SefazUrlConfig = {
  autorizacao:
    'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4?wsdl',
  retAutorizacao:
    'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4?wsdl',
  statusServico:
    'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4?wsdl',
  inutilizacao:
    'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4?wsdl',
  recepcaoEvento:
    'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const MS_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://homologacao.nfe.ms.gov.br/ws/NFeAutorizacao4?wsdl',
  retAutorizacao:
    'https://homologacao.nfe.ms.gov.br/ws/NFeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://homologacao.nfe.ms.gov.br/ws/NFeConsultaProtocolo4?wsdl',
  statusServico:
    'https://homologacao.nfe.ms.gov.br/ws/NFeStatusServico4?wsdl',
  inutilizacao:
    'https://homologacao.nfe.ms.gov.br/ws/NFeInutilizacao4?wsdl',
  recepcaoEvento:
    'https://homologacao.nfe.ms.gov.br/ws/NFeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const MS_PRODUCAO: SefazUrlConfig = {
  autorizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4?wsdl',
  retAutorizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4?wsdl',
  consultaProtocolo:
    'https://nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4?wsdl',
  statusServico: 'https://nfe.sefaz.ms.gov.br/ws/NFeStatusServico4?wsdl',
  inutilizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeInutilizacao4?wsdl',
  recepcaoEvento: 'https://nfe.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4?wsdl',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const RS_HOMOLOGACAO: SefazUrlConfig = {
  autorizacao:
    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  statusServico:
    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  inutilizacao:
    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  recepcaoEvento:
    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  distribuicaoDFe:
    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const RS_PRODUCAO: SefazUrlConfig = {
  autorizacao:
    'https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao:
    'https://nfe.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  consultaProtocolo:
    'https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  statusServico:
    'https://nfe.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  inutilizacao:
    'https://nfe.sefazrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  recepcaoEvento:
    'https://nfe.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  distribuicaoDFe:
    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

// ============================================================================
// Mapa completo: UF -> { homologacao, producao }
// Estados sem servidor proprio usam SVRS (maioria) ou SVAN (MA, PA, PI)
// ============================================================================

export const SEFAZ_URLS: Record<
  string,
  { homologacao: SefazUrlConfig; producao: SefazUrlConfig }
> = {
  // Estados com servidor próprio
  SP: { homologacao: SP_HOMOLOGACAO, producao: SP_PRODUCAO },
  MG: { homologacao: MG_HOMOLOGACAO, producao: MG_PRODUCAO },
  BA: { homologacao: BA_HOMOLOGACAO, producao: BA_PRODUCAO },
  PR: { homologacao: PR_HOMOLOGACAO, producao: PR_PRODUCAO },
  PE: { homologacao: PE_HOMOLOGACAO, producao: PE_PRODUCAO },
  GO: { homologacao: GO_HOMOLOGACAO, producao: GO_PRODUCAO },
  MT: { homologacao: MT_HOMOLOGACAO, producao: MT_PRODUCAO },
  MS: { homologacao: MS_HOMOLOGACAO, producao: MS_PRODUCAO },
  RS: { homologacao: RS_HOMOLOGACAO, producao: RS_PRODUCAO },

  // Estados que usam SVAN
  MA: { homologacao: SVAN_HOMOLOGACAO, producao: SVAN_PRODUCAO },
  PA: { homologacao: SVAN_HOMOLOGACAO, producao: SVAN_PRODUCAO },
  PI: { homologacao: SVAN_HOMOLOGACAO, producao: SVAN_PRODUCAO },

  // Estados que usam SVRS
  AC: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  AL: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  AM: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  AP: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  CE: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  DF: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  ES: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  PB: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  RJ: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  RN: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  RO: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  RR: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  SC: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  SE: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
  TO: { homologacao: SVRS_HOMOLOGACAO, producao: SVRS_PRODUCAO },
};

/**
 * Resolve a URL config for a given UF and ambiente.
 */
export function getSefazUrls(
  uf: string,
  ambiente: '1' | '2',
): SefazUrlConfig {
  const ufUpper = uf.toUpperCase();
  const config = SEFAZ_URLS[ufUpper];

  if (!config) {
    throw new Error(`SEFAZ URLs not configured for UF: ${ufUpper}`);
  }

  return ambiente === '1' ? config.producao : config.homologacao;
}
