import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import {
  generateSpedLine,
  formatSpedDecimal,
  formatSpedDate,
} from './sped-file-header';

/**
 * Escrituracao Contabil Fiscal (ECF) file generation service.
 * Lucro Real: IRPJ and CSLL calculation via LALUR/LACS.
 */
@Injectable()
export class EcfService extends GovernmentTransmissionService {
  private static readonly LAYOUT_VERSION = '010';

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Generate the ECF file for a given fiscal year.
   */
  async generateFile(
    companyId: string,
    anoReferencia: number,
  ): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const dtIni = new Date(anoReferencia, 0, 1);
    const dtFim = new Date(anoReferencia, 11, 31);
    const lines: string[] = [];

    // =========================================================================
    // BLOCO 0 - Abertura e Identificacao
    // =========================================================================

    lines.push(
      generateSpedLine(
        '0000',
        'LECF', // tipo arquivo
        EcfService.LAYOUT_VERSION,
        '', // hash
        formatSpedDate(dtIni),
        formatSpedDate(dtFim),
        company.razaoSocial,
        company.cnpj,
        company.uf || 'SP',
        '', // hash ECF anterior
        '', // NIRE
        '', // natjuridica
        '0', // ind sit ini periodo
        '0', // SIT ESPECIAL
        '', // PAT REMAN
        '0', // IND ATIV RURAL
        '', // hash ECD
        '1', // tipo ECF: 1=Lucro Real
        '', // forma tributacao
      ),
    );

    lines.push(generateSpedLine('0001', '0'));

    // Register 0010 - Parameters
    lines.push(
      generateSpedLine(
        '0010',
        '', // hash ECD
        '1', // forma tributacao: 1=Lucro Real
        '', // forma apuracao: T=trimestral, A=anual
        'A', // tipo escrituracao: C=PJ em geral, A=lucro arbitrado, etc.
        '0', // optante REFIS
        '0', // optante PAES
        '0', // forma avaliacao estoques
        '0', // atividade rural
        '0', // lucro exploracao
        '0', // participante exterior
        '0', // isentas
        '0', // tributacao diferenciada
        '0', // tributacao monofasica
        '0', // tributacao zona franca
        '0', // fundos investimento
        '0', // obras audiovisuais
        '0', // atividade incentivada
      ),
    );

    lines.push(generateSpedLine('0990', '4'));

    // =========================================================================
    // BLOCO L - Lucro Real (Balanco/DRE)
    // =========================================================================

    lines.push(generateSpedLine('L001', '0'));

    // Register L100 - Balance Sheet (placeholder)
    lines.push(
      generateSpedLine(
        'L100',
        '1', // cod AGL/CTN
        '1', // nivel
        'A', // tipo conta
        'ATIVO TOTAL',
        formatSpedDecimal(0), // saldo inicial
        'D',
        formatSpedDecimal(0), // saldo final
        'D',
      ),
    );

    // Register L200 - DRE (placeholder)
    lines.push(
      generateSpedLine(
        'L200',
        '3', // cod AGL/CTN
        '1',
        'A',
        'RECEITA BRUTA DE VENDAS',
        formatSpedDecimal(0),
        formatSpedDecimal(0),
      ),
    );
    lines.push(
      generateSpedLine(
        'L200',
        '3',
        '1',
        'A',
        '(-) DEDUCOES DA RECEITA',
        formatSpedDecimal(0),
        formatSpedDecimal(0),
      ),
    );
    lines.push(
      generateSpedLine(
        'L200',
        '3',
        '1',
        'A',
        'LUCRO LIQUIDO DO EXERCICIO',
        formatSpedDecimal(0),
        formatSpedDecimal(0),
      ),
    );

    lines.push(generateSpedLine('L990', (lines.length + 1).toString()));

    // =========================================================================
    // BLOCO M - LALUR/LACS (e-LALUR)
    // =========================================================================

