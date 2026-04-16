import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import {
  generateSpedHeader,
  generateSpedLine,
  formatSpedDecimal,
  formatSpedDate,
} from './sped-file-header';

/**
 * EFD ICMS/IPI (SPED Fiscal) file generation service.
 * Generates the complete EFD file with all required registers.
 */
@Injectable()
export class SpedFiscalService extends GovernmentTransmissionService {
  private static readonly LAYOUT_VERSION = '017'; // Current EFD ICMS/IPI version

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  // ---------------------------------------------------------------------------
  // Map ItemDestinacao → SPED tipo_item code
  // ---------------------------------------------------------------------------
  private mapTipoItem(destinacao: string | null | undefined): string {
    switch (destinacao) {
      case 'PRODUTO_REVENDA':      return '00';
      case 'MATERIA_PRIMA':        return '01';
      case 'COMPONENTE':           return '01';
      case 'EMBALAGEM':            return '02';
      case 'PRODUTO_INDUSTRIALIZADO': return '04';
      case 'INSUMO_PRODUCAO':      return '06';
      case 'MATERIAL_USO_CONSUMO': return '07';
      case 'GGF':                  return '07';
      case 'IMOBILIZADO':          return '09';
      default:                     return '00';
    }
  }

  /**
   * Generate a complete EFD ICMS/IPI file for a given period.
   */
  async generateFile(
    companyId: string,
    periodoInicio: Date,
    periodoFim: Date,
  ): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const lines: string[] = [];
    let lineCount = 0;

    // =========================================================================
    // BLOCO 0 - Abertura, Identificacao e Referencias
    // =========================================================================

    // Register 0000 - Header
    lines.push(
      generateSpedHeader({
        codVer: SpedFiscalService.LAYOUT_VERSION,
        codFin: '0',
        dtIni: periodoInicio,
        dtFim: periodoFim,
        nome: company.razaoSocial,
        cnpj: company.cnpj,
        uf: company.uf || 'SP',
        ie: company.inscricaoEstadual || undefined,
        codMun: company.codigoMunicipioIbge || '3550308',
        indPerfil: 'A',
        indAtiv: '0',
      }),
    );
    lineCount++;

    // Register 0001 - Opening Block 0
    lines.push(generateSpedLine('0001', '0')); // 0=com dados
    lineCount++;

    // Register 0005 - Company supplementary data
    lines.push(
      generateSpedLine(
        '0005',
        company.nomeFantasia || company.razaoSocial,
        company.cep || '',
        company.logradouro || '',
        company.numero || '',
        company.complemento || '',
        company.bairro || '',
        company.telefone || '',
        '', // fax
        company.email || '',
      ),
    );
    lineCount++;

    // Register 0100 - Accountant data (placeholder — dados do contador não gerenciados no sistema)
    lines.push(
      generateSpedLine(
        '0100',
        'CONTADOR RESPONSAVEL',
        '00000000000', // CPF
        '000000',      // CRC
        '',            // CNPJ escritorio
        '',            // CEP
        '',            // Endereco
        '',            // Numero
        '',            // Complemento
        '',            // Bairro
        '',            // Telefone
        '',            // Fax
        '',            // Email
        company.codigoMunicipioIbge || '',
      ),
    );
    lineCount++;

    // -------------------------------------------------------------------------
    // 0150 — Participantes (real: persons from NF-e saídas + NF-e entradas)
    // -------------------------------------------------------------------------

    // Fetch NF-e saídas for participants
    const nfeSaidasPart = await this.prisma.nFeDocument.findMany({
      where: {
        companyId,
        status: 'AUTORIZADA' as any,
        type: 'SAIDA' as any,
        dataEmissao: { gte: periodoInicio, lte: periodoFim },
      },
      include: {
        person: {
          include: { addresses: { take: 1 } },
        },
      },
    });

    // Fetch NF-e entradas (inbox) for participants
    const nfeEntradasPart = await this.prisma.nFeInbox.findMany({
      where: {
        companyId,
        status: { in: ['ESCRITURACAO', 'FINALIZADA', 'LANCADA'] as any[] },
        dataEmissao: { gte: periodoInicio, lte: periodoFim },
      },
      include: {
        emitentePessoa: {
          include: { addresses: { take: 1 } },
        },
      },
    });

