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
 * EFD PIS/COFINS (SPED Contribuições) — A11
 * Layout 006 — dados reais do banco de dados.
 */
@Injectable()
export class SpedContribuicoesService extends GovernmentTransmissionService {
  private static readonly LAYOUT_VERSION = '006';

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  async generateFile(
    companyId: string,
    periodoInicio: Date,
    periodoFim: Date,
  ): Promise<string> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error(`Company ${companyId} not found`);

    const periodoRef = `${periodoInicio.getFullYear()}-${String(periodoInicio.getMonth() + 1).padStart(2, '0')}`;

    // ── Pre-fetch data ────────────────────────────────────────────────────────

    // NF-e saídas emitidas no período
    const nfeSaidas = await this.prisma.nFeDocument.findMany({
      where: {
        companyId,
        status: 'AUTORIZADA' as any,
        type: 'SAIDA' as any,
        dataEmissao: { gte: periodoInicio, lte: periodoFim },
      },
      include: { person: true, items: true },
    });

    // NF-e entradas (inbox escrituradas no período)
    const nfeEntradas = await this.prisma.nFeInbox.findMany({
      where: {
        companyId,
        status: 'ESCRITURADA' as any,
        dataEmissao: { gte: periodoInicio, lte: periodoFim },
      },
      include: { items: true },
    });

    // FiscalEntries do período para PIS e COFINS
    const fiscalEntries = await this.prisma.fiscalEntry.findMany({
      where: {
        companyId,
        periodoReferencia: periodoRef,
        taxType: { in: ['PIS', 'COFINS'] },
      },
    });

    const lines: string[] = [];
    let lineCount = 0;
    const push = (line: string) => { lines.push(line); lineCount++; };

    // =========================================================================
    // BLOCO 0 — Abertura e Identificação
    // =========================================================================

    push(generateSpedHeader({
      codVer: SpedContribuicoesService.LAYOUT_VERSION,
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
    }));

    const bloco0Start = lineCount;
    push(generateSpedLine('0001', '0'));

    // 0100 — Contador (placeholder)
    push(generateSpedLine(
      '0100',
      'CONTADOR RESPONSAVEL', '00000000000', '000000',
      '', '', '', '', '', '', '', '', '',
      company.codigoMunicipioIbge || '',
    ));

    // 0140 — Estabelecimento (dados reais)
    push(generateSpedLine(
      '0140',
      company.cnpj,
      company.razaoSocial,
      (company as any).inscricaoMunicipal || '',
      company.uf || 'SP',
      company.inscricaoEstadual || '',
      company.codigoMunicipioIbge || '',
      '', // suframa
      '', // cnae
    ));

    // 0150 — Participantes (pessoas das NF-e saídas + emitentes das entradas)
    const seenPersons = new Set<string>();
    for (const nfe of nfeSaidas) {
      if (nfe.person && !seenPersons.has(nfe.person.id)) {
        seenPersons.add(nfe.person.id);
        const addr = await this.prisma.personAddress.findFirst({ where: { personId: nfe.person.id } });
        push(generateSpedLine(
          '0150',
          nfe.person.id,
          nfe.person.razaoSocial,
          '1058', // Brasil
          nfe.person.type === 'PJ' ? nfe.person.cpfCnpj : '',
          nfe.person.type === 'PF' ? nfe.person.cpfCnpj : '',
          nfe.person.rgIe || '',
          (nfe.person as any).municipioIbge || '',
          (nfe.person as any).suframa || '',
          addr?.logradouro || '',
          (addr as any)?.numero || '',
          addr?.complemento || '',
          addr?.bairro || '',
        ));
      }
    }
    for (const inbox of nfeEntradas) {
      if (!seenPersons.has(inbox.emitenteCnpj)) {
        seenPersons.add(inbox.emitenteCnpj);
        push(generateSpedLine(
          '0150',
          inbox.emitenteCnpj,
          inbox.emitenteNome,
          '1058', '', inbox.emitenteCnpj, '', '', '', '', '', '', '',
        ));
      }
    }