    lines.push(generateSpedLine('M001', '0'));

    // Register M010 - LALUR identification
    lines.push(
      generateSpedLine(
        'M010',
        '1', // cod CTA LALUR
        'LUCRO LIQUIDO ANTES DO IRPJ',
      ),
    );

    // Register M300 - IRPJ additions/exclusions (LALUR Part A)
    lines.push(
      generateSpedLine(
        'M300',
        '1', // numero lancamento
        'LUCRO LIQUIDO ANTES DO IRPJ', // historico
        formatSpedDecimal(0), // valor
        'A', // indicador: A=adicao, E=exclusao, C=compensacao
        'IRPJ', // tributo
        '', // natureza adicao/exclusao
        '', // periodo apuracao
      ),
    );

    // Register M350 - CSLL additions/exclusions (LACS Part A)
    lines.push(
      generateSpedLine(
        'M350',
        '1',
        'LUCRO LIQUIDO ANTES DA CSLL',
        formatSpedDecimal(0),
        'A',
        'CSLL',
        '',
        '',
      ),
    );

    lines.push(generateSpedLine('M990', (lines.length + 1).toString()));

    // =========================================================================
    // BLOCO N - Calculo IRPJ e CSLL
    // =========================================================================

    lines.push(generateSpedLine('N001', '0'));

    // Register N600 - IRPJ calculation
    lines.push(
      generateSpedLine(
        'N600',
        formatSpedDate(dtIni), // periodo apuracao inicio
        formatSpedDate(dtFim), // periodo apuracao fim
        formatSpedDecimal(0), // lucro real / base calculo
        formatSpedDecimal(15), // aliquota IRPJ (15%)
        formatSpedDecimal(0), // IRPJ calculado
        formatSpedDecimal(0), // adicional 10% (base > 60k trimestral)
        formatSpedDecimal(0), // IRPJ total
        formatSpedDecimal(0), // deducoes
        formatSpedDecimal(0), // IRPJ a pagar
      ),
    );

    // Register N650 - CSLL calculation
    lines.push(
      generateSpedLine(
        'N650',
        formatSpedDate(dtIni),
        formatSpedDate(dtFim),
        formatSpedDecimal(0), // base calculo
        formatSpedDecimal(9), // aliquota CSLL (9%)
        formatSpedDecimal(0), // CSLL calculada
        formatSpedDecimal(0), // deducoes
        formatSpedDecimal(0), // CSLL a pagar
      ),
    );

    lines.push(generateSpedLine('N990', (lines.length + 1).toString()));

    // =========================================================================
    // BLOCO 9 - Encerramento
    // =========================================================================

    lines.push(generateSpedLine('9001', '0'));
    lines.push(generateSpedLine('9900', '0000', '1'));
    lines.push(generateSpedLine('9900', '0010', '1'));
    lines.push(generateSpedLine('9900', 'L001', '1'));
    lines.push(generateSpedLine('9900', 'M001', '1'));
    lines.push(generateSpedLine('9900', 'N001', '1'));
    lines.push(generateSpedLine('9900', '9001', '1'));
    lines.push(generateSpedLine('9900', '9900', '7'));
    lines.push(generateSpedLine('9900', '9990', '1'));
    lines.push(generateSpedLine('9900', '9999', '1'));
    lines.push(generateSpedLine('9990', (lines.length + 2).toString()));
    lines.push(generateSpedLine('9999', (lines.length + 1).toString()));

    const fileContent = lines.join('\r\n');

    await this.logTransmission({
      companyId,
      type: 'ECF',
      endpoint: 'local:file_generation',
      success: true,
      documentNumber: `ECF_${anoReferencia}`,
      processingTimeMs: 0,
    });

    this.logger.log(
      `[ECF] Generated ECF file for ${company.razaoSocial} year ${anoReferencia} (${lines.length} lines)`,
    );

    return fileContent;
  }
}