    // Build deduplicated map of participants
    // Key: person.id (for linked persons) or CNPJ (for NFeInbox without linked person)
    const participantMap = new Map<string, {
      codPart: string;
      nome: string;
      cnpj: string;
      cpf: string;
      ie: string;
      codMun: string;
      suframa: string;
      end: string;
      num: string;
      compl: string;
      bairro: string;
    }>();

    for (const doc of nfeSaidasPart) {
      const p = doc.person;
      if (!p) continue;
      if (participantMap.has(p.id)) continue;
      const addr = (p as any).addresses?.[0];
      const isCnpj = p.cpfCnpj.length === 14;
      participantMap.set(p.id, {
        codPart: p.id,
        nome: p.razaoSocial,
        cnpj: isCnpj ? p.cpfCnpj : '',
        cpf: !isCnpj ? p.cpfCnpj : '',
        ie: p.rgIe || '',
        codMun: p.municipioIbge || (addr?.codigoMunicipioIbge ?? ''),
        suframa: p.suframa || '',
        end: addr?.logradouro ?? '',
        num: addr?.numero ?? '',
        compl: addr?.complemento ?? '',
        bairro: addr?.bairro ?? '',
      });
    }

    for (const inbox of nfeEntradasPart) {
      if ((inbox as any).emitentePessoa) {
        const p = (inbox as any).emitentePessoa as any;
        const key = p.id as string;
        if (participantMap.has(key)) continue;
        const addr = p.addresses?.[0];
        const isCnpj = p.cpfCnpj.length === 14;
        participantMap.set(key, {
          codPart: p.id,
          nome: p.razaoSocial,
          cnpj: isCnpj ? p.cpfCnpj : '',
          cpf: !isCnpj ? p.cpfCnpj : '',
          ie: p.rgIe || '',
          codMun: p.municipioIbge || (addr?.codigoMunicipioIbge ?? ''),
          suframa: p.suframa || '',
          end: addr?.logradouro ?? '',
          num: addr?.numero ?? '',
          compl: addr?.complemento ?? '',
          bairro: addr?.bairro ?? '',
        });
      } else {
        // NFeInbox without linked person — use CNPJ as key
        const cnpj = (inbox as any).emitenteCnpj as string;
        if (participantMap.has(cnpj)) continue;
        participantMap.set(cnpj, {
          codPart: cnpj,
          nome: (inbox as any).emitenteNome as string,
          cnpj,
          cpf: '',
          ie: '',
          codMun: '',
          suframa: '',
          end: '',
          num: '',
          compl: '',
          bairro: '',
        });
      }
    }

    for (const part of participantMap.values()) {
      lines.push(
        generateSpedLine(
          '0150',
          part.codPart,
          part.nome,
          '1058', // cod_pais — Brasil
          part.cnpj,
          part.cpf,
          part.ie,
          part.codMun,
          part.suframa,
          part.end,
          part.num,
          part.compl,
          part.bairro,
        ),
      );
      lineCount++;
    }

    // -------------------------------------------------------------------------
    // 0190 — Unidades de medida (real: distinct units from products)
    // -------------------------------------------------------------------------
    const unidades = await this.prisma.product.findMany({
      where: { companyId },
      select: { unit: true },
      distinct: ['unit'],
    });

    for (const u of unidades) {
      const unit = String(u.unit);
      lines.push(generateSpedLine('0190', unit, unit));
      lineCount++;
    }

    // Guarantee at least UN is present if none found
    if (unidades.length === 0) {
      lines.push(generateSpedLine('0190', 'UN', 'UNIDADE'));
      lineCount++;
    }

    // -------------------------------------------------------------------------
    // 0200 — Produtos/Serviços (real: products from catalog)
    // -------------------------------------------------------------------------
    const products = await this.prisma.product.findMany({
      where: { companyId },
      select: {
        code: true,
        description: true,
        unit: true,
        destinacaoFiscal: true,
        ncm: { select: { code: true } },
      },
    });