    // 0190 — Unidades de medida (distintas dos itens)
    const unidades = new Set<string>();
    for (const nfe of nfeSaidas) for (const item of nfe.items) unidades.add(item.unit || 'UN');
    for (const inbox of nfeEntradas) for (const item of inbox.items) unidades.add(item.unidade || 'UN');
    for (const und of unidades) push(generateSpedLine('0190', und, und));

    // 0200 — Produtos (distintos dos itens das saídas)
    const seenProducts = new Set<string>();
    for (const nfe of nfeSaidas) {
      for (const item of nfe.items) {
        const code = item.description?.substring(0, 20)?.replace(/\s+/g, '_') || 'PROD';
        if (!seenProducts.has(code)) {
          seenProducts.add(code);
          push(generateSpedLine(
            '0200',
            code,
            item.description?.substring(0, 60) || '',
            '', '', item.unit || 'UN', '04',
            item.ncmCode || '', '', '', '', '',
          ));
        }
      }
    }

    push(generateSpedLine('0990', (lineCount - bloco0Start + 1).toString()));

    // =========================================================================
    // BLOCO A — Serviços NFS-e (sem dados por ora)
    // =========================================================================
    push(generateSpedLine('A001', '1')); // 1=sem dados
    push(generateSpedLine('A990', '2'));

    // =========================================================================
    // BLOCO C — Documentos Fiscais de Mercadorias
    // =========================================================================
    push(generateSpedLine('C001', '0'));
    const c001Line = lineCount;

    // C100 saídas (NFeDocuments — emissão própria)
    for (const nfe of nfeSaidas) {
      const bcPis    = nfe.items.reduce((s, i) => s + (i.bcPis    || 0), 0);
      const vlPis    = nfe.items.reduce((s, i) => s + (i.valorPis || 0), 0);
      const bcCofins = nfe.items.reduce((s, i) => s + (i.bcCofins    || 0), 0);
      const vlCofins = nfe.items.reduce((s, i) => s + (i.valorCofins || 0), 0);

      push(generateSpedLine(
        'C100',
        '1',  // IND_OPER: saída
        '0',  // IND_EMIT: emissão própria
        nfe.person?.id || '',
        '55', '00',
        String(nfe.serie || 1),
        String(nfe.numero || ''),
        nfe.chaveAcesso || '',
        nfe.dataEmissao ? formatSpedDate(new Date(nfe.dataEmissao)) : '',
        nfe.dataEntradaSaida ? formatSpedDate(new Date(nfe.dataEntradaSaida)) : '',
        formatSpedDecimal(nfe.valorTotal),
        '1',
        formatSpedDecimal(nfe.valorDesconto),
        '0,00',
        formatSpedDecimal(nfe.valorProdutos),
        '1',
        formatSpedDecimal(nfe.valorFrete),
        formatSpedDecimal(nfe.valorSeguro),
        formatSpedDecimal(nfe.valorOutros),
        formatSpedDecimal(bcPis),
        formatSpedDecimal(vlPis),
        formatSpedDecimal(bcCofins),
        formatSpedDecimal(vlCofins),
        company.codigoMunicipioIbge || '',
        '', 'T', '1',
      ));

      for (const item of nfe.items) {
        push(generateSpedLine(
          'C170',
          String(item.itemNumber),
          item.description?.substring(0, 20)?.replace(/\s+/g, '_') || '',
          item.description?.substring(0, 60) || '',
          formatSpedDecimal(item.quantity),
          item.unit || 'UN',
          formatSpedDecimal(item.totalPrice),
          formatSpedDecimal(0),
          '0',
          item.cstPis || '01',
          formatSpedDecimal(item.bcPis || 0),
          formatSpedDecimal(item.aliqPis || 0),
          '0,0000',
          formatSpedDecimal(item.valorPis || 0),
          item.cstCofins || '01',
          formatSpedDecimal(item.bcCofins || 0),
          formatSpedDecimal(item.aliqCofins || 0),
          '0,0000',
          formatSpedDecimal(item.valorCofins || 0),
          '',
        ));
      }
    }

