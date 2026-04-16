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
 * EFD PIS/COFINS (SPED Contribuicoes) file generation service.
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

  /**
   * Generate a complete EFD PIS/COFINS file for a given period.
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

    // =========================================================================
    // BLOCO 0 - Abertura e Identificacao
    // =========================================================================

    // Register 0000 - Header
    lines.push(
      generateSpedHeader({
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
      }),
    );

    // Register 0001 - Opening Block 0
    lines.push(generateSpedLine('0001', '0'));

    // Register 0100 - Accountant
    lines.push(
      generateSpedLine(
        '0100',
        'CONTADOR RESPONSAVEL',
        '00000000000',
        '000000',
        '', '', '', '', '', '', '', '', '',
        company.codigoMunicipioIbge || '',
      ),
    );

    // Register 0140 - Establishment
    lines.push(
      generateSpedLine(
        '0140',
        company.cnpj,
        company.razaoSocial,
        company.inscricaoMunicipal || '',
        company.uf || 'SP',
        company.inscricaoEstadual || '',
        company.codigoMunicipioIbge || '',
        '', // suframa
        '', // cnae
      ),
    );

    lines.push(generateSpedLine('0990', '5'));

    // =========================================================================
    // BLOCO A - Documentos Fiscais (Servicos)
    // =========================================================================

    lines.push(generateSpedLine('A001', '0'));

    // Register A100 - NFS-e documents (placeholder)
    lines.push(
      generateSpedLine(
        'A100',
        '0', // ind tipo operacao: 0=receita
        '1', // ind emissao: 0=propria, 1=terceiros
        '', // cod participante
        '', // cod situacao
        '', // serie
        '', // subserie
        '', // numero
        '', // chave nfse
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoInicio),
        formatSpedDecimal(0), // valor total
        '1', // ind pagamento
        formatSpedDecimal(0), // valor desconto
        formatSpedDecimal(0), // valor servicos
        formatSpedDecimal(0), // BC PIS
        formatSpedDecimal(0), // valor PIS
        formatSpedDecimal(0), // BC COFINS
        formatSpedDecimal(0), // valor COFINS
      ),
    );

    // Register A170 - Service items (placeholder)
    lines.push(
      generateSpedLine(
        'A170',
        '1', // numero item
        '', // cod item
        'SERVICO EXEMPLO',
        formatSpedDecimal(0), // valor item
        formatSpedDecimal(0), // desconto
        '01', // natureza BC credito
        '50', // indicador origem credito
        '01', // CST PIS
        formatSpedDecimal(0), // BC PIS
        formatSpedDecimal(1.65), // aliq PIS
        formatSpedDecimal(0), // valor PIS
        '01', // CST COFINS
        formatSpedDecimal(0), // BC COFINS
        formatSpedDecimal(7.6), // aliq COFINS
        formatSpedDecimal(0), // valor COFINS
        '', // cod conta
        '', // cod CTA
      ),
    );

    lines.push(generateSpedLine('A990', '4'));

    // =========================================================================
    // BLOCO C - Documentos Fiscais (Mercadorias)
    // =========================================================================

    lines.push(generateSpedLine('C001', '0'));

    // Register C100 - NF-e documents (placeholder)
    lines.push(
      generateSpedLine(
        'C100',
        '0', // ind operacao
        '1', // ind emitente
        '', // cod participante
        '55', // modelo
        '00', // situacao
        '001', // serie
        '000000001',
        '', // chave acesso
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoInicio),
        formatSpedDecimal(0),
        '0',
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
      ),
    );

    // Register C170 - Items (placeholder)
    lines.push(
      generateSpedLine(
        'C170',
        '1',
        'PROD001',
        'PRODUTO EXEMPLO',
        formatSpedDecimal(1),
        'UN',
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        '50', // CST PIS
        formatSpedDecimal(0),
        formatSpedDecimal(1.65),
        formatSpedDecimal(0),
        '50', // CST COFINS
        formatSpedDecimal(0),
        formatSpedDecimal(7.6),
        formatSpedDecimal(0),
      ),
    );

    lines.push(generateSpedLine('C990', '4'));

    // =========================================================================
    // BLOCO M - Apuracao PIS e COFINS
    // =========================================================================

    lines.push(generateSpedLine('M001', '0'));

    // Register M100 - PIS credit
    lines.push(
      generateSpedLine(
        'M100',
        '01', // cod credito
        '0', // ind credito origem
        formatSpedDecimal(0), // valor BC
        formatSpedDecimal(1.65), // aliq
        formatSpedDecimal(0), // valor credito
        formatSpedDecimal(0), // valor credito ajustado
        '', // saldo credor
        '', // indicador
        formatSpedDecimal(0), // valor credito descontado
        '', // saldo credor transportar
      ),
    );

    // Register M200 - PIS consolidation
    lines.push(
      generateSpedLine(
        'M200',
        formatSpedDecimal(0), // valor total contrib nao cumulativa
        formatSpedDecimal(0), // valor total contrib cumulativa
        formatSpedDecimal(0), // valor total contrib
        formatSpedDecimal(0), // valor retencao nao cumulativa
        formatSpedDecimal(0), // valor retencao cumulativa
        formatSpedDecimal(0), // valor retencao
        formatSpedDecimal(0), // valor deducoes
        formatSpedDecimal(0), // valor contrib devida
        formatSpedDecimal(0), // valor saldo credor anterior
        formatSpedDecimal(0), // saldo credor transportar
        formatSpedDecimal(0), // valor contrib a pagar
      ),
    );

    // Register M500 - COFINS credit
    lines.push(
      generateSpedLine(
        'M500',
        '01', // cod credito
        '0',
        formatSpedDecimal(0),
        formatSpedDecimal(7.6),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        '',
        '',
        formatSpedDecimal(0),
        '',
      ),
    );

    // Register M600 - COFINS consolidation
    lines.push(
      generateSpedLine(
        'M600',
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
        formatSpedDecimal(0),
      ),
    );

    lines.push(generateSpedLine('M990', '6'));

    // =========================================================================
    // BLOCO 9 - Encerramento
    // =========================================================================

    lines.push(generateSpedLine('9001', '0'));
    lines.push(generateSpedLine('9900', '0000', '1'));
    lines.push(generateSpedLine('9900', '9001', '1'));
    lines.push(generateSpedLine('9900', '9900', '3'));
    lines.push(generateSpedLine('9900', '9990', '1'));
    lines.push(generateSpedLine('9900', '9999', '1'));
    lines.push(generateSpedLine('9990', '7'));
    lines.push(generateSpedLine('9999', (lines.length + 1).toString()));

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
      `[SpedContribuicoes] Generated EFD PIS/COFINS file for ${company.razaoSocial} (${lines.length} lines)`,
    );

    return fileContent;
  }
}