    for (const prod of products) {
      const tipoItem = this.mapTipoItem((prod as any).destinacaoFiscal);
      const ncmCode = (prod as any).ncm?.code ?? '';
      lines.push(
        generateSpedLine(
          '0200',
          prod.code,
          prod.description,
          '',        // cod_barra
          '',        // cod_ant_item
          String(prod.unit),
          tipoItem,
          ncmCode,
          '',        // EX IPI
          '',        // cod_genero
          '',        // cod_lst
          formatSpedDecimal(0), // aliq_ipi
        ),
      );
      lineCount++;
    }

    // Register 0990 - Closing Block 0
    lines.push(generateSpedLine('0990', (lineCount + 1).toString()));
    lineCount++;

    // =========================================================================
    // BLOCO C - Documentos Fiscais I (Mercadorias)
    // =========================================================================

    lines.push(generateSpedLine('C001', '0')); // 0=com dados
    lineCount++;

    // -------------------------------------------------------------------------
    // C100/C170 — NF-e saídas (emissão própria)
    // -------------------------------------------------------------------------
    const nfeSaidas = await this.prisma.nFeDocument.findMany({
      where: {
        companyId,
        status: 'AUTORIZADA' as any,
        type: 'SAIDA' as any,
        dataEmissao: { gte: periodoInicio, lte: periodoFim },
      },
      include: {
        items: true,
        person: true,
      },
    });

    for (const doc of nfeSaidas) {
      const codPart = (doc as any).person?.id ?? '';
      const dtDoc = (doc as any).dataEmissao
        ? formatSpedDate(new Date((doc as any).dataEmissao))
        : '';
      const dtES = (doc as any).dataEntradaSaida
        ? formatSpedDate(new Date((doc as any).dataEntradaSaida))
        : dtDoc;

      // Aggregate BC ICMS and ICMS ST from items
      const items = (doc as any).items as any[];
      const vlBcIcms = items.reduce((s: number, it: any) => s + Number(it.bcIcms ?? 0), 0);
      const vlBcIcmsSt = items.reduce((s: number, it: any) => s + Number(it.bcIcmsSt ?? 0), 0);

      lines.push(
        generateSpedLine(
          'C100',
          '1',                                       // ind_oper: 1=saída
          '0',                                       // ind_emit: 0=emissão própria
          codPart,                                   // cod_part
          '55',                                      // mod
          '00',                                      // cod_sit
          String((doc as any).serie ?? '1'),         // ser
          String((doc as any).numero ?? ''),         // num_doc
          (doc as any).chaveAcesso ?? '',            // chv_nfe
          dtDoc,                                     // dt_doc
          dtES,                                      // dt_e_s
          formatSpedDecimal(Number((doc as any).valorTotal ?? 0)),     // vl_doc
          '1',                                       // ind_pgto: 1=a prazo
          formatSpedDecimal(Number((doc as any).valorDesconto ?? 0)),  // vl_desc
          formatSpedDecimal(0),                      // vl_abatnt
          formatSpedDecimal(Number((doc as any).valorProdutos ?? 0)),  // vl_merc
          '1',                                       // ind_frt: 1=CIF
          formatSpedDecimal(Number((doc as any).valorFrete ?? 0)),     // vl_frt
          formatSpedDecimal(Number((doc as any).valorSeguro ?? 0)),    // vl_seg
          formatSpedDecimal(Number((doc as any).valorOutros ?? 0)),    // vl_out_da
          formatSpedDecimal(vlBcIcms),               // vl_bc_icms
          formatSpedDecimal(Number((doc as any).valorIcms ?? 0)),      // vl_icms
          formatSpedDecimal(vlBcIcmsSt),             // vl_bc_icms_st
          formatSpedDecimal(Number((doc as any).valorIcmsSt ?? 0)),    // vl_icms_st
          formatSpedDecimal(Number((doc as any).valorIpi ?? 0)),       // vl_ipi
          formatSpedDecimal(Number((doc as any).valorPis ?? 0)),       // vl_pis
          formatSpedDecimal(Number((doc as any).valorCofins ?? 0)),    // vl_cofins
          formatSpedDecimal(0),                      // vl_pis_st
          formatSpedDecimal(0),                      // vl_cofins_st
        ),
      );
      lineCount++;

      // C170 — items
      for (const item of items) {
        lines.push(
          generateSpedLine(
            'C170',
            String(item.itemNumber ?? '1'),
            item.productId ? item.productId : item.description,  // cod_item — use productId to match 0200
            item.description ?? '',
            formatSpedDecimal(Number(item.quantity ?? 0), 4),
            String(item.unit ?? 'UN'),
            formatSpedDecimal(Number(item.totalPrice ?? 0)),
            formatSpedDecimal(Number(0)),              // vl_desc (not stored per item separately)
            '0',                                       // ind_mov: 0=com movimentação física
            String(item.cstIcms ?? '000'),             // cst_icms
            String(item.cfopCode ?? ''),               // cfop
            '',                                        // cod_nat
            formatSpedDecimal(Number(item.bcIcms ?? 0)),
            formatSpedDecimal(Number(item.aliqIcms ?? 0)),
            formatSpedDecimal(Number(item.valorIcms ?? 0)),
            formatSpedDecimal(Number(item.bcIcmsSt ?? 0)),
            formatSpedDecimal(Number(item.aliqIcmsSt ?? 0)),
            formatSpedDecimal(Number(item.valorIcmsSt ?? 0)),
            'T',                                       // ind_apur: T=período
            String(item.cstIpi ?? '99'),               // cst_ipi
            '',                                        // cod_enq
            formatSpedDecimal(Number(item.bcIpi ?? 0)),
            formatSpedDecimal(Number(item.aliqIpi ?? 0)),
            formatSpedDecimal(Number(item.valorIpi ?? 0)),
            String(item.cstPis ?? '50'),               // cst_pis
            formatSpedDecimal(Number(item.bcPis ?? 0)),
            formatSpedDecimal(Number(item.aliqPis ?? 0)),
            formatSpedDecimal(0, 4),                   // quant_bc_pis
            formatSpedDecimal(Number(item.valorPis ?? 0)),
            String(item.cstCofins ?? '50'),            // cst_cofins
            formatSpedDecimal(Number(item.bcCofins ?? 0)),
            formatSpedDecimal(Number(item.aliqCofins ?? 0)),
            formatSpedDecimal(0, 4),                   // quant_bc_cofins
            formatSpedDecimal(Number(item.valorCofins ?? 0)),
            '',                                        // cod_cta
          ),
        );
        lineCount++;
      }
    }

