import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class NfeXmlBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  private fmt(v: number, dec = 2): string {
    return v.toFixed(dec);
  }

  private ufCode(uf: string): string {
    const codes: Record<string, string> = {
      AC:'12',AL:'27',AP:'16',AM:'13',BA:'29',CE:'23',DF:'53',ES:'32',
      GO:'52',MA:'21',MT:'51',MS:'50',MG:'31',PA:'15',PB:'25',PR:'41',
      PE:'26',PI:'22',RJ:'33',RN:'24',RS:'43',RO:'11',RR:'14',SC:'42',
      SP:'35',SE:'28',TO:'17',
    };
    return codes[uf?.toUpperCase()] ?? '35';
  }

  private crtFromRegime(taxRegime: string): string {
    // CRT: 1=Simples Nacional, 2=Simples Nacional Excesso, 3=Regime Normal
    if (taxRegime === 'SIMPLES_NACIONAL') return '1';
    if (taxRegime === 'MEI') return '1';
    return '3';
  }

  private formatDateTime(d: Date): string {
    // ISO 8601 with Brazil offset -03:00
    const pad = (n: number) => n.toString().padStart(2, '0');
    const Y = d.getFullYear();
    const M = pad(d.getMonth() + 1);
    const D = pad(d.getDate());
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${Y}-${M}-${D}T${h}:${m}:${s}-03:00`;
  }

  private sanitize(s: string | null | undefined, max = 60): string {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .slice(0, max);
  }

  /**
   * Build complete NF-e XML (layout 4.00) for a given NFeDocument ID.
   * Returns { xml, chaveAcesso, cNf }
   */
  async buildXml(nfeId: string, ambiente: '1' | '2'): Promise<{ xml: string; chaveAcesso: string; cNf: string }> {
    const nfe = await this.prisma.nFeDocument.findUniqueOrThrow({
      where: { id: nfeId },
      include: {
        items: { orderBy: { itemNumber: 'asc' } },
        person: true,
        company: true,
      },
    });

    const company = nfe.company;
    const dest = nfe.person;

    const dataEmissao = nfe.dataEmissao ?? new Date();
    const cUF = this.ufCode(company.uf ?? 'SP');
    const cNf = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
    const serie = (nfe.serie ?? company.serieNfe ?? 1).toString().padStart(3, '0');
    const numero = (nfe.numero ?? 1).toString().padStart(9, '0');
    const mod = '55'; // NF-e
    const tpNF = nfe.type === 'ENTRADA' ? '0' : '1';
    const tpAmb = ambiente; // 1=prod, 2=hom
    const aamm = dataEmissao.getFullYear().toString().slice(2) + (dataEmissao.getMonth() + 1).toString().padStart(2, '0');
    const cnpjEmit = (company.cnpj ?? '').replace(/\D/g, '');

    // Build chave acesso base (43 digits, then add check digit)
    const chaveBase = `${cUF}${aamm}${cnpjEmit.padStart(14,'0')}${mod}${serie}${numero}1${cNf}`;
    const dv = this.calcMod11(chaveBase);
    const chaveAcesso = `${chaveBase}${dv}`;

    // In homologação, item descriptions MUST start with this text (per NT)
    const homPrefix = tpAmb === '2' ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL - ' : '';

    // Calculate totals
    let vProd = 0, vICMS = 0, vIPI = 0, vPIS = 0, vCOFINS = 0, vIcmsSt = 0;
    for (const item of nfe.items) {
      vProd += Number(item.totalPrice ?? 0);
      vICMS += Number(item.valorIcms ?? 0);
      vIPI += Number(item.valorIpi ?? 0);
      vPIS += Number(item.valorPis ?? 0);
      vCOFINS += Number(item.valorCofins ?? 0);
      vIcmsSt += Number(item.valorIcmsSt ?? 0);
    }
    const vFrete = Number(nfe.valorFrete ?? 0);
    const vSeg = Number(nfe.valorSeguro ?? 0);
    const vDesc = Number(nfe.valorDesconto ?? 0);
    const vOutro = Number(nfe.valorOutros ?? 0);
    const vNF = vProd + vFrete + vSeg + vOutro - vDesc + vIPI + vIcmsSt;

    // CRT from tax regime
    const crt = this.crtFromRegime(company.taxRegime ?? '');

    // Destinatário CNPJ or CPF
    const destDoc = (dest?.cpfCnpj ?? '').replace(/\D/g, '');
    const destIsJuridica = destDoc.length === 14;
    const destTag = destIsJuridica ? `<CNPJ>${destDoc}</CNPJ>` : `<CPF>${destDoc.padStart(11,'0')}</CPF>`;

    // indIEDest: 1=contribuinte ICMS, 2=contribuinte isento, 9=não contribuinte
    const indIEDest = dest?.rgIe ? '1' : '9';

    // Build items XML
    const itemsXml = nfe.items.map((item, i) => {
      const descProd = `${homPrefix}${this.sanitize(item.description, 120 - homPrefix.length)}`;
      const qty = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? 0);
      const total = Number(item.totalPrice ?? qty * unitPrice);
      const ncm = (item.ncmCode ?? '00000000').replace(/\D/g,'').padStart(8,'0');
      const cfop = (item.cfopCode ?? '5102').replace(/\D/g,'');
      const unit = item.unit ?? 'UN';

      // ICMS
      const cst = item.cstIcms ?? '40';
      const bcIcms = Number(item.bcIcms ?? 0);
      const aliqIcms = Number(item.aliqIcms ?? 0);
      const vIcmsItem = Number(item.valorIcms ?? 0);

      // Choose ICMS tag based on CST
      let icmsTag = '';
      if (cst === '00') {
        icmsTag = `<ICMS00>
              <orig>0</orig><CST>00</CST><modBC>3</modBC>
              <vBC>${this.fmt(bcIcms)}</vBC><pICMS>${this.fmt(aliqIcms)}</pICMS>
              <vICMS>${this.fmt(vIcmsItem)}</vICMS>
            </ICMS00>`;
      } else if (cst === '10') {
        icmsTag = `<ICMS10>
              <orig>0</orig><CST>10</CST><modBC>3</modBC>
              <vBC>${this.fmt(bcIcms)}</vBC><pICMS>${this.fmt(aliqIcms)}</pICMS>
              <vICMS>${this.fmt(vIcmsItem)}</vICMS>
              <modBCST>4</modBCST><pMVAST>0.00</pMVAST>
              <vBCST>${this.fmt(Number(item.bcIcmsSt??0))}</vBCST>
              <pICMSST>${this.fmt(Number(item.aliqIcmsSt??0))}</pICMSST>
              <vICMSST>${this.fmt(Number(item.valorIcmsSt??0))}</vICMSST>
            </ICMS10>`;
      } else if (cst === '20') {
        icmsTag = `<ICMS20>
              <orig>0</orig><CST>20</CST><modBC>3</modBC><pRedBC>0.00</pRedBC>
              <vBC>${this.fmt(bcIcms)}</vBC><pICMS>${this.fmt(aliqIcms)}</pICMS>
              <vICMS>${this.fmt(vIcmsItem)}</vICMS>
            </ICMS20>`;
      } else if (['40','41','50'].includes(cst)) {
        icmsTag = `<ICMS40>
              <orig>0</orig><CST>${cst}</CST>
            </ICMS40>`;
      } else if (cst === '60') {
        icmsTag = `<ICMS60>
              <orig>0</orig><CST>60</CST>
              <vBCSTRet>0.00</vBCSTRet><vICMSSTRet>0.00</vICMSSTRet>
            </ICMS60>`;
      } else if (cst === '102') {
        // Simples Nacional sem permissão crédito
        icmsTag = `<ICMSSN102>
              <orig>0</orig><CSOSN>102</CSOSN>
            </ICMSSN102>`;
      } else if (cst === '400') {
        icmsTag = `<ICMSSN400>
              <orig>0</orig><CSOSN>400</CSOSN>
            </ICMSSN400>`;
      } else if (cst === '500') {
        icmsTag = `<ICMSSN500>
              <orig>0</orig><CSOSN>500</CSOSN>
              <vBCSTRet>0.00</vBCSTRet><pST>0.00</pST><vICMSSTRet>0.00</vICMSSTRet>
            </ICMSSN500>`;
      } else {
        // Default: ICMS40 (isento)
        icmsTag = `<ICMS40><orig>0</orig><CST>40</CST></ICMS40>`;
      }

      // PIS
      const cstPis = item.cstPis ?? '07';
      let pisTag = '';
      if (['07','08','09'].includes(cstPis)) {
        pisTag = `<PISNT><CST>${cstPis}</CST></PISNT>`;
      } else {
        pisTag = `<PISAliq>
              <CST>${cstPis}</CST>
              <vBC>${this.fmt(Number(item.bcPis??0))}</vBC>
              <pPIS>${this.fmt(Number(item.aliqPis??0),4)}</pPIS>
              <vPIS>${this.fmt(Number(item.valorPis??0))}</vPIS>
            </PISAliq>`;
      }

      // COFINS
      const cstCofins = item.cstCofins ?? '07';
      let cofinsTag = '';
      if (['07','08','09'].includes(cstCofins)) {
        cofinsTag = `<COFINSNT><CST>${cstCofins}</CST></COFINSNT>`;
      } else {
        cofinsTag = `<COFINSAliq>
              <CST>${cstCofins}</CST>
              <vBC>${this.fmt(Number(item.bcCofins??0))}</vBC>
              <pCOFINS>${this.fmt(Number(item.aliqCofins??0),4)}</pCOFINS>
              <vCOFINS>${this.fmt(Number(item.valorCofins??0))}</vCOFINS>
            </COFINSAliq>`;
      }

      return `<det nItem="${i+1}">
          <prod>
            <cProd>${this.sanitize(item.productId ? item.productId.slice(0,60) : (i+1).toString().padStart(3,'0'))}</cProd>
            <cEAN>SEM GTIN</cEAN>
            <xProd>${descProd}</xProd>
            <NCM>${ncm}</NCM>
            <CFOP>${cfop}</CFOP>
            <uCom>${this.sanitize(unit,6)}</uCom>
            <qCom>${this.fmt(qty,4)}</qCom>
            <vUnCom>${this.fmt(unitPrice,10)}</vUnCom>
            <vProd>${this.fmt(total)}</vProd>
            <cEANTrib>SEM GTIN</cEANTrib>
            <uTrib>${this.sanitize(unit,6)}</uTrib>
            <qTrib>${this.fmt(qty,4)}</qTrib>
            <vUnTrib>${this.fmt(unitPrice,10)}</vUnTrib>
            <indTot>1</indTot>
          </prod>
          <imposto>
            <ICMS>${icmsTag}</ICMS>
            <PIS>${pisTag}</PIS>
            <COFINS>${cofinsTag}</COFINS>
          </imposto>
        </det>`;
    }).join('\n');

    // Main XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${chaveAcesso}">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${cNf}</cNF>
      <natOp>${this.sanitize(nfe.naturezaOperacao ?? 'Venda de Mercadoria', 60)}</natOp>
      <mod>55</mod>
      <serie>${nfe.serie ?? company.serieNfe ?? 1}</serie>
      <nNF>${nfe.numero ?? 1}</nNF>
      <dhEmi>${this.formatDateTime(dataEmissao)}</dhEmi>
      <tpNF>${tpNF}</tpNF>
      <idDest>1</idDest>
      <cMunFG>${company.codigoMunicipioIbge ?? '9999999'}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${dv}</cDV>
      <tpAmb>${tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>0</indFinal>
      <indPres>9</indPres>
      <procEmi>0</procEmi>
      <verProc>ERP-1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${cnpjEmit.padStart(14,'0')}</CNPJ>
      <xNome>${this.sanitize(company.razaoSocial ?? 'EMPRESA', 60)}</xNome>
      ${company.nomeFantasia ? `<xFant>${this.sanitize(company.nomeFantasia, 60)}</xFant>` : ''}
      <enderEmit>
        <xLgr>${this.sanitize(company.logradouro ?? 'Rua', 60)}</xLgr>
        <nro>${this.sanitize(company.numero ?? 'SN', 60)}</nro>
        ${company.complemento ? `<xCpl>${this.sanitize(company.complemento, 60)}</xCpl>` : ''}
        <xBairro>${this.sanitize(company.bairro ?? 'Centro', 60)}</xBairro>
        <cMun>${company.codigoMunicipioIbge ?? '9999999'}</cMun>
        <xMun>${this.sanitize(company.municipio ?? 'Municipio', 60)}</xMun>
        <UF>${company.uf ?? 'SP'}</UF>
        <CEP>${(company.cep ?? '').replace(/\D/g,'').padStart(8,'0')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${company.telefone ? `<fone>${(company.telefone).replace(/\D/g,'').slice(0,14)}</fone>` : ''}
      </enderEmit>
      <IE>${(company.inscricaoEstadual ?? '').replace(/\D/g,'')}</IE>
      <CRT>${crt}</CRT>
    </emit>
    <dest>
      ${destTag}
      <xNome>${this.sanitize(dest?.razaoSocial ?? 'CONSUMIDOR NAO IDENTIFICADO', 60)}</xNome>
      <enderDest>
        <xLgr>${this.sanitize('Rua Nao Informada', 60)}</xLgr>
        <nro>SN</nro>
        <xBairro>${this.sanitize('Nao Informado', 60)}</xBairro>
        <cMun>9999999</cMun>
        <xMun>EXTERIOR</xMun>
        <UF>SP</UF>
        <CEP>00000000</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderDest>
      <indIEDest>${indIEDest}</indIEDest>
      ${dest?.rgIe ? `<IE>${this.sanitize(dest.rgIe, 14)}</IE>` : ''}
    </dest>
    ${itemsXml}
    <total>
      <ICMSTot>
        <vBC>${this.fmt(nfe.items.reduce((s,i)=>s+Number(i.bcIcms??0),0))}</vBC>
        <vICMS>${this.fmt(vICMS)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>${this.fmt(nfe.items.reduce((s,i)=>s+Number(i.bcIcmsSt??0),0))}</vBCST>
        <vST>${this.fmt(vIcmsSt)}</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${this.fmt(vProd)}</vProd>
        <vFrete>${this.fmt(vFrete)}</vFrete>
        <vSeg>${this.fmt(vSeg)}</vSeg>
        <vDesc>${this.fmt(vDesc)}</vDesc>
        <vII>0.00</vII>
        <vIPI>${this.fmt(vIPI)}</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${this.fmt(vPIS)}</vPIS>
        <vCOFINS>${this.fmt(vCOFINS)}</vCOFINS>
        <vOutro>${this.fmt(vOutro)}</vOutro>
        <vNF>${this.fmt(vNF)}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${this.fmt(vNF)}</vPag>
      </detPag>
    </pag>
    ${nfe.informacoesComplementares ? `<infAdic><infCpl>${this.sanitize(nfe.informacoesComplementares, 2000)}</infCpl></infAdic>` : ''}
  </infNFe>
</NFe>`;

    return { xml, chaveAcesso, cNf };
  }

  private calcMod11(chave: string): string {
    const weights = [2,3,4,5,6,7,8,9];
    let sum = 0;
    const digits = chave.split('').reverse();
    for (let i = 0; i < digits.length; i++) {
      sum += parseInt(digits[i], 10) * weights[i % weights.length];
    }
    const rem = sum % 11;
    return (rem < 2 ? 0 : 11 - rem).toString();
  }
}