    // C100 entradas (NFeInbox — terceiros)
    for (const inbox of nfeEntradas) {
      const vlPisInbox    = inbox.items.reduce((s, i) => s + Number(i.valorPis    ?? 0), 0);
      const vlCofinsInbox = inbox.items.reduce((s, i) => s + Number(i.valorCofins ?? 0), 0);

      push(generateSpedLine(
        'C100',
        '0',  // IND_OPER: entrada
        '1',  // IND_EMIT: terceiros
        inbox.emitenteCnpj,
        '55', '00',
        inbox.serie || '',
        inbox.numero || '',
        inbox.chaveAcesso || '',
        formatSpedDate(new Date(inbox.dataEmissao)),
        formatSpedDate(new Date(inbox.dataEmissao)),
        formatSpedDecimal(Number(inbox.valorTotal)),
        '1',
        formatSpedDecimal(Number(inbox.valorDesconto)),
        '0,00',
        formatSpedDecimal(Number(inbox.valorTotal) - Number(inbox.valorFrete)),
        '1',
        formatSpedDecimal(Number(inbox.valorFrete)),
        formatSpedDecimal(Number(inbox.valorSeguro)),
        formatSpedDecimal(Number(inbox.valorOutrasDespesas)),
        formatSpedDecimal(0),
        formatSpedDecimal(vlPisInbox),
        formatSpedDecimal(0),
        formatSpedDecimal(vlCofinsInbox),
        company.codigoMunicipioIbge || '',
        '', 'T', '1',
      ));

      for (const item of inbox.items) {
        push(generateSpedLine(
          'C170',
          String(item.numeroItem),
          item.codigoProdutoFornecedor || '',
          item.descricaoProduto?.substring(0, 60) || '',
          formatSpedDecimal(Number(item.quantidade)),
          item.unidade || 'UN',
          formatSpedDecimal(Number(item.valorTotal)),
          formatSpedDecimal(0),
          '0',
          '50', // CST_PIS crédito
          formatSpedDecimal(Number(item.valorTotal)),
          formatSpedDecimal(1.65),
          '0,0000',
          formatSpedDecimal(Number(item.valorPis ?? 0)),
          '50', // CST_COFINS crédito
          formatSpedDecimal(Number(item.valorTotal)),
          formatSpedDecimal(7.6),
          '0,0000',
          formatSpedDecimal(Number(item.valorCofins ?? 0)),
          '',
        ));
      }
    }

    push(generateSpedLine('C990', (lineCount - c001Line + 1).toString()));

    // =========================================================================
    // BLOCO M — Apuração PIS e COFINS (FiscalEntry reais)
    // =========================================================================
    push(generateSpedLine('M001', '0'));
    const m001Line = lineCount;

    // ── PIS ──────────────────────────────────────────────────────────────────
    const pisEntries = fiscalEntries.filter(e => e.taxType === 'PIS');
    const pisCredito = pisEntries
      .filter(e => e.bookType === 'ENTRADA' as any && e.type === 'CREDITO' as any)
      .reduce((s, e) => s + (e.valorImposto || 0), 0);
    const pisDebito = pisEntries
      .filter(e => e.bookType === 'SAIDA' as any && e.type === 'DEBITO' as any)
      .reduce((s, e) => s + (e.valorImposto || 0), 0);
    const pisARecolher = Math.max(0, pisDebito - pisCredito);
    const pisBcCredito = pisEntries
      .filter(e => e.bookType === 'ENTRADA' as any && e.type === 'CREDITO' as any)
      .reduce((s, e) => s + (e.baseCalculo || 0), 0);