    // -------------------------------------------------------------------------
    // C100/C170 — NF-e entradas (terceiros, escrituradas)
    // -------------------------------------------------------------------------
    const nfeEntradas = await this.prisma.nFeInbox.findMany({
      where: {
        companyId,
        status: { in: ['ESCRITURACAO', 'FINALIZADA', 'LANCADA'] as any[] },
        dataEmissao: { gte: periodoInicio, lte: periodoFim },
      },
      include: { items: true },
    });

    for (const inbox of nfeEntradas) {
      const codPart = (inbox as any).emitentePessoaId ?? (inbox as any).emitenteCnpj;
      const dtDoc = formatSpedDate(new Date((inbox as any).dataEmissao));
      const inboxItems = (inbox as any).items as any[];

      lines.push(
        generateSpedLine(
          'C100',
          '0',                                        // ind_oper: 0=entrada
          '1',                                        // ind_emit: 1=terceiros
          codPart,                                    // cod_part
          '55',                                       // mod
          '00',                                       // cod_sit
          String((inbox as any).serie ?? '1'),        // ser
          String((inbox as any).numero ?? ''),        // num_doc
          (inbox as any).chaveAcesso ?? '',           // chv_nfe
          dtDoc,                                      // dt_doc
          dtDoc,                                      // dt_e_s (usar mesma data como entrada)
          formatSpedDecimal(Number((inbox as any).valorTotal ?? 0)),
          '1',                                        // ind_pgto
          formatSpedDecimal(Number((inbox as any).valorDesconto ?? 0)),
          formatSpedDecimal(0),                       // vl_abatnt
          formatSpedDecimal(
            Number((inbox as any).valorTotal ?? 0) -
            Number((inbox as any).valorFrete ?? 0) -
            Number((inbox as any).valorSeguro ?? 0) -
            Number((inbox as any).valorOutrasDespesas ?? 0) +
            Number((inbox as any).valorDesconto ?? 0)
          ),                                          // vl_merc (aproximado)
          '1',                                        // ind_frt
          formatSpedDecimal(Number((inbox as any).valorFrete ?? 0)),
          formatSpedDecimal(Number((inbox as any).valorSeguro ?? 0)),
          formatSpedDecimal(Number((inbox as any).valorOutrasDespesas ?? 0)),
          formatSpedDecimal(inboxItems.reduce((s: number, it: any) => s + 0, 0)), // vl_bc_icms (not stored at header level)
          formatSpedDecimal(inboxItems.reduce((s: number, it: any) => s + Number(it.valorIcms ?? 0), 0)),
          formatSpedDecimal(0),                       // vl_bc_icms_st
          formatSpedDecimal(0),                       // vl_icms_st
          formatSpedDecimal(inboxItems.reduce((s: number, it: any) => s + Number(it.valorIpi ?? 0), 0)),
          formatSpedDecimal(inboxItems.reduce((s: number, it: any) => s + Number(it.valorPis ?? 0), 0)),
          formatSpedDecimal(inboxItems.reduce((s: number, it: any) => s + Number(it.valorCofins ?? 0), 0)),
          formatSpedDecimal(0),                       // vl_pis_st
          formatSpedDecimal(0),                       // vl_cofins_st
        ),
      );
      lineCount++;

      // C170 — NFeInboxItem
      for (const item of inboxItems) {
        const codItem = (item as any).codigoProdutoFornecedor ?? '';
        const descrItem = (item as any).descricaoProduto ?? '';
        lines.push(
          generateSpedLine(
            'C170',
            String((item as any).numeroItem ?? '1'),
            codItem,
            descrItem,
            formatSpedDecimal(Number((item as any).quantidade ?? 0), 4),
            String((item as any).unidade ?? 'UN'),
            formatSpedDecimal(Number((item as any).valorTotal ?? 0)),
            formatSpedDecimal(0),                      // vl_desc
            '0',                                       // ind_mov
            '000',                                     // cst_icms (not stored in NFeInboxItem)
            String((item as any).cfop ?? ''),          // cfop
            '',                                        // cod_nat
            formatSpedDecimal(0),                      // vl_bc_icms (not stored)
            formatSpedDecimal(0),                      // aliq_icms
            formatSpedDecimal(Number((item as any).valorIcms ?? 0)),
            formatSpedDecimal(0),                      // vl_bc_icms_st
            formatSpedDecimal(0),                      // aliq_icms_st
            formatSpedDecimal(0),                      // vl_icms_st
            'T',                                       // ind_apur
            '99',                                      // cst_ipi
            '',                                        // cod_enq
            formatSpedDecimal(0),                      // vl_bc_ipi
            formatSpedDecimal(0),                      // aliq_ipi
            formatSpedDecimal(Number((item as any).valorIpi ?? 0)),
            '50',                                      // cst_pis
            formatSpedDecimal(0),                      // vl_bc_pis
            formatSpedDecimal(0),                      // aliq_pis
            formatSpedDecimal(0, 4),                   // quant_bc_pis
            formatSpedDecimal(Number((item as any).valorPis ?? 0)),
            '50',                                      // cst_cofins
            formatSpedDecimal(0),                      // vl_bc_cofins
            formatSpedDecimal(0),                      // aliq_cofins
            formatSpedDecimal(0, 4),                   // quant_bc_cofins
            formatSpedDecimal(Number((item as any).valorCofins ?? 0)),
            '',                                        // cod_cta
          ),
        );
        lineCount++;
      }
    }

    lines.push(generateSpedLine('C990', (lineCount + 1).toString()));
    lineCount++;

    // =========================================================================
    // BLOCO E - Apuracao ICMS
    // =========================================================================

    lines.push(generateSpedLine('E001', '0'));
    lineCount++;

    // Register E100 - ICMS period
    lines.push(
      generateSpedLine(
        'E100',
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoFim),
      ),
    );
    lineCount++;

    // -------------------------------------------------------------------------
    // E110 — ICMS apuração (real: aggregate from FiscalEntry)
    // -------------------------------------------------------------------------
    const periodoRef = `${periodoInicio.getFullYear()}-${String(periodoInicio.getMonth() + 1).padStart(2, '0')}`;

    const fiscalEntries = await this.prisma.fiscalEntry.findMany({
      where: {
        companyId,
        periodoReferencia: periodoRef,
        taxType: 'ICMS',
      },
    });

    const debitosIcms = fiscalEntries
      .filter((e) => (e as any).bookType === 'SAIDA' && (e as any).type === 'DEBITO')
      .reduce((s, e) => s + Number((e as any).valorImposto ?? 0), 0);

    const creditosIcms = fiscalEntries
      .filter((e) => (e as any).bookType === 'ENTRADA' && (e as any).type === 'CREDITO')
      .reduce((s, e) => s + Number((e as any).valorImposto ?? 0), 0);

    const saldoApurado = debitosIcms - creditosIcms;
    const icmsRecolher = Math.max(0, saldoApurado);
    const saldoCredorTransp = Math.max(0, -saldoApurado);

    lines.push(
      generateSpedLine(
        'E110',
        formatSpedDecimal(debitosIcms),        // VL_TOT_DEBITOS
        formatSpedDecimal(0),                  // VL_AJ_DEBITOS
        formatSpedDecimal(debitosIcms),        // VL_TOT_AJ_DEBITOS
        formatSpedDecimal(creditosIcms),       // VL_TOT_CREDITOS
        formatSpedDecimal(0),                  // VL_AJ_CREDITOS
        formatSpedDecimal(creditosIcms),       // VL_TOT_AJ_CREDITOS
        formatSpedDecimal(0),                  // VL_SLD_CREDOR_ANT
        formatSpedDecimal(saldoApurado),       // VL_SLD_APURADO
        formatSpedDecimal(0),                  // VL_TOT_DED
        formatSpedDecimal(icmsRecolher),       // VL_ICMS_RECOLHER
        formatSpedDecimal(saldoCredorTransp),  // VL_SLD_CREDOR_TRANSP
        formatSpedDecimal(0),                  // VL_DEB_ESP
      ),
    );
    lineCount++;

    // Register E200 - ICMS ST period
    lines.push(
      generateSpedLine(
        'E200',
        company.uf || 'SP',
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoFim),
      ),
    );
    lineCount++;

    lines.push(generateSpedLine('E990', (lineCount + 1).toString()));
    lineCount++;

    // =========================================================================
    // BLOCO G — CIAP (Controle de Crédito de ICMS do Ativo Permanente) (A10)
    // G001 / G110 / G125 / G990
    // =========================================================================

    // Fetch all CIAP-eligible assets with movements in this period
    const ciapAtivos = await this.prisma.fixedAsset.findMany({
      where: { companyId, ciapAtivo: true },
      include: {
        ciapMovimentos: {
          where: {
            ano: periodoInicio.getFullYear(),
            mes: periodoInicio.getMonth() + 1,
          },
        },
      },
    });

    const ciapComMovimento = ciapAtivos.filter(a => a.ciapMovimentos.length > 0);

    if (ciapComMovimento.length > 0) {
      // G001 - Abertura do Bloco G
      lines.push(generateSpedLine('G001', '0')); // 0=com dados
      lineCount++;

      // G110 - CIAP — Período de apuração
      lines.push(
        generateSpedLine(
          'G110',
          formatSpedDate(periodoInicio),
          formatSpedDate(periodoFim),
          formatSpedDecimal(0), // saldo credor ICMS transportado anterior
          formatSpedDecimal(ciapComMovimento.reduce((s, a) => s + Number(a.icmsNaEntrada ?? 0), 0)), // total ICMS ativo permanente no período
        ),
      );
      lineCount++;

      // G125 — Um registro por bem imobilizado com crédito no período
      for (const asset of ciapComMovimento) {
        const mov = asset.ciapMovimentos[0];
        lines.push(
          generateSpedLine(
            'G125',
            asset.plaqueta,                                       // cod_item (plaqueta do bem)
            asset.nfeEntradaNumero || '',                         // num_doc — número da NF-e de aquisição
            formatSpedDate(asset.dataAquisicao),                  // data entrada do bem
            formatSpedDecimal(Number(asset.icmsNaEntrada ?? 0)), // valor do ICMS na entrada
            asset.parcelasIcmsCiap.toString(),                    // qtd de parcelas (48)
            mov.parcelaNumero.toString(),                         // número da parcela atual
            formatSpedDecimal(Number(mov.valorCredito)),          // valor do crédito a apropriar
            asset.nfeEntradaChave || '',                          // chave NF-e de aquisição
          ),
        );
        lineCount++;
      }

      // G990 - Encerramento do Bloco G
      lines.push(generateSpedLine('G990', (lineCount + 1).toString()));
      lineCount++;
    } else {
      // G001 sem dados
      lines.push(generateSpedLine('G001', '1')); // 1=sem dados
      lineCount++;
      lines.push(generateSpedLine('G990', (lineCount + 1).toString()));
      lineCount++;
    }

    // =========================================================================
    // BLOCO H — Inventário (real: stock balances)
    // =========================================================================

    // Query stock balances at end of period
    const balances = await this.prisma.stockBalance.findMany({
      where: { companyId, quantity: { gt: 0 } },
      include: {
        product: { select: { code: true, unit: true, description: true } },
      },
    });

    const totalInventario = balances.reduce(
      (s, b) => s + Number((b as any).totalCost ?? 0),
      0,
    );

    if (balances.length > 0) {
      lines.push(generateSpedLine('H001', '0')); // 0=com dados
      lineCount++;

      // H005 — Data e valor do inventário
      lines.push(
        generateSpedLine(
          'H005',
          formatSpedDate(periodoFim),
          formatSpedDecimal(totalInventario),
          '01', // MOT_INV: 01=balanço
        ),
      );
      lineCount++;

      // H010 — Um registro por item de estoque
      for (const bal of balances) {
        const prod = (bal as any).product as any;
        const qty = Number((bal as any).quantity ?? 0);
        const avgCost = Number((bal as any).averageCost ?? 0);
        const totalCost = Number((bal as any).totalCost ?? 0);
        lines.push(
          generateSpedLine(
            'H010',
            prod.code,                            // COD_ITEM
            String(prod.unit ?? 'UN'),            // UNID
            formatSpedDecimal(qty, 4),            // QTD
            formatSpedDecimal(avgCost, 4),        // VL_UNIT
            formatSpedDecimal(totalCost),         // VL_ITEM
            '1',                                  // IND_PROP: 1=próprio
            '',                                   // COD_PART
            '',                                   // TXT_COMPL
            '',                                   // COD_CTA
            formatSpedDecimal(totalCost),         // VL_ITEM_IR
          ),
        );
        lineCount++;
      }

      lines.push(generateSpedLine('H990', (lineCount + 1).toString()));
      lineCount++;
    } else {
      lines.push(generateSpedLine('H001', '1')); // 1=sem dados
      lineCount++;
      lines.push(generateSpedLine('H990', (lineCount + 1).toString()));
      lineCount++;
    }

    // =========================================================================
    // BLOCO K - Controle da Producao e do Estoque (A9)
    // K001 / K100 / K200 / K230 / K235 / K990
    // =========================================================================

    // K001 - Abertura do Bloco K
    lines.push(generateSpedLine('K001', '0')); // 0=com dados
    lineCount++;

    // K100 - Período de escrituração
    lines.push(
      generateSpedLine(
        'K100',
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoFim),
      ),
    );
    lineCount++;

    // K200 - Estoque escriturado ao final do período
    // Fetch all stock balances for this company
    const stockBalances = await this.prisma.stockBalance.findMany({
      where: { companyId },
      include: {
        product: { select: { code: true, unit: true } },
      },
    });

    for (const balance of stockBalances) {
      lines.push(
        generateSpedLine(
          'K200',
          formatSpedDate(periodoFim),
          balance.product.code,
          formatSpedDecimal(Number(balance.quantity)),
          balance.product.unit || 'UN',
          '0', // ind_estoque: 0=final, 1=inicial
        ),
      );
      lineCount++;
    }

    // K230 + K235 — Itens produzidos e insumos consumidos por OP
    // Fetch production orders that had activity in this period
    const productionOrders = await this.prisma.productionOrder.findMany({
      where: {
        companyId,
        updatedAt: {
          gte: periodoInicio,
          lte: periodoFim,
        },
      },
      include: {
        product: { select: { code: true, unit: true } },
        items: {
          where: { quantityConsumed: { gt: 0 } },
          include: {
            product: { select: { code: true, unit: true } },
          },
        },
      },
    });

    for (const op of productionOrders) {
      const qtdProduzida = Number((op as any).quantityProduced ?? 0);
      if (qtdProduzida <= 0 && op.items.length === 0) continue;

      // K230 - Item produzido
      if (qtdProduzida > 0) {
        lines.push(
          generateSpedLine(
            'K230',
            formatSpedDate((op as any).completedAt ?? periodoFim),
            op.product.code,                          // cod_item produto acabado
            formatSpedDecimal(qtdProduzida),           // qtd_producao
          ),
        );
        lineCount++;

        // K235 - Insumos consumidos nesta OP (filhos do K230)
        for (const item of op.items) {
          lines.push(
            generateSpedLine(
              'K235',
              formatSpedDate((op as any).completedAt ?? periodoFim),
              item.product.code,                        // cod_item componente
              formatSpedDecimal(Number(item.quantityConsumed)), // qtd_cons
              item.product.unit || 'UN',
            ),
          );
          lineCount++;
        }
      }
    }

    // K990 - Encerramento do Bloco K
    lines.push(generateSpedLine('K990', (lineCount + 1).toString()));
    lineCount++;

    // =========================================================================
    // BLOCO 9 - Controle e Encerramento
    // =========================================================================

    lines.push(generateSpedLine('9001', '0'));
    lineCount++;

    // Count registers for 9900 — count lines per register type in the generated file
    const regCounts = new Map<string, number>();
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const reg = parts[1];
        regCounts.set(reg, (regCounts.get(reg) ?? 0) + 1);
      }
    }

    // Add entries for registers in Bloco 9 that don't exist yet
    // We need 9900 (will add below), 9990 and 9999
    const blocoNineRegisters = ['9001', '9900', '9990', '9999'];

    // Emit 9900 for each register found (including 9900 itself — 4 lines approx)
    const sortedRegs = Array.from(regCounts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    // Count how many 9900 lines will be emitted: one per unique register type
    // plus the registers in bloco 9 that are not yet counted
    const total9900Lines = sortedRegs.length + blocoNineRegisters.length;

    for (const [reg, count] of sortedRegs) {
      lines.push(generateSpedLine('9900', reg, count.toString()));
      lineCount++;
    }

    // 9900 for 9900 itself
    lines.push(generateSpedLine('9900', '9900', total9900Lines.toString()));
    lineCount++;
    // 9900 for 9990
    lines.push(generateSpedLine('9900', '9990', '1'));
    lineCount++;
    // 9900 for 9999
    lines.push(generateSpedLine('9900', '9999', '1'));
    lineCount++;
    // 9900 for 9001
    lines.push(generateSpedLine('9900', '9001', '1'));
    lineCount++;

    lines.push(generateSpedLine('9990', (lineCount + 1).toString()));
    lineCount++;

    // Register 9999 - File closing
    lines.push(generateSpedLine('9999', (lineCount + 1).toString()));

    const fileContent = lines.join('\r\n');

    // Log the generation
    await this.logTransmission({
      companyId,
      type: 'SPED_FISCAL',
      endpoint: 'local:file_generation',
      success: true,
      documentNumber: `EFD_${formatSpedDate(periodoInicio)}_${formatSpedDate(periodoFim)}`,
      processingTimeMs: 0,
    });

    this.logger.log(
      `[SpedFiscal] Generated EFD ICMS/IPI file for ${company.razaoSocial} period ${periodoInicio.toISOString()} - ${periodoFim.toISOString()} (${lineCount + 1} lines)`,
    );

    return fileContent;
  }
}