    push(generateSpedLine(
      'M100',
      '101', '0',
      formatSpedDecimal(pisBcCredito),
      formatSpedDecimal(1.65),
      '0,0000',
      formatSpedDecimal(pisCredito),
      formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0),
      formatSpedDecimal(pisCredito),
      formatSpedDecimal(pisCredito),
      formatSpedDecimal(0), formatSpedDecimal(0),
    ));

    push(generateSpedLine(
      'M200',
      formatSpedDecimal(pisDebito),
      formatSpedDecimal(pisCredito),
      formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0),
      formatSpedDecimal(pisARecolher),
      formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0),
      formatSpedDecimal(pisARecolher),
    ));

    // ── COFINS ────────────────────────────────────────────────────────────────
    const cofinsEntries = fiscalEntries.filter(e => e.taxType === 'COFINS');
    const cofinsCredito = cofinsEntries
      .filter(e => e.bookType === 'ENTRADA' as any && e.type === 'CREDITO' as any)
      .reduce((s, e) => s + (e.valorImposto || 0), 0);
    const cofinsDebito = cofinsEntries
      .filter(e => e.bookType === 'SAIDA' as any && e.type === 'DEBITO' as any)
      .reduce((s, e) => s + (e.valorImposto || 0), 0);
    const cofinsARecolher = Math.max(0, cofinsDebito - cofinsCredito);
    const cofinsBcCredito = cofinsEntries
      .filter(e => e.bookType === 'ENTRADA' as any && e.type === 'CREDITO' as any)
      .reduce((s, e) => s + (e.baseCalculo || 0), 0);

    push(generateSpedLine(
      'M500',
      '501', '0',
      formatSpedDecimal(cofinsBcCredito),
      formatSpedDecimal(7.6),
      '0,0000',
      formatSpedDecimal(cofinsCredito),
      formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0),
      formatSpedDecimal(cofinsCredito),
      formatSpedDecimal(cofinsCredito),
      formatSpedDecimal(0), formatSpedDecimal(0),
    ));

    push(generateSpedLine(
      'M600',
      formatSpedDecimal(cofinsDebito),
      formatSpedDecimal(cofinsCredito),
      formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0),
      formatSpedDecimal(cofinsARecolher),
      formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0), formatSpedDecimal(0),
      formatSpedDecimal(cofinsARecolher),
    ));

    push(generateSpedLine('M990', (lineCount - m001Line + 1).toString()));

    // =========================================================================
    // BLOCO 9 — Encerramento
    // =========================================================================
    push(generateSpedLine('9001', '0'));

    // Count all registers so far
    const regCounts: Record<string, number> = {};
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const reg = parts[1];
        regCounts[reg] = (regCounts[reg] ?? 0) + 1;
      }
    }

    // 9900 — one entry per register type
    for (const [reg, count] of Object.entries(regCounts).sort()) {
      push(generateSpedLine('9900', reg, String(count)));
    }
    // Self-count for 9900
    const my9900Count = Object.keys(regCounts).length + 1;
    push(generateSpedLine('9900', '9900', String(my9900Count)));

    push(generateSpedLine('9990', (lineCount + 1).toString()));
    push(generateSpedLine('9999', (lineCount + 1).toString()));

    const fileContent = lines.join('\r\n');

    await this.logTransmission({
      companyId,
      type: 'SPED_CONTRIBUICOES',
      endpoint: 'local:file_generation',
      success: true,
      documentNumber: `EFD_CONTRIB_${formatSpedDate(periodoInicio)}_${formatSpedDate(periodoFim)}`,
      processingTimeMs: 0,
    });

    this.logger.log(
      `[SpedContribuicoes] EFD PIS/COFINS for ${company.razaoSocial}: ${lineCount} lines, ` +
      `${nfeSaidas.length} NF-e saídas, ${nfeEntradas.length} entradas, ` +
      `PIS a recolher: R$ ${pisARecolher.toFixed(2)}, COFINS: R$ ${cofinsARecolher.toFixed(2)}.`,
    );

    return fileContent;
  }
}
